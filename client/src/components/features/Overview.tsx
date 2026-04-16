import ExplainerCard from '../shared/ExplainerCard';

export default function Overview() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="overview" title="What is this?">
        The Overview dashboard gives you a real-time snapshot of your Lakebase instance — connection health,
        storage usage, active connections, and query latency. It polls the backend every 10 seconds and
        displays live metrics from your Postgres-compatible Lakebase endpoint.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Overview coming soon — full implementation in next task.
      </div>
    </div>
  );
}
