import argparse
import ast
import json
import os
import warnings
from pathlib import Path

import hdbscan
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from neo4j import GraphDatabase
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import Normalizer, StandardScaler

try:
    import umap
except ImportError:  # pragma: no cover - optional dependency
    umap = None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Cluster FastRP embeddings with HDBSCAN and rank unsupervised anomalies."
    )
    parser.add_argument(
        "--input-source",
        choices=["neo4j", "file"],
        default="neo4j",
        help="Read embeddings directly from Neo4j or from a CSV/Parquet file.",
    )
    parser.add_argument(
        "--input-path",
        help="CSV or Parquet file containing node_id, embedding, and optional feature columns.",
    )
    parser.add_argument(
        "--output-path",
        default="anomaly_results.csv",
        help="Path to the ranked anomaly results CSV.",
    )
    parser.add_argument(
        "--id-column",
        default="node_id",
        help="Unique node identifier column in file mode, and output column name in Neo4j mode.",
    )
    parser.add_argument(
        "--id-property",
        default="node_id",
        help="Neo4j node property used as the ID in Neo4j mode. Falls back to elementId(n) if missing.",
    )
    parser.add_argument(
        "--embedding-column",
        default="fastrp_embedding",
        help="Embedding column in file mode, or Neo4j node property in Neo4j mode.",
    )
    parser.add_argument(
        "--neo4j-node-labels",
        default="",
        help="Comma-separated Neo4j node labels to include. Empty means all nodes with the embedding property.",
    )
    parser.add_argument(
        "--feature-columns",
        default="",
        help="Comma-separated scalar feature columns in file mode, or Neo4j node properties in Neo4j mode.",
    )
    parser.add_argument(
        "--embedding-weight",
        type=float,
        default=1.0,
        help="Relative weight applied to the embedding block after preprocessing.",
    )
    parser.add_argument(
        "--feature-weight",
        type=float,
        default=1.0,
        help="Relative weight applied to the scalar feature block after preprocessing.",
    )
    parser.add_argument(
        "--normalize-embeddings",
        action="store_true",
        help="L2-normalize embedding vectors before reduction or clustering.",
    )
    parser.add_argument(
        "--reduction",
        choices=["none", "pca", "umap"],
        default="none",
        help="Optional dimensionality reduction for the embedding block.",
    )
    parser.add_argument(
        "--reduction-dim",
        type=int,
        default=32,
        help="Target dimension for PCA or UMAP when reduction is enabled.",
    )
    parser.add_argument(
        "--metric",
        choices=["euclidean", "cosine"],
        default="euclidean",
        help="Distance metric passed to HDBSCAN. Prefer cosine for pure normalized embeddings, euclidean for mixed features.",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=25,
        help="Minimum cluster size for HDBSCAN.",
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=None,
        help="HDBSCAN min_samples. Defaults to min_cluster_size when omitted.",
    )
    parser.add_argument(
        "--cluster-selection-method",
        choices=["eom", "leaf"],
        default="eom",
        help="HDBSCAN cluster selection method.",
    )
    parser.add_argument(
        "--anomaly-percentile",
        type=float,
        default=99.0,
        help="Percentile cutoff for flagging anomalies from HDBSCAN outlier scores.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for reproducible PCA, UMAP, and Isolation Forest runs.",
    )
    parser.add_argument(
        "--neo4j-uri",
        default=os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687"),
        help="Neo4j URI used in Neo4j mode.",
    )
    parser.add_argument(
        "--neo4j-username",
        default=os.getenv("NEO4J_USERNAME", "neo4j"),
        help="Neo4j username used in Neo4j mode.",
    )
    parser.add_argument(
        "--neo4j-password",
        default=os.getenv("NEO4J_PASSWORD"),
        help="Neo4j password used in Neo4j mode.",
    )
    return parser


def parse_csv_arg(value: str) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def load_input_table(input_path: str) -> pd.DataFrame:
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    raise ValueError("Unsupported input format. Use CSV or Parquet.")


def build_neo4j_query(
    id_column: str,
    id_property: str,
    embedding_column: str,
    feature_columns: list[str],
) -> str:
    return_items = [
        f"coalesce(toString(n[$id_property]), elementId(n)) AS `{id_column}`",
        "labels(n) AS node_labels",
        "n[$embedding_property] AS embedding_vector",
    ]
    for idx, column in enumerate(feature_columns):
        return_items.append(f"n[$feature_property_{idx}] AS `{column}`")
    return f"""
    MATCH (n)
    WHERE n[$embedding_property] IS NOT NULL
    RETURN {", ".join(return_items)}
    """


def load_from_neo4j(
    uri: str,
    username: str,
    password: str,
    id_column: str,
    id_property: str,
    embedding_column: str,
    node_labels: list[str],
    feature_columns: list[str],
) -> pd.DataFrame:
    if not password:
        raise ValueError("Missing Neo4j password for Neo4j input mode.")

    query = build_neo4j_query(
        id_column=id_column,
        id_property=id_property,
        embedding_column=embedding_column,
        feature_columns=feature_columns,
    )
    parameters = {
        "id_property": id_property,
        "embedding_property": embedding_column,
    }
    for idx, column in enumerate(feature_columns):
        parameters[f"feature_property_{idx}"] = column

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        driver.verify_connectivity()
        with driver.session() as session:
            rows = [record.data() for record in session.run(query, parameters)]
    finally:
        driver.close()

    frame = pd.DataFrame(rows)
    if frame.empty:
        raise ValueError(
            "No Neo4j nodes were returned. Check the embedding property name and label filters."
        )

    if node_labels:
        label_set = set(node_labels)
        frame = frame[
            frame["node_labels"].apply(
                lambda values: bool(label_set.intersection(values or []))
            )
        ].reset_index(drop=True)
        if frame.empty:
            raise ValueError(
                f"No Neo4j nodes matched the requested labels: {node_labels}"
            )

    frame = frame.rename(columns={"embedding_vector": embedding_column})
    return frame


def parse_embedding(value) -> np.ndarray:
    if isinstance(value, np.ndarray):
        return value.astype(float)
    if isinstance(value, list):
        return np.asarray(value, dtype=float)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("Empty embedding string.")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = ast.literal_eval(text)
        return np.asarray(parsed, dtype=float)
    raise TypeError(f"Unsupported embedding value type: {type(value)!r}")


def stack_embeddings(series: pd.Series) -> np.ndarray:
    embeddings = [parse_embedding(value) for value in series]
    dims = {embedding.shape[0] for embedding in embeddings}
    if len(dims) != 1:
        raise ValueError(f"Inconsistent embedding dimensions found: {sorted(dims)}")
    return np.vstack(embeddings)


def reduce_embeddings(
    embeddings: np.ndarray,
    reduction: str,
    reduction_dim: int,
    random_state: int,
) -> tuple[np.ndarray, dict]:
    metadata = {
        "reduction": reduction,
        "input_dim": int(embeddings.shape[1]),
        "output_dim": int(embeddings.shape[1]),
    }
    if reduction == "none":
        return embeddings, metadata

    reduction_dim = min(reduction_dim, embeddings.shape[1], max(2, embeddings.shape[0] - 1))
    if reduction_dim < 2:
        return embeddings, metadata

    if reduction == "pca":
        reducer = PCA(n_components=reduction_dim, random_state=random_state)
        reduced = reducer.fit_transform(embeddings)
        metadata["output_dim"] = int(reduced.shape[1])
        metadata["explained_variance_ratio"] = float(np.sum(reducer.explained_variance_ratio_))
        return reduced, metadata

    if reduction == "umap":
        if umap is None:
            raise ImportError(
                "UMAP reduction requested but umap-learn is not installed."
            )
        reducer = umap.UMAP(
            n_components=reduction_dim,
            metric="cosine",
            random_state=random_state,
            n_neighbors=30,
            min_dist=0.0,
        )
        reduced = reducer.fit_transform(embeddings)
        metadata["output_dim"] = int(reduced.shape[1])
        return reduced, metadata

    raise ValueError(f"Unsupported reduction method: {reduction}")


def prepare_feature_matrix(
    frame: pd.DataFrame,
    embedding_column: str,
    feature_columns: list[str],
    normalize_embeddings: bool,
    reduction: str,
    reduction_dim: int,
    embedding_weight: float,
    feature_weight: float,
    random_state: int,
) -> tuple[np.ndarray, dict]:
    embeddings = stack_embeddings(frame[embedding_column])
    raw_embedding_dim = int(embeddings.shape[1])

    if normalize_embeddings:
        embeddings = Normalizer(norm="l2").fit_transform(embeddings)

    embeddings, reduction_info = reduce_embeddings(
        embeddings=embeddings,
        reduction=reduction,
        reduction_dim=reduction_dim,
        random_state=random_state,
    )
    blocks = [embeddings * embedding_weight]

    numeric_feature_columns = []
    ignored_feature_columns = []
    if feature_columns:
        missing = [column for column in feature_columns if column not in frame.columns]
        if missing:
            raise KeyError(f"Missing feature columns: {missing}")
        requested_feature_columns = list(feature_columns)
        numeric_features = frame[requested_feature_columns].apply(
            pd.to_numeric,
            errors="coerce",
        )
        numeric_feature_columns = [
            column for column in requested_feature_columns
            if numeric_features[column].notna().any()
        ]
        ignored_feature_columns = [
            column for column in requested_feature_columns
            if column not in numeric_feature_columns
        ]
        if numeric_feature_columns:
            imputed = SimpleImputer(strategy="median").fit_transform(
                numeric_features[numeric_feature_columns]
            )
            scaled = StandardScaler().fit_transform(imputed)
            blocks.append(scaled * feature_weight)
        if ignored_feature_columns:
            warnings.warn(
                "Ignoring feature columns with no observed values: "
                + ", ".join(ignored_feature_columns),
                stacklevel=2,
            )

    combined = np.hstack(blocks)
    metadata = {
        "raw_embedding_dim": raw_embedding_dim,
        "final_embedding_dim": int(embeddings.shape[1]),
        "feature_count": len(numeric_feature_columns),
        "used_feature_columns": numeric_feature_columns,
        "ignored_feature_columns": ignored_feature_columns,
        "combined_dim": int(combined.shape[1]),
        "reduction": reduction_info,
    }
    print('metadata:', metadata)
    return combined, metadata


def fit_hdbscan(
    matrix: np.ndarray,
    min_cluster_size: int,
    min_samples: int | None,
    metric: str,
    cluster_selection_method: str,
) -> hdbscan.HDBSCAN:
    algorithm = "generic" if metric == "cosine" else "best"
    return hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples if min_samples is not None else min_cluster_size,
        metric=metric,
        cluster_selection_method=cluster_selection_method,
        prediction_data=True,
        algorithm=algorithm,
    ).fit(matrix)


def percentile_threshold(scores: np.ndarray, percentile: float) -> float:
    clean_scores = scores[np.isfinite(scores)]
    if clean_scores.size == 0:
        return 0.0
    return float(np.percentile(clean_scores, percentile))


def centroid_distance_scores(matrix: np.ndarray, labels: np.ndarray) -> np.ndarray:
    distances = np.full(matrix.shape[0], np.nan)
    cluster_labels = [label for label in np.unique(labels) if label != -1]
    if not cluster_labels:
        return distances

    centroids = {
        label: matrix[labels == label].mean(axis=0)
        for label in cluster_labels
    }
    for idx, label in enumerate(labels):
        if label == -1:
            distances[idx] = min(
                np.linalg.norm(matrix[idx] - centroids[cluster_label])
                for cluster_label in cluster_labels
            )
        else:
            distances[idx] = np.linalg.norm(matrix[idx] - centroids[label])
    return distances


def summarize_clusters(labels: np.ndarray) -> pd.DataFrame:
    counts = (
        pd.Series(labels, name="cluster")
        .value_counts(dropna=False)
        .rename_axis("cluster")
        .reset_index(name="count")
        .sort_values(["cluster"])
    )
    counts["cluster_type"] = np.where(counts["cluster"] == -1, "noise", "cluster")
    return counts


def run_baseline_isolation_forest(
    matrix: np.ndarray,
    random_state: int,
) -> np.ndarray:
    model = IsolationForest(
        n_estimators=300,
        contamination="auto",
        random_state=random_state,
    )
    model.fit(matrix)
    return -model.score_samples(matrix)


def build_results(
    frame: pd.DataFrame,
    id_column: str,
    matrix: np.ndarray,
    model: hdbscan.HDBSCAN,
    anomaly_percentile: float,
    baseline_scores: np.ndarray,
) -> tuple[pd.DataFrame, float]:
    labels = model.labels_
    outlier_scores = np.nan_to_num(model.outlier_scores_, nan=0.0, posinf=0.0, neginf=0.0)
    anomaly_threshold = percentile_threshold(outlier_scores, anomaly_percentile)
    centroid_distances = centroid_distance_scores(matrix, labels)

    results = pd.DataFrame(
        {
            id_column: frame[id_column].values,
            "cluster": labels,
            "cluster_probability": model.probabilities_,
            "outlier_score": outlier_scores,
            "is_noise": labels == -1,
            "centroid_distance": centroid_distances,
            "baseline_iforest_score": baseline_scores,
        }
    )
    results["is_anomaly"] = results["outlier_score"] >= anomaly_threshold
    results["anomaly_rank"] = results["outlier_score"].rank(
        method="dense",
        ascending=False,
    ).astype(int)
    results = results.sort_values(
        ["is_anomaly", "is_noise", "outlier_score", "baseline_iforest_score"],
        ascending=[False, False, False, False],
    ).reset_index(drop=True)
    return results, anomaly_threshold


def main() -> None:
    load_dotenv()
    args = build_parser().parse_args()

    feature_columns = parse_csv_arg(args.feature_columns)
    node_labels = parse_csv_arg(args.neo4j_node_labels)

    if args.input_source == "neo4j":
        frame = load_from_neo4j(
            uri=args.neo4j_uri,
            username=args.neo4j_username,
            password=args.neo4j_password,
            id_column=args.id_column,
            id_property=args.id_property,
            embedding_column=args.embedding_column,
            node_labels=node_labels,
            feature_columns=feature_columns,
        )
        source_description = f"Neo4j at {args.neo4j_uri}"
    else:
        if not args.input_path:
            raise ValueError("--input-path is required when --input-source file is used.")
        frame = load_input_table(args.input_path)
        source_description = args.input_path

    if args.id_column not in frame.columns:
        raise KeyError(f"Missing id column: {args.id_column}")
    if args.embedding_column not in frame.columns:
        raise KeyError(f"Missing embedding column: {args.embedding_column}")

    matrix, prep_info = prepare_feature_matrix(
        frame=frame,
        embedding_column=args.embedding_column,
        feature_columns=feature_columns,
        normalize_embeddings=args.normalize_embeddings,
        reduction=args.reduction,
        reduction_dim=args.reduction_dim,
        embedding_weight=args.embedding_weight,
        feature_weight=args.feature_weight,
        random_state=args.random_state,
    )

    model = fit_hdbscan(
        matrix=matrix,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
        metric=args.metric,
        cluster_selection_method=args.cluster_selection_method,
    )
    baseline_scores = run_baseline_isolation_forest(
        matrix=matrix,
        random_state=args.random_state,
    )
    results, anomaly_threshold = build_results(
        frame=frame,
        id_column=args.id_column,
        matrix=matrix,
        model=model,
        anomaly_percentile=args.anomaly_percentile,
        baseline_scores=baseline_scores,
    )

    cluster_summary = summarize_clusters(model.labels_)
    results.to_csv(args.output_path, index=False)

    print(f"Loaded {len(frame)} rows from {source_description}")
    print(
        "Prepared feature matrix with "
        f"{prep_info['combined_dim']} columns "
        f"(embedding_dim={prep_info['final_embedding_dim']}, "
        f"extra_features={prep_info['feature_count']})."
    )
    if prep_info["used_feature_columns"]:
        print(
            "Using scalar features: "
            + ", ".join(prep_info["used_feature_columns"])
        )
    if prep_info["ignored_feature_columns"]:
        print(
            "Ignored empty scalar features: "
            + ", ".join(prep_info["ignored_feature_columns"])
        )
    if prep_info["reduction"]["reduction"] == "pca":
        print(
            "PCA retained "
            f"{prep_info['reduction']['explained_variance_ratio']:.3f} "
            "of embedding variance."
        )
    print(
        "HDBSCAN produced "
        f"{(cluster_summary['cluster'] != -1).sum()} clusters and "
        f"{int((model.labels_ == -1).sum())} noise points."
    )
    print(
        "Anomaly threshold "
        f"(percentile={args.anomaly_percentile}) = {anomaly_threshold:.6f}"
    )
    print("Top anomaly candidates:")
    print(results.head(10).to_string(index=False))
    print(f"Saved ranked results to {args.output_path}")


if __name__ == "__main__":
    main()
