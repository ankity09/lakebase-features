import ExplainerCard from '../shared/ExplainerCard';

export default function ScaleToZero() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="scale-to-zero" title="What is this?">
        Lakebase&apos;s Scale-to-Zero feature automatically suspends compute when the database is idle,
        eliminating costs during off-hours. When a connection arrives, it wakes up in seconds.
        This page shows the current suspend/resume state, cold-start latency, and cumulative cost savings.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Scale to Zero — coming soon.
      </div>
    </div>
  );
}
