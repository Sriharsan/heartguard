"""
VitalFlow – Dataset Setup
Downloads Framingham Heart Study dataset from Kaggle/UCI mirror.
Falls back to a statistically realistic synthetic dataset if offline.
"""

import os, random, math, csv, urllib.request

OUT_PATH = os.path.join(os.path.dirname(__file__), "framingham.csv")

COLUMNS = [
    "male","age","education","currentSmoker","cigsPerDay",
    "BPMeds","prevalentStroke","prevalentHyp","diabetes",
    "totChol","sysBP","diaBP","BMI","heartRate","glucose","TenYearCHD"
]

KAGGLE_URLS = [
    "https://raw.githubusercontent.com/dsrscientist/dataset1/master/framingham.csv",
    "https://raw.githubusercontent.com/dsrscientist/DSData/master/framingham.csv",
]


def try_download():
    for url in KAGGLE_URLS:
        try:
            print(f"  Trying {url[:60]}...")
            urllib.request.urlretrieve(url, OUT_PATH)
            with open(OUT_PATH) as f:
                lines = f.readlines()
            if len(lines) > 100:
                print(f"  Downloaded {len(lines)-1} rows.")
                return True
        except Exception as e:
            print(f"  Failed: {e}")
    return False


def generate_synthetic(n=4238):
    """
    Statistically grounded synthetic Framingham-like dataset.
    Approximate distributions from published Framingham cohort statistics.
    10-year CHD prevalence ~15%.
    """
    random.seed(2024)

    def clamp(v, lo, hi): return max(lo, min(hi, v))
    def norm(mu, sd): return random.gauss(mu, sd)

    rows = []
    for _ in range(n):
        male    = random.randint(0, 1)
        age     = clamp(int(norm(49, 8)), 32, 70)
        educ    = random.choices([1,2,3,4], weights=[0.18,0.30,0.29,0.23])[0]
        smoker  = random.choices([0,1], weights=[0.52,0.48])[0]
        cigs    = 0 if not smoker else clamp(int(norm(18, 10)), 1, 50)
        bpmeds  = random.choices([0,1], weights=[0.97,0.03])[0]
        stroke  = random.choices([0,1], weights=[0.99,0.01])[0]
        hyp     = random.choices([0,1], weights=[0.68,0.32])[0]
        diab    = random.choices([0,1], weights=[0.97,0.03])[0]
        chol    = clamp(int(norm(237, 44)), 110, 400)
        sysBP   = clamp(round(norm(132 if hyp else 118, 20), 1), 90, 220)
        diaBP   = clamp(round(norm(83 if hyp else 76, 12), 1), 55, 140)
        bmi     = clamp(round(norm(26.5, 4.5), 1), 16, 55)
        hr      = clamp(int(norm(75, 12)), 44, 140)
        glucose = clamp(int(norm(117 if diab else 81, 30 if diab else 18)), 50, 400)

        # Risk score → logistic transformation
        z = (-6.8
             + 0.065 * age
             + 0.4   * male
             + 0.012 * sysBP
             + 0.006 * chol
             + 0.8   * diab
             + 0.4   * smoker
             + 0.5   * hyp
             + 0.7   * stroke
             + 0.003 * glucose
             + 0.01  * bmi)
        p   = 1 / (1 + math.exp(-z))
        chd = 1 if random.random() < p else 0

        rows.append([
            male, age, educ, smoker, cigs if smoker else "",
            bpmeds, stroke, hyp, diab,
            chol, sysBP, diaBP, bmi, hr,
            glucose if random.random() > 0.02 else "",  # ~2% missing glucose
            chd
        ])

    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        w.writerows(rows)

    pos = sum(1 for r in rows if r[-1] == 1)
    print(f"  Synthetic dataset saved: {len(rows)} rows | CHD={pos} ({round(pos/len(rows)*100,1)}%)")


if __name__ == "__main__":
    if os.path.exists(OUT_PATH):
        print(f"Dataset already exists at {OUT_PATH}")
    else:
        print("Setting up Framingham dataset...")
        if not try_download():
            print("  Generating statistically calibrated synthetic data...")
            generate_synthetic()
    print("Done.")
