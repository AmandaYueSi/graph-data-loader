import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Neo4jLoader:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def clear_database(self):
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            print("Database cleared.")

    def load_sample_data(self):
        with self.driver.session() as session:
            # Create a simple Person -> BELONGS_TO -> Department graph
            query = """
            MERGE (p:Person {name: $person_name})
            MERGE (d:Department {name: $dept_name})
            MERGE (p)-[:BELONGS_TO]->(d)
            RETURN p, d
            """
            result = session.run(query, person_name="Alice", dept_name="Engineering")
            record = result.single()
            if record:
                print(f"Created relationship: {record['p']['name']} works in {record['d']['name']}")
            
            session.run(query, person_name="Bob", dept_name="Engineering")
            session.run(query, person_name="Charlie", dept_name="Design")
            print("Sample data loaded successfully.")

if __name__ == "__main__":
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")

    if not all([uri, user, password]):
        print("Error: Neo4j credentials not found in environment variables.")
    else:
        loader = Neo4jLoader(uri, user, password)
        try:
            print(f"Connecting to Neo4j at {uri}...")
            # Verify connection
            loader.driver.verify_connectivity()
            print("Connection successful!")
            
            loader.clear_database()
            loader.load_sample_data()
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            loader.close()
