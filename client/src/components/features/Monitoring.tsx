import ExplainerCard from '../shared/ExplainerCard';

export default function Monitoring() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="monitoring" title="What is this?">
        The Monitoring dashboard surfaces real-time operational metrics from your Lakebase instance —
        transactions per second, active connections, cache hit rate, and storage usage. It also surfaces
        slow query analysis from pg_stat_statements to help identify optimization opportunities.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Monitoring — coming soon.
      </div>
    </div>
  );
}
