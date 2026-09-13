"""Train and export the learner-behavior classifier used by backend_server.py."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "learner_classifier.pkl"
DATASET_PATH = BASE_DIR / "telemetry_dataset.csv"

FEATURE_COLUMNS = [
    "total_time_seconds",
    "code_submissions",
    "submission_frequency_per_min",
    "code_structure_changes",
    "retries",
    "hint_requests",
    "experiments_started",
    "question_level_numeric",
    "accuracy_rate",
]
LABEL_COLUMN = "learner_type"


def generate_synthetic_dataset(num_samples: int = 1500) -> pd.DataFrame:
    """Create reproducible training data when a labeled CSV is not available."""
    rng = np.random.default_rng(42)
    records = []

    for _ in range(num_samples):
        experimental = rng.choice([False, True], p=[0.45, 0.55])
        if experimental:
            time_spent = rng.uniform(30, 400)
            submissions = int(rng.integers(4, 25))
            structure_changes = int(rng.integers(5, 40))
            retries = int(rng.integers(3, 15))
            hints = int(rng.integers(0, 3))
            experiments = int(rng.integers(2, 10))
            accuracy = rng.uniform(0.40, 0.95)
            learner_type = "Experimental Learner"
        else:
            time_spent = rng.uniform(150, 900)
            submissions = int(rng.integers(1, 5))
            structure_changes = int(rng.integers(1, 8))
            retries = int(rng.integers(0, 4))
            hints = int(rng.integers(2, 8))
            experiments = int(rng.integers(0, 2))
            accuracy = rng.uniform(0.60, 1.00)
            learner_type = "Manual Learner"

        records.append(
            {
                "total_time_seconds": round(time_spent, 2),
                "code_submissions": submissions,
                "submission_frequency_per_min": round(submissions / (time_spent / 60), 2),
                "code_structure_changes": structure_changes,
                "retries": retries,
                "hint_requests": hints,
                "experiments_started": experiments,
                "question_level_numeric": int(rng.integers(1, 4)),
                "accuracy_rate": round(float(accuracy), 2),
                LABEL_COLUMN: learner_type,
            }
        )

    return pd.DataFrame(records)


def load_dataset() -> pd.DataFrame:
    if DATASET_PATH.exists():
        print(f"Loading training data from {DATASET_PATH}")
        dataframe = pd.read_csv(DATASET_PATH)
    else:
        print(f"{DATASET_PATH.name} not found; generating synthetic telemetry data")
        dataframe = generate_synthetic_dataset()
        dataframe.to_csv(DATASET_PATH, index=False)

    required = set(FEATURE_COLUMNS + [LABEL_COLUMN])
    missing = required.difference(dataframe.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")
    if dataframe[LABEL_COLUMN].nunique() < 2:
        raise ValueError("Training data must contain both learner types")
    return dataframe.dropna(subset=list(required))


def train_and_export_model() -> None:
    dataframe = load_dataset()
    features = dataframe[FEATURE_COLUMNS]
    labels = dataframe[LABEL_COLUMN]
    train_features, test_features, train_labels, test_labels = train_test_split(
        features, labels, test_size=0.2, random_state=42, stratify=labels
    )

    classifier = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    classifier.fit(train_features, train_labels)
    predictions = classifier.predict(test_features)
    print(classification_report(test_labels, predictions, zero_division=0))

    joblib.dump(
        {
            "model": classifier,
            "feature_names": FEATURE_COLUMNS,
            "classes": classifier.classes_.tolist(),
        },
        MODEL_PATH,
    )
    print(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    train_and_export_model()