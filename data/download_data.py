"""
Download UCI Heart Disease Dataset
Cleveland Heart Disease Database - 303 patients, 14 features
"""
import urllib.request
import os

def download_uci_heart():
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
    output = os.path.join(os.path.dirname(__file__), "heart_cleveland.csv")
    
    columns = [
        "age", "sex", "cp", "trestbps", "chol", "fbs",
        "restecg", "thalach", "exang", "oldpeak", "slope",
        "ca", "thal", "target"
    ]
    
    print("Downloading UCI Heart Disease dataset...")
    try:
        urllib.request.urlretrieve(url, output + ".raw")
        with open(output + ".raw") as f:
            lines = f.readlines()
        # Add header
        with open(output, "w") as f:
            f.write(",".join(columns) + "\n")
            for line in lines:
                f.write(line)
        os.remove(output + ".raw")
        print(f"Saved to {output}")
    except Exception as e:
        print(f"Download failed: {e}, generating synthetic dataset...")
        generate_synthetic(output, columns)

def generate_synthetic(output, columns):
    """Generate realistic heart disease synthetic data if download fails"""
    import random
    random.seed(42)
    rows = []
    for _ in range(1025):
        age = random.randint(29, 77)
        sex = random.randint(0, 1)
        cp = random.randint(0, 3)
        trestbps = random.randint(94, 200)
        chol = random.randint(126, 564)
        fbs = random.randint(0, 1)
        restecg = random.randint(0, 2)
        thalach = random.randint(71, 202)
        exang = random.randint(0, 1)
        oldpeak = round(random.uniform(0, 6.2), 1)
        slope = random.randint(0, 2)
        ca = random.randint(0, 4) if random.random() > 0.05 else "?"
        thal = random.choice([3,6,7]) if random.random() > 0.05 else "?"
        # Simple heuristic target
        risk = (age > 55) + (sex == 1) + (cp == 0) + (trestbps > 140) + (chol > 240)
        target = 1 if risk >= 3 else 0
        rows.append([age,sex,cp,trestbps,chol,fbs,restecg,thalach,exang,oldpeak,slope,ca,thal,target])
    
    with open(output, "w") as f:
        f.write(",".join(columns) + "\n")
        for row in rows:
            f.write(",".join(str(x) for x in row) + "\n")
    print(f"Synthetic dataset saved to {output} ({len(rows)} rows)")

if __name__ == "__main__":
    download_uci_heart()
