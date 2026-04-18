import json
import logging
import math
import random
from datetime import datetime, timedelta, timezone

from app.services.db import get_conn

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data pools
# ---------------------------------------------------------------------------

CUSTOMERS = [
    # 10 named anchors
    "acme-corp", "globex-inc", "initech-systems", "widget-co", "stark-industries",
    "waystar-royco", "umbrella-corp", "cyberdyne-tech", "weyland-corp", "oscorp-labs",
    # 190 generated from adjective + noun combos
    *[
        f"{adj}-{noun}"
        for adj in [
            "apex", "atlas", "axon", "azure", "beacon", "carbon", "cipher",
            "cobalt", "core", "crest", "delta", "echo", "ember", "epoch",
            "flux", "forge", "frost", "fusion", "gamma", "grid", "helix",
            "hydra", "ion", "iris", "krypton", "lattice", "lens", "lumen",
            "magna", "matrix", "nexus", "nova", "onyx", "orbit", "paladin",
            "peak", "pulse", "quasar", "radix", "rally", "redux", "relay",
            "rune", "sigma", "slate", "solar", "solus", "sonic", "spark",
            "steel", "stone", "storm", "swift", "synth", "terra", "titan",
            "token", "torch", "torus", "track", "ultra", "unity", "vault",
            "vector", "vega", "velo", "venom", "vertex", "vibe", "vista",
            "volta", "vortex", "wave", "xenon", "yield", "zeal", "zenith",
            "zero", "zeta", "zinc",
        ]
        for noun in ["systems", "tech", "labs", "corp", "dynamics", "works", "io"]
    ][:190],
]
# Trim to exactly 200
CUSTOMERS = CUSTOMERS[:200]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.90 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "python-requests/2.31.0",
    "python-httpx/0.26.0",
    "Go-http-client/2.0",
    "axios/1.6.7",
    "curl/8.5.0",
    "PostmanRuntime/7.36.3",
    "okhttp/4.12.0",
    "Apache-HttpClient/4.5.14 (Java/17.0.10)",
    "Jakarta Commons-HttpClient/3.1",
    "Wget/1.21.4",
    "libwww-perl/6.72",
    "node-fetch/3.3.2",
    "undici/5.28.3",
    "fasthttp",
]

HTTP_METHODS = (
    ["GET"] * 70
    + ["POST"] * 20
    + ["PUT"] * 5
    + ["DELETE"] * 3
    + ["OPTIONS"] * 2
)

RESPONSE_CODES = (
    [200] * 85
    + [301] * 3
    + [302] * 2
    + [404] * 5
    + [500] * 3
    + [403] * 2
)

REGIONS = (
    ["us-east-1"] * 40
    + ["us-west-2"] * 25
    + ["eu-west-1"] * 20
    + ["ap-southeast-1"] * 15
)

REQUEST_PATHS = [
    "/api/v1/analytics",
    "/api/v1/threat-intel",
    "/api/v1/events",
    "/api/v1/metrics",
    "/dashboard/overview",
    "/dashboard/security",
    "/dashboard/performance",
    "/auth/login",
    "/auth/token",
    "/auth/refresh",
    "/api/v2/detections",
    "/api/v2/classifications",
    "/health",
    "/status",
]

TLS_VERSIONS = ["TLSv1.3"] * 60 + ["TLSv1.2"] * 35 + ["TLSv1.1"] * 5

APP_CLASSIFICATIONS = [
    "Web Application",
    "API Service",
    "Bot Traffic",
    "Mobile App",
    "IoT Device",
    "CDN Cache",
]

CONTENT_TYPES = [
    "application/json",
    "text/html; charset=utf-8",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
    "application/octet-stream",
    "text/plain",
    "application/xml",
]

EMBEDDING_TEMPLATES = [
    ("DDoS attack detected from IP range {ip}/8 targeting {path}", "security_threat"),
    ("SSL certificate expired for domain {domain}.{tld}", "configuration_error"),
    ("Bot traffic spike detected in {region}: {count} req/min", "traffic_anomaly"),
    ("Brute-force login attempt against /auth/login from {ip}", "security_threat"),
    ("High latency on {path}: avg {latency}ms over last 5 minutes", "performance_issue"),
    ("Anomalous geo spread: requests from {count} distinct countries in 10 minutes", "traffic_anomaly"),
    ("TLS downgrade attempt detected on customer {customer}", "security_threat"),
    ("JWT token reuse detected: same token from {count} IPs", "authentication_event"),
    ("Request payload size exceeded threshold: {size}KB from {ip}", "security_threat"),
    ("Memory pressure on gateway node {node}: {pct}% utilization", "performance_issue"),
    ("Cross-site scripting (XSS) pattern found in query params from {ip}", "security_threat"),
    ("SQL injection attempt blocked on {path} from {ip}", "security_threat"),
    ("CDN cache hit ratio dropped to {pct}% in {region}", "performance_issue"),
    ("New device fingerprint for user {customer}: possible account takeover", "authentication_event"),
    ("Rate limit exceeded for customer {customer}: {count} req/min", "traffic_anomaly"),
    ("HSTS header missing on {count} responses in the last hour", "configuration_error"),
    ("P99 latency spike on {path}: {latency}ms", "performance_issue"),
    ("Expired session token reused by IP {ip}", "authentication_event"),
    ("Unusual user-agent string detected: scraper pattern from {ip}", "traffic_anomaly"),
    ("Geo-blocking rule triggered for {region}: {count} requests dropped", "security_threat"),
    ("Config drift detected: TLS 1.1 still enabled for customer {customer}", "configuration_error"),
    ("Webhook delivery failure rate at {pct}%: downstream {domain}", "performance_issue"),
    ("High cookie diversity score for {customer}: possible session hijacking", "security_threat"),
    ("Flood of OPTIONS preflight requests from {ip}", "traffic_anomaly"),
    ("Origin server 5xx rate elevated: {pct}% in last 15 minutes", "performance_issue"),
]

_IP_POOL = [
    "192.168.1", "10.0.0", "172.16.0", "203.0.113", "198.51.100",
    "185.220.101", "45.33.32", "23.239.9", "66.240.192", "91.108.4",
]

_DOMAINS = ["example", "acme", "globex", "widget", "initech", "stark", "oscorp", "umbrella"]
_TLDS = ["com", "io", "net", "org", "co"]
_NODES = ["gw-01", "gw-02", "gw-03", "edge-us-1", "edge-eu-1", "edge-ap-1"]


def _rand_ip() -> str:
    prefix = random.choice(_IP_POOL)
    return f"{prefix}.{random.randint(1, 254)}"


def _fill_template(template: str) -> str:
    return template.format(
        ip=_rand_ip(),
        path=random.choice(REQUEST_PATHS),
        domain=random.choice(_DOMAINS),
        tld=random.choice(_TLDS),
        region=random.choice(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]),
        count=random.randint(10, 9999),
        latency=random.randint(200, 8000),
        size=random.randint(50, 5000),
        node=random.choice(_NODES),
        pct=round(random.uniform(5, 95), 1),
        customer=random.choice(CUSTOMERS),
    )


# ---------------------------------------------------------------------------
# Schema / table DDL
# ---------------------------------------------------------------------------

_DDL_SCHEMA = "CREATE SCHEMA IF NOT EXISTS appshield"

_DDL_EXTENSION = "CREATE EXTENSION IF NOT EXISTS vector"

_DDL_TELEMETRY = """
CREATE TABLE IF NOT EXISTS appshield.telemetry_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    source_ip INET,
    user_agent TEXT,
    http_method VARCHAR(10),
    request_path TEXT,
    response_code INT,
    hsts_present BOOLEAN,
    cookie_count INT,
    has_analytics_cookie BOOLEAN,
    tls_version VARCHAR(10),
    content_type VARCHAR(128),
    payload_size_bytes INT,
    region VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_customer ON appshield.telemetry_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON appshield.telemetry_events(event_time);
"""

_DDL_CUSTOMER_FEATURES = """
CREATE TABLE IF NOT EXISTS appshield.customer_features (
    customer_id VARCHAR(64) NOT NULL,
    time_bucket TIMESTAMPTZ NOT NULL,
    hsts_present BOOLEAN,
    unique_ips_5min INT,
    request_count_5min INT,
    avg_payload_bytes FLOAT,
    cookie_diversity_score FLOAT,
    geo_diversity_score FLOAT,
    PRIMARY KEY (customer_id, time_bucket)
);
"""

_DDL_MODEL_PREDICTIONS = """
CREATE TABLE IF NOT EXISTS appshield.model_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(64) NOT NULL,
    predicted_at TIMESTAMPTZ NOT NULL,
    app_classification VARCHAR(64),
    confidence FLOAT,
    features_used JSONB
);
"""

_DDL_EVENT_EMBEDDINGS = """
CREATE TABLE IF NOT EXISTS appshield.event_embeddings (
    id SERIAL PRIMARY KEY,
    event_summary TEXT NOT NULL,
    category VARCHAR(64),
    embedding vector(384)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON appshield.event_embeddings
    USING hnsw (embedding vector_cosine_ops);
"""


# ---------------------------------------------------------------------------
# Data generation helpers
# ---------------------------------------------------------------------------

def _diurnal_event_time(now: datetime) -> datetime:
    """Return a random timestamp within the past 30 days, weighted toward 9am-6pm."""
    # Pick a random day offset
    days_ago = random.uniform(0, 30)
    base = now - timedelta(days=days_ago)
    # Weight hour: 9-18 gets 3x probability
    if random.random() < 0.70:
        hour = random.randint(9, 18)
    else:
        hour = random.choice(list(range(0, 9)) + list(range(19, 24)))
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return base.replace(hour=hour, minute=minute, second=second, microsecond=0)


def _normalized_vector(dims: int = 384) -> list[float]:
    """Random unit vector of `dims` dimensions."""
    v = [random.gauss(0, 1) for _ in range(dims)]
    mag = math.sqrt(sum(x * x for x in v))
    if mag == 0:
        v[0] = 1.0
        mag = 1.0
    return [x / mag for x in v]


def _vector_to_pg_literal(vec: list[float]) -> str:
    """Format as Postgres vector literal '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


# ---------------------------------------------------------------------------
# Seeding routines
# ---------------------------------------------------------------------------

def _schema_exists(cur) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'appshield'"
    )
    return cur.fetchone() is not None


def _seed_telemetry(cur, now: datetime) -> int:
    logger.info("Seeding telemetry_events (50 000 rows)…")
    rows = []
    for _ in range(50_000):
        rows.append((
            random.choice(CUSTOMERS),
            _diurnal_event_time(now),
            _rand_ip(),
            random.choice(USER_AGENTS),
            random.choice(HTTP_METHODS),
            random.choice(REQUEST_PATHS),
            random.choice(RESPONSE_CODES),
            random.random() < 0.65,            # hsts_present
            random.randint(0, 15),             # cookie_count
            random.random() < 0.40,            # has_analytics_cookie
            random.choice(TLS_VERSIONS),
            random.choice(CONTENT_TYPES),
            random.randint(100, 50_000),       # payload_size_bytes
            random.choice(REGIONS),
        ))

    sql = """
        INSERT INTO appshield.telemetry_events (
            customer_id, event_time, source_ip, user_agent,
            http_method, request_path, response_code,
            hsts_present, cookie_count, has_analytics_cookie,
            tls_version, content_type, payload_size_bytes, region
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    batch = 5_000
    for i in range(0, len(rows), batch):
        cur.executemany(sql, rows[i : i + batch])
    return len(rows)


def _seed_customer_features(cur, now: datetime) -> int:
    logger.info("Seeding customer_features (60 000 rows)…")
    # 200 customers × 300 time buckets = 60 000 rows
    rows = []
    # Per-customer tendency for hsts (stable trait)
    hsts_tendency = {c: random.random() > 0.35 for c in CUSTOMERS}
    # Base time: yesterday 00:00 UTC, then add 5-min offsets
    base_time = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    for customer in CUSTOMERS:
        for bucket_idx in range(300):
            bucket_ts = base_time + timedelta(minutes=5 * bucket_idx)
            rows.append((
                customer,
                bucket_ts,
                hsts_tendency[customer],
                random.randint(1, 50),             # unique_ips_5min
                random.randint(10, 2000),           # request_count_5min
                round(random.uniform(500, 10_000), 2),  # avg_payload_bytes
                round(random.uniform(0.0, 1.0), 4),     # cookie_diversity_score
                round(random.uniform(0.0, 1.0), 4),     # geo_diversity_score
            ))

    sql = """
        INSERT INTO appshield.customer_features (
            customer_id, time_bucket, hsts_present,
            unique_ips_5min, request_count_5min, avg_payload_bytes,
            cookie_diversity_score, geo_diversity_score
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (customer_id, time_bucket) DO NOTHING
    """
    batch = 5_000
    for i in range(0, len(rows), batch):
        cur.executemany(sql, rows[i : i + batch])
    return len(rows)


def _seed_model_predictions(cur, now: datetime) -> int:
    logger.info("Seeding model_predictions (1 000 rows)…")
    feature_names = [
        "hsts_present", "unique_ips_5min", "request_count_5min",
        "avg_payload_bytes", "cookie_diversity_score", "geo_diversity_score",
        "tls_version_score", "response_code_ratio", "bot_ua_fraction",
    ]
    rows = []
    for _ in range(1_000):
        days_ago = random.uniform(0, 7)
        predicted_at = now - timedelta(days=days_ago)
        features_used = {
            fname: round(random.uniform(0, 1), 4) for fname in feature_names
        }
        rows.append((
            random.choice(CUSTOMERS),
            predicted_at,
            random.choice(APP_CLASSIFICATIONS),
            round(random.uniform(0.50, 0.99), 4),  # confidence
            json.dumps(features_used),
        ))

    sql = """
        INSERT INTO appshield.model_predictions (
            customer_id, predicted_at, app_classification, confidence, features_used
        ) VALUES (%s,%s,%s,%s,%s)
    """
    cur.executemany(sql, rows)
    return len(rows)


def _seed_event_embeddings(cur) -> int:
    logger.info("Seeding event_embeddings (500 rows)…")
    rows = []
    # Cycle through templates to fill 500 rows
    for i in range(500):
        template_text, category = EMBEDDING_TEMPLATES[i % len(EMBEDDING_TEMPLATES)]
        summary = _fill_template(template_text)
        vec_literal = _vector_to_pg_literal(_normalized_vector(384))
        rows.append((summary, category, vec_literal))

    sql = """
        INSERT INTO appshield.event_embeddings (event_summary, category, embedding)
        VALUES (%s, %s, %s::vector)
    """
    cur.executemany(sql, rows)
    return len(rows)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def seed_if_needed() -> None:
    """Create schema + tables and populate with sample data (idempotent)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            if _schema_exists(cur):
                logger.info("appshield schema already exists — skipping seed.")
                return

            logger.info("Starting AppShield seed…")

            # Schema
            cur.execute(_DDL_SCHEMA)

            # pgvector extension (best-effort)
            try:
                cur.execute(_DDL_EXTENSION)
                logger.info("pgvector extension enabled.")
            except Exception as ext_err:
                logger.warning("Could not enable pgvector: %s — embeddings table will be created without it.", ext_err)
                conn.rollback()
                # Re-create schema after rollback cleared it
                cur.execute(_DDL_SCHEMA)

            # Tables
            cur.execute(_DDL_TELEMETRY)
            cur.execute(_DDL_CUSTOMER_FEATURES)
            cur.execute(_DDL_MODEL_PREDICTIONS)

            # event_embeddings — only if pgvector succeeded
            try:
                cur.execute(_DDL_EVENT_EMBEDDINGS)
                has_vector = True
            except Exception as vec_err:
                logger.warning("Could not create event_embeddings with vector column: %s", vec_err)
                conn.rollback()
                has_vector = False

            now = datetime.now(timezone.utc)

            n_tel = _seed_telemetry(cur, now)
            logger.info("Inserted %d telemetry_events rows.", n_tel)

            n_feat = _seed_customer_features(cur, now)
            logger.info("Inserted %d customer_features rows.", n_feat)

            n_pred = _seed_model_predictions(cur, now)
            logger.info("Inserted %d model_predictions rows.", n_pred)

            if has_vector:
                n_emb = _seed_event_embeddings(cur)
                logger.info("Inserted %d event_embeddings rows.", n_emb)
            else:
                logger.info("Skipped event_embeddings (pgvector unavailable).")

            logger.info("AppShield seed complete.")

    # Create demo branches for the Branching page
    try:
        from app.services.lakebase_api import get_workspace_client
        w = get_workspace_client()
        PROJECT = "lakebase-features"

        # Check existing branches
        existing = w.api_client.do("GET", f"/api/2.0/postgres/projects/{PROJECT}/branches")
        existing_names = [b.get("status", {}).get("branch_id", "") for b in existing.get("branches", [])]

        for branch_name in ["dev", "staging"]:
            if branch_name not in existing_names:
                logger.info(f"Creating demo branch: {branch_name}")
                try:
                    w.api_client.do("POST", f"/api/2.0/postgres/projects/{PROJECT}/branches?branch_id={branch_name}", body={
                        "spec": {
                            "source_branch": f"projects/{PROJECT}/branches/production",
                            "no_expiry": True,
                        }
                    })
                    logger.info(f"Branch '{branch_name}' created successfully")
                except Exception as be:
                    logger.warning(f"Failed to create branch '{branch_name}': {be}")
            else:
                logger.info(f"Branch '{branch_name}' already exists")
    except Exception as e:
        logger.warning(f"Branch creation skipped: {e}")

    # Create a read-only endpoint for the Read Replicas demo
    try:
        endpoints = w.api_client.do("GET", f"/api/2.0/postgres/projects/{PROJECT}/branches/production/endpoints")
        endpoint_names = [e.get("name", "").split("/")[-1] for e in endpoints.get("endpoints", [])]

        if "read-replica" not in endpoint_names:
            logger.info("Creating read-only endpoint: read-replica")
            try:
                w.api_client.do("POST", f"/api/2.0/postgres/projects/{PROJECT}/branches/production/endpoints?endpoint_id=read-replica", body={
                    "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_ONLY",
                        "autoscaling_limit_min_cu": 0.5,
                        "autoscaling_limit_max_cu": 2.0,
                    }
                })
                logger.info("Read replica endpoint created")
            except Exception as re:
                logger.warning(f"Failed to create read replica: {re}")
        else:
            logger.info("Read replica endpoint already exists")
    except Exception as e:
        logger.warning(f"Read replica creation skipped: {e}")

    # Create agent_memories table for AI Memory page
    try:
        with get_conn() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS appshield.agent_memories (
                        id SERIAL PRIMARY KEY,
                        content TEXT NOT NULL,
                        memory_type VARCHAR(32),
                        equipment_tag VARCHAR(64),
                        importance FLOAT DEFAULT 0.5,
                        embedding vector(384),
                        access_count INT DEFAULT 0,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_memories_hnsw
                    ON appshield.agent_memories USING hnsw (embedding vector_cosine_ops)
                """)

                # Check if already seeded
                cur.execute("SELECT COUNT(*) FROM appshield.agent_memories")
                if cur.fetchone()[0] == 0:
                    logger.info("Seeding agent_memories (20 rows)...")
                    memories = [
                        ("Hydraulic press HP-L4-001 has a recurring leak in the main cylinder seal. Usually manifests after 200+ hours of continuous operation.", "failure_mode", "HP-L4-001", 0.9),
                        ("CNC machine CNC-M2-014 overheats when running high-RPM aluminum jobs for more than 4 hours. Coolant flow rate needs to be increased to 12 L/min.", "failure_mode", "CNC-M2-014", 0.85),
                        ("Conveyor belt CONV-B1-008 drifts left under heavy loads. The tracking roller on the return side needs adjustment every 500 hours.", "failure_mode", "CONV-B1-008", 0.8),
                        ("Welding robot WELD-C3-012 throws E4507 error intermittently. Root cause is a loose encoder cable on joint 3.", "failure_mode", "WELD-C3-012", 0.9),
                        ("Robotic arm ROB-A7-003 loses calibration after power cycling. Always run the homing sequence before resuming production.", "failure_mode", "ROB-A7-003", 0.85),
                        ("Use Parker 512HB seals for HP-L4 series hydraulic presses. Flexitallic gaskets fail within 3 months under our operating pressures.", "part_preference", "HP-L4-001", 0.85),
                        ("SKF 6205-2RS bearings are the go-to for CONV-B1 series conveyor rollers. NSK alternatives work but have 20% shorter service life.", "part_preference", "CONV-B1-008", 0.75),
                        ("For CNC coolant systems, use Castrol Alusol SL 51 XBB. It handles aluminum machining better than the generic stuff.", "part_preference", "CNC-M2-014", 0.7),
                        ("Lincoln Electric PowerMig 210 MP is the backup welder for WELD-C3 series robots. Keep one in storage for emergency swaps.", "part_preference", "WELD-C3-012", 0.65),
                        ("HP-L4-001 cylinder seal replacement: 1) Depressurize system. 2) Remove 4x M16 bolts on cylinder head. 3) Extract old seal with hook tool. 4) Clean groove with brake cleaner. 5) Install new Parker 512HB seal. 6) Torque bolts to 180 Nm. 7) Pressurize to 50% for 10 min leak test.", "procedure", "HP-L4-001", 0.95),
                        ("CNC-M2-014 coolant flush procedure: 1) Drain old coolant. 2) Run clean water cycle for 15 min. 3) Mix new Castrol at 8% concentration. 4) Fill reservoir. 5) Run circulation pump for 5 min. 6) Check flow rate at spindle (target 12 L/min).", "procedure", "CNC-M2-014", 0.8),
                        ("Conveyor tracking adjustment: 1) Loosen idler frame bolts. 2) Run belt empty at half speed. 3) Adjust return roller angle 2-3 degrees toward drift side. 4) Tighten bolts. 5) Run loaded for 30 min to verify.", "procedure", "CONV-B1-008", 0.75),
                        ("WELD-C3-012 encoder cable fix: 1) Power off robot. 2) Remove joint 3 cover (6x M5 screws). 3) Reseat the 12-pin Molex connector. 4) Apply thread locker to the retaining screw. 5) Reassemble. 6) Run calibration sequence.", "procedure", "WELD-C3-012", 0.85),
                        ("HP-L4-001 makes a clicking noise at the top of each stroke. This is normal — it's the directional control valve switching. Only investigate if clicking becomes irregular.", "machine_quirk", "HP-L4-001", 0.6),
                        ("CNC-M2-014 shows a spindle load warning at exactly 82% — this is a firmware bug in version 4.2.1. The actual limit is 95%. Ignore the warning unless load exceeds 90%.", "machine_quirk", "CNC-M2-014", 0.7),
                        ("ROB-A7-003 has a 0.3mm backlash on joint 2 that can't be fully eliminated. Account for it in precision pick-and-place programs by approaching from the same direction.", "machine_quirk", "ROB-A7-003", 0.75),
                        ("CONV-B1-008 speed sensor reads 2% low compared to tachometer. This is a known calibration offset — don't adjust the sensor, just factor it into throughput calculations.", "machine_quirk", "CONV-B1-008", 0.5),
                        ("Parker Hannifin — primary seal supplier. Order through distributor Motion Industries (account #MFG-4421). Standard lead time: 3-5 business days. Emergency overnight available at 3x cost.", "vendor_info", None, 0.6),
                        ("SKF bearings — order through Applied Industrial Technologies. Bulk discount kicks in at 50+ units. Lead time: 1-2 weeks standard, 3 days expedited.", "vendor_info", None, 0.55),
                        ("Castrol industrial lubricants — direct from Castrol Industrial (rep: Sarah Chen, sarah.chen@castrol.com). Minimum order 200L drum. Lead time: 1 week.", "vendor_info", None, 0.5),
                    ]
                    for content, mem_type, eq_tag, importance in memories:
                        embedding = [random.gauss(0, 1) for _ in range(384)]
                        norm = sum(x*x for x in embedding) ** 0.5
                        embedding = [x / norm for x in embedding]
                        cur.execute(
                            "INSERT INTO appshield.agent_memories (content, memory_type, equipment_tag, importance, embedding) VALUES (%s, %s, %s, %s, %s::vector)",
                            (content, mem_type, eq_tag, importance, str(embedding))
                        )
                    logger.info("Inserted 20 agent_memories rows.")
    except Exception as e:
        logger.warning(f"agent_memories setup: {e}")

    # Create loadtest scratch table for Autoscaling page
    try:
        with get_conn() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS appshield.loadtest_events (
                        id SERIAL PRIMARY KEY,
                        event_type VARCHAR(32),
                        payload JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
        logger.info("loadtest_events table ready.")
    except Exception as e:
        logger.warning(f"loadtest_events setup: {e}")
