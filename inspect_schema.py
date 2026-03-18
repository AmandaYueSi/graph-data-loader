import pandas as pd
import os
import json

def inspect_schemas():
    dir_path = r"C:\Users\Prabha\.gemini\antigravity\scratch\graph-data-loader\parquet_data_set"
    if not os.path.exists(dir_path):
        print(f"Directory not found: {dir_path}")
        return

    all_files = [f for f in os.listdir(dir_path) if f.endswith(".parquet")]

    schemas = {}
    for f in all_files:
        path = os.path.join(dir_path, f)
        df = pd.read_parquet(path)
        schemas[f] = df.columns.tolist()

    print(json.dumps(schemas, indent=2))

if __name__ == "__main__":
    inspect_schemas()
