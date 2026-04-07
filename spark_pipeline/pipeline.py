"""
VitalFlow – Apache Spark ML Pipeline
Production-grade cardiovascular risk analytics
Author: ML Engineering · EXL Analytics
"""

import os, sys, json, time, shutil
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler, StandardScaler, Imputer, QuantileDiscretizer
from pyspark.ml.classification import (
    LogisticRegression, RandomForestClassifier, GBTClassifier, LinearSVC
)
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator
from pyspark.ml.tuning import CrossValidator, ParamGridBuilder

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "data", "framingham.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

FEATURE_COLS = [
    "male", "age", "education", "currentSmoker", "cigsPerDay",
    "BPMeds", "prevalentStroke", "prevalentHyp", "diabetes",
    "totChol", "sysBP", "diaBP", "BMI", "heartRate", "glucose"
]

FEATURE_LABELS = {
    "male":             "Sex (Male)",
    "age":              "Age",
    "education":        "Education Level",
    "currentSmoker":    "Current Smoker",
    "cigsPerDay":       "Cigarettes/Day",
    "BPMeds":           "BP Medication",
    "prevalentStroke":  "Prior Stroke",
    "prevalentHyp":     "Hypertension",
    "diabetes":         "Diabetes",
    "totChol":          "Total Cholesterol",
    "sysBP":            "Systolic BP",
    "diaBP":            "Diastolic BP",
    "BMI":              "BMI",
    "heartRate":        "Heart Rate",
    "glucose":          "Glucose Level"
}


def build_spark():
    return (SparkSession.builder
        .appName("VitalFlow-CVD-Analytics")
        .master("local[*]")
        .config("spark.driver.memory", "3g")
        .config("spark.executor.memory", "2g")
        .config("spark.sql.shuffle.partitions", "16")
        .config("spark.ui.enabled", "false")
        .config("spark.driver.extraJavaOptions", "-Xss4M")
        .getOrCreate())


def load_and_clean(spark):
    print("\n[1/7] Ingesting & cleaning Framingham dataset...")
    df = spark.read.csv(DATA_PATH, header=True, inferSchema=True)

    # Drop rows where target is null
    df = df.filter(F.col("TenYearCHD").isNotNull())

    # Cast all feature cols to DoubleType, coerce nulls
    for col in FEATURE_COLS:
        df = df.withColumn(col,
            F.when(F.col(col).cast("string").isin("NA", "NaN", "null", ""), None)
             .otherwise(F.col(col).cast(DoubleType()))
        )

    df = df.withColumn("label", F.col("TenYearCHD").cast(DoubleType()))
    df = df.drop("TenYearCHD")

    total = df.count()
    pos   = df.filter(F.col("label") == 1).count()
    neg   = total - pos
    print(f"   Rows: {total} | CHD Positive: {pos} ({round(pos/total*100,1)}%) | Negative: {neg}")
    return df, {"total": int(total), "positive": int(pos), "negative": int(neg)}


def compute_eda(df):
    print("\n[2/7] Computing EDA statistics via Spark DataFrame API...")
    eda = {}
    for col in FEATURE_COLS:
        row = df.select(
            F.mean(col).alias("mean"),
            F.stddev(col).alias("std"),
            F.min(col).alias("min"),
            F.max(col).alias("max"),
            F.expr(f"percentile_approx(`{col}`, 0.5)").alias("median")
        ).first()
        eda[col] = {
            "label":  FEATURE_LABELS.get(col, col),
            "mean":   round(float(row["mean"]  or 0), 3),
            "std":    round(float(row["std"]   or 0), 3),
            "min":    round(float(row["min"]   or 0), 3),
            "max":    round(float(row["max"]   or 0), 3),
            "median": round(float(row["median"]or 0), 3),
        }

    # Age distribution
    age_dist_rows = (df
        .withColumn("age_group", F.concat((F.floor(F.col("age")/10)*10).cast("string"), F.lit("s")))
        .groupBy("age_group")
        .agg(F.count("*").alias("total"), F.sum("label").alias("chd"))
        .orderBy("age_group")
        .collect())
    age_dist = [{"group": r["age_group"], "total": int(r["total"]), "chd": int(r["chd"])}
                for r in age_dist_rows]

    # Pearson correlations with label
    corr = {}
    for col in FEATURE_COLS:
        try:
            c = df.stat.corr(col, "label")
            corr[col] = round(c, 4)
        except:
            corr[col] = 0.0

    # Smoking vs CHD breakdown
    smoke_rows = (df.groupBy("currentSmoker")
                    .agg(F.count("*").alias("total"), F.sum("label").alias("chd"))
                    .orderBy("currentSmoker").collect())
    smoke_dist = [{"smoker": int(r["currentSmoker"] or 0), "total": int(r["total"]), "chd": int(r["chd"])}
                  for r in smoke_rows]

    # BP category breakdown
    bp_rows = (df
        .withColumn("bp_cat",
            F.when(F.col("sysBP") < 120, "Normal")
             .when(F.col("sysBP") < 130, "Elevated")
             .when(F.col("sysBP") < 140, "Stage 1")
             .otherwise("Stage 2"))
        .groupBy("bp_cat")
        .agg(F.count("*").alias("total"), F.sum("label").alias("chd"))
        .collect())
    bp_dist = [{"category": r["bp_cat"], "total": int(r["total"]), "chd": int(r["chd"])}
               for r in bp_rows]

    return eda, age_dist, corr, smoke_dist, bp_dist


def build_ml_pipeline(clf):
    imputer = Imputer(
        inputCols=FEATURE_COLS,
        outputCols=[f"{c}_imp" for c in FEATURE_COLS],
        strategy="median"
    )
    assembler = VectorAssembler(
        inputCols=[f"{c}_imp" for c in FEATURE_COLS],
        outputCol="raw_features",
        handleInvalid="skip"
    )
    scaler = StandardScaler(inputCol="raw_features", outputCol="features",
                            withMean=True, withStd=True)
    return Pipeline(stages=[imputer, assembler, scaler, clf])


def evaluate_model(model, test_df, name):
    preds = model.transform(test_df)
    bin_eval = BinaryClassificationEvaluator(labelCol="label")
    mc_eval  = MulticlassClassificationEvaluator(labelCol="label")

    auc      = bin_eval.evaluate(preds, {bin_eval.metricName: "areaUnderROC"})
    pr_auc   = bin_eval.evaluate(preds, {bin_eval.metricName: "areaUnderPR"})
    accuracy = mc_eval.evaluate(preds,  {mc_eval.metricName: "accuracy"})
    f1       = mc_eval.evaluate(preds,  {mc_eval.metricName: "f1"})
    prec     = mc_eval.evaluate(preds,  {mc_eval.metricName: "weightedPrecision"})
    rec      = mc_eval.evaluate(preds,  {mc_eval.metricName: "weightedRecall"})

    cm = preds.groupBy("label", "prediction").count().collect()
    confusion = {f"{int(r.label)}_{int(r.prediction)}": r["count"] for r in cm}
    tp = confusion.get("1_1", 0); tn = confusion.get("0_0", 0)
    fp = confusion.get("0_1", 0); fn = confusion.get("1_0", 0)

    metrics = {
        "model":     name,
        "auc":       round(auc, 4),
        "pr_auc":    round(pr_auc, 4),
        "accuracy":  round(accuracy, 4),
        "f1":        round(f1, 4),
        "precision": round(prec, 4),
        "recall":    round(rec, 4),
        "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn}
    }
    print(f"   {name:32s} | AUC={auc:.4f} | Acc={accuracy:.4f} | F1={f1:.4f}")
    return metrics, preds


def get_roc_points(model, test_df, n_pts=60):
    preds = model.transform(test_df)
    rows  = preds.select("label", "probability").collect()
    scores = [{"label": int(r["label"]), "prob": float(r["probability"][1])} for r in rows]
    scores.sort(key=lambda x: -x["prob"])
    pos_total = sum(1 for s in scores if s["label"] == 1)
    neg_total = len(scores) - pos_total
    tp = fp = 0
    roc = [{"fpr": 0.0, "tpr": 0.0}]
    step = max(1, len(scores) // n_pts)
    for i, s in enumerate(scores):
        if s["label"] == 1: tp += 1
        else:                fp += 1
        if (i + 1) % step == 0:
            roc.append({"fpr": round(fp / max(neg_total, 1), 4),
                        "tpr": round(tp / max(pos_total, 1), 4)})
    roc.append({"fpr": 1.0, "tpr": 1.0})
    return roc


def get_feature_importance(model):
    try:
        clf = model.stages[-1]
        if hasattr(clf, "featureImportances"):
            imp = clf.featureImportances.toArray().tolist()
            return [{"feature": FEATURE_LABELS.get(f, f), "key": f, "importance": round(v, 6)}
                    for f, v in zip(FEATURE_COLS, imp)]
    except:
        pass
    return []


def run():
    t0 = time.time()
    spark = build_spark()
    spark.sparkContext.setLogLevel("ERROR")

    df, data_stats = load_and_clean(spark)
    eda, age_dist, corr, smoke_dist, bp_dist = compute_eda(df)

    # Class-weight oversampling for imbalance
    pos_ratio = data_stats["positive"] / data_stats["total"]
    neg_ratio = 1 - pos_ratio

    train_df, test_df = df.randomSplit([0.80, 0.20], seed=42)
    train_df.cache(); test_df.cache()
    print(f"\n[3/7] Split → Train: {train_df.count()} | Test: {test_df.count()}")

    # ── Model 1: Logistic Regression with ElasticNet ──────────────────────────
    print("\n[4/7] Training Logistic Regression (ElasticNet regularized)...")
    lr = LogisticRegression(featuresCol="features", labelCol="label",
                            maxIter=200, regParam=0.005, elasticNetParam=0.3,
                            threshold=0.42)
    lr_model = build_ml_pipeline(lr).fit(train_df)
    lr_metrics, _ = evaluate_model(lr_model, test_df, "Logistic Regression")
    lr_roc = get_roc_points(lr_model, test_df)

    # ── Model 2: Random Forest ────────────────────────────────────────────────
    print("\n[5/7] Training Random Forest Ensemble...")
    rf = RandomForestClassifier(featuresCol="features", labelCol="label",
                                numTrees=150, maxDepth=10, minInstancesPerNode=5,
                                featureSubsetStrategy="sqrt", seed=42)
    rf_model = build_ml_pipeline(rf).fit(train_df)
    rf_metrics, _ = evaluate_model(rf_model, test_df, "Random Forest")
    rf_roc = get_roc_points(rf_model, test_df)
    rf_fi  = get_feature_importance(rf_model)

    # ── Model 3: Gradient Boosted Trees ──────────────────────────────────────
    print("\n[6/7] Training Gradient Boosted Trees (GBTClassifier)...")
    gbt = GBTClassifier(featuresCol="features", labelCol="label",
                        maxIter=80, maxDepth=6, stepSize=0.08,
                        subsamplingRate=0.8, seed=42)
    gbt_model = build_ml_pipeline(gbt).fit(train_df)
    gbt_metrics, _ = evaluate_model(gbt_model, test_df, "Gradient Boosted Trees")
    gbt_roc = get_roc_points(gbt_model, test_df)
    gbt_fi  = get_feature_importance(gbt_model)

    # ── Save best model ───────────────────────────────────────────────────────
    print("\n[7/7] Persisting model artifacts...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(REPORT_DIR, exist_ok=True)
    best_path = os.path.join(MODEL_DIR, "gbt_cvd_v1")
    if os.path.exists(best_path): shutil.rmtree(best_path)
    gbt_model.save(best_path)

    elapsed = round(time.time() - t0, 2)

    results = {
        "timestamp":    datetime.now().isoformat(),
        "elapsed_sec":  elapsed,
        "dataset":      "Framingham Heart Study",
        "data_stats":   data_stats,
        "eda":          eda,
        "age_dist":     age_dist,
        "correlation":  corr,
        "smoke_dist":   smoke_dist,
        "bp_dist":      bp_dist,
        "models":       [lr_metrics, rf_metrics, gbt_metrics],
        "roc_curves": {
            "Logistic Regression":    lr_roc,
            "Random Forest":          rf_roc,
            "Gradient Boosted Trees": gbt_roc,
        },
        "feature_importance": {
            "Random Forest":          rf_fi,
            "Gradient Boosted Trees": gbt_fi,
        }
    }

    out = os.path.join(REPORT_DIR, "results.json")
    with open(out, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  VitalFlow pipeline complete in {elapsed}s")
    print(f"  Results → {out}")
    print(f"{'='*60}\n")
    spark.stop()
    return results


if __name__ == "__main__":
    run()
