"""Compare per-ear research classifiers against independent reference labels.

CSV rows are paired browser sessions and reference outcomes. participant_id must be
pseudonymous. Supply the cohort assignment in split (train or test) before running.
L_250 through R_8000 are relative browser detection steps. Missing and censored
values are excluded under this complete-case baseline and counted in the output.
"""

import argparse
import json

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import balanced_accuracy_score, classification_report

FREQUENCIES = (250, 500, 1000, 2000, 4000, 8000)
FEATURES = ["age"] + [f"{ear}_{hz}" for ear in ("L", "R") for hz in FREQUENCIES]
LABELS = ("left_reference_label", "right_reference_label")


def evaluate(path, noise_column):
    data = pd.read_csv(path)
    features = FEATURES + ([noise_column] if noise_column else [])
    required = ["participant_id", "split", *features, *LABELS]
    missing = set(required) - set(data)
    if missing:
        raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")
    if data["participant_id"].isna().any() or not data["split"].isin(["train", "test"]).all():
        raise ValueError("Every session needs a participant ID and a train/test assignment")
    if data.groupby("participant_id")["split"].nunique().gt(1).any():
        raise ValueError("Participants must not occur in both splits")

    data[features] = data[features].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    thresholds = data[FEATURES[1:]]
    on_grid = thresholds.isin(range(15, 91, 5)).all(axis=1)
    # The minimum step may be a censored reading in this protocol.
    uncensored = thresholds.gt(15).all(axis=1)
    cohort = data[on_grid & uncensored].dropna(subset=required)
    train = cohort[cohort["split"] == "train"]
    test = cohort[cohort["split"] == "test"]
    if train.empty or test.empty:
        raise ValueError("Both splits need eligible paired data")
    result = {
        "excluded_sessions": len(data) - len(cohort),
        "train_participants": train["participant_id"].nunique(),
        "test_participants": test["participant_id"].nunique(),
        "test_sessions": len(test),
        "models": {},
    }
    variants = {"baseline": FEATURES}
    if noise_column:
        variants["with_noise"] = features
    for variant, columns in variants.items():
        for label in LABELS:
            train_classes = set(train[label])
            if len(train_classes) < 2 or train_classes != set(test[label]):
                raise ValueError(f"{label} needs the same two or more reference classes in both splits")
            model = RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=43)
            model.fit(train[columns], train[label])
            predicted = model.predict(test[columns])
            result["models"][f"{variant}:{label}"] = {
                "balanced_accuracy": balanced_accuracy_score(test[label], predicted),
                "per_class": classification_report(test[label], predicted, output_dict=True, zero_division=0),
            }
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", help="De-identified paired sessions CSV")
    parser.add_argument("--noise-column", help="Optional numeric noise feature to compare on the same cohort")
    args = parser.parse_args()
    print(json.dumps(evaluate(args.csv, args.noise_column), indent=2))
