"""Train an experimental curve-pattern classifier on synthetic relative-level profiles.

These labels describe curve geometry. No patient data, clinical severity labels,
or hearing-loss type labels are used. Held-out metrics only test synthetic profiles.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
SEED = 20261118
CLASSES = (
    "near_flat", "high_frequency_rise", "low_frequency_rise",
    "mid_frequency_dip", "mid_frequency_rise", "high_frequency_dip",
)
LABELS = {
    "near_flat": "Similar response levels across frequencies",
    "high_frequency_rise": "Higher playback steps at high frequencies",
    "low_frequency_rise": "Higher playback steps at low frequencies",
    "mid_frequency_dip": "Lower playback steps in the middle frequencies",
    "mid_frequency_rise": "Higher playback steps in the middle frequencies",
    "high_frequency_dip": "Lower playback steps at high frequencies",
}


def features(values):
    values = np.asarray(values, dtype=float)
    return np.concatenate((values - values.mean(axis=-1, keepdims=True), np.diff(values, axis=-1)), axis=-1)


def train():
    rng = np.random.default_rng(SEED)
    x = []
    y = []
    # Independent random profiles. Offset is removed in preprocessing so absolute
    # relative levels do not get interpreted as clinical severity.
    for pattern in CLASSES:
        for _ in range(1200):
            base = rng.uniform(42, 61)
            amplitude = rng.uniform(12, 24)
            templates = {
                "near_flat": [0, 0, 0, 0, 0, 0],
                "high_frequency_rise": [-1, -.65, -.2, .15, .65, 1],
                "low_frequency_rise": [1, .65, .2, -.15, -.65, -1],
                "mid_frequency_dip": [.7, .2, -.8, -1, .2, .7],
                "mid_frequency_rise": [-.7, -.2, .8, 1, -.2, -.7],
                "high_frequency_dip": [.4, .4, .2, .1, -1, -.5],
            }
            values = base + amplitude * np.array(templates[pattern]) + rng.normal(0, 2.4, 6)
            values = np.clip(5 * np.round(values / 5), 20, 90)
            x.append(values)
            y.append(pattern)
    raw = np.asarray(x)
    labels = np.asarray(y)
    # Hold identical quantized profiles in one partition.
    unique, indices = np.unique(raw, axis=0, return_index=True)
    targets = labels[indices]
    train_idx, test_idx = train_test_split(
        np.arange(len(unique)), test_size=.25, random_state=SEED, stratify=targets,
    )
    model = RandomForestClassifier(
        n_estimators=48, max_depth=7, min_samples_leaf=6,
        class_weight="balanced", random_state=SEED,
    )
    model.fit(features(unique[train_idx]), targets[train_idx])
    predicted = model.predict(features(unique[test_idx]))
    metrics = {
        "evaluation": "held-out synthetic profiles only",
        "training_profiles": len(train_idx),
        "test_profiles": len(test_idx),
        "per_class": classification_report(targets[test_idx], predicted, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(targets[test_idx], predicted, labels=model.classes_).tolist(),
    }
    trees = []
    for estimator in model.estimators_:
        tree = estimator.tree_
        votes = tree.value[:, 0, :]
        votes = votes / votes.sum(axis=1, keepdims=True)
        trees.append({
            "left": tree.children_left.tolist(),
            "right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": tree.threshold.tolist(),
            "probability": votes.tolist(),
        })
    source_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    artifact = {
        "version": "relative-curve-pattern-rf-v1",
        "training": "synthetic relative-level profiles",
        "seed": SEED, "training_script_sha256": source_hash,
        "frequencies": [250, 500, 1000, 2000, 4000, 8000],
        "classes": model.classes_.tolist(), "labels": LABELS, "trees": trees,
    }
    (ROOT / "app/models/relative-pattern.json").write_text(json.dumps(artifact, separators=(",", ":")) + "\n")
    (ROOT / "research/pattern-model-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    samples = np.vstack((unique[test_idx[:75]], [[30]*6, [20,25,35,45,55,70], [70,55,45,35,25,20]]))
    fixtures = [{
        "values": values.tolist(),
        "expected": str(model.predict(features(values.reshape(1, -1)))[0]),
        "probabilities": model.predict_proba(features(values.reshape(1, -1)))[0].tolist(),
    } for values in samples]
    (ROOT / "research/pattern-parity-fixtures.json").write_text(json.dumps(fixtures, indent=2) + "\n")
    print(json.dumps({"train": len(train_idx), "test": len(test_idx), "synthetic_macro_f1": metrics["per_class"]["macro avg"]["f1-score"]}))


if __name__ == "__main__":
    train()
