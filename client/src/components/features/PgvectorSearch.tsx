import ExplainerCard from '../shared/ExplainerCard';

export default function PgvectorSearch() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="pgvector" title="What is this?">
        Lakebase supports the pgvector extension, enabling similarity search directly in Postgres.
        This page lets you run semantic searches over threat event embeddings — enter a natural language
        query and find the most similar security events using cosine similarity, all without leaving
        your operational database.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        pgvector Search — coming soon.
      </div>
    </div>
  );
}
