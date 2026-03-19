import argparse
import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# Try importing different LLM providers
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class RoleMiner:
    def __init__(self, provider: str = "openai", model: Optional[str] = None):
        """
        Initialize role miner with specified LLM provider.
        
        Args:
            provider: 'openai', 'anthropic', or 'ollama'
            model: Model name (optional, uses defaults if not specified)
        """
        self.provider = provider
        
        if provider == "openai":
            if not HAS_OPENAI:
                raise ImportError("OpenAI package not installed. Install with: pip install openai")
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.model = model or "gpt-4-turbo"
        
        elif provider == "anthropic":
            if not HAS_ANTHROPIC:
                raise ImportError("Anthropic package not installed. Install with: pip install anthropic")
            self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            self.model = model or "claude-3-5-sonnet-20241022"
        
        elif provider == "ollama":
            # For Ollama, we'll use requests to call the local API
            self.model = model or "mistral"
            self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def generate_role_name(self, entitlements: list[str], cluster_id: str) -> dict:
        """
        Use LLM to suggest a role name and description for a cluster of entitlements.
        
        Args:
            entitlements: List of entitlement IDs/names in the cluster
            cluster_id: Identifier of the cluster
        
        Returns:
            Dictionary with role_name, role_description, and justification
        """
        entitlements_str = "\n".join(f"  - {e}" for e in sorted(entitlements))
        
        system_prompt = """You are an IAM (Identity and Access Management) expert specializing in role design. 
Your task is to analyze a list of entitlements and suggest a meaningful role name that describes the purpose and scope of the role.

Guidelines:
- Role names should be descriptive and follow common IAM conventions (e.g., "Developer", "Finance Manager", "Data Analyst")
- Consider the patterns and keywords in the entitlement names
- The role name should be concise (2-5 words)
- Description should explain the primary purpose and access level
- Justification should explain why these entitlements logically group together"""
        
        user_prompt = f"""Cluster ID: {cluster_id}
Number of entitlements: {len(entitlements)}

Entitlements in this cluster:
{entitlements_str}

Please analyze these entitlements and provide:
1. A suggested role name
2. A brief role description (1-2 sentences)
3. Justification for why these entitlements group together

Format your response as valid JSON with these keys:
- "role_name": string
- "role_description": string  
- "justification": string"""
        
        if self.provider == "openai":
            return self._call_openai(system_prompt, user_prompt)
        elif self.provider == "anthropic":
            return self._call_anthropic(system_prompt, user_prompt)
        elif self.provider == "ollama":
            return self._call_ollama(system_prompt, user_prompt)
    
    def _call_openai(self, system_prompt: str, user_prompt: str) -> dict:
        """Call OpenAI API"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = response.choices[0].message.content
            result = json.loads(response_text)
            return result
        
        except json.JSONDecodeError:
            return {
                "role_name": "Unknown Role",
                "role_description": "Failed to parse LLM response",
                "justification": response_text
            }
        except Exception as e:
            print(f"Error calling OpenAI: {e}")
            return {
                "role_name": "Unknown Role",
                "role_description": f"Error: {str(e)}",
                "justification": ""
            }
    
    def _call_anthropic(self, system_prompt: str, user_prompt: str) -> dict:
        """Call Anthropic Claude API"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            response_text = response.content[0].text
            result = json.loads(response_text)
            return result
        
        except json.JSONDecodeError:
            return {
                "role_name": "Unknown Role",
                "role_description": "Failed to parse LLM response",
                "justification": response_text
            }
        except Exception as e:
            print(f"Error calling Anthropic: {e}")
            return {
                "role_name": "Unknown Role",
                "role_description": f"Error: {str(e)}",
                "justification": ""
            }
    
    def _call_ollama(self, system_prompt: str, user_prompt: str) -> dict:
        """Call local Ollama instance"""
        import requests
        
        try:
            combined_prompt = f"{system_prompt}\n\n{user_prompt}"
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": combined_prompt,
                    "stream": False
                },
                timeout=60
            )
            
            response_text = response.json()["response"]
            
            # Extract JSON from response
            try:
                # Try to find JSON in the response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                    return result
            except:
                pass
            
            return {
                "role_name": "Unknown Role",
                "role_description": "Failed to parse LLM response",
                "justification": response_text
            }
        
        except Exception as e:
            print(f"Error calling Ollama: {e}")
            return {
                "role_name": "Unknown Role",
                "role_description": f"Error: {str(e)}",
                "justification": ""
            }
    
    def process_clusters(self, clusters_input: list[dict]) -> list[dict]:
        """
        Process all clusters and generate role names.
        
        Args:
            clusters_input: List of cluster dictionaries with cluster_id and entitlements
        
        Returns:
            List of cluster dictionaries with added role assignments
        """
        results = []
        
        for i, cluster in enumerate(clusters_input, 1):
            cluster_id = cluster.get("cluster_id", f"cluster_{i}")
            entitlements = cluster.get("entitlements", [])
            
            print(f"Processing {cluster_id} ({len(entitlements)} entitlements)...")
            
            role_info = self.generate_role_name(entitlements, cluster_id)
            
            # Combine original cluster data with role information
            enriched_cluster = {
                "cluster_id": cluster_id,
                "entitlements": entitlements,
                "role_name": role_info.get("role_name", "Unknown Role"),
                "role_description": role_info.get("role_description", ""),
                "justification": role_info.get("justification", "")
            }
            
            results.append(enriched_cluster)
            print(f"  → Role: {enriched_cluster['role_name']}")
        
        return results


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate IAM role names and descriptions for entitlement clusters using LLM."
    )
    parser.add_argument(
        "--input-path",
        default="entitlement_clusters.json",
        help="Path to the entitlement clusters JSON file.",
    )
    parser.add_argument(
        "--output-path",
        default="entitlement_roles.json",
        help="Path to the output JSON file with assigned roles.",
    )
    parser.add_argument(
        "--provider",
        choices=["openai", "anthropic", "ollama"],
        default="openai",
        help="LLM provider to use for role generation.",
    )
    parser.add_argument(
        "--model",
        help="Specific model to use (optional, uses provider defaults if not specified).",
    )
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    
    input_path = Path(args.input_path)
    output_path = Path(args.output_path)
    
    # Validate input file
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return
    
    # Load clusters
    print(f"Loading clusters from {input_path}...")
    with open(input_path, "r") as f:
        clusters = json.load(f)
    
    print(f"Loaded {len(clusters)} clusters")
    
    # Initialize role miner
    print(f"Initializing {args.provider} provider...")
    miner = RoleMiner(provider=args.provider, model=args.model)
    
    # Process clusters
    print("Generating role names and descriptions...\n")
    enriched_clusters = miner.process_clusters(clusters)
    
    # Save results
    print(f"\nSaving results to {output_path}...")
    with open(output_path, "w") as f:
        json.dump(enriched_clusters, f, indent=2)
    
    print(f"\n✓ Successfully processed {len(enriched_clusters)} clusters")
    print(f"✓ Results saved to {output_path}")
    
    # Print summary
    print("\nRole Summary:")
    print("-" * 80)
    for cluster in enriched_clusters:
        print(f"{cluster['cluster_id']:15} → {cluster['role_name']}")
        print(f"  {cluster['role_description']}")
        print()


if __name__ == "__main__":
    main()
