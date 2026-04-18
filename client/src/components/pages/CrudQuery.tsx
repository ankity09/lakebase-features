import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as Tabs from '@radix-ui/react-tabs'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { InsightCard } from '@/components/shared/InsightCard'
import { SqlEditor } from '@/components/shared/SqlEditor'
import { DataTable } from '@/components/shared/DataTable'
import { LatencyBadge } from '@/components/shared/LatencyBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { useAppStore } from '@/stores/appStore'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { QueryResponse, TableInfo, ColumnInfo } from '@/types'

/* ------------------------------------------------------------------ */
/*  Comparison Steps                                                   */
/* ------------------------------------------------------------------ */

const oldSteps = [
  'Provision RDS instance',
  'Configure security groups',
  'Set parameter groups',
  'Create IAM role',
  'Configure automated backups',
  'Set up CloudWatch monitoring',
  'Create database',
  'Create application user',
  'Grant permissions',
  'Configure connection pooling',
  'Create tables',
  'Test connectivity',
]

const lakebaseSteps = ['Create project', 'Write SQL', 'Done']

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
}

const fastContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const stepVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function ComparisonSteps() {
  return (
    <div className="flex gap-4">
      {/* Old Way */}
      <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          The Old Way
        </span>
        <motion.ol
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-3 space-y-1.5"
        >
          {oldSteps.map((step, i) => (
            <motion.li
              key={i}
              variants={stepVariants}
              className="flex items-start gap-2 text-[11px] leading-snug text-[var(--color-text-muted)]"
            >
              <span className="mt-px min-w-[16px] font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                {i + 1}.
              </span>
              {step}
            </motion.li>
          ))}
        </motion.ol>
      </div>

      {/* Lakebase Way */}
      <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          The Lakebase Way
        </span>
        <motion.ol
          variants={fastContainerVariants}
          initial="hidden"
          animate="visible"
          className="mt-3 space-y-1.5"
        >
          {lakebaseSteps.map((step, i) => (
            <motion.li
              key={i}
              variants={stepVariants}
              className="flex items-start gap-2 text-[11px] leading-snug text-[var(--color-text-primary)]"
            >
              <span className="mt-px text-[var(--color-accent)]">
                &#10003;
              </span>
              {step}
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Left Panel                                                         */
/* ------------------------------------------------------------------ */

function LeftPanel() {
  return (
    <div className="flex flex-col gap-6">
      <StoryHeader
        label="CRUD & QUERY"
        title="Sub-10ms Postgres, Fully Managed"
        subtitle="Full SQL engine — not a limited API"
      />

      <ComparisonSteps />

      <InsightCard>
        Full Postgres SQL engine — transactions, indexes, CTEs, triggers, stored
        procedures, views. Standard wire protocol. Every Postgres tool works.
      </InsightCard>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Panel                                                        */
/* ------------------------------------------------------------------ */

function RightPanel() {
  const { theme } = useAppStore()

  // --- SQL Editor state ---
  const [sql, setSql] = useState('')
  const [executing, setExecuting] = useState(false)
  const [explainMode, setExplainMode] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null)
  const [explainPlan, setExplainPlan] = useState<string | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  // --- Tables state ---
  const [tables, setTables] = useState<TableInfo[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  // --- Quick Actions state ---
  const [activeTab, setActiveTab] = useState('read')
  const [selectedTable, setSelectedTable] = useState('')
  const [schema, setSchema] = useState<ColumnInfo[]>([])

  // Read tab
  const [filterEntityId, setFilterEntityId] = useState('')
  const [readResult, setReadResult] = useState<QueryResponse | null>(null)
  const [readLoading, setReadLoading] = useState(false)

  // Insert tab
  const [insertFields, setInsertFields] = useState<Record<string, string>>({})
  const [insertLoading, setInsertLoading] = useState(false)
  const [insertMsg, setInsertMsg] = useState<string | null>(null)

  // Update tab
  const [updateSet, setUpdateSet] = useState('')
  const [updateWhere, setUpdateWhere] = useState('')
  const [updatePreview, setUpdatePreview] = useState<number | null>(null)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false)

  // Delete tab
  const [deleteWhere, setDeleteWhere] = useState('')
  const [deletePreview, setDeletePreview] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // --- Fetch tables ---
  useEffect(() => {
    setTablesLoading(true)
    api
      .get('/tables')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : r.data.tables ?? []
        setTables(list)
        if (list.length > 0 && !selectedTable) {
          setSelectedTable(list[0].table_name)
        }
      })
      .catch(() => {})
      .finally(() => setTablesLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch schema when table changes ---
  useEffect(() => {
    if (!selectedTable) return
    api
      .get(`/tables/${selectedTable}/schema`)
      .then((r) => {
        const cols = Array.isArray(r.data) ? r.data : r.data.columns ?? []
        setSchema(cols)
        const blank: Record<string, string> = {}
        cols.forEach((c: ColumnInfo) => {
          blank[c.name] = ''
        })
        setInsertFields(blank)
      })
      .catch(() => setSchema([]))
  }, [selectedTable])

  // --- Execute SQL ---
  const executeQuery = useCallback(async () => {
    if (!sql.trim()) return
    setExecuting(true)
    setQueryError(null)
    setQueryResult(null)
    setExplainPlan(null)
    try {
      if (explainMode) {
        const r = await api.post<{ plan: string; latency_ms: number }>(
          '/query/explain',
          { sql }
        )
        setExplainPlan(JSON.stringify(r.data.plan, null, 2))
      } else {
        const r = await api.post<QueryResponse>('/query/execute', { sql })
        setQueryResult(r.data)
      }
    } catch (err: any) {
      setQueryError(
        err.response?.data?.detail || err.response?.data?.error || err.message
      )
    } finally {
      setExecuting(false)
    }
  }, [sql, explainMode])

  // --- Template select ---
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value)
    if (!isNaN(idx) && theme.sampleQueries[idx]) {
      setSql(theme.sampleQueries[idx].sql)
    }
  }

  // --- Quick Action handlers ---
  const handleRead = async () => {
    if (!selectedTable) return
    setReadLoading(true)
    setReadResult(null)
    try {
      const filters: Record<string, string> = {}
      if (filterEntityId.trim()) {
        filters[theme.entityIdLabel.toLowerCase().replace(/\s+/g, '_')] =
          filterEntityId.trim()
      }
      const r = await api.post<QueryResponse>(
        `/tables/${selectedTable}/query`,
        { filters, page: 1, page_size: 20 }
      )
      setReadResult(r.data)
    } catch {
      /* swallow — API interceptor logs */
    } finally {
      setReadLoading(false)
    }
  }

  const handleInsert = async () => {
    if (!selectedTable) return
    setInsertLoading(true)
    setInsertMsg(null)
    try {
      const cleaned: Record<string, string> = {}
      Object.entries(insertFields).forEach(([k, v]) => {
        if (v.trim()) cleaned[k] = v.trim()
      })
      await api.post(`/tables/${selectedTable}/insert`, {
        records: [cleaned],
      })
      setInsertMsg('Row inserted successfully')
    } catch (err: any) {
      setInsertMsg(
        err.response?.data?.detail || err.response?.data?.error || 'Insert failed'
      )
    } finally {
      setInsertLoading(false)
    }
  }

  const handleUpdatePreview = async () => {
    if (!selectedTable || !updateWhere.trim()) return
    setUpdateLoading(true)
    setUpdateMsg(null)
    try {
      const r = await api.post<{ affected_rows: number }>(
        `/tables/${selectedTable}/update/preview`,
        { set_clause: updateSet, where_clause: updateWhere }
      )
      setUpdatePreview(r.data.affected_rows)
      setShowUpdateConfirm(true)
    } catch (err: any) {
      setUpdateMsg(
        err.response?.data?.detail || err.response?.data?.error || 'Preview failed'
      )
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleUpdateConfirm = async () => {
    setShowUpdateConfirm(false)
    setUpdateLoading(true)
    try {
      await api.post(`/tables/${selectedTable}/update`, {
        set_clause: updateSet,
        where_clause: updateWhere,
      })
      setUpdateMsg(`Updated ${updatePreview ?? 0} rows`)
      setUpdatePreview(null)
    } catch (err: any) {
      setUpdateMsg(
        err.response?.data?.detail || err.response?.data?.error || 'Update failed'
      )
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleDeletePreview = async () => {
    if (!selectedTable || !deleteWhere.trim()) return
    setDeleteLoading(true)
    setDeleteMsg(null)
    try {
      const r = await api.post<{ affected_rows: number }>(
        `/tables/${selectedTable}/delete/preview`,
        { where_clause: deleteWhere }
      )
      setDeletePreview(r.data.affected_rows)
      setShowDeleteConfirm(true)
    } catch (err: any) {
      setDeleteMsg(
        err.response?.data?.detail || err.response?.data?.error || 'Preview failed'
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setDeleteLoading(true)
    try {
      await api.post(`/tables/${selectedTable}/delete`, {
        where_clause: deleteWhere,
      })
      setDeleteMsg(`Deleted ${deletePreview ?? 0} rows`)
      setDeletePreview(null)
    } catch (err: any) {
      setDeleteMsg(
        err.response?.data?.detail || err.response?.data?.error || 'Delete failed'
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  // --- Shared table selector ---
  const TableSelector = () => (
    <select
      value={selectedTable}
      onChange={(e) => setSelectedTable(e.target.value)}
      disabled={tablesLoading}
      className={cn(
        'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2',
        'text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]',
        'focus:outline-none focus:border-[var(--color-accent)]'
      )}
    >
      {tables.map((t) => (
        <option key={t.table_name} value={t.table_name}>
          {t.table_schema}.{t.table_name} ({t.row_count} rows)
        </option>
      ))}
      {tables.length === 0 && <option value="">Loading tables...</option>}
    </select>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* ---- SQL Editor Card ---- */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            SQL Editor
          </span>
          <select
            onChange={handleTemplateChange}
            defaultValue=""
            className={cn(
              'ml-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2 py-1',
              'text-xs text-[var(--color-text-secondary)]',
              'focus:outline-none focus:border-[var(--color-accent)]'
            )}
          >
            <option value="" disabled>
              Templates...
            </option>
            {theme.sampleQueries.map((q, i) => (
              <option key={i} value={i}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        <SqlEditor
          value={sql}
          onChange={setSql}
          onExecute={executeQuery}
          placeholder="SELECT * FROM ..."
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={executeQuery}
            disabled={executing || !sql.trim()}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              'bg-[var(--color-accent)] text-[#0A0A0A]',
              'hover:bg-[var(--color-accent)]/80',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {executing ? 'Running...' : 'Execute'}
          </button>
          <span className="text-[10px] text-[var(--color-text-muted)] font-[var(--font-mono)]">
            Ctrl+Enter
          </span>
          <button
            onClick={() => setExplainMode((v) => !v)}
            className={cn(
              'ml-auto rounded-lg px-3 py-2 text-xs font-medium transition-colors border',
              explainMode
                ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            Explain
          </button>
        </div>

        {queryError && (
          <p className="mt-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
            {queryError}
          </p>
        )}
      </div>

      {/* ---- Results Card ---- */}
      {(queryResult || explainPlan) && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Results
            </span>
            {queryResult && (
              <>
                <LatencyBadge ms={queryResult.latency_ms} />
                <span className="text-[10px] font-[var(--font-mono)] text-[var(--color-text-muted)]">
                  {queryResult.row_count} row{queryResult.row_count !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {queryResult && (
            <DataTable
              columns={queryResult.columns}
              rows={queryResult.rows}
              maxRows={50}
            />
          )}

          {explainPlan && (
            <pre className="overflow-x-auto rounded-lg bg-[var(--color-bg-hover)] p-3 font-[var(--font-mono)] text-xs text-[var(--color-text-secondary)]">
              {explainPlan}
            </pre>
          )}
        </div>
      )}

      {/* ---- Quick Actions ---- */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Quick Actions
        </span>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="mb-4 flex gap-1 rounded-lg bg-[var(--color-bg-hover)] p-1">
            {['read', 'insert', 'update', 'delete'].map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  'text-[var(--color-text-muted)]',
                  'data-[state=active]:bg-[var(--color-bg-tertiary)] data-[state=active]:text-[var(--color-text-primary)]',
                  'data-[state=active]:shadow-sm'
                )}
              >
                {tab}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ---- Read Tab ---- */}
          <Tabs.Content value="read" className="flex flex-col gap-3">
            <TableSelector />
            <div className="flex gap-2">
              <input
                value={filterEntityId}
                onChange={(e) => setFilterEntityId(e.target.value)}
                placeholder={`Filter by ${theme.entityIdLabel}...`}
                className={cn(
                  'flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2',
                  'text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]'
                )}
              />
              <button
                onClick={handleRead}
                disabled={readLoading}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  'bg-[var(--color-accent)] text-[#0A0A0A]',
                  'hover:bg-[var(--color-accent)]/80',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {readLoading ? 'Querying...' : 'Query'}
              </button>
            </div>
            {readResult && (
              <div className="mt-1">
                <div className="mb-2 flex items-center gap-2">
                  <LatencyBadge ms={readResult.latency_ms} />
                  <span className="text-[10px] font-[var(--font-mono)] text-[var(--color-text-muted)]">
                    {readResult.row_count} row{readResult.row_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <DataTable
                  columns={readResult.columns}
                  rows={readResult.rows}
                  maxRows={20}
                />
              </div>
            )}
          </Tabs.Content>

          {/* ---- Insert Tab ---- */}
          <Tabs.Content value="insert" className="flex flex-col gap-3">
            <TableSelector />
            {schema.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {schema.map((col) => (
                  <div key={col.name} className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[var(--color-text-muted)]">
                      {col.name}{' '}
                      <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]/60">
                        {col.data_type}
                      </span>
                    </label>
                    <input
                      value={insertFields[col.name] ?? ''}
                      onChange={(e) =>
                        setInsertFields((prev) => ({
                          ...prev,
                          [col.name]: e.target.value,
                        }))
                      }
                      placeholder={col.default_value ?? ''}
                      className={cn(
                        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2 py-1.5',
                        'text-xs text-[var(--color-text-primary)] font-[var(--font-mono)]',
                        'placeholder:text-[var(--color-text-muted)]',
                        'focus:outline-none focus:border-[var(--color-accent)]'
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleInsert}
              disabled={insertLoading}
              className={cn(
                'self-start rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-accent)] text-[#0A0A0A]',
                'hover:bg-[var(--color-accent)]/80',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {insertLoading ? 'Inserting...' : 'Insert'}
            </button>
            {insertMsg && (
              <p
                className={cn(
                  'rounded-lg px-3 py-2 text-xs',
                  insertMsg.includes('success')
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                )}
              >
                {insertMsg}
              </p>
            )}
          </Tabs.Content>

          {/* ---- Update Tab ---- */}
          <Tabs.Content value="update" className="flex flex-col gap-3">
            <TableSelector />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)]">
                SET clause
              </label>
              <input
                value={updateSet}
                onChange={(e) => setUpdateSet(e.target.value)}
                placeholder="column = 'value', ..."
                className={cn(
                  'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2',
                  'text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]'
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)]">
                WHERE clause
              </label>
              <input
                value={updateWhere}
                onChange={(e) => setUpdateWhere(e.target.value)}
                placeholder="id = 123"
                className={cn(
                  'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2',
                  'text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]'
                )}
              />
            </div>
            <button
              onClick={handleUpdatePreview}
              disabled={updateLoading || !updateWhere.trim()}
              className={cn(
                'self-start rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-accent)] text-[#0A0A0A]',
                'hover:bg-[var(--color-accent)]/80',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {updateLoading ? 'Loading...' : 'Preview & Update'}
            </button>
            {updateMsg && (
              <p
                className={cn(
                  'rounded-lg px-3 py-2 text-xs',
                  updateMsg.startsWith('Updated')
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                )}
              >
                {updateMsg}
              </p>
            )}
          </Tabs.Content>

          {/* ---- Delete Tab ---- */}
          <Tabs.Content value="delete" className="flex flex-col gap-3">
            <TableSelector />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)]">
                WHERE clause
              </label>
              <input
                value={deleteWhere}
                onChange={(e) => setDeleteWhere(e.target.value)}
                placeholder="id = 123"
                className={cn(
                  'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2',
                  'text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]'
                )}
              />
            </div>
            <button
              onClick={handleDeletePreview}
              disabled={deleteLoading || !deleteWhere.trim()}
              className={cn(
                'self-start rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-danger)] text-white',
                'hover:bg-[var(--color-danger)]/80',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {deleteLoading ? 'Loading...' : 'Preview & Delete'}
            </button>
            {deleteMsg && (
              <p
                className={cn(
                  'rounded-lg px-3 py-2 text-xs',
                  deleteMsg.startsWith('Deleted')
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                )}
              >
                {deleteMsg}
              </p>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* ---- Confirm Modals ---- */}
      <ConfirmModal
        open={showUpdateConfirm}
        onConfirm={handleUpdateConfirm}
        onCancel={() => setShowUpdateConfirm(false)}
        title="Confirm Update"
        message={`UPDATE ${selectedTable} SET ${updateSet} WHERE ${updateWhere}`}
        affectedRows={updatePreview ?? undefined}
        variant="default"
      />

      <ConfirmModal
        open={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Confirm Delete"
        message={`DELETE FROM ${selectedTable} WHERE ${deleteWhere}`}
        affectedRows={deletePreview ?? undefined}
        variant="danger"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page Export                                                         */
/* ------------------------------------------------------------------ */

export function CrudQuery() {
  return <SplitLayout left={<LeftPanel />} right={<RightPanel />} />
}
