import argparse
import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from mlxtend.frequent_patterns import association_rules, fpgrowth
from mlxtend.preprocessing import TransactionEncoder
from neo4j import GraphDatabase


DEFAULT_GENERIC_PATTERNS = [
    "basic",
    "baseline",
    "default",
    "standard",
    "email",
    "sso",
    "vpn",
]


@dataclass
class CohortConfig:
    name: str
    filters: dict[str, str]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Mine role candidates from Neo4j user entitlement data using FP-Growth."
    )
    parser.add_argument(
        "--output-path",
        default="neo4j_role_candidates.json",
        help="Path to the output JSON file.",
    )
    parser.add_argument(
        "--min-support",
        type=float,
        default=0.02,
        help="Minimum support threshold for FP-Growth.",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.0,
        help="Minimum confidence threshold for association rules. Set to 0 to skip rule generation.",
    )
    parser.add_argument(
        "--min-itemset-size",
        type=int,
        default=2,
        help="Minimum number of entitlements required for a role candidate.",
    )
    parser.add_argument(
        "--max-itemset-size",
        type=int,
        default=8,
        help="Maximum number of entitlements allowed in a role candidate.",
    )
    parser.add_argument(
        "--cohort-columns",
        default="department",
        help="Comma-separated identity properties used for cohort mining.",
    )
    parser.add_argument(
        "--min-cohort-size",
        type=int,
        default=100,
        help="Minimum number of users required to mine a cohort.",
    )
    parser.add_argument(
        "--max-cohort-values-per-column",
        type=int,
        default=10,
        help="Maximum number of cohort values to mine per cohort column, ranked by user count.",
    )
    parser.add_argument(
        "--generic-entitlements",
        default="",
        help="Comma-separated entitlement names to exclude before mining.",
    )
    parser.add_argument(
        "--generic-patterns",
        default=",".join(DEFAULT_GENERIC_PATTERNS),
        help="Comma-separated case-insensitive substrings used to filter generic entitlements.",
    )
    parser.add_argument(
        "--support-ubiquity-threshold",
        type=float,
        default=0.8,
        help="Exclude entitlements present in more than this fraction of users.",
    )
    parser.add_argument(
        "--write-to-neo4j",
        action="store_true",
        help="Write role candidates and proposed relationships back into Neo4j.",
    )
    parser.add_argument(
        "--global-only",
        action="store_true",
        help="Mine only the global population and skip cohort-specific mining for faster execution.",
    )
    return parser


def parse_csv_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Neo4jRoleMiner:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self) -> None:
        self.driver.close()

    def fetch_transactions(self) -> pd.DataFrame:
        query = """
        MATCH (i:Identity)-[:HAS_ACCOUNT]->(a:Account)-[:HAS_ENTITLEMENT]->(e:Entitlement)
        WITH i, collect(DISTINCT coalesce(e.name, e.entitlement_id)) AS entitlements
        WHERE size(entitlements) > 0
        RETURN
            i.identity_id AS user_id,
            coalesce(i.department, 'Unknown') AS department,
            coalesce(i.job_title, 'Unknown') AS job_title,
            coalesce(i.location, 'Unknown') AS location,
            entitlements
        """
        with self.driver.session() as session:
            records = session.run(query).data()
        return pd.DataFrame(records)

    def write_role_candidates(self, candidates: list[dict]) -> None:
        role_query = """
        UNWIND $rows AS row
        MERGE (r:ProposedRole {role_candidate_id: row.role_candidate_id})
        SET r.role_name = row.role_name,
            r.support_score = row.support_score,
            r.user_count = row.user_count,
            r.cohort_scope = row.cohort_scope,
            r.candidate_type = row.candidate_type,
            r.dominant_department = row.dominant_department,
            r.dominant_job_title = row.dominant_job_title,
            r.dominant_location = row.dominant_location,
            r.rule_confidence = row.rule_confidence,
            r.rule_lift = row.rule_lift
        """
        entitlement_query = """
        UNWIND $rows AS row
        MATCH (r:ProposedRole {role_candidate_id: row.role_candidate_id})
        UNWIND row.entitlement_set AS entitlement_name
        MATCH (e:Entitlement)
        WHERE coalesce(e.name, e.entitlement_id) = entitlement_name
        MERGE (r)-[:PROPOSES_ENTITLEMENT]->(e)
        """
        with self.driver.session() as session:
            session.run(role_query, rows=candidates).consume()
            session.run(entitlement_query, rows=candidates).consume()


def normalize_transactions(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy()
    normalized["entitlements"] = normalized["entitlements"].apply(
        lambda values: sorted(set(str(value).strip() for value in values if str(value).strip()))
    )
    normalized = normalized[normalized["entitlements"].map(bool)].reset_index(drop=True)
    return normalized


def find_generic_entitlements(
    transactions: pd.DataFrame,
    explicit_generic: set[str],
    generic_patterns: list[str],
    ubiquity_threshold: float,
) -> set[str]:
    user_count = len(transactions)
    exploded = transactions[["user_id", "entitlements"]].explode("entitlements")
    support_by_entitlement = (
        exploded.groupby("entitlements")["user_id"].nunique().div(user_count).sort_values(ascending=False)
    )

    generic = set(explicit_generic)
    generic.update(
        entitlement
        for entitlement, support in support_by_entitlement.items()
        if support >= ubiquity_threshold
    )

    lowered_patterns = [pattern.lower() for pattern in generic_patterns]
    for entitlement in support_by_entitlement.index:
        if any(pattern in entitlement.lower() for pattern in lowered_patterns):
            generic.add(entitlement)
    return generic


def filter_generic_entitlements(transactions: pd.DataFrame, generic_entitlements: set[str]) -> pd.DataFrame:
    filtered = transactions.copy()
    filtered["entitlements"] = filtered["entitlements"].apply(
        lambda items: [item for item in items if item not in generic_entitlements]
    )
    filtered = filtered[filtered["entitlements"].map(len) > 0].reset_index(drop=True)
    return filtered


def build_cohorts(
    transactions: pd.DataFrame,
    cohort_columns: list[str],
    min_cohort_size: int,
    max_cohort_values_per_column: int,
) -> list[CohortConfig]:
    cohorts = [CohortConfig(name="global", filters={})]
    for column in cohort_columns:
        if column not in transactions.columns:
            continue
        counts = transactions[column].value_counts()
        for value, count in counts.head(max_cohort_values_per_column).items():
            if count < min_cohort_size:
                continue
            safe_value = str(value)
            cohorts.append(
                CohortConfig(
                    name=f"{column}={safe_value}",
                    filters={column: safe_value},
                )
            )
    return cohorts


def select_transactions(transactions: pd.DataFrame, cohort: CohortConfig) -> pd.DataFrame:
    scoped = transactions
    for column, value in cohort.filters.items():
        scoped = scoped[scoped[column] == value]
    return scoped.reset_index(drop=True)


def encode_transactions(transactions: list[list[str]]) -> pd.DataFrame:
    encoder = TransactionEncoder()
    encoded = encoder.fit(transactions).transform(transactions)
    return pd.DataFrame(encoded, columns=encoder.columns_)


def prune_infrequent_entitlements(
    scoped_transactions: pd.DataFrame,
    min_support: float,
) -> pd.DataFrame:
    min_count = max(1, math.ceil(len(scoped_transactions) * min_support))
    exploded = scoped_transactions[["user_id", "entitlements"]].explode("entitlements")
    supported_items = set(
        exploded.groupby("entitlements")["user_id"].nunique().loc[lambda values: values >= min_count].index
    )
    pruned = scoped_transactions.copy()
    pruned["entitlements"] = pruned["entitlements"].apply(
        lambda items: [item for item in items if item in supported_items]
    )
    pruned = pruned[pruned["entitlements"].map(bool)].reset_index(drop=True)
    return pruned


def mine_itemsets(
    scoped_transactions: pd.DataFrame,
    min_support: float,
    min_itemset_size: int,
    max_itemset_size: int,
) -> pd.DataFrame:
    scoped_transactions = prune_infrequent_entitlements(scoped_transactions, min_support=min_support)
    if len(scoped_transactions) < 2:
        return pd.DataFrame()
    basket = encode_transactions(scoped_transactions["entitlements"].tolist())
    itemsets = fpgrowth(basket, min_support=min_support, use_colnames=True)
    if itemsets.empty:
        return itemsets
    itemsets["itemset_size"] = itemsets["itemsets"].map(len)
    itemsets = itemsets[
        (itemsets["itemset_size"] >= min_itemset_size)
        & (itemsets["itemset_size"] <= max_itemset_size)
    ].copy()
    itemsets["entitlement_set"] = itemsets["itemsets"].apply(lambda values: sorted(values))
    itemsets["user_count"] = (itemsets["support"] * len(scoped_transactions)).round().astype(int)
    return itemsets.sort_values(["support", "itemset_size"], ascending=[False, False]).reset_index(drop=True)


def build_rule_lookup(itemsets: pd.DataFrame, min_confidence: float) -> dict[tuple[str, ...], dict]:
    if itemsets.empty or min_confidence <= 0:
        return {}
    rules = association_rules(itemsets[["support", "itemsets"]], metric="confidence", min_threshold=min_confidence)
    if rules.empty:
        return {}
    rules["combined"] = rules.apply(
        lambda row: tuple(sorted(set(row["antecedents"]).union(set(row["consequents"])))),
        axis=1,
    )
    best_rules: dict[tuple[str, ...], dict] = {}
    for _, row in rules.sort_values(["confidence", "lift"], ascending=[False, False]).iterrows():
        key = row["combined"]
        if key in best_rules:
            continue
        best_rules[key] = {
            "confidence": float(row["confidence"]),
            "lift": float(row["lift"]),
        }
    return best_rules


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "role"


def infer_theme(entitlement_set: list[str]) -> str:
    tokens = []
    for entitlement in entitlement_set:
        pieces = re.split(r"[^A-Za-z0-9]+", entitlement)
        tokens.extend(piece for piece in pieces if len(piece) >= 4)
    if not tokens:
        return "Access"
    counts = pd.Series(tokens).str.lower().value_counts()
    if counts.empty:
        return "Access"
    return counts.index[0].replace("_", " ").title()


def build_role_name(cohort: CohortConfig, scoped_transactions: pd.DataFrame, entitlement_set: list[str]) -> str:
    if cohort.name == "global":
        prefix = "Global"
    else:
        column, value = next(iter(cohort.filters.items()))
        prefix = f"{str(value).title()} {column.replace('_', ' ').title()}"
    theme = infer_theme(entitlement_set)
    return f"{prefix} {theme} Role"


def summarize_dominant_values(scoped_transactions: pd.DataFrame, column: str) -> str:
    if column not in scoped_transactions.columns or scoped_transactions.empty:
        return "Unknown"
    mode = scoped_transactions[column].mode(dropna=True)
    return str(mode.iloc[0]) if not mode.empty else "Unknown"


def build_candidates_for_cohort(
    cohort: CohortConfig,
    scoped_transactions: pd.DataFrame,
    itemsets: pd.DataFrame,
    min_confidence: float,
) -> list[dict]:
    rule_lookup = build_rule_lookup(itemsets, min_confidence=min_confidence)
    candidates = []
    for index, row in itemsets.iterrows():
        entitlement_set = row["entitlement_set"]
        key = tuple(entitlement_set)
        role_candidate_id = f"{slugify(cohort.name)}-{index + 1}"
        candidates.append(
            {
                "role_candidate_id": role_candidate_id,
                "role_name": build_role_name(cohort, scoped_transactions, entitlement_set),
                "entitlement_set": entitlement_set,
                "support_score": round(float(row["support"]), 6),
                "user_count": int(row["user_count"]),
                "cohort_scope": cohort.name,
                "candidate_type": "global" if cohort.name == "global" else "cohort",
                "dominant_department": summarize_dominant_values(scoped_transactions, "department"),
                "dominant_job_title": summarize_dominant_values(scoped_transactions, "job_title"),
                "dominant_location": summarize_dominant_values(scoped_transactions, "location"),
                "rule_confidence": round(rule_lookup.get(key, {}).get("confidence", 0.0), 6),
                "rule_lift": round(rule_lookup.get(key, {}).get("lift", 0.0), 6),
            }
        )
    return candidates


def deduplicate_candidates(candidates: list[dict]) -> list[dict]:
    seen: dict[tuple[str, ...], dict] = {}
    for candidate in sorted(
        candidates,
        key=lambda item: (item["support_score"], len(item["entitlement_set"]), item["candidate_type"] == "global"),
        reverse=True,
    ):
        key = tuple(candidate["entitlement_set"])
        if key not in seen:
            seen[key] = candidate
    return list(seen.values())


def main() -> None:
    load_dotenv()
    args = build_parser().parse_args()

    uri = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
    user = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")
    if not password:
        raise SystemExit("Missing NEO4J_PASSWORD in environment variables.")

    miner = Neo4jRoleMiner(uri, user, password)
    try:
        print(f"Connecting to Neo4j at {uri}...")
        miner.driver.verify_connectivity()
        print("Neo4j connection successful.")

        print("Fetching identity entitlement transactions from Neo4j...")
        transactions = normalize_transactions(miner.fetch_transactions())
        if transactions.empty:
            raise SystemExit("No identity entitlement transactions found in Neo4j.")
        print(
            "Fetched "
            f"{len(transactions)} user transactions with "
            f"{transactions['entitlements'].map(len).sum()} total entitlement assignments."
        )
        print(
            "Average entitlements per user: "
            f"{transactions['entitlements'].map(len).mean():.2f}"
        )

        print("Detecting generic entitlements to exclude from role mining...")
        generic_entitlements = find_generic_entitlements(
            transactions=transactions,
            explicit_generic=set(parse_csv_list(args.generic_entitlements)),
            generic_patterns=parse_csv_list(args.generic_patterns),
            ubiquity_threshold=args.support_ubiquity_threshold,
        )
        print(f"Filtered {len(generic_entitlements)} generic entitlements.")
        filtered_transactions = filter_generic_entitlements(transactions, generic_entitlements)
        if filtered_transactions.empty:
            raise SystemExit("All entitlements were filtered out as generic.")
        print(
            "Remaining "
            f"{len(filtered_transactions)} user transactions after filtering generic entitlements."
        )

        if args.global_only:
            cohorts = [CohortConfig(name="global", filters={})]
            print("Global-only mode enabled. Skipping cohort-specific mining.")
        else:
            cohorts = build_cohorts(
                filtered_transactions,
                cohort_columns=parse_csv_list(args.cohort_columns),
                min_cohort_size=args.min_cohort_size,
                max_cohort_values_per_column=args.max_cohort_values_per_column,
            )
        print(f"Prepared {len(cohorts)} mining scopes (including global scope).")
        if args.min_confidence <= 0:
            print("Association rule generation is disabled for faster execution.")

        all_candidates: list[dict] = []
        for position, cohort in enumerate(cohorts, start=1):
            scoped = select_transactions(filtered_transactions, cohort)
            print(
                f"[{position}/{len(cohorts)}] Mining scope '{cohort.name}' "
                f"with {len(scoped)} users..."
            )
            if len(scoped) < args.min_cohort_size and cohort.name != "global":
                print(f"  Skipping '{cohort.name}' because it has fewer than {args.min_cohort_size} users.")
                continue
            if len(scoped) < 2:
                print(f"  Skipping '{cohort.name}' because it has fewer than 2 users.")
                continue

            itemsets = mine_itemsets(
                scoped_transactions=scoped,
                min_support=args.min_support,
                min_itemset_size=args.min_itemset_size,
                max_itemset_size=args.max_itemset_size,
            )
            if itemsets.empty:
                print(f"  No frequent itemsets found for '{cohort.name}'.")
                continue
            print(
                f"  Found {len(itemsets)} frequent entitlement bundles in '{cohort.name}'."
            )

            cohort_candidates = build_candidates_for_cohort(
                cohort=cohort,
                scoped_transactions=scoped,
                itemsets=itemsets,
                min_confidence=args.min_confidence,
            )
            all_candidates.extend(cohort_candidates)
            print(f"  Produced {len(cohort_candidates)} role candidates for '{cohort.name}'.")

        deduped = deduplicate_candidates(all_candidates)
        print(
            f"Deduplicated {len(all_candidates)} raw candidates down to {len(deduped)} unique role candidates."
        )
        output = {
            "summary": {
                "users_analyzed": int(len(filtered_transactions)),
                "generic_entitlements_filtered": sorted(generic_entitlements),
                "candidate_count": int(len(deduped)),
            },
            "role_candidates": deduped,
        }

        Path(args.output_path).write_text(json.dumps(output, indent=2))
        print(f"Wrote {len(deduped)} role candidates to {args.output_path}")

        if args.write_to_neo4j and deduped:
            print("Writing proposed roles and entitlement relationships back to Neo4j...")
            miner.write_role_candidates(deduped)
            print("Wrote proposed roles back to Neo4j.")
    finally:
        miner.close()


if __name__ == "__main__":
    main()
