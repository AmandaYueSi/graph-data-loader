import argparse
import json
from pathlib import Path

import hdbscan
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import Normalizer


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Cluster entitlement packages using only identity/account/entitlement "
            "relationships and output entitlement-only cluster results."
        )
    )
    parser.add_argument(
        "--data-dir",
        default="iam_dataset_new",
        help="Directory containing the IAM parquet files.",
    )
    parser.add_argument(
        "--output-path",
        default="entitlement_clusters.json",
        help="Path to the output JSON file.",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=5,
        help="Minimum cluster size for HDBSCAN.",
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=None,
        help="Optional HDBSCAN min_samples value.",
    )
    parser.add_argument(
        "--svd-dim",
        type=int,
        default=32,
        help="Target dimension for sparse TF-IDF reduction before clustering.",
    )
    parser.add_argument(
        "--include-noise",
        action="store_true",
        help="Include HDBSCAN noise points as single-entitlement clusters.",
    )
    return parser


def load_filtered_tables(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    account_entitlements = pd.read_parquet(data_dir / "account_entitlements.parquet")[
        ["identity_id", "account_id", "entitlement_id"]
    ].dropna()
    accounts = pd.read_parquet(data_dir / "accounts.parquet")[
        ["identity_id", "account_id"]
    ].dropna()
    entitlements = pd.read_parquet(data_dir / "entitlements.parquet")[
        ["entitlement_id", "entitlement_name"]
    ].drop_duplicates(subset=["entitlement_id"])
    return account_entitlements, accounts, entitlements


def build_entitlement_documents(
    account_entitlements: pd.DataFrame,
    accounts: pd.DataFrame,
) -> pd.DataFrame:
    merged = account_entitlements.merge(
        accounts,
        on=["identity_id", "account_id"],
        how="inner",
    )[["entitlement_id", "identity_id", "account_id"]].drop_duplicates()

    grouped = (
        merged.groupby("entitlement_id")
        .agg(
            identity_tokens=("identity_id", lambda values: sorted({f"identity:{value}" for value in values})),
            account_tokens=("account_id", lambda values: sorted({f"account:{value}" for value in values})),
        )
        .reset_index()
    )
    grouped["document"] = grouped.apply(
        lambda row: " ".join(row["identity_tokens"] + row["account_tokens"]),
        axis=1,
    )
    return grouped[["entitlement_id", "document"]]


def cluster_entitlements(
    entitlement_docs: pd.DataFrame,
    min_cluster_size: int,
    min_samples: int | None,
    svd_dim: int,
) -> list[int]:
    vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b[^\s]+\b")
    feature_matrix = vectorizer.fit_transform(entitlement_docs["document"])

    if feature_matrix.shape[0] < 2:
        return [0] * len(entitlement_docs)

    reduced_dim = min(
        svd_dim,
        max(1, feature_matrix.shape[0] - 1),
        max(1, feature_matrix.shape[1] - 1),
    )
    if reduced_dim >= 1 and reduced_dim < feature_matrix.shape[1]:
        feature_matrix = TruncatedSVD(n_components=reduced_dim, random_state=42).fit_transform(feature_matrix)
        feature_matrix = Normalizer().fit_transform(feature_matrix)
    else:
        feature_matrix = feature_matrix.toarray()

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    return clusterer.fit_predict(feature_matrix).tolist()


def build_output(
    entitlement_docs: pd.DataFrame,
    entitlements: pd.DataFrame,
    labels: list[int],
    include_noise: bool,
) -> list[dict]:
    clustered = entitlement_docs.copy()
    clustered["label"] = labels
    clustered = clustered.merge(entitlements, on="entitlement_id", how="left")
    clustered["entitlement_value"] = clustered["entitlement_name"].fillna(clustered["entitlement_id"])

    output = []
    for label, frame in clustered.groupby("label", sort=True):
        if label == -1 and not include_noise:
            continue
        cluster_id = f"cluster_{label}" if label != -1 else "noise"
        entitlements_in_cluster = sorted(frame["entitlement_value"].dropna().astype(str).unique().tolist())
        if not entitlements_in_cluster:
            continue
        output.append(
            {
                "cluster_id": cluster_id,
                "entitlements": entitlements_in_cluster,
            }
        )
    return output


def main() -> None:
    args = build_parser().parse_args()
    data_dir = Path(args.data_dir)

    if not data_dir.exists():
        raise SystemExit(f"Data directory not found: {data_dir}")

    account_entitlements, accounts, entitlements = load_filtered_tables(data_dir)
    entitlement_docs = build_entitlement_documents(account_entitlements, accounts)

    if entitlement_docs.empty:
        raise SystemExit("No entitlement relationships found for clustering.")

    labels = cluster_entitlements(
        entitlement_docs=entitlement_docs,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
        svd_dim=args.svd_dim,
    )
    output = build_output(
        entitlement_docs=entitlement_docs,
        entitlements=entitlements,
        labels=labels,
        include_noise=args.include_noise,
    )

    Path(args.output_path).write_text(json.dumps(output, indent=2))
    print(f"Wrote {len(output)} clusters to {args.output_path}")


if __name__ == "__main__":
    main()
