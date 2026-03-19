import argparse
import os

from dotenv import load_dotenv

from fastrp_embeddings import FastRPEmbedder, parse_csv


DEFAULT_NODE_LABELS = [
    "Identity",
    "Account",
    "Entitlement",
    "Application",
    "Resource",
    "EntitlementGroup",
    "BusinessOwner",
]

DEFAULT_RELATIONSHIP_TYPES = [
    "HAS_ACCOUNT",
    "ON_RESOURCE",
    "HAS_ENTITLEMENT",
    "PART_OF",
    "MEMBER_OF_GROUP",
    "CONTAINS_ENTITLEMENT",
    "HAS_CHILD_GROUP",
    "OWNED_BY",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create FastRP embeddings across the full IAM graph, including business owners."
    )
    parser.add_argument(
        "--graph-name",
        default="iam-all-nodes-fastrp",
        help="Name of the in-memory GDS graph projection.",
    )
    parser.add_argument(
        "--node-labels",
        default=",".join(DEFAULT_NODE_LABELS),
        help="Comma-separated node labels to project.",
    )
    parser.add_argument(
        "--relationship-types",
        default=",".join(DEFAULT_RELATIONSHIP_TYPES),
        help="Comma-separated relationship types to project.",
    )
    parser.add_argument(
        "--embedding-property",
        default="embedding",
        help="Node property name used to store the embedding vector.",
    )
    parser.add_argument(
        "--embedding-dimension",
        type=int,
        default=256,
        help="Length of the embedding vector.",
    )
    parser.add_argument(
        "--iteration-weights",
        default="0.0,1.0,1.0",
        help="Comma-separated FastRP iteration weights.",
    )
    parser.add_argument(
        "--normalization-strength",
        type=float,
        default=0.0,
        help="FastRP normalization strength.",
    )
    return parser


def main() -> None:
    load_dotenv()

    parser = build_parser()
    args = parser.parse_args()

    uri = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
    user = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not password:
        raise SystemExit("Missing NEO4J_PASSWORD in environment variables.")

    node_labels = parse_csv(args.node_labels, DEFAULT_NODE_LABELS)
    relationship_types = parse_csv(args.relationship_types, DEFAULT_RELATIONSHIP_TYPES)
    iteration_weights = [float(value) for value in parse_csv(args.iteration_weights, ["0.0", "1.0", "1.0"])]

    embedder = FastRPEmbedder(uri, user, password)

    try:
        print(f"Connecting to Neo4j at {uri}...")
        embedder.driver.verify_connectivity()
        embedder.verify_gds()
        print("Neo4j and GDS are available.")

        embedder.drop_projection_if_exists(args.graph_name)
        projection = embedder.create_projection(
            graph_name=args.graph_name,
            node_labels=node_labels,
            relationship_types=relationship_types,
        )
        print(
            "Projected graph "
            f"{projection['graphName']} with {projection['nodeCount']} nodes and "
            f"{projection['relationshipCount']} relationships."
        )

        result = embedder.write_embeddings(
            graph_name=args.graph_name,
            embedding_property=args.embedding_property,
            embedding_dimension=args.embedding_dimension,
            iteration_weights=iteration_weights,
            normalization_strength=args.normalization_strength,
        )
        print(
            "FastRP completed. "
            f"Wrote embeddings to {result['nodePropertiesWritten']} nodes in property "
            f"'{args.embedding_property}'."
        )
        print(
            "Timing (ms): "
            f"preProcessing={result['preProcessingMillis']}, "
            f"compute={result['computeMillis']}, "
            f"write={result['writeMillis']}"
        )
    finally:
        embedder.close()


if __name__ == "__main__":
    main()
