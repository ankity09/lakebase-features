"""
Bulk seed script — generates 5M telemetry events + 600K features directly into Lakebase.
Run this ONCE from your local machine (not during app startup).

Usage:
    python scripts/bulk_seed.py --profile stable-trvrmk

Requires: psycopg2, databricks-sdk (or provide PGHOST/PGPASSWORD directly)
"""

import argparse
import io
import json
import logging
import os
import random
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# ── Data pools ─────────────────────────────────────────────────────

CUSTOMERS = [
    "acme-corp", "globex-inc", "initech-systems", "widget-co", "stark-industries",
    "waystar-royco", "umbrella-corp", "cyberdyne-tech", "weyland-corp", "oscorp-labs",
] + [f"{adj}-{noun}" for adj in [
    "apex", "atlas", "axon", "azure", "beacon", "carbon", "cipher", "cobalt", "core",
    "crest", "delta", "echo", "ember", "epoch", "flux", "forge", "frost", "fusion",
    "gamma", "grid",
] for noun in [
    "tech", "data", "labs", "corp", "sys", "net", "cloud", "io", "sec", "ai",
]]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko Firefox/123.0",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3) AppleWebKit/605.1.15",
]

HTTP_METHODS = ["GET"] * 70 + ["POST"] * 20 + ["PUT"] * 5 + ["DELETE"] * 3 + ["OPTIONS"] * 2
RESPONSE_CODES = [200] * 85 + [301] * 3 + [302] * 2 + [404] * 5 + [500] * 3 + [403] * 2
REGIONS = ["us-east-1"] * 40 + ["us-west-2"] * 25 + ["eu-west-1"] * 20 + ["ap-southeast-1"] * 15
REQUEST_PATHS = [
    "/api/v1/analytics", "/api/v1/threat-intel", "/api/v1/events", "/api/v1/metrics",
    "/dashboard/overview", "/dashboard/security", "/dashboard/performance",
    "/auth/login", "/auth/token", "/auth/refresh",
    "/api/v2/detections", "/api/v2/classifications", "/health", "/status",
]
TLS_VERSIONS = ["TLSv1.3"] * 60 + ["TLSv1.2"] * 35 + ["TLSv1.1"] * 5


def get_connection(profile: str):
    """Get psycopg2 connection using Databricks CLI credentials."""
    import psycopg2

    # Get instance info
    result = subprocess.run(
        ["databricks", "database", "get-database-instance", "lakebase-features",
         "--profile", profile, "-o", "json"],
        capture_output=True, text=True
    )
    instance = json.loads(result.stdout)
    host = instance["read_write_dns"]

    # Generate credential
    result = subprocess.run(
        ["databricks", "database", "generate-database-credential",
         "--json", json.dumps({"request_id": "bulk-seed", "instance_names": ["lakebase-features"]}),
         "--profile", profile, "-o", "json"],
        capture_output=True, text=True
    )
    token = json.loads(result.stdout)["token"]

    # Get user email
    result = subprocess.run(
        ["databricks", "current-user", "me", "--profile", profile, "-o", "json"],
        capture_output=True, text=True
    )
    email = json.loads(result.stdout)["userName"]

    return psycopg2.connect(
        host=host, port=5432, user=email, password=token,
        database="databricks_postgres", sslmode="require"
    )


def generate_telemetry_csv(num_rows: int) -> io.StringIO:
    """Generate telemetry events as CSV in memory for COPY."""
    logger.info(f"Generating {num_rows:,} telemetry events in memory...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for i in range(num_rows):
        customer = random.choice(CUSTOMERS)
        # Diurnal pattern
        days_ago = random.uniform(0, 90)
        hour = random.gauss(13, 4)  # Peak at 1pm
        hour = max(0, min(23, int(hour)))
        event_time = (now - timedelta(days=days_ago)).replace(
            hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59)
        )

        row = "\t".join([
            customer,
            event_time.isoformat(),
            f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            random.choice(USER_AGENTS),
            random.choice(HTTP_METHODS),
            random.choice(REQUEST_PATHS),
            str(random.choice(RESPONSE_CODES)),
            str(random.random() < 0.65).lower(),  # hsts_present
            str(random.randint(0, 15)),  # cookie_count
            str(random.random() < 0.4).lower(),  # has_analytics_cookie
            random.choice(TLS_VERSIONS),
            "application/json",
            str(random.randint(100, 50000)),  # payload_size_bytes
            random.choice(REGIONS),
        ])
        buf.write(row + "\n")

        if (i + 1) % 500000 == 0:
            logger.info(f"  Generated {i+1:,} / {num_rows:,} events")

    buf.seek(0)
    return buf


def generate_features_csv(num_customers: int, buckets_per_customer: int) -> io.StringIO:
    """Generate feature rows as CSV."""
    total = num_customers * buckets_per_customer
    logger.info(f"Generating {total:,} feature rows ({num_customers} customers × {buckets_per_customer} buckets)...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for customer in CUSTOMERS[:num_customers]:
        for b in range(buckets_per_customer):
            time_bucket = now - timedelta(minutes=5 * b)
            row = "\t".join([
                customer,
                time_bucket.isoformat(),
                str(random.random() < 0.65).lower(),
                str(random.randint(1, 50)),
                str(random.randint(10, 2000)),
                f"{random.uniform(500, 10000):.2f}",
                f"{random.random():.4f}",
                f"{random.random():.4f}",
            ])
            buf.write(row + "\n")

    buf.seek(0)
    return buf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="stable-trvrmk")
    parser.add_argument("--telemetry-rows", type=int, default=5_000_000)
    parser.add_argument("--feature-customers", type=int, default=200)
    parser.add_argument("--feature-buckets", type=int, default=3000)  # ~10 days of 5-min buckets
    parser.add_argument("--skip-telemetry", action="store_true")
    parser.add_argument("--skip-features", action="store_true")
    args = parser.parse_args()

    conn = get_connection(args.profile)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        if not args.skip_telemetry:
            # Check current row count
            cur.execute("SELECT COUNT(*) FROM appshield.telemetry_events")
            current = cur.fetchone()[0]
            logger.info(f"Current telemetry_events: {current:,} rows")

            if current >= args.telemetry_rows:
                logger.info("Already have enough telemetry rows, skipping")
            else:
                # Truncate and reload for clean state
                logger.info("Truncating telemetry_events...")
                cur.execute("TRUNCATE appshield.telemetry_events CASCADE")
                conn.commit()

                # Generate and COPY
                csv_buf = generate_telemetry_csv(args.telemetry_rows)

                logger.info(f"COPY-ing {args.telemetry_rows:,} rows into telemetry_events...")
                start = time.time()
                cur.execute("SET search_path TO appshield")
                cur.copy_from(
                    csv_buf,
                    "telemetry_events",
                    sep="\t",
                    columns=(
                        "customer_id", "event_time", "source_ip", "user_agent",
                        "http_method", "request_path", "response_code",
                        "hsts_present", "cookie_count", "has_analytics_cookie",
                        "tls_version", "content_type", "payload_size_bytes", "region"
                    ),
                )
                conn.commit()
                elapsed = time.time() - start
                logger.info(f"Telemetry COPY complete: {args.telemetry_rows:,} rows in {elapsed:.1f}s ({args.telemetry_rows/elapsed:.0f} rows/sec)")

        if not args.skip_features:
            cur.execute("SELECT COUNT(*) FROM appshield.customer_features")
            current = cur.fetchone()[0]
            total_features = args.feature_customers * args.feature_buckets
            logger.info(f"Current customer_features: {current:,} rows, target: {total_features:,}")

            if current >= total_features:
                logger.info("Already have enough feature rows, skipping")
            else:
                logger.info("Truncating customer_features...")
                cur.execute("TRUNCATE appshield.customer_features CASCADE")
                conn.commit()

                csv_buf = generate_features_csv(args.feature_customers, args.feature_buckets)

                logger.info(f"COPY-ing {total_features:,} feature rows...")
                start = time.time()
                cur.execute("SET search_path TO appshield")
                cur.copy_from(
                    csv_buf,
                    "customer_features",
                    sep="\t",
                    columns=(
                        "customer_id", "time_bucket", "hsts_present",
                        "unique_ips_5min", "request_count_5min",
                        "avg_payload_bytes", "cookie_diversity_score", "geo_diversity_score"
                    ),
                )
                conn.commit()
                elapsed = time.time() - start
                logger.info(f"Features COPY complete: {total_features:,} rows in {elapsed:.1f}s")

        # Verify
        cur.execute("SELECT COUNT(*) FROM appshield.telemetry_events")
        tel_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM appshield.customer_features")
        feat_count = cur.fetchone()[0]
        logger.info(f"Final counts — telemetry: {tel_count:,}, features: {feat_count:,}")

        # ANALYZE for query planner
        logger.info("Running ANALYZE...")
        conn.autocommit = True
        cur.execute("ANALYZE appshield.telemetry_events")
        cur.execute("ANALYZE appshield.customer_features")
        logger.info("Done!")

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
