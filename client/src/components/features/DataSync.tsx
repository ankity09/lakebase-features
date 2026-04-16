import ExplainerCard from '../shared/ExplainerCard';

export default function DataSync() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="sync" title="What is this?">
        Lakebase&apos;s Zero-ETL Sync automatically replicates data from your Lakebase (Postgres) tables into
        Delta Lake tables in your Databricks workspace — with no manual pipelines or ETL code needed.
        This page shows sync status, last sync timestamp, and row counts across source and target.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Data Sync — coming soon.
      </div>
    </div>
  );
}
