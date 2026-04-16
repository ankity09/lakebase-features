import ExplainerCard from '../shared/ExplainerCard';

export default function CrudOperations() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="crud" title="What is this?">
        CRUD operations let you read, insert, update, and delete records directly in your Lakebase tables.
        This page showcases Lakebase&apos;s Postgres-compatible SQL interface with real-time row previews,
        bulk operations with confirmation dialogs, and sub-10ms transactional performance.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        CRUD Operations — coming soon.
      </div>
    </div>
  );
}
