import ExplainerCard from '../shared/ExplainerCard';

export default function Autoscaling() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="autoscaling" title="What is this?">
        Lakebase autoscales compute resources based on workload demand. During peak traffic, it spins up
        additional compute units; during quiet periods, it scales back down. This page visualizes
        compute unit allocation over time and shows current endpoint states across all replicas.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Autoscaling — coming soon.
      </div>
    </div>
  );
}
