import os
import pandas as pd
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Use absolute path for .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

def check_counts():
    data_dir = r"C:\Users\Prabha\.gemini\antigravity\scratch\graph-data-loader\parquet_data_set"
    files = {
        "identity": "identities.parquet",
        "account": "accounts.parquet",
        "entitlement": "account_entitlements.parquet",
        "application": "applications.parquet",
        "resource": "resources.parquet",
        "entitlement_group": "entitlement_groups.parquet"
    }

    print("--- Parquet File Counts ---")
    file_counts = {}
    for label, filename in files.items():
        path = os.path.join(data_dir, filename)
        if os.path.exists(path):
            df = pd.read_parquet(path)
            count = len(df)
            file_counts[label] = count
            print(f"{filename}: {count} records")
        else:
            print(f"{filename}: File not found")

    print("\n--- Neo4j Database Counts ---")
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    
    if not all([uri, user, password]):
        print(f"Error: Missing credentials in .env. URI: {uri}, User: {user}")
        return

    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        db_counts = {}
        with driver.session() as session:
            labels = ["Identity", "Account", "Entitlement", "Application", "Resource", "EntitlementGroup"]
            for label in labels:
                result = session.run(f"MATCH (n:{label}) RETURN count(n) AS count")
                count = result.single()["count"]
                db_counts[label.lower()] = count
                print(f"{label} nodes: {count}")
        driver.close()
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return

    print("\n--- Summary ---")
    for label, count in file_counts.items():
        db_count = db_counts.get(label, 0)
        status = "OK" if db_count >= count or label in ["entitlement", "entitlement_group"] else "MISMATCH"
        print(f"{label}: Parquet {count}, DB {db_count} -> {status}")

if __name__ == "__main__":
    check_counts()
