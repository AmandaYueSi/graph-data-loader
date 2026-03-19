# Graph Data Loader

This project is designed to load data into a graph database (e.g., Neo4j).

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Run the loader:
```bash
python main.py
```

Generate FastRP embeddings after your data is loaded:
```bash
python fastrp_embeddings.py
```

Optional example with custom settings:
```bash
python fastrp_embeddings.py \
  --graph-name iam-embedding-graph \
  --embedding-property access_embedding \
  --embedding-dimension 128 \
  --iteration-weights 0.0,1.0,1.0
```

Run HDBSCAN anomaly detection directly from Neo4j node properties:
```bash
python hdbscan_anomaly_pipeline.py \
  --input-source neo4j \
  --id-column node_id \
  --id-property node_id \
  --embedding-column fastrp_embedding \
  --neo4j-node-labels Identity,Account,Entitlement,Application,Resource,EntitlementGroup \
  --feature-columns degree,pagerank,num_entitlements \
  --normalize-embeddings \
  --reduction pca \
  --reduction-dim 32 \
  --metric euclidean \
  --min-cluster-size 25 \
  --anomaly-percentile 99
```

Prerequisites:
- Your Neo4j instance must have the Graph Data Science library installed.
- `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` should be available in `.env`.
