import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '../../stores/appStore';
import { cn } from '../../lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/crud': 'CRUD Operations',
  '/query': 'Query Editor',
  '/sync': 'Data Sync',
  '/branching': 'Branching',
  '/autoscaling': 'Autoscaling',
  '/scale-to-zero': 'Scale to Zero',
  '/replicas': 'Read Replicas',
  '/feature-store': 'Feature Store',
  '/pgvector': 'pgvector Search',
  '/monitoring': 'Monitoring',
};

const PAGE_DOCS: Record<string, string> = {
  '/overview': 'https://docs.databricks.com/aws/en/lakebase/',
  '/crud': 'https://docs.databricks.com/aws/en/lakebase/',
  '/query': 'https://docs.databricks.com/aws/en/lakebase/',
  '/sync': 'https://docs.databricks.com/aws/en/lakebase/data-sharing.html',
  '/branching': 'https://docs.databricks.com/aws/en/lakebase/branching.html',
  '/autoscaling': 'https://docs.databricks.com/aws/en/lakebase/',
  '/scale-to-zero': 'https://docs.databricks.com/aws/en/lakebase/',
  '/replicas': 'https://docs.databricks.com/aws/en/lakebase/',
  '/feature-store': 'https://docs.databricks.com/aws/en/machine-learning/feature-store/',
  '/pgvector': 'https://docs.databricks.com/aws/en/lakebase/',
  '/monitoring': 'https://docs.databricks.com/aws/en/lakebase/',
};

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation();
  const { sidebarCollapsed } = useAppStore();

  const title = PAGE_TITLES[location.pathname] || 'Lakebase Features';
  const docsUrl = PAGE_DOCS[location.pathname];

  return (
    <div className="flex h-screen bg-surface-0 overflow-hidden">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 transition-all duration-300 overflow-hidden',
          sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'
        )}
      >
        <Header title={title} docsUrl={docsUrl} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
