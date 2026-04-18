import { useState, useEffect, useCallback, useRef } from 'react'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { ArchitectureDiagram } from '@/components/shared/ArchitectureDiagram'
import { BeforeAfter } from '@/components/shared/BeforeAfter'
import { InsightCard } from '@/components/shared/InsightCard'
import { LatencyBadge } from '@/components/shared/LatencyBadge'
import { DataTable } from '@/components/shared/DataTable'
import { useAppStore } from '@/stores/appStore'
import api from '@/lib/api'
import type { FeatureLookupResponse } from '@/types'

interface FeatureTableResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  page_size: number
  total_pages?: number
  latency_ms?: number
}

const architectureNodes = [
  { id: 'telemetry', icon: '\uD83D\uDCE1', label: 'Telemetry' },
  { id: 'compute', icon: '\u2699\uFE0F', label: 'Compute', sublabel: '5-min grain' },
  { id: 'delta', icon: '\uD83D\uDCCA', label: 'Delta Table', sublabel: 'Offline Store' },
  { id: 'lakebase', icon: '\u26A1', label: 'Lakebase', sublabel: 'Online Store', highlighted: true },
  { id: 'model', icon: '\uD83E\uDD16', label: 'ML Model' },
  { id: 'dashboard', icon: '\uD83D\uDC64', label: 'Customer Dashboard' },
]

export function FeatureStore() {
  const theme = useAppStore((s) => s.theme)

  const [entityId, setEntityId] = useState(theme.sampleEntities[0])
  const [lookupResult, setLookupResult] = useState<FeatureLookupResponse | null>(null)
  const [batchResult, setBatchResult] = useState<FeatureLookupResponse | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [activeNode, setActiveNode] = useState<string | undefined>(undefined)

  const [tablePage, setTablePage] = useState(1)
  const [tableData, setTableData] = useState<FeatureTableResponse | null>(null)
  const [tableLoading, setTableLoading] = useState(true)

  const prevThemeId = useRef(theme.id)

  // Reset entityId when theme changes
  useEffect(() => {
    if (prevThemeId.current !== theme.id) {
      prevThemeId.current = theme.id
      setEntityId(theme.sampleEntities[0])
      setLookupResult(null)
      setBatchResult(null)
      setActiveNode(undefined)
    }
  }, [theme])

  // Load feature table
  useEffect(() => {
    let cancelled = false
    setTableLoading(true)
    const [schema, table] = theme.featureTableName.split('.')
    api
      .get('/features/table', { params: { page: tablePage, page_size: 10, schema, table } })
      .then((res) => {
        if (!cancelled) setTableData(res.data)
      })
      .catch(() => {
        if (!cancelled) setTableData(null)
      })
      .finally(() => {
        if (!cancelled) setTableLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tablePage, theme])

  const handleLookup = useCallback(async () => {
    if (!entityId.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    setBatchResult(null)

    try {
      const [featureSchema, featureTable] = theme.featureTableName.split('.')
      const featureParams = { schema: featureSchema, table: featureTable }
      const [onlineRes, batchRes] = await Promise.all([
        api.get(`/features/${encodeURIComponent(entityId)}`, { params: featureParams }),
        api.get(`/features/${encodeURIComponent(entityId)}/batch`, { params: featureParams }),
      ])

      setLookupResult(onlineRes.data)
      setBatchResult(batchRes.data)

      // Flash the Lakebase node for 2 seconds
      setActiveNode('lakebase')
      setTimeout(() => setActiveNode(undefined), 2000)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lookup failed'
      setLookupError(msg)
      setLookupResult(null)
      setBatchResult(null)
    } finally {
      setLookupLoading(false)
    }
  }, [entityId])

  const onlineLat = lookupResult?.latency_ms ?? 7
  const batchLat = batchResult?.latency_ms ?? 500
  const speedup = batchLat > 0 ? Math.round(batchLat / onlineLat) : 70

  const left = (
    <div className="flex flex-col gap-6">
      <StoryHeader
        label="Feature Store"
        title="From Raw Data to Real-Time ML"
        subtitle="Sub-10ms feature serving for production ML models"
      />

      <ArchitectureDiagram
        nodes={architectureNodes}
        activeNode={activeNode}
        layout="two-row"
        splitAfter={3}
        syncLabel="Auto-sync"
      />

      <BeforeAfter
        before={{
          title: 'WITHOUT LAKEBASE',
          stat: '~500ms',
          description:
            'Query Delta table at request time. User sees a spinner.',
        }}
        after={{
          title: 'WITH LAKEBASE',
          stat: '~7ms',
          description:
            'Pre-synced to Lakebase. Instant lookup. 70x faster.',
        }}
      />

      <InsightCard>
        Same features, same data. Delta for training (batch, seconds OK).
        Lakebase for serving (real-time, milliseconds required). The platform
        syncs them automatically — no ETL to build.
      </InsightCard>
    </div>
  )

  const featureEntries = lookupResult
    ? Object.entries(lookupResult.features)
    : []

  const right = (
    <div className="flex flex-col gap-4">
      {/* Online Lookup Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Online Lookup
        </h3>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          {theme.entityIdLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 font-[var(--font-mono)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
            placeholder={theme.sampleEntities[0]}
          />
          <button
            onClick={handleLookup}
            disabled={lookupLoading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {lookupLoading ? 'Loading...' : 'Lookup'}
          </button>
        </div>

        {/* Sample entity quick picks */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {theme.sampleEntities.map((id) => (
            <button
              key={id}
              onClick={() => setEntityId(id)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {id}
            </button>
          ))}
        </div>

        {lookupError && (
          <div className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-xs text-[var(--color-danger)]">
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                Features for{' '}
                <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
                  {lookupResult.customer_id}
                </span>
              </span>
              <LatencyBadge ms={lookupResult.latency_ms} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {featureEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2"
                >
                  <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    {theme.featureLabels[key] ?? key}
                  </div>
                  <div className="mt-0.5 font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-primary)]">
                    {typeof value === 'boolean'
                      ? value
                        ? 'Yes'
                        : 'No'
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latency Comparison Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Latency Comparison
        </h3>

        <div className="flex flex-col gap-3">
          {/* Lakebase bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--color-text-secondary)]">
                Lakebase (Online)
              </span>
              <span className="font-[var(--font-mono)] font-semibold text-[var(--color-accent)]">
                {lookupResult ? `${Math.round(onlineLat)}ms` : '~7ms'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
                style={{
                  width: `${Math.max(2, (onlineLat / batchLat) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Delta bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--color-text-secondary)]">
                Delta (Batch)
              </span>
              <span className="font-[var(--font-mono)] font-semibold text-[var(--color-warning)]">
                {batchResult ? `${Math.round(batchLat)}ms` : '~500ms'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
              <div
                className="h-full rounded-full bg-[var(--color-warning)] transition-all duration-700"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Speedup callout */}
          <div className="mt-1 text-center">
            <span className="font-[var(--font-mono)] text-2xl font-bold text-[var(--color-accent)]">
              {lookupResult ? `${speedup}x` : '70x'}
            </span>
            <span className="ml-1.5 text-sm text-[var(--color-text-muted)]">
              faster
            </span>
          </div>
        </div>
      </div>

      {/* Feature Table Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Feature Table
        </h3>

        <DataTable
          columns={tableData?.columns ?? []}
          rows={tableData?.rows ?? []}
          loading={tableLoading}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-md bg-[var(--color-bg-hover)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
            {tableData ? `${tableData.total} rows total` : '---'}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage <= 1}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <span className="flex items-center px-2 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
              {tablePage}
            </span>
            <button
              onClick={() => setTablePage((p) => p + 1)}
              disabled={
                tableData != null &&
                tablePage * 10 >= tableData.total
              }
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return <SplitLayout left={left} right={right} />
}
