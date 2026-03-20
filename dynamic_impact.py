import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    import boto3
except ImportError:
    boto3 = None

load_dotenv()

class ImpactAnalyzer:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        
        # Initialize OpenAI if key is present
        self.ai_client = None
        api_key = os.getenv("OPENAI_API_KEY")
        if OpenAI and api_key and api_key != "your_api_key_here":
            self.ai_client = OpenAI(api_key=api_key)
            
        # Initialize AWS Bedrock if region is present
        self.bedrock_client = None
        region = os.getenv("AWS_REGION")
        if boto3 and region:
            try:
                self.bedrock_client = boto3.client(
                    service_name='bedrock-runtime',
                    region_name=region
                )
            except Exception as e:
                print(f"Warning: Failed to initialize Bedrock client: {e}")

    def close(self):
        self.driver.close()

    def search_application_impact(self, search_term):
        print(f"\n--- Analyzing Impact for Application matching: '{search_term}' ---")
        query = """
        MATCH (app:Application)
        WHERE app.appId CONTAINS $term OR app.name CONTAINS $term
        
        MATCH (app)<-[:PART_OF]-(res:Resource)<-[:ON_RESOURCE]-(acc:Account)-[:BELONGS_TO]->(user:Identity)
        
        WITH app, count(DISTINCT user) AS total_users, collect(DISTINCT user) AS users
        UNWIND users AS u
        WITH app, total_users, u.department AS dept, count(*) AS dept_count
        ORDER BY dept_count DESC
        
        RETURN 
            app.appId AS appId,
            app.name AS appName,
            total_users,
            collect({department: dept, count: dept_count})[0..3] AS top_departments
        """
        with self.driver.session() as session:
            results = session.run(query, term=search_term).data()
            return results

    def search_entitlement_impact(self, search_term):
        print(f"\n--- Analyzing Impact for Entitlement matching: '{search_term}' ---")
        query = """
        MATCH (e:Entitlement)
        WHERE e.entitlementId CONTAINS $term OR e.entitlement_name CONTAINS $term
        
        // Path 1: Direct via Account
        OPTIONAL MATCH (e)<-[:HAS_ENTITLEMENT]-(acc:Account)-[:BELONGS_TO]->(u1:Identity)
        
        // Path 2: Indirect via Groups
        OPTIONAL MATCH (e)<-[:GRANTS]-(grp:EntitlementGroup)<-[:PARENT_OF*0..]-(top_grp:EntitlementGroup)<-[:MEMBER_OF]-(u2:Identity)
        
        WITH e, collect(DISTINCT u1) + collect(DISTINCT u2) AS all_users
        UNWIND all_users AS user
        WITH e, user WHERE user IS NOT NULL
        
        WITH e, count(DISTINCT user) AS total_users, collect(DISTINCT user) AS users
        UNWIND users AS u
        WITH e, total_users, u.department AS dept, count(*) AS dept_count
        ORDER BY dept_count DESC
        
        RETURN 
            e.entitlementId AS entitlementId,
            e.entitlement_name AS name,
            total_users,
            collect({department: dept, count: dept_count})[0..3] AS top_departments
        """
        with self.driver.session() as session:
            results = session.run(query, term=search_term).data()
            return results

    def run_impact_report(self, term, search_type="app"):
        if search_type == "app":
            results = self.search_application_impact(term)
        else:
            results = self.search_entitlement_impact(term)
            
        if not results:
            print(f"No matches found for {search_type} search: '{term}'")
            return

        for res in results:
            print(f"\nRESULT: {res.get('appName', res.get('name'))} ({res.get('appId', res.get('entitlementId'))})")
            print(f"Total Users Affected: {res['total_users']}")
            print("Top Impacted Departments:")
            for dept in res['top_departments']:
                print(f"  - {dept['department']}: {dept['count']} users")
            
            # AI IMPACT NARRATIVE
            print("\n[AI IMPACT NARRATIVE]")
            if self.bedrock_client:
                narrative = self.generate_bedrock_narrative(res, search_type)
                print(f"(AWS Bedrock): {narrative}")
            elif self.ai_client:
                narrative = self.generate_ai_narrative(res, search_type)
                print(f"(OpenAI): {narrative}")
            else:
                # Fallback simple logic
                if res['total_users'] > 500:
                    print(f"CRITICAL: Removal of this {search_type} will cause widespread disruption in {res['top_departments'][0]['department']}. Suggest gradual roll-off.")
                else:
                    print(f"MODERATE: Limited impact focused on {res['top_departments'][0]['department']}. Risk is localized.")

    def generate_ai_narrative(self, data, search_type):
        prompt = f"""
        You are an IAM Security Architect. Analyze the following impact data for removing an {search_type}.
        
        Data: {json.dumps(data, indent=2)}
        
        Provide a 2-3 sentence 'Plain English' explanation of the business impact. 
        Focus on which departments are most affected and the potential 'blast radius' if this was an accidental deletion.
        """
        try:
            response = self.ai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"Error generating AI narrative: {e}"

    def generate_bedrock_narrative(self, data, search_type):
        model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.titan-text-express-v1")
        prompt = f"""
        You are an IAM Security Architect. Analyze the following impact data for removing an {search_type}.
        
        Data: {json.dumps(data, indent=2)}
        
        Provide a 2-3 sentence 'Plain English' explanation of the business impact. 
        Focus on which departments are most affected and the potential 'blast radius' if this was an accidental deletion.
        """
        
        # Structure payload based on model provider
        if "anthropic" in model_id:
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": f"Human: {prompt}\n\nAssistant:"}]
            })
        elif "amazon" in model_id:
            body = json.dumps({
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 3072,
                    "stopSequences": [],
                    "temperature": 0.5,
                    "topP": 0.9
                }
            })
        elif "mistral" in model_id:
            body = json.dumps({
                "prompt": f"<s>[INST] {prompt} [/INST]",
                "max_tokens": 200,
                "temperature": 0.5
            })
        else:
            return f"Error: Model provider for {model_id} not yet supported in this script."
        
        try:
            response = self.bedrock_client.invoke_model(
                body=body,
                modelId=model_id
            )
            response_body = json.loads(response.get('body').read())
            
            if "anthropic" in model_id:
                return response_body['content'][0]['text'].strip()
            elif "amazon" in model_id:
                return response_body['results'][0]['outputText'].strip()
            elif "mistral" in model_id:
                return response_body['outputs'][0]['text'].strip()
                
        except Exception as e:
            return f"Error generating Bedrock narrative: {e}"

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Dynamic IAM Impact Analyzer")
    parser.add_argument("query", help="Search term for Application or Entitlement")
    parser.add_argument("--type", choices=["app", "ent"], default="app", help="Type of search (default: app)")
    args = parser.parse_args()
    
    analyzer = ImpactAnalyzer()
    try:
        analyzer.run_impact_report(args.query, args.type)
    finally:
        analyzer.close()
