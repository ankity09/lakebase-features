import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { BeforeAfter } from '@/components/shared/BeforeAfter'
import { DataTable } from '@/components/shared/DataTable'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

/* ---------- Types ---------- */

interface SnapshotState {
  snapshot_id: string
  timestamp: string
  row_count: number
}

interface RestoreResult {
  status: string
  rows_recovered: number
  elapsed_seconds: number
  branch_used: string
}

interface DemoTableResponse {
  rows: Record<string, unknown>[]
  row_count: number
  showing?: number
  timestamp?: string
}

/* ---------- Timeline ---------- */

interface TimelineProps {
  snapshotDay: number | null
  disasterDay: number | null
  restored: boolean
}

function Timeline({ snapshotDay, disasterDay, restored }: TimelineProps) {
  const days = [1, 2, 3, 4, 5, 6, 7]
  const snapshotPct = snapshotDay != null ? ((snapshotDay - 1) / 6) * 100 : null
  const disasterPct = disasterDay != null ? ((disasterDay - 1) / 6) * 100 : null

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        7-Day Recovery Window
      </div>

      <div className="relative">
        {/* Track */}
        <div className="h-3 w-full rounded-full bg-[var(--color-bg-hover)]">
          {/* Danger zone — from snapshot to disaster */}
          {snapshotPct != null && disasterPct != null && (
            <motion.div
              className="absolute inset-y-0 rounded-full bg-[var(--color-danger)]/20"
              initial={{ left: `${snapshotPct}%`, width: `${disasterPct - snapshotPct}%` }}
              animate={{
                left: `${snapshotPct}%`,
                width: restored ? '0%' : `${disasterPct - snapshotPct}%`,
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Snapshot pin (green) */}
        {snapshotPct != null && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-0.5 flex flex-col items-center"
            style={{ left: `${snapshotPct}%` }}
          >
            <div className="h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[var(--color-bg-secondary)] bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
            <span className="mt-1 -translate-x-1/2 text-[9px] font-semibold text-[var(--color-accent)]">
              Snapshot
            </span>
          </motion.div>
        )}

        {/* Disaster pin (red) */}
        {disasterPct != null && !restored && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-0.5 flex flex-col items-center"
            style={{ left: `${disasterPct}%` }}
          >
            <div className="h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[var(--color-bg-secondary)] bg-[var(--color-danger)] shadow-[0_0_8px_var(--color-danger)]" />
            <span className="mt-1 -translate-x-1/2 text-[9px] font-semibold text-[var(--color-danger)]">
              Disaster
            </span>
          </motion.div>
        )}
      </div>

      {/* Day labels */}
      <div className="mt-4 flex justify-between px-0.5">
        {days.map((d) => (
          <span
            key={d}
            className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]"
          >
            Day {d}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- Step Indicators ---------- */

interface StepIndicatorsProps {
  currentStep: number
}

function StepIndicators({ currentStep }: StepIndicatorsProps) {
  const steps = [1, 2, 3, 4]

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, idx) => (
        <div key={s} className="flex items-center">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full font-[var(--font-mono)] text-xs font-bold transition-all duration-300',
              s < currentStep &&
                'bg-[var(--color-accent)] text-[#0A0A0A]',
              s === currentStep &&
                'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]',
              s > currentStep &&
                'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            )}
          >
            {s}
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-px w-8 transition-colors duration-300',
                s < currentStep
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-border)]'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------- Recovery Page ---------- */

export function Recovery() {
  const [step, setStep] = useState(1)
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null)
  const [tableData, setTableData] = useState<DemoTableResponse | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  /* --- Step 1: Verify --- */
  const handleVerify = useCallback(async () => {
    setLoading(true)
    clearError()
    try {
      const res = await api.get<DemoTableResponse>('/recovery/demo-table')
      setTableData(res.data)
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify table'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  /* --- Step 2: Snapshot --- */
  const handleSnapshot = useCallback(async () => {
    setLoading(true)
    clearError()
    try {
      const res = await api.post<SnapshotState>('/recovery/snapshot')
      setSnapshot(res.data)
      setStep(3)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to take snapshot'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  /* --- Step 3: Corrupt --- */
  const handleCorrupt = useCallback(async () => {
    setLoading(true)
    clearError()
    try {
      await api.post('/recovery/corrupt')
      setTableData({ rows: [], row_count: 0 })
      setStep(4)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [tableData])

  /* --- Step 4: Restore --- */
  const handleRestore = useCallback(async () => {
    if (!snapshot) return
    setLoading(true)
    clearError()
    try {
      const res = await api.post<RestoreResult>('/recovery/restore', {
        snapshot_timestamp: snapshot.timestamp,
      })
      setRestoreResult(res.data)

      // Re-fetch the table to show recovered data
      const tableRes = await api.get<DemoTableResponse>('/recovery/demo-table')
      setTableData(tableRes.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [snapshot])

  /* --- Reset --- */
  const handleReset = useCallback(() => {
    setStep(1)
    setSnapshot(null)
    setTableData(null)
    setRestoreResult(null)
    setLoading(false)
    setError(null)
  }, [])

  const isTableEmpty = tableData != null && tableData.row_count === 0

  /* ---------- Left Panel ---------- */
  const left = (
    <div className="flex flex-col gap-6">
      <StoryHeader
        label="RECOVERY"
        title="Undo Anything, Instantly"
        subtitle="Point-in-time recovery to any second in the last 7 days"
      />

      <Timeline
        snapshotDay={snapshot ? 3 : null}
        disasterDay={step >= 4 ? 5 : null}
        restored={restoreResult != null}
      />

      <BeforeAfter
        before={{
          title: 'TRADITIONAL BACKUP',
          stat: '4-24 hrs',
          description:
            'Restore from nightly backup. Lose hours of data. 2-4 hour downtime while restoring.',
        }}
        after={{
          title: 'LAKEBASE PITR',
          stat: 'Any second',
          description:
            'Restore to any point in the last 7 days. Zero data loss. Seconds, not hours.',
        }}
      />
    </div>
  )

  /* ---------- Right Panel ---------- */
  const right = (
    <div className="flex flex-col gap-4">
      {/* Step Indicators */}
      <StepIndicators currentStep={step} />

      {/* Step Cards */}
      <AnimatePresence mode="wait">
        {/* Step 1 — Verify */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4"
          >
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
              Step 1 — Verify Table
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Confirm the <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">model_predictions</span> table has data.
            </p>
            <button
              onClick={handleVerify}
              disabled={loading}
              className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-accent)] text-[#0A0A0A]',
                'hover:bg-[var(--color-accent)]/80',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {loading ? 'Verifying...' : 'Verify Table'}
            </button>
          </motion.div>
        )}

        {/* Step 2 — Snapshot */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4"
          >
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
              Step 2 — Take Snapshot
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Record the current state as a recovery point.
            </p>
            <button
              onClick={handleSnapshot}
              disabled={loading}
              className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'border border-[var(--color-accent)] text-[var(--color-accent)]',
                'hover:bg-[var(--color-accent)]/10',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {loading ? 'Taking Snapshot...' : 'Take Snapshot'}
            </button>
          </motion.div>
        )}

        {/* Step 3 — Corrupt */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4"
          >
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
              Step 3 — Simulate Disaster
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Delete all data from the table. This is the catastrophic event.
            </p>
            <button
              onClick={handleCorrupt}
              disabled={loading}
              className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-danger)] text-white',
                'hover:bg-[var(--color-danger)]/80',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {loading ? 'Deleting...' : 'Delete All Data'}
            </button>
          </motion.div>
        )}

        {/* Step 4 — Restore */}
        {step === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4"
          >
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
              Step 4 — Restore to Snapshot
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Use Lakebase PITR to recover to the exact second of the snapshot.
            </p>
            <button
              onClick={handleRestore}
              disabled={loading || restoreResult != null}
              className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-accent)] text-[#0A0A0A]',
                'hover:bg-[var(--color-accent)]/80',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {loading ? 'Restoring...' : restoreResult ? 'Restored' : 'Restore to Snapshot'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snapshot info */}
      {snapshot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-3"
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Snapshot Recorded
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Timestamp</div>
              <div className="font-[var(--font-mono)] text-xs text-[var(--color-text-primary)]">
                {new Date(snapshot.timestamp).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Rows at Snapshot</div>
              <div className="font-[var(--font-mono)] text-xs text-[var(--color-text-primary)]">
                {snapshot.row_count.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Current Table State */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Current Table State
        </h3>

        {tableData == null ? (
          <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
            Run Step 1 to load table data
          </p>
        ) : isTableEmpty ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 py-6"
          >
            <div className="text-2xl font-bold text-[var(--color-danger)]">
              TABLE IS EMPTY
            </div>
            <span className="font-[var(--font-mono)] text-xs text-[var(--color-danger)]/70">
              0 rows — all data deleted
            </span>
          </motion.div>
        ) : (
          <>
            <DataTable
              columns={tableData.rows.length > 0 ? Object.keys(tableData.rows[0]) : []}
              rows={tableData.rows}
              maxRows={5}
            />
            <div className="mt-2">
              <span className="rounded-md bg-[var(--color-bg-hover)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                {tableData.row_count.toLocaleString()} rows total
              </span>
            </div>
          </>
        )}
      </div>

      {/* Results card — shown after restore */}
      <AnimatePresence>
        {restoreResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-4"
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Recovery Complete
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Rows Recovered
                </div>
                <div className="mt-0.5 font-[var(--font-mono)] text-lg font-bold text-[var(--color-accent)]">
                  {restoreResult.rows_recovered.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Elapsed Time
                </div>
                <div className="mt-0.5 font-[var(--font-mono)] text-lg font-bold text-[var(--color-accent)]">
                  {restoreResult.elapsed_seconds.toFixed(2)}s
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  PITR Branch
                </div>
                <div className="mt-0.5 font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-primary)]">
                  {restoreResult.branch_used}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Method
                </div>
                <div className="mt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  Zero-copy branch at timestamp
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Demo button */}
      {step > 1 && (
        <button
          onClick={handleReset}
          className={cn(
            'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'text-[var(--color-text-muted)]',
            'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]'
          )}
        >
          Reset Demo
        </button>
      )}
    </div>
  )

  return <SplitLayout left={left} right={right} />
}
