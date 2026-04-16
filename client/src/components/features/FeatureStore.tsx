import ExplainerCard from '../shared/ExplainerCard';

export default function FeatureStore() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="feature-store" title="What is this?">
        Lakebase can serve as a low-latency online feature store for ML models. This page demonstrates
        real-time feature lookups by customer ID — fetching pre-computed features (risk score, transaction
        velocity, anomaly flags) from Lakebase with sub-10ms latency, ready to feed into inference pipelines.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Feature Store — coming soon.
      </div>
    </div>
  );
}
