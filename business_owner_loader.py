import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

from parquet_loader import bulk_load_parquet


load_dotenv()


def run_business_owner_ingestion():
    """
    Load business owner nodes and application ownership relationships into Neo4j.
    """
    uri = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
    user = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "12345678")

    data_dir = "/Users/amandasi/Code/graph-data-loader/iam_dataset_new"
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        print("Starting business owner ingestion...\n")

        business_owner_query = """
        UNWIND $rows AS row
        MERGE (bo:BusinessOwner {owner_id: row.owner_id})
        SET bo.name = row.name,
            bo.title = row.title,
            bo.department = row.department,
            bo.domain = row.domain,
            bo.business_responsibility = row.business_responsibility
        """
        bulk_load_parquet(
            driver,
            os.path.join(data_dir, "business_owners.parquet"),
            business_owner_query,
        )

        application_business_owner_query = """
        UNWIND $rows AS row
        MATCH (a:Application {app_id: row.app_id})
        MATCH (bo:BusinessOwner {owner_id: row.owner_id})
        MERGE (a)-[:OWNED_BY]->(bo)
        """
        bulk_load_parquet(
            driver,
            os.path.join(data_dir, "application_business_owners.parquet"),
            application_business_owner_query,
        )

        print("Business owner data loaded successfully.")

    except Exception as e:
        print(f"Business owner ingestion error: {e}")
    finally:
        driver.close()


if __name__ == "__main__":
    run_business_owner_ingestion()
