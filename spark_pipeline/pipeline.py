"""
HeartGuard - Apache Spark ML Pipeline
Big Data Analytics for Heart Disease Prediction
Implements: Logistic Regression, Random Forest, Gradient Boosted Trees
Saves: model artifacts, metrics JSON, feature importance JSON
"""

import os
import sys
import json
import time
import shutil
from datetime import datetime

# ── Spark imports ──────────────────────────────────────────────────────────────
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, StringType
from pyspark.ml import Pipeline
from pyspark.ml.feature import (
    VectorAssembler, StandardScaler, StringIndexer, Imputer
)
from pyspark.ml.classification import (
    LogisticRegression,
    RandomForestClassifier,
    GBTClassifier
)
from pyspark.ml.evaluation import (
    BinaryClassificationEvaluator,
    MulticlassClassificationEvaluator
)
from pyspark.ml.tuning import CrossValidator, ParamGridBuilder

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "data", "heart_cleveland.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

FEATURE_COLS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs",
    "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]

FEATURE_LABELS = {
    "age":      "Age",
    "sex":      "Sex",
    "cp":       "Chest Pain Type",
    "trestbps": "Resting BP",
    "chol":     "Cholesterol",
    "fbs":      "Fasting Blood Sugar",
    "restecg":  "Resting ECG",
    "thalach":  "Max Heart Rate",
    "exang":    "Exercise Angina",
    "oldpeak":  "ST Depression",
    "slope":    "ST Slope",
    "ca":       "Major Vessels",
    "thal":     "Thalassemia"
}

def build_spark():
    return (SparkSession.builder
        .appName("HeartGuard-BDA")
        .master("local[*]")
        .config("spark.driver.memory", "2g")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.ui.enabled", "false")
        .getOrCreate())

def load_and_clean(spark):
    print("\n[1/6] Loading & cleaning data...")
    df = spark.read.csv(DATA_PATH, header=True, inferSchema=True)
    
    # Replace '?' with null
    for col in FEATURE_COLS:
        df = df.withColumn(col,
            F.when(F.col(col).cast("string") == "?", None)
             .otherwise(F.col(col).cast(DoubleType()))
        )
    
    # Binarize target: 0 = no disease, 1 = disease
    df = df.withColumn("label",
        F.when(F.col("target") > 0, 1.0).otherwise(0.0)
    ).drop("target")
    
    total = df.count()
    pos   = df.filter(F.col("label") == 1).count()
    neg   = total - pos
    print(f"   Total: {total} | Positive: {pos} | Negative: {neg}")
    return df, {"total": total, "positive": int(pos), "negative": int(neg)}

def build_pipeline(model_name, model_obj):
    imputer = Imputer(
        inputCols=FEATURE_COLS,
        outputCols=[f"{c}_imp" for c in FEATURE_COLS],
        strategy="median"
    )
    imputed_cols = [f"{c}_imp" for c in FEATURE_COLS]
    assembler = VectorAssembler(inputCols=imputed_cols, outputCol="raw_features")
    scaler    = StandardScaler(inputCol="raw_features", outputCol="features",
                               withMean=True, withStd=True)
    return Pipeline(stages=[imputer, assembler, scaler, model_obj])

def evaluate(model, test_df, name):
    preds = model.transform(test_df)
    
    bin_eval = BinaryClassificationEvaluator(labelCol="label")
    mc_eval  = MulticlassClassificationEvaluator(labelCol="label")
    
    auc       = bin_eval.evaluate(preds, {bin_eval.metricName: "areaUnderROC"})
    pr_auc    = bin_eval.evaluate(preds, {bin_eval.metricName: "areaUnderPR"})
    accuracy  = mc_eval.evaluate(preds,  {mc_eval.metricName: "accuracy"})
    f1        = mc_eval.evaluate(preds,  {mc_eval.metricName: "f1"})
    precision = mc_eval.evaluate(preds,  {mc_eval.metricName: "weightedPrecision"})
    recall    = mc_eval.evaluate(preds,  {mc_eval.metricName: "weightedRecall"})
    
    # Confusion matrix
    cm = preds.groupBy("label", "prediction").count().collect()
    confusion = {f"{int(r.label)}_{int(r.prediction)}": r["count"] for r in cm}
    tp = confusion.get("1_1", 0)
    tn = confusion.get("0_0", 0)
    fp = confusion.get("0_1", 0)
    fn = confusion.get("1_0", 0)
    
    metrics = {
        "model":     name,
        "auc":       round(auc, 4),
        "pr_auc":    round(pr_auc, 4),
        "accuracy":  round(accuracy, 4),
        "f1":        round(f1, 4),
        "precision": round(precision, 4),
        "recall":    round(recall, 4),
        "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn}
    }
    print(f"   {name}: AUC={auc:.4f} | Acc={accuracy:.4f} | F1={f1:.4f}")
    return metrics, preds

def get_feature_importance(model, model_name):
    """Extract feature importances from tree-based models"""
    try:
        stages = model.stages
        clf = stages[-1]
        if hasattr(clf, "featureImportances"):
            importances = clf.featureImportances.toArray().tolist()
            return [
                {"feature": FEATURE_LABELS.get(f, f), "key": f, "importance": round(v, 6)}
                for f, v in zip(FEATURE_COLS, importances)
            ]
    except:
        pass
    return []

def get_roc_points(model, test_df):
    """Sample ROC curve points"""
    from pyspark.ml.evaluation import BinaryClassificationEvaluator
    preds = model.transform(test_df)
    # Collect probability scores
    rows = preds.select("label", "probability").collect()
    scores = []
    for r in rows:
        scores.append({"label": int(r["label"]), "prob": float(r["probability"][1])})
    # Sort by prob descending and compute TPR/FPR
    scores.sort(key=lambda x: -x["prob"])
    total_pos = sum(1 for s in scores if s["label"] == 1)
    total_neg = len(scores) - total_pos
    tp = fp = 0
    roc = [{"fpr": 0.0, "tpr": 0.0}]
    step = max(1, len(scores) // 50)
    for i, s in enumerate(scores):
        if s["label"] == 1: tp += 1
        else:                fp += 1
        if (i + 1) % step == 0:
            roc.append({
                "fpr": round(fp / max(total_neg, 1), 4),
                "tpr": round(tp / max(total_pos, 1), 4)
            })
    roc.append({"fpr": 1.0, "tpr": 1.0})
    return roc

def run_pipeline():
    t0 = time.time()
    spark = build_spark()
    spark.sparkContext.setLogLevel("ERROR")
    
    df, data_stats = load_and_clean(spark)
    
    # Train/test split
    train_df, test_df = df.randomSplit([0.8, 0.2], seed=42)
    train_df.cache()
    test_df.cache()
    print(f"   Train: {train_df.count()} | Test: {test_df.count()}")
    
    # ── Models ────────────────────────────────────────────────────────────────
    print("\n[2/6] Training Logistic Regression...")
    lr = LogisticRegression(featuresCol="features", labelCol="label",
                            maxIter=100, regParam=0.01, elasticNetParam=0.0)
    lr_pipeline = build_pipeline("LR", lr)
    lr_model = lr_pipeline.fit(train_df)
    lr_metrics, _ = evaluate(lr_model, test_df, "Logistic Regression")
    lr_roc = get_roc_points(lr_model, test_df)
    
    print("\n[3/6] Training Random Forest...")
    rf = RandomForestClassifier(featuresCol="features", labelCol="label",
                                numTrees=100, maxDepth=8, seed=42)
    rf_pipeline = build_pipeline("RF", rf)
    rf_model = rf_pipeline.fit(train_df)
    rf_metrics, _ = evaluate(rf_model, test_df, "Random Forest")
    rf_fi  = get_feature_importance(rf_model, "RF")
    rf_roc = get_roc_points(rf_model, test_df)
    
    print("\n[4/6] Training Gradient Boosted Trees...")
    gbt = GBTClassifier(featuresCol="features", labelCol="label",
                        maxIter=50, maxDepth=5, seed=42)
    gbt_pipeline = build_pipeline("GBT", gbt)
    gbt_model = gbt_pipeline.fit(train_df)
    gbt_metrics, _ = evaluate(gbt_model, test_df, "GBT")
    gbt_fi  = get_feature_importance(gbt_model, "GBT")
    gbt_roc = get_roc_points(gbt_model, test_df)
    
    # ── EDA stats ─────────────────────────────────────────────────────────────
    print("\n[5/6] Computing EDA statistics...")
    eda = {}
    for col in FEATURE_COLS:
        stats = df.select(
            F.mean(col).alias("mean"),
            F.stddev(col).alias("std"),
            F.min(col).alias("min"),
            F.max(col).alias("max")
        ).first()
        eda[col] = {
            "label": FEATURE_LABELS.get(col, col),
            "mean":  round(float(stats["mean"] or 0), 3),
            "std":   round(float(stats["std"]  or 0), 3),
            "min":   round(float(stats["min"]  or 0), 3),
            "max":   round(float(stats["max"]  or 0), 3),
        }
    
    # Age distribution
    age_dist = (df.withColumn("age_group",
                    F.concat(
                        (F.floor(F.col("age")/10)*10).cast("string"),
                        F.lit("s")
                    ))
                .groupBy("age_group")
                .agg(
                    F.count("*").alias("total"),
                    F.sum("label").alias("disease")
                )
                .orderBy("age_group")
                .collect())
    age_data = [{"group": r["age_group"],
                 "total": r["total"],
                 "disease": int(r["disease"])} for r in age_dist]
    
    # Feature correlation with label
    corr = {}
    for col in FEATURE_COLS:
        try:
            c = df.stat.corr(col, "label")
            corr[col] = round(c, 4)
        except:
            corr[col] = 0.0
    
    # ── Save artifacts ─────────────────────────────────────────────────────────
    print("\n[6/6] Saving artifacts...")
    os.makedirs(MODEL_DIR,  exist_ok=True)
    os.makedirs(REPORT_DIR, exist_ok=True)
    
    # Save best model (GBT usually best)
    best_model_path = os.path.join(MODEL_DIR, "gbt_model")
    if os.path.exists(best_model_path):
        shutil.rmtree(best_model_path)
    gbt_model.save(best_model_path)
    
    elapsed = round(time.time() - t0, 2)
    
    results = {
        "timestamp":   datetime.now().isoformat(),
        "elapsed_sec": elapsed,
        "data_stats":  data_stats,
        "eda":         eda,
        "age_dist":    age_data,
        "correlation": corr,
        "models": [lr_metrics, rf_metrics, gbt_metrics],
        "roc_curves": {
            "Logistic Regression": lr_roc,
            "Random Forest":       rf_roc,
            "Gradient Boosted Trees": gbt_roc
        },
        "feature_importance": {
            "Random Forest": rf_fi,
            "Gradient Boosted Trees": gbt_fi
        }
    }
    
    out_path = os.path.join(REPORT_DIR, "results.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✅ Done in {elapsed}s. Results → {out_path}")
    
    spark.stop()
    return results

if __name__ == "__main__":
    run_pipeline()
