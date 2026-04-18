export interface QueryTemplate {
  name: string
  description: string
  sql: string
}

export interface ThemeConfig {
  id: string
  name: string
  icon: string
  schema: string
  entityName: string
  entityIdLabel: string
  entityIdColumn: string
  tableName: string
  featureTableName: string
  sampleEntities: string[]
  featureLabels: Record<string, string>
  sampleQueries: QueryTemplate[]
}

export const themes: ThemeConfig[] = [
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    icon: '🛡️',
    schema: 'appshield',
    entityName: 'customer',
    entityIdLabel: 'Customer ID',
    entityIdColumn: 'customer_id',
    tableName: 'appshield.telemetry_events',
    featureTableName: 'appshield.customer_features',
    sampleEntities: ['acme-corp', 'globex-inc', 'initech-systems', 'stark-industries', 'widget-co'],
    featureLabels: {
      hsts_present: 'HSTS Enabled',
      unique_ips_5min: 'Unique IPs (5m)',
      request_count_5min: 'Request Count (5m)',
      avg_payload_bytes: 'Avg Payload',
      cookie_diversity_score: 'Cookie Diversity',
      geo_diversity_score: 'Geo Diversity',
    },
    sampleQueries: [
      { name: 'Top customers by volume', description: 'Most active customers', sql: 'SELECT customer_id, COUNT(*) as request_count FROM appshield.telemetry_events GROUP BY customer_id ORDER BY request_count DESC LIMIT 10' },
      { name: 'HSTS adoption rate', description: 'Percentage with HSTS enabled', sql: 'SELECT ROUND(100.0 * SUM(CASE WHEN hsts_present THEN 1 ELSE 0 END) / COUNT(*), 1) as hsts_pct FROM appshield.telemetry_events' },
      { name: 'Error rate by region', description: 'HTTP 4xx/5xx by region', sql: "SELECT region, COUNT(*) as total, SUM(CASE WHEN response_code >= 400 THEN 1 ELSE 0 END) as errors FROM appshield.telemetry_events GROUP BY region ORDER BY errors DESC" },
      { name: 'Latest predictions', description: 'Recent model classifications', sql: "SELECT customer_id, app_classification, confidence, predicted_at FROM appshield.model_predictions ORDER BY predicted_at DESC LIMIT 20" },
    ],
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain',
    icon: '🚛',
    schema: 'supply_chain',
    entityName: 'shipment',
    entityIdLabel: 'Shipment ID',
    entityIdColumn: 'shipment_id',
    tableName: 'supply_chain.shipment_tracking',
    featureTableName: 'supply_chain.shipment_features',
    sampleEntities: ['SHIP-4521', 'SHIP-8834', 'SHIP-2291', 'SHIP-6677', 'SHIP-1105'],
    featureLabels: {
      temp_excursion: 'Temp Excursion',
      avg_temperature: 'Avg Temperature',
      route_deviation_km: 'Route Deviation (km)',
      sensor_readings_5min: 'Sensor Readings (5m)',
      humidity_variance: 'Humidity Variance',
      vibration_max_g: 'Vibration Max (g)',
      on_time_score: 'On-Time Score',
      carrier_reliability: 'Carrier Reliability',
    },
    sampleQueries: [
      { name: 'Active shipments', description: 'By sensor volume', sql: 'SELECT shipment_id, COUNT(*) as readings FROM supply_chain.shipment_tracking GROUP BY shipment_id ORDER BY readings DESC LIMIT 10' },
      { name: 'Temperature excursions', description: 'Cold chain violations', sql: "SELECT shipment_id, COUNT(*) as excursions FROM supply_chain.shipment_tracking WHERE temperature_celsius > 8 GROUP BY shipment_id ORDER BY excursions DESC LIMIT 10" },
      { name: 'Carrier performance', description: 'Delivery stats by carrier', sql: "SELECT carrier, COUNT(*) as total, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered, ROUND(100.0 * SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) / COUNT(*), 1) as delay_pct FROM supply_chain.shipment_tracking GROUP BY carrier ORDER BY total DESC" },
      { name: 'Status breakdown', description: 'Shipment status distribution', sql: "SELECT status, COUNT(*) as count FROM supply_chain.shipment_tracking GROUP BY status ORDER BY count DESC" },
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    icon: '🌾',
    schema: 'agriculture',
    entityName: 'farm',
    entityIdLabel: 'Farm ID',
    entityIdColumn: 'farm_id',
    tableName: 'agriculture.crop_sensors',
    featureTableName: 'agriculture.crop_features',
    sampleEntities: ['farm-midwest-07', 'farm-central-12', 'farm-pacific-03', 'farm-south-01', 'farm-plains-09'],
    featureLabels: {
      irrigation_active: 'Irrigation Active',
      sensor_nodes_5min: 'Sensor Nodes (5m)',
      avg_soil_moisture: 'Avg Soil Moisture',
      avg_temperature: 'Avg Temperature',
      rainfall_total_mm: 'Rainfall (mm)',
      crop_health_index: 'Crop Health Index',
      pest_risk_score: 'Pest Risk Score',
      yield_prediction_kg: 'Yield Prediction (kg)',
    },
    sampleQueries: [
      { name: 'Active farms', description: 'By sensor activity', sql: 'SELECT farm_id, COUNT(*) as readings FROM agriculture.crop_sensors GROUP BY farm_id ORDER BY readings DESC LIMIT 10' },
      { name: 'Crop health by region', description: 'Average NDVI by region', sql: "SELECT region, ROUND(AVG(ndvi_index)::numeric, 3) as avg_ndvi, COUNT(*) as readings FROM agriculture.crop_sensors GROUP BY region ORDER BY avg_ndvi DESC" },
      { name: 'Irrigation status', description: 'Farms with active irrigation', sql: "SELECT farm_id, SUM(CASE WHEN irrigation_active THEN 1 ELSE 0 END) as active_readings, COUNT(*) as total FROM agriculture.crop_features GROUP BY farm_id ORDER BY active_readings DESC LIMIT 10" },
      { name: 'Crop type distribution', description: 'Sensor readings by crop', sql: "SELECT crop_type, COUNT(*) as readings, ROUND(AVG(soil_moisture_pct)::numeric, 1) as avg_moisture FROM agriculture.crop_sensors GROUP BY crop_type ORDER BY readings DESC" },
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    icon: '🏭',
    schema: 'manufacturing',
    entityName: 'equipment',
    entityIdLabel: 'Equipment ID',
    entityIdColumn: 'equipment_id',
    tableName: 'manufacturing.equipment_telemetry',
    featureTableName: 'manufacturing.equipment_features',
    sampleEntities: ['HP-L4-001', 'CNC-L2-014', 'ROB-L1-003', 'CONV-L3-008', 'WELD-L4-012'],
    featureLabels: {
      safety_check_ok: 'Safety Check OK',
      alert_count_5min: 'Alert Count (5m)',
      sensor_events_5min: 'Sensor Events (5m)',
      avg_vibration: 'Avg Vibration (mm/s)',
      max_temperature: 'Max Temperature (C)',
      uptime_score: 'Uptime Score',
      anomaly_score: 'Anomaly Score',
      maintenance_due_hours: 'Maintenance Due (hrs)',
    },
    sampleQueries: [
      { name: 'Equipment alerts', description: 'By alert volume', sql: "SELECT equipment_id, COUNT(*) as events, SUM(CASE WHEN alert_level IN ('high', 'critical') THEN 1 ELSE 0 END) as critical_alerts FROM manufacturing.equipment_telemetry GROUP BY equipment_id ORDER BY critical_alerts DESC LIMIT 10" },
      { name: 'Status breakdown', description: 'Equipment status distribution', sql: "SELECT status, COUNT(*) as count FROM manufacturing.equipment_telemetry GROUP BY status ORDER BY count DESC" },
      { name: 'High vibration events', description: 'Vibration above threshold', sql: "SELECT equipment_id, ROUND(AVG(vibration_mm_s)::numeric, 2) as avg_vib, ROUND(MAX(vibration_mm_s)::numeric, 2) as max_vib, COUNT(*) as events FROM manufacturing.equipment_telemetry WHERE vibration_mm_s > 10 GROUP BY equipment_id ORDER BY max_vib DESC LIMIT 10" },
      { name: 'Production line health', description: 'Uptime by line', sql: "SELECT production_line, ROUND(AVG(uptime_score)::numeric, 3) as avg_uptime, ROUND(AVG(anomaly_score)::numeric, 3) as avg_anomaly, COUNT(*) as readings FROM manufacturing.equipment_features GROUP BY production_line ORDER BY avg_uptime DESC" },
    ],
  },
]
