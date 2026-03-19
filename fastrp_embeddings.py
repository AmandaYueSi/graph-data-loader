import argparse
import os
from typing import Iterable

from dotenv import load_dotenv
from neo4j import GraphDatabase


DEFAULT_NODE_LABELS = [
    "Identity",
    "Account",
    "Entitlement",
    "Application",
    "Resource",
    "EntitlementGroup",
]

DEFAULT_RELATIONSHIP_TYPES = [
    "HAS_ACCOUNT",
    "ON_RESOURCE",
    "HAS_ENTITLEMENT",
    "PART_OF",
    "MEMBER_OF_GROUP",
    "CONTAINS_ENTITLEMENT",
    "HAS_CHILD_GROUP",
]


def parse_csv(value: str | None, default: Iterable[str]) -> list[str]:
    if not value:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


class FastRPEmbedder:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self) -> None:
        self.driver.close()

    def verify_gds(self) -> None:
        required_procedures = [
            "gds.graph.project",
            "gds.fastRP.write",
        ]
        query = """
        SHOW PROCEDURES YIELD name
        WHERE name IN $required_procedures
        RETURN collect(name) AS available
        """
        with self.driver.session() as session:
            record = session.run(
                query,
                required_procedures=required_procedures,
            ).single()

        available = set(record["available"])
        missing = [name for name in required_procedures if name not in available]
        if missing:
            raise RuntimeError(
                "Neo4j Graph Data Science procedures are unavailable: "
                + ", ".join(missing)
                + ". Install or enable the GDS plugin before running FastRP."
            )

    def drop_projection_if_exists(self, graph_name: str) -> None:
        query = """
        CALL gds.graph.exists($graph_name) YIELD exists
        WITH exists, $graph_name AS gName
        CALL (exists, gName) {
            WITH exists, gName
            WITH exists WHERE exists
            CALL gds.graph.drop(gName, false) YIELD graphName
            RETURN graphName
            UNION
            WITH exists
            WITH exists WHERE NOT exists
            RETURN null AS graphName
        }
        RETURN graphName
        """
        with self.driver.session() as session:
            session.run(query, graph_name=graph_name).consume()

    def create_projection(
        self,
        graph_name: str,
        node_labels: list[str],
        relationship_types: list[str],
    ) -> dict:
        query = """
        CALL gds.graph.project(
            $graph_name,
            $node_labels,
            $relationship_types
        )
        YIELD graphName, nodeCount, relationshipCount
        RETURN graphName, nodeCount, relationshipCount
        """
        with self.driver.session() as session:
            record = session.run(
                query,
                graph_name=graph_name,
                node_labels=node_labels,
                relationship_types=relationship_types,
            ).single()
        return dict(record)

    def write_embeddings(
        self,
        graph_name: str,
        embedding_property: str,
        embedding_dimension: int,
        iteration_weights: list[float],
        normalization_strength: float,
    ) -> dict:
        query = """
        CALL gds.fastRP.write(
            $graph_name,
            {
                writeProperty: $embedding_property,
                embeddingDimension: $embedding_dimension,
                iterationWeights: $iteration_weights,
                normalizationStrength: $normalization_strength
            }
        )
        YIELD nodePropertiesWritten, preProcessingMillis, computeMillis, writeMillis
        RETURN nodePropertiesWritten, preProcessingMillis, computeMillis, writeMillis
        """
        with self.driver.session() as session:
            record = session.run(
                query,
                graph_name=graph_name,
                embedding_property=embedding_property,
                embedding_dimension=embedding_dimension,
                iteration_weights=iteration_weights,
                normalization_strength=normalization_strength,
            ).single()
        return dict(record)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create Neo4j FastRP embeddings and write them back to node properties."
    )
    parser.add_argument(
        "--graph-name",
        default="iam-fastrp",
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
        default="fastrp_embedding",
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