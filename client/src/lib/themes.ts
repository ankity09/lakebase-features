export interface QueryTemplate {
  name: string
  description: string
  sql: string
}

export interface ThemeConfig {
  id: string
  name: string
  icon: string
  entityName: string
  entityIdLabel: string
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
    entityName: 'customer',
    entityIdLabel: 'Customer ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
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
    entityName: 'shipment',
    entityIdLabel: 'Shipment ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['SHIP-4521', 'SHIP-8834', 'SHIP-2291', 'SHIP-6677', 'SHIP-1105'],
    featureLabels: {
      hsts_present: 'Cold Chain OK',
      unique_ips_5min: 'Route Deviations',
      request_count_5min: 'Sensor Readings',
      avg_payload_bytes: 'Avg Payload (kg)',
      cookie_diversity_score: 'Carrier Score',
      geo_diversity_score: 'Route Diversity',
    },
    sampleQueries: [
      { name: 'Active shipments', description: 'By sensor volume', sql: 'SELECT customer_id as shipment_id, COUNT(*) as readings FROM appshield.telemetry_events GROUP BY customer_id ORDER BY readings DESC LIMIT 10' },
      { name: 'Temperature excursions', description: 'Cold chain violations', sql: "SELECT customer_id as shipment_id, COUNT(*) as excursions FROM appshield.telemetry_events WHERE response_code >= 400 GROUP BY customer_id ORDER BY excursions DESC LIMIT 10" },
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    icon: '🌾',
    entityName: 'farm',
    entityIdLabel: 'Farm ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['farm-midwest-07', 'farm-central-12', 'farm-pacific-03', 'farm-south-21', 'farm-plains-09'],
    featureLabels: {
      hsts_present: 'Irrigation Active',
      unique_ips_5min: 'Sensor Nodes',
      request_count_5min: 'Readings (5m)',
      avg_payload_bytes: 'Soil Moisture',
      cookie_diversity_score: 'Crop Health',
      geo_diversity_score: 'Field Coverage',
    },
    sampleQueries: [
      { name: 'Active farms', description: 'By sensor activity', sql: 'SELECT customer_id as farm_id, COUNT(*) as readings FROM appshield.telemetry_events GROUP BY customer_id ORDER BY readings DESC LIMIT 10' },
      { name: 'Irrigation status', description: 'Farms with active irrigation', sql: "SELECT customer_id as farm_id, SUM(CASE WHEN hsts_present THEN 1 ELSE 0 END) as active_readings FROM appshield.telemetry_events GROUP BY customer_id ORDER BY active_readings DESC LIMIT 10" },
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    icon: '🏭',
    entityName: 'equipment',
    entityIdLabel: 'Equipment ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['HP-L4-001', 'CNC-M2-014', 'ROB-A7-003', 'CONV-B1-008', 'WELD-C3-012'],
    featureLabels: {
      hsts_present: 'Safety Check OK',
      unique_ips_5min: 'Alert Count',
      request_count_5min: 'Sensor Events',
      avg_payload_bytes: 'Vibration Index',
      cookie_diversity_score: 'Uptime Score',
      geo_diversity_score: 'Line Coverage',
    },
    sampleQueries: [
      { name: 'Equipment alerts', description: 'By alert volume', sql: 'SELECT customer_id as equipment_id, COUNT(*) as events FROM appshield.telemetry_events GROUP BY customer_id ORDER BY events DESC LIMIT 10' },
      { name: 'Failure patterns', description: 'High error rate equipment', sql: "SELECT customer_id as equipment_id, ROUND(100.0 * SUM(CASE WHEN response_code >= 400 THEN 1 ELSE 0 END) / COUNT(*), 1) as error_pct FROM appshield.telemetry_events GROUP BY customer_id HAVING COUNT(*) > 100 ORDER BY error_pct DESC LIMIT 10" },
    ],
  },
]
