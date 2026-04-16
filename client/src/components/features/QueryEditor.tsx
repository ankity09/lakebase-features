import ExplainerCard from '../shared/ExplainerCard';

export default function QueryEditor() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="query" title="What is this?">
        The Query Editor lets you run arbitrary SQL against your Lakebase database and see results instantly.
        It supports keyboard shortcuts (Ctrl+Enter to execute), displays query latency, and formats results
        in a sortable data grid — all backed by the FastAPI query endpoint.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Query Editor — coming soon.
      </div>
    </div>
  );
}
