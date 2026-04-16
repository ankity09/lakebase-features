import ExplainerCard from '../shared/ExplainerCard';

export default function Branching() {
  return (
    <div className="space-y-6">
      <ExplainerCard pageKey="branching" title="What is this?">
        Lakebase Branching lets you create isolated copies of your database in seconds — perfect for safe
        schema migrations, load testing, and feature development. Branches share storage with the parent
        (copy-on-write) so they&apos;re cheap to create and destroy. This page lets you list, create, and
        switch between database branches.
      </ExplainerCard>
      <div className="rounded-card bg-surface-2 border border-surface-3 p-8 text-center text-text-secondary">
        Branching — coming soon.
      </div>
    </div>
  );
}
