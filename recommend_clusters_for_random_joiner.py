import argparse
import json
from pathlib import Path

import pandas as pd


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Pick a random joiner, find similar colleagues, and recommend the "
            "top entitlement clusters based on colleague access."
        )
    )
    parser.add_argument(
        "--data-dir",
        default="iam_dataset_new",
        help="Directory containing IAM parquet files.",
    )
    parser.add_argument(
        "--clusters-path",
        default="entitlement_clusters.json",
        help="Path to the entitlement cluster JSON file.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="Number of cluster recommendations to return.",
    )
    parser.add_argument(
        "--colleague-count",
        type=int,
        default=25,
        help="Maximum number of similar colleagues to use for scoring.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for selecting the joiner.",
    )
    parser.add_argument(
        "--output-path",
        default="random_joiner_recommendations.json",
        help="Path to the output JSON file.",
    )
    return parser


def load_data(data_dir: Path, clusters_path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list[dict]]:
    identities = pd.read_parquet(data_dir / "identities.parquet")
    account_entitlements = pd.read_parquet(data_dir / "account_entitlements.parquet")[
        ["identity_id", "account_id", "entitlement_id"]
    ].dropna()
    entitlements = pd.read_parquet(data_dir / "entitlements.parquet")[
        ["entitlement_id", "entitlement_name"]
    ].drop_duplicates(subset=["entitlement_id"])
    clusters = json.loads(clusters_path.read_text())
    return identities, account_entitlements, entitlements, clusters


def pick_random_joiner(identities: pd.DataFrame, random_state: int) -> pd.Series:
    candidates = identities[
        (identities["status"] == "Active") & (identities["identity_type"] == "Human")
    ]
    if candidates.empty:
        candidates = identities.copy()
    return candidates.sample(n=1, random_state=random_state).iloc[0]


def score_colleagues(identities: pd.DataFrame, joiner: pd.Series) -> pd.DataFrame:
    candidates = identities[identities["identity_id"] != joiner["identity_id"]].copy()
    candidates["similarity_score"] = 0

    match_columns = [
        ("manager_id", 5),
        ("department", 3),
        ("job_title", 3),
        ("location", 2),
        ("identity_type", 1),
    ]
    for column, weight in match_columns:
        joiner_value = joiner.get(column)
        if pd.notna(joiner_value):
            candidates["similarity_score"] += (candidates[column] == joiner_value).astype(int) * weight

    candidates = candidates[candidates["similarity_score"] > 0].copy()
    return candidates.sort_values(
        by=["similarity_score", "status", "identity_id"],
        ascending=[False, True, True],
    )


def build_cluster_lookup(clusters: list[dict]) -> dict[str, str]:
    lookup = {}
    for cluster in clusters:
        cluster_id = cluster["cluster_id"]
        for entitlement_name in cluster["entitlements"]:
            lookup[entitlement_name] = cluster_id
    return lookup


def score_clusters(
    colleagues: pd.DataFrame,
    account_entitlements: pd.DataFrame,
    entitlements: pd.DataFrame,
    clusters: list[dict],
    top_k: int,
) -> list[dict]:
    cluster_lookup = build_cluster_lookup(clusters)
    colleague_ids = set(colleagues["identity_id"])
    colleague_access = account_entitlements[
        account_entitlements["identity_id"].isin(colleague_ids)
    ].merge(entitlements, on="entitlement_id", how="left")
    colleague_access["cluster_id"] = colleague_access["entitlement_name"].map(cluster_lookup)
    colleague_access = colleague_access.dropna(subset=["cluster_id"])

    if colleague_access.empty:
        return []

    cluster_sizes = {
        cluster["cluster_id"]: len(cluster["entitlements"])
        for cluster in clusters
    }

    scored = (
        colleague_access.groupby("cluster_id")
        .agg(
            colleagues_covered=("identity_id", "nunique"),
            entitlement_hits=("entitlement_id", "nunique"),
        )
        .reset_index()
    )
    scored["cluster_size"] = scored["cluster_id"].map(cluster_sizes)
    scored["coverage_ratio"] = scored["entitlement_hits"] / scored["cluster_size"]
    total_colleagues = max(1, colleagues["identity_id"].nunique())
    scored["support_ratio"] = scored["colleagues_covered"] / total_colleagues
    scored["score"] = scored["support_ratio"] + scored["coverage_ratio"]
    scored = scored.sort_values(
        by=["score", "colleagues_covered", "entitlement_hits", "cluster_id"],
        ascending=[False, False, False, True],
    ).head(top_k)

    cluster_details = {cluster["cluster_id"]: cluster["entitlements"] for cluster in clusters}
    recommendations = []
    for row in scored.itertuples(index=False):
        recommendations.append(
            {
                "cluster_id": row.cluster_id,
                "score": round(float(row.score), 4),
                "colleagues_covered": int(row.colleagues_covered),
                "cluster_size": int(row.cluster_size),
                "matched_entitlements": sorted(
                    colleague_access.loc[
                        colleague_access["cluster_id"] == row.cluster_id,
                        "entitlement_name",
                    ].dropna().astype(str).unique().tolist()
                ),
                "recommended_entitlements": cluster_details[row.cluster_id],
            }
        )
    return recommendations


def main() -> None:
    args = build_parser().parse_args()
    data_dir = Path(args.data_dir)
    clusters_path = Path(args.clusters_path)

    if not data_dir.exists():
        raise SystemExit(f"Data directory not found: {data_dir}")
    if not clusters_path.exists():
        raise SystemExit(f"Cluster file not found: {clusters_path}")

    identities, account_entitlements, entitlements, clusters = load_data(data_dir, clusters_path)
    joiner = pick_random_joiner(identities, args.random_state)
    colleagues = score_colleagues(identities, joiner).head(args.colleague_count)
    recommendations = score_clusters(
        colleagues=colleagues,
        account_entitlements=account_entitlements,
        entitlements=entitlements,
        clusters=clusters,
        top_k=args.top_k,
    )

    output = {
        "new_joiner": {
            "identity_id": joiner["identity_id"],
            "identity_type": joiner["identity_type"],
            "status": joiner["status"],
            "department": joiner["department"],
            "job_title": joiner["job_title"],
            "location": joiner["location"],
            "manager_id": joiner["manager_id"],
        },
        "colleague_count_used": int(len(colleagues)),
        "colleagues": colleagues[
            ["identity_id", "department", "job_title", "location", "manager_id", "similarity_score"]
        ].to_dict(orient="records"),
        "top_cluster_recommendations": recommendations,
    }

    Path(args.output_path).write_text(json.dumps(output, indent=2, default=str))
    print(f"Wrote recommendations for joiner {joiner['identity_id']} to {args.output_path}")


if __name__ == "__main__":
    main()
