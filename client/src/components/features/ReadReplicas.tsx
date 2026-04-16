import ExplainerCard from '../shared/ExplainerCard';

export default function ReadReplicas() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="replicas" title="What is this?">
        Read Replicas in Lakebase allow you to horizontally scale read throughput by routing SELECT queries
        to dedicated replica endpoints. This page shows each replica&apos;s state, compute units, host, and
        replication lag — giving you full visibility into your read fleet.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Read Replicas — coming soon.
      </div>
    </div>
  );
}
