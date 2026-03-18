import os
import pandas as pd
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def bulk_load_parquet(driver, file_path, cypher_query, batch_size=2000):
    """
    Reads a Parquet file and bulk-loads it into Neo4j using the provided Cypher query.
    
    :param driver: neo4j.Driver object
    :param file_path: Path to the .parquet file
    :param cypher_query: Parameterized Cypher query using UNWIND $rows AS row
    :param batch_size: Number of records per batch
    """
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Processing file: {os.path.basename(file_path)}...")
    
    try:
        # Read the parquet file
        df = pd.read_parquet(file_path)
        
        # Replace NaN with None for Neo4j compatibility
        df = df.where(pd.notnull(df), None)
        
        records = df.to_dict('records')
        total_records = len(records)
        
        with driver.session() as session:
            for i in range(0, total_records, batch_size):
                batch = records[i:i + batch_size]
                session.run(cypher_query, rows=batch)
                print(f"  Inserted batch {i//batch_size + 1} ({min(i + batch_size, total_records)}/{total_records} rows)")
                
        print(f"Successfully loaded {total_records} records from {os.path.basename(file_path)}.\n")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

def run_ingestion():
    """
    Caller method to load all 10 Parquet files from the IAM dataset.
    """
    uri = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
    user = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "12345678")
    
    data_dir = r"C:\Users\Prabha\.gemini\antigravity\scratch\graph-data-loader\parquet_data_set"
    
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    try:
        print("Starting comprehensive ingestion...\n")

        # 1. Applications
        app_query = """
        UNWIND $rows AS row
        MERGE (a:Application {app_id: row.app_id})
        SET a.name = row.app_name,
            a.criticality = row.business_criticality
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "applications.parquet"), app_query)

        # 2. Identities
        identity_query = """
        UNWIND $rows AS row
        MERGE (i:Identity {identity_id: row.identity_id})
        SET i.type = row.identity_type,
            i.status = row.status,
            i.location = row.location,
            i.department = row.department,
            i.job_title = row.job_title
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "identities.parquet"), identity_query)

        # 3. Resources
        resource_query = """
        UNWIND $rows AS row
        MERGE (r:Resource {resource_id: row.resource_id})
        SET r.source = row.iga_source_name,
            r.type = row.resource_type
        WITH r, row
        MATCH (a:Application {app_id: row.app_id})
        MERGE (r)-[:PART_OF]->(a)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "resources.parquet"), resource_query)

        # 4. Entitlements
        ent_query = """
        UNWIND $rows AS row
        MERGE (e:Entitlement {entitlement_id: row.entitlement_id})
        SET e.name = row.entitlement_name,
            e.requestable = row.is_requestable
        WITH e, row
        MATCH (r:Resource {resource_id: row.resource_id})
        MERGE (e)-[:ON_RESOURCE]->(r)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "entitlements.parquet"), ent_query)

        # 5. Accounts
        account_query = """
        UNWIND $rows AS row
        MERGE (acc:Account {account_id: row.account_id})
        SET acc.name = row.account_name,
            acc.privileged = row.is_privileged,
            acc.status = row.status
        WITH acc, row
        MATCH (i:Identity {identity_id: row.identity_id})
        MERGE (i)-[:HAS_ACCOUNT]->(acc)
        WITH acc, row
        MATCH (r:Resource {resource_id: row.resource_id})
        MERGE (acc)-[:ON_RESOURCE]->(r)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "accounts.parquet"), account_query)

        # 6. Account Entitlements
        acc_ent_query = """
        UNWIND $rows AS row
        MATCH (acc:Account {account_id: row.account_id})
        MATCH (e:Entitlement {entitlement_id: row.entitlement_id})
        MERGE (acc)-[:HAS_ENTITLEMENT {granted_at: row.grant_date, type: row.assignment_type}]->(e)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "account_entitlements.parquet"), acc_ent_query)

        # 7. Entitlement Groups
        group_query = """
        UNWIND $rows AS row
        MERGE (g:EntitlementGroup {ent_group_id: row.ent_group_id})
        SET g.name = row.group_name,
            g.type = row.type
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "entitlement_groups.parquet"), group_query)

        # 8. Group Entitlements
        grp_ent_query = """
        UNWIND $rows AS row
        MATCH (g:EntitlementGroup {ent_group_id: row.ent_group_id})
        MATCH (e:Entitlement {entitlement_id: row.entitlement_id})
        MERGE (g)-[:CONTAINS_ENTITLEMENT]->(e)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "group_entitlements.parquet"), grp_ent_query)

        # 9. Entitlement Group Assignments (Identity -> Group)
        grp_assign_query = """
        UNWIND $rows AS row
        MATCH (i:Identity {identity_id: row.identity_id})
        MATCH (g:EntitlementGroup {ent_group_id: row.ent_group_id})
        MERGE (i)-[:MEMBER_OF_GROUP {status: row.assignment_status}]->(g)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "entitlement_group_assignments.parquet"), grp_assign_query)

        # 10. Entitlement Group Relations (Hierarchies)
        grp_rel_query = """
        UNWIND $rows AS row
        MATCH (parent:EntitlementGroup {ent_group_id: row.parent_ent_group_id})
        MATCH (child:EntitlementGroup {ent_group_id: row.child_ent_group_id})
        MERGE (parent)-[:HAS_CHILD_GROUP]->(child)
        """
        bulk_load_parquet(driver, os.path.join(data_dir, "entitlement_group_relations.parquet"), grp_rel_query)

        print("\nAll data re-mapped and ready for ingestion.")

    except Exception as e:
        print(f"Ingestion error: {e}")
    finally:
        driver.close()

if __name__ == "__main__":
    run_ingestion()
