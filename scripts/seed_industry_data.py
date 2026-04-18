"""
Industry-specific seed data for the 4 Lakebase Features themes.

Creates separate schemas with realistic telemetry + features tables:
  - supply_chain.shipment_tracking / supply_chain.shipment_features
  - agriculture.crop_sensors / agriculture.crop_features
  - manufacturing.equipment_telemetry / manufacturing.equipment_features

Verifies that the existing appshield schema is populated (cybersecurity).

Usage:
    python scripts/seed_industry_data.py --profile stable-trvrmk
"""

import argparse
import io
import json
import logging
import math
import random
import subprocess
import time
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

SERVICE_PRINCIPAL_ID = "08fbad0b-6d62-4f38-8304-c1e48e24edfe"

# ── Connection (same pattern as bulk_seed.py) ─────────────────────────


def get_connection(profile: str):
    """Get psycopg2 connection using Databricks CLI credentials."""
    import psycopg2

    result = subprocess.run(
        ["databricks", "database", "get-database-instance", "lakebase-features",
         "--profile", profile, "-o", "json"],
        capture_output=True, text=True,
    )
    instance = json.loads(result.stdout)
    host = instance["read_write_dns"]

    result = subprocess.run(
        ["databricks", "database", "generate-database-credential",
         "--json", json.dumps({"request_id": "industry-seed", "instance_names": ["lakebase-features"]}),
         "--profile", profile, "-o", "json"],
        capture_output=True, text=True,
    )
    token = json.loads(result.stdout)["token"]

    result = subprocess.run(
        ["databricks", "current-user", "me", "--profile", profile, "-o", "json"],
        capture_output=True, text=True,
    )
    email = json.loads(result.stdout)["userName"]

    return psycopg2.connect(
        host=host, port=5432, user=email, password=token,
        database="databricks_postgres", sslmode="require",
    )


# ══════════════════════════════════════════════════════════════════════
#  SUPPLY CHAIN
# ══════════════════════════════════════════════════════════════════════

SUPPLY_CHAIN_DDL = """
CREATE SCHEMA IF NOT EXISTS supply_chain;

CREATE TABLE IF NOT EXISTS supply_chain.shipment_tracking (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    origin VARCHAR(64),
    destination VARCHAR(64),
    carrier VARCHAR(64),
    temperature_celsius FLOAT,
    humidity_pct FLOAT,
    vibration_g FLOAT,
    gps_lat FLOAT,
    gps_lon FLOAT,
    status VARCHAR(32),
    container_type VARCHAR(32),
    weight_kg FLOAT,
    region VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS supply_chain.shipment_features (
    shipment_id VARCHAR(64) NOT NULL,
    time_bucket TIMESTAMPTZ NOT NULL,
    temp_excursion BOOLEAN,
    avg_temperature FLOAT,
    route_deviation_km FLOAT,
    sensor_readings_5min INT,
    humidity_variance FLOAT,
    vibration_max_g FLOAT,
    on_time_score FLOAT,
    carrier_reliability FLOAT,
    PRIMARY KEY (shipment_id, time_bucket)
);
"""

# Realistic US city pairs with approximate lat/lon midpoints
CITY_PAIRS = [
    ("Chicago", "Los Angeles", 41.88, -87.63, 34.05, -118.24),
    ("Houston", "Miami", 29.76, -95.37, 25.76, -80.19),
    ("Seattle", "Denver", 47.61, -122.33, 39.74, -104.99),
    ("New York", "Atlanta", 40.71, -74.01, 33.75, -84.39),
    ("Dallas", "Phoenix", 32.78, -96.80, 33.45, -112.07),
    ("Boston", "Detroit", 42.36, -71.06, 42.33, -83.05),
    ("San Francisco", "Portland", 37.77, -122.42, 45.52, -122.68),
    ("Memphis", "Nashville", 35.15, -90.05, 36.16, -86.78),
    ("Columbus", "Philadelphia", 39.96, -83.00, 39.95, -75.17),
    ("Minneapolis", "Kansas City", 44.98, -93.27, 39.10, -94.58),
]

CARRIERS = ["FedEx Freight", "XPO Logistics", "JB Hunt", "Schneider", "Old Dominion"]

SC_STATUS_POOL = (
    ["in_transit"] * 70 + ["delivered"] * 20 + ["delayed"] * 8 + ["exception"] * 2
)

SC_CONTAINER_POOL = (
    ["refrigerated"] * 40 + ["dry"] * 35 + ["flatbed"] * 15 + ["tanker"] * 10
)

SC_REGIONS = ["northeast", "southeast", "midwest", "southwest", "northwest"]


def _gen_shipment_ids(n: int) -> list[str]:
    return [f"SHIP-{random.randint(1000, 9999)}" for _ in range(n)]


def generate_supply_chain_telemetry(shipment_ids: list[str], num_rows: int) -> io.StringIO:
    logger.info(f"Generating {num_rows:,} supply chain telemetry rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for i in range(num_rows):
        sid = random.choice(shipment_ids)
        pair = random.choice(CITY_PAIRS)
        origin, dest = pair[0], pair[1]
        o_lat, o_lon, d_lat, d_lon = pair[2], pair[3], pair[4], pair[5]

        days_ago = random.uniform(0, 90)
        event_time = (now - timedelta(days=days_ago)).replace(
            hour=random.randint(0, 23),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
        )

        # Interpolate GPS along route with some noise
        t = random.random()
        gps_lat = o_lat + t * (d_lat - o_lat) + random.gauss(0, 0.3)
        gps_lon = o_lon + t * (d_lon - o_lon) + random.gauss(0, 0.3)

        # Cold chain temperature: normally ~2C, with occasional excursions
        if random.random() < 0.08:
            temp = random.uniform(8, 15)  # excursion
        else:
            temp = random.gauss(2.0, 1.5)

        humidity = random.gauss(65, 10)
        vibration = abs(random.gauss(0.5, 0.3))
        weight = random.uniform(500, 25000)
        carrier = random.choice(CARRIERS)
        status = random.choice(SC_STATUS_POOL)
        container = random.choice(SC_CONTAINER_POOL)
        region = random.choice(SC_REGIONS)

        row = "\t".join([
            sid,
            event_time.isoformat(),
            origin,
            dest,
            carrier,
            f"{temp:.2f}",
            f"{max(0, min(100, humidity)):.1f}",
            f"{vibration:.3f}",
            f"{gps_lat:.5f}",
            f"{gps_lon:.5f}",
            status,
            container,
            f"{weight:.1f}",
            region,
        ])
        buf.write(row + "\n")

        if (i + 1) % 100000 == 0:
            logger.info(f"  Supply chain telemetry: {i+1:,} / {num_rows:,}")

    buf.seek(0)
    return buf


def generate_supply_chain_features(shipment_ids: list[str], buckets_per: int) -> io.StringIO:
    total = len(shipment_ids) * buckets_per
    logger.info(f"Generating {total:,} supply chain feature rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for sid in shipment_ids:
        for b in range(buckets_per):
            time_bucket = now - timedelta(minutes=5 * b)
            temp_excursion = random.random() < 0.08
            avg_temp = random.gauss(2.5, 1.0) if not temp_excursion else random.uniform(8, 12)
            route_dev = abs(random.gauss(0, 15))
            readings = random.randint(5, 50)
            humidity_var = abs(random.gauss(3, 2))
            vib_max = abs(random.gauss(1.0, 0.5))
            on_time = max(0, min(1, random.gauss(0.85, 0.1)))
            carrier_rel = max(0, min(1, random.gauss(0.9, 0.08)))

            row = "\t".join([
                sid,
                time_bucket.isoformat(),
                str(temp_excursion).lower(),
                f"{avg_temp:.2f}",
                f"{route_dev:.2f}",
                str(readings),
                f"{humidity_var:.3f}",
                f"{vib_max:.3f}",
                f"{on_time:.4f}",
                f"{carrier_rel:.4f}",
            ])
            buf.write(row + "\n")

    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════
#  AGRICULTURE
# ══════════════════════════════════════════════════════════════════════

AGRICULTURE_DDL = """
CREATE SCHEMA IF NOT EXISTS agriculture;

CREATE TABLE IF NOT EXISTS agriculture.crop_sensors (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    sensor_node VARCHAR(32),
    soil_moisture_pct FLOAT,
    soil_temperature_c FLOAT,
    air_temperature_c FLOAT,
    humidity_pct FLOAT,
    light_intensity_lux FLOAT,
    rainfall_mm FLOAT,
    wind_speed_kmh FLOAT,
    ndvi_index FLOAT,
    crop_type VARCHAR(32),
    field_zone VARCHAR(16),
    region VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS agriculture.crop_features (
    farm_id VARCHAR(64) NOT NULL,
    time_bucket TIMESTAMPTZ NOT NULL,
    irrigation_active BOOLEAN,
    sensor_nodes_5min INT,
    avg_soil_moisture FLOAT,
    avg_temperature FLOAT,
    rainfall_total_mm FLOAT,
    crop_health_index FLOAT,
    pest_risk_score FLOAT,
    yield_prediction_kg FLOAT,
    PRIMARY KEY (farm_id, time_bucket)
);
"""

AG_REGIONS = ["midwest", "central", "pacific", "south", "plains"]
AG_CROPS = ["corn", "soybeans", "wheat", "alfalfa", "potatoes"]
AG_ZONES = ["A1", "A2", "B1", "B2", "C1"]


def _gen_farm_ids(n: int) -> list[str]:
    ids = []
    per_region = n // len(AG_REGIONS)
    for region in AG_REGIONS:
        for i in range(per_region):
            ids.append(f"farm-{region}-{i+1:02d}")
    return ids[:n]


def generate_agriculture_telemetry(farm_ids: list[str], num_rows: int) -> io.StringIO:
    logger.info(f"Generating {num_rows:,} agriculture telemetry rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for i in range(num_rows):
        farm = random.choice(farm_ids)
        region = farm.split("-")[1]
        sensor = f"SN-{random.randint(1, 20):03d}"

        days_ago = random.uniform(0, 90)
        event_time = (now - timedelta(days=days_ago)).replace(
            hour=random.randint(0, 23),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
        )

        # Seasonal NDVI: higher in summer months
        month = event_time.month
        season_factor = 0.5 + 0.4 * math.sin((month - 3) * math.pi / 6)

        # Region-based soil moisture
        base_moisture = {"midwest": 30, "central": 25, "pacific": 20, "south": 35, "plains": 22}
        soil_moisture = max(5, min(60, random.gauss(base_moisture.get(region, 25), 7)))
        soil_temp = random.gauss(18 + season_factor * 10, 3)
        air_temp = random.gauss(20 + season_factor * 12, 4)
        humidity = max(10, min(100, random.gauss(55 + season_factor * 15, 12)))
        light = max(0, random.gauss(40000 + season_factor * 30000, 15000))
        rainfall = max(0, random.expovariate(1 / 2.0)) if random.random() < 0.3 else 0.0
        wind = max(0, random.gauss(12, 5))
        ndvi = max(0.15, min(0.95, random.gauss(0.3 + season_factor * 0.4, 0.1)))
        crop = random.choice(AG_CROPS)
        zone = random.choice(AG_ZONES)

        row = "\t".join([
            farm,
            event_time.isoformat(),
            sensor,
            f"{soil_moisture:.1f}",
            f"{soil_temp:.2f}",
            f"{air_temp:.2f}",
            f"{humidity:.1f}",
            f"{light:.0f}",
            f"{rainfall:.2f}",
            f"{wind:.1f}",
            f"{ndvi:.3f}",
            crop,
            zone,
            region,
        ])
        buf.write(row + "\n")

        if (i + 1) % 100000 == 0:
            logger.info(f"  Agriculture telemetry: {i+1:,} / {num_rows:,}")

    buf.seek(0)
    return buf


def generate_agriculture_features(farm_ids: list[str], buckets_per: int) -> io.StringIO:
    total = len(farm_ids) * buckets_per
    logger.info(f"Generating {total:,} agriculture feature rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for farm in farm_ids:
        for b in range(buckets_per):
            time_bucket = now - timedelta(minutes=5 * b)
            irrigation = random.random() < 0.65
            nodes = random.randint(3, 20)
            avg_moisture = max(5, min(55, random.gauss(28, 8)))
            avg_temp = random.gauss(22, 5)
            rainfall = max(0, random.expovariate(1 / 3.0)) if random.random() < 0.25 else 0.0
            crop_health = max(0, min(1, random.gauss(0.72, 0.12)))
            pest_risk = max(0, min(1, random.gauss(0.15, 0.1)))
            yield_pred = max(0, random.gauss(4500, 1200))

            row = "\t".join([
                farm,
                time_bucket.isoformat(),
                str(irrigation).lower(),
                str(nodes),
                f"{avg_moisture:.2f}",
                f"{avg_temp:.2f}",
                f"{rainfall:.2f}",
                f"{crop_health:.4f}",
                f"{pest_risk:.4f}",
                f"{yield_pred:.1f}",
            ])
            buf.write(row + "\n")

    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════
#  MANUFACTURING
# ══════════════════════════════════════════════════════════════════════

MANUFACTURING_DDL = """
CREATE SCHEMA IF NOT EXISTS manufacturing;

CREATE TABLE IF NOT EXISTS manufacturing.equipment_telemetry (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    sensor_type VARCHAR(32),
    vibration_mm_s FLOAT,
    temperature_c FLOAT,
    current_amps FLOAT,
    pressure_bar FLOAT,
    rpm FLOAT,
    oil_level_pct FLOAT,
    noise_db FLOAT,
    status VARCHAR(32),
    alert_level VARCHAR(16),
    production_line VARCHAR(16),
    region VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS manufacturing.equipment_features (
    equipment_id VARCHAR(64) NOT NULL,
    time_bucket TIMESTAMPTZ NOT NULL,
    safety_check_ok BOOLEAN,
    alert_count_5min INT,
    sensor_events_5min INT,
    avg_vibration FLOAT,
    max_temperature FLOAT,
    uptime_score FLOAT,
    anomaly_score FLOAT,
    maintenance_due_hours FLOAT,
    PRIMARY KEY (equipment_id, time_bucket)
);
"""

MFG_TYPES = {
    "HP": ("hydraulic press", 35, 80, 200, 600),
    "CNC": ("CNC machine", 25, 65, 1000, 8000),
    "ROB": ("robotic arm", 20, 50, 0, 0),
    "CONV": ("conveyor", 20, 45, 100, 300),
    "WELD": ("welding robot", 40, 120, 0, 0),
}

MFG_LINES = ["L1", "L2", "L3", "L4"]
MFG_SENSOR_TYPES = ["vibration", "thermal", "pressure", "current", "acoustic"]

MFG_STATUS_POOL = (
    ["running"] * 75 + ["idle"] * 15 + ["maintenance"] * 8 + ["fault"] * 2
)

MFG_ALERT_POOL = (
    ["none"] * 80 + ["low"] * 10 + ["medium"] * 7 + ["high"] * 2 + ["critical"] * 1
)

MFG_REGIONS = ["plant-east", "plant-west", "plant-central", "plant-south"]


def _gen_equipment_ids(n: int) -> list[str]:
    ids = []
    types = list(MFG_TYPES.keys())
    per_type = n // len(types)
    for t in types:
        for i in range(per_type):
            line = random.choice(MFG_LINES)
            ids.append(f"{t}-{line}-{i+1:03d}")
    return ids[:n]


def generate_manufacturing_telemetry(equip_ids: list[str], num_rows: int) -> io.StringIO:
    logger.info(f"Generating {num_rows:,} manufacturing telemetry rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for i in range(num_rows):
        eid = random.choice(equip_ids)
        etype = eid.split("-")[0]
        specs = MFG_TYPES[etype]
        temp_low, temp_high = specs[1], specs[2]
        rpm_low, rpm_high = specs[3], specs[4]

        days_ago = random.uniform(0, 90)
        # Manufacturing: 3-shift pattern, more events during day
        hour = int(random.gauss(12, 5)) % 24
        event_time = (now - timedelta(days=days_ago)).replace(
            hour=hour,
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
        )

        vibration = max(0.1, random.gauss(3.0, 2.5))
        temperature = random.uniform(temp_low, temp_high)
        current = max(0, random.gauss(15, 5))
        pressure = max(0, random.gauss(6, 2))
        rpm = random.uniform(rpm_low, rpm_high) if rpm_high > 0 else 0
        oil_level = max(10, min(100, random.gauss(75, 12)))
        noise = max(40, random.gauss(72, 8))
        status = random.choice(MFG_STATUS_POOL)
        alert = random.choice(MFG_ALERT_POOL)

        # High vibration correlates with alerts
        if vibration > 10:
            alert = random.choice(["medium", "high", "critical"])

        line = eid.split("-")[1]
        region = random.choice(MFG_REGIONS)
        sensor_type = random.choice(MFG_SENSOR_TYPES)

        row = "\t".join([
            eid,
            event_time.isoformat(),
            sensor_type,
            f"{vibration:.3f}",
            f"{temperature:.2f}",
            f"{current:.2f}",
            f"{pressure:.2f}",
            f"{rpm:.1f}",
            f"{oil_level:.1f}",
            f"{noise:.1f}",
            status,
            alert,
            line,
            region,
        ])
        buf.write(row + "\n")

        if (i + 1) % 100000 == 0:
            logger.info(f"  Manufacturing telemetry: {i+1:,} / {num_rows:,}")

    buf.seek(0)
    return buf


def generate_manufacturing_features(equip_ids: list[str], buckets_per: int) -> io.StringIO:
    total = len(equip_ids) * buckets_per
    logger.info(f"Generating {total:,} manufacturing feature rows...")
    buf = io.StringIO()
    now = datetime.now(timezone.utc)

    for eid in equip_ids:
        for b in range(buckets_per):
            time_bucket = now - timedelta(minutes=5 * b)
            safety_ok = random.random() < 0.92
            alerts = random.randint(0, 5) if random.random() < 0.3 else 0
            events = random.randint(10, 200)
            avg_vib = max(0.1, random.gauss(3.0, 1.5))
            max_temp = random.uniform(40, 110)
            uptime = max(0, min(1, random.gauss(0.88, 0.08)))
            anomaly = max(0, min(1, random.gauss(0.1, 0.08)))
            maint_hours = max(0, random.gauss(200, 80))

            row = "\t".join([
                eid,
                time_bucket.isoformat(),
                str(safety_ok).lower(),
                str(alerts),
                str(events),
                f"{avg_vib:.3f}",
                f"{max_temp:.2f}",
                f"{uptime:.4f}",
                f"{anomaly:.4f}",
                f"{maint_hours:.1f}",
            ])
            buf.write(row + "\n")

    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════
#  MAIN — orchestrate all themes
# ══════════════════════════════════════════════════════════════════════

THEMES = [
    {
        "name": "Supply Chain",
        "schema": "supply_chain",
        "ddl": SUPPLY_CHAIN_DDL,
        "telemetry_table": "shipment_tracking",
        "feature_table": "shipment_features",
        "gen_ids": lambda n: _gen_shipment_ids(n),
        "gen_telemetry": generate_supply_chain_telemetry,
        "gen_features": generate_supply_chain_features,
        "telemetry_columns": (
            "shipment_id", "event_time", "origin", "destination", "carrier",
            "temperature_celsius", "humidity_pct", "vibration_g",
            "gps_lat", "gps_lon", "status", "container_type", "weight_kg", "region",
        ),
        "feature_columns": (
            "shipment_id", "time_bucket", "temp_excursion", "avg_temperature",
            "route_deviation_km", "sensor_readings_5min", "humidity_variance",
            "vibration_max_g", "on_time_score", "carrier_reliability",
        ),
    },
    {
        "name": "Agriculture",
        "schema": "agriculture",
        "ddl": AGRICULTURE_DDL,
        "telemetry_table": "crop_sensors",
        "feature_table": "crop_features",
        "gen_ids": lambda n: _gen_farm_ids(n),
        "gen_telemetry": generate_agriculture_telemetry,
        "gen_features": generate_agriculture_features,
        "telemetry_columns": (
            "farm_id", "event_time", "sensor_node",
            "soil_moisture_pct", "soil_temperature_c", "air_temperature_c",
            "humidity_pct", "light_intensity_lux", "rainfall_mm", "wind_speed_kmh",
            "ndvi_index", "crop_type", "field_zone", "region",
        ),
        "feature_columns": (
            "farm_id", "time_bucket", "irrigation_active", "sensor_nodes_5min",
            "avg_soil_moisture", "avg_temperature", "rainfall_total_mm",
            "crop_health_index", "pest_risk_score", "yield_prediction_kg",
        ),
    },
    {
        "name": "Manufacturing",
        "schema": "manufacturing",
        "ddl": MANUFACTURING_DDL,
        "telemetry_table": "equipment_telemetry",
        "feature_table": "equipment_features",
        "gen_ids": lambda n: _gen_equipment_ids(n),
        "gen_telemetry": generate_manufacturing_telemetry,
        "gen_features": generate_manufacturing_features,
        "telemetry_columns": (
            "equipment_id", "event_time", "sensor_type",
            "vibration_mm_s", "temperature_c", "current_amps", "pressure_bar",
            "rpm", "oil_level_pct", "noise_db", "status", "alert_level",
            "production_line", "region",
        ),
        "feature_columns": (
            "equipment_id", "time_bucket", "safety_check_ok", "alert_count_5min",
            "sensor_events_5min", "avg_vibration", "max_temperature",
            "uptime_score", "anomaly_score", "maintenance_due_hours",
        ),
    },
]


def seed_theme(conn, theme_cfg: dict, telemetry_rows: int, entity_count: int, buckets_per: int):
    """Create schema, tables, and seed data for one industry theme."""
    name = theme_cfg["name"]
    schema = theme_cfg["schema"]

    cur = conn.cursor()
    try:
        # 1. DDL
        logger.info(f"[{name}] Creating schema and tables...")
        for stmt in theme_cfg["ddl"].split(";"):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)
        conn.commit()

        # 2. Check telemetry row count
        fq_telemetry = f"{schema}.{theme_cfg['telemetry_table']}"
        fq_features = f"{schema}.{theme_cfg['feature_table']}"

        cur.execute(f"SELECT COUNT(*) FROM {fq_telemetry}")
        tel_count = cur.fetchone()[0]
        logger.info(f"[{name}] Current {fq_telemetry}: {tel_count:,} rows")

        if tel_count >= telemetry_rows:
            logger.info(f"[{name}] Already populated, skipping telemetry")
        else:
            # Generate IDs
            ids = theme_cfg["gen_ids"](entity_count)

            # Truncate and reload
            logger.info(f"[{name}] Truncating {fq_telemetry}...")
            cur.execute(f"TRUNCATE {fq_telemetry} CASCADE")
            conn.commit()

            csv_buf = theme_cfg["gen_telemetry"](ids, telemetry_rows)

            logger.info(f"[{name}] COPY-ing {telemetry_rows:,} rows into {fq_telemetry}...")
            start = time.time()
            cur.execute(f"SET search_path TO {schema}")
            cur.copy_from(
                csv_buf,
                theme_cfg["telemetry_table"],
                sep="\t",
                columns=theme_cfg["telemetry_columns"],
            )
            conn.commit()
            elapsed = time.time() - start
            logger.info(f"[{name}] Telemetry COPY: {telemetry_rows:,} rows in {elapsed:.1f}s ({telemetry_rows/elapsed:.0f} rows/sec)")

            # Features
            cur.execute(f"SELECT COUNT(*) FROM {fq_features}")
            feat_count = cur.fetchone()[0]
            total_features = entity_count * buckets_per

            if feat_count >= total_features:
                logger.info(f"[{name}] Features already populated, skipping")
            else:
                logger.info(f"[{name}] Truncating {fq_features}...")
                cur.execute(f"TRUNCATE {fq_features} CASCADE")
                conn.commit()

                csv_buf = theme_cfg["gen_features"](ids, buckets_per)

                logger.info(f"[{name}] COPY-ing {total_features:,} feature rows into {fq_features}...")
                start = time.time()
                cur.execute(f"SET search_path TO {schema}")
                cur.copy_from(
                    csv_buf,
                    theme_cfg["feature_table"],
                    sep="\t",
                    columns=theme_cfg["feature_columns"],
                )
                conn.commit()
                elapsed = time.time() - start
                logger.info(f"[{name}] Features COPY: {total_features:,} rows in {elapsed:.1f}s")

        # 3. ANALYZE
        conn.autocommit = True
        logger.info(f"[{name}] Running ANALYZE...")
        cur.execute(f"ANALYZE {fq_telemetry}")
        cur.execute(f"ANALYZE {fq_features}")
        conn.autocommit = False

        # 4. GRANT to service principal
        logger.info(f"[{name}] Granting permissions to SP...")
        conn.autocommit = True
        cur.execute(f"GRANT USAGE ON SCHEMA {schema} TO \"{SERVICE_PRINCIPAL_ID}\"")
        cur.execute(f"GRANT ALL ON ALL TABLES IN SCHEMA {schema} TO \"{SERVICE_PRINCIPAL_ID}\"")
        conn.autocommit = False

        # 5. Verify
        cur.execute(f"SELECT COUNT(*) FROM {fq_telemetry}")
        tel_final = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {fq_features}")
        feat_final = cur.fetchone()[0]
        logger.info(f"[{name}] Final — telemetry: {tel_final:,}, features: {feat_final:,}")

    finally:
        cur.close()


def verify_cybersecurity(conn):
    """Verify the existing appshield schema has data."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM appshield.telemetry_events")
        tel = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM appshield.customer_features")
        feat = cur.fetchone()[0]
        logger.info(f"[Cybersecurity] appshield — telemetry: {tel:,}, features: {feat:,}")
        if tel == 0:
            logger.warning("[Cybersecurity] appshield.telemetry_events is EMPTY — run bulk_seed.py first")
    finally:
        cur.close()


def main():
    parser = argparse.ArgumentParser(description="Seed industry-specific data for Lakebase Features demo")
    parser.add_argument("--profile", default="stable-trvrmk")
    parser.add_argument("--telemetry-rows", type=int, default=500_000)
    parser.add_argument("--entity-count", type=int, default=50)
    parser.add_argument("--feature-buckets", type=int, default=1000)  # 50 entities * 1000 = 50K features
    parser.add_argument("--themes", nargs="*", default=None,
                        help="Specific themes to seed (supply_chain, agriculture, manufacturing). Default: all")
    args = parser.parse_args()

    conn = get_connection(args.profile)
    conn.autocommit = False

    try:
        # Verify cybersecurity
        verify_cybersecurity(conn)

        # Seed each theme
        for theme_cfg in THEMES:
            if args.themes and theme_cfg["schema"] not in args.themes:
                logger.info(f"Skipping {theme_cfg['name']} (not in --themes)")
                continue

            seed_theme(conn, theme_cfg, args.telemetry_rows, args.entity_count, args.feature_buckets)

        logger.info("All themes seeded successfully!")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
