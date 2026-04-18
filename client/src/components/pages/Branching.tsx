import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, Plus, Trash2, ArrowRightLeft, Shield } from 'lucide-react'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { BeforeAfter } from '@/components/shared/BeforeAfter'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Skeleton } from '@/components/shared/Skeleton'
import { ZeroCopyDiagram } from '@/components/pages/ZeroCopyDiagram'
import api from '@/lib/api'
import { cn, formatBytes } from '@/lib/utils'
import type { BranchInfo, BranchCompareResponse } from '@/types'

/* ---------- BranchTree ---------- */

interface BranchTreeProps {
  branches: BranchInfo[]
  loading: boolean
}

function BranchTree({ branches, loading }: BranchTreeProps) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const mainBranch = branches.find((b) => b.is_default)
  const childBranches = branches.filter((b) => !b.is_default)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Branch tree
      </div>

      <AnimatePresence mode="popLayout">
        {/* Main trunk */}
        {mainBranch && (
          <motion.div
            key={mainBranch.name}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <div className="flex items-center gap-3">
              {/* Trunk line */}
              <div className="flex flex-col items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                {childBranches.length > 0 && (
                  <div className="h-full w-px bg-[var(--color-accent)]/30" />
                )}
              </div>

              <div className="flex flex-1 items-center justify-between rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {mainBranch.name}
                  </span>
                  <StatusBadge status={mainBranch.state} />
                  <span className="rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-accent)]">
                    production
                  </span>
                </div>
                <span className="font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                  {formatBytes(mainBranch.logical_size_bytes)}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Child branches */}
        {childBranches.map((branch, idx) => (
          <motion.div
            key={branch.name}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, delay: idx * 0.05 }}
            className="relative mt-1"
          >
            <div className="flex items-center gap-3">
              {/* Branch connector */}
              <div className="flex flex-col items-center">
                <div className="h-3 w-px bg-[var(--color-accent)]/30" />
                <div className="flex items-center">
                  <div className="h-px w-3 bg-[var(--color-info)]/40" />
                  <div className="h-2 w-2 rounded-full bg-[var(--color-info)]" />
                </div>
                {idx < childBranches.length - 1 && (
                  <div className="h-3 w-px bg-[var(--color-accent)]/30" />
                )}
              </div>

              <div className="flex flex-1 items-center justify-between rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {branch.name}
                  </span>
                  <StatusBadge status={branch.state} />
                </div>
                <span className="font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                  {formatBytes(branch.logical_size_bytes)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {branches.length === 0 && !loading && (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          No branches found
        </p>
      )}
    </div>
  )
}

/* ---------- CreateBranchForm ---------- */

interface CreateBranchFormProps {
  branches: BranchInfo[]
  onCreated: () => void
}

function CreateBranchForm({ branches, onCreated }: CreateBranchFormProps) {
  const [name, setName] = useState('')
  const [parentBranch, setParentBranch] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (branches.length > 0 && !parentBranch) {
      const def = branches.find((b) => b.is_default)
      setParentBranch(def?.name ?? branches[0].name)
    }
  }, [branches, parentBranch])

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      await api.post('/branches', { name: name.trim(), parent_branch: parentBranch })
      setSuccess(`Branch "${name.trim()}" created`)
      setName('')
      onCreated()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to create branch'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Create Branch
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="branch-name"
            className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]"
          >
            Branch name
          </label>
          <input
            id="branch-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. dev, staging, feature-xyz"
            className={cn(
              'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]',
              'px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
              'focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]',
              'transition-colors'
            )}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div>
          <label
            htmlFor="parent-branch"
            className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]"
          >
            Parent branch
          </label>
          <select
            id="parent-branch"
            value={parentBranch}
            onChange={(e) => setParentBranch(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]',
              'px-3 py-2 text-sm text-[var(--color-text-primary)]',
              'focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]',
              'transition-colors'
            )}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.is_default ? ' (production)' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className={cn(
            'w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            'bg-[var(--color-accent)] text-[#0A0A0A]',
            'hover:bg-[var(--color-accent)]/80',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {creating ? 'Creating...' : 'Create Branch'}
        </button>

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
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-xs text-[var(--color-accent)]"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- BranchListCard ---------- */

interface BranchListCardProps {
  branch: BranchInfo
  onDelete: (name: string) => void
}

function BranchListCard({ branch, onDelete }: BranchListCardProps) {
  const createdDate = branch.created_at
    ? new Date(branch.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <GitBranch className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text-primary)]">
                {branch.name}
              </span>
              {branch.is_default && (
                <span className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-accent)]">
                  <Shield className="h-2.5 w-2.5" />
                  production
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <StatusBadge status={branch.state} />
              <span className="font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                {formatBytes(branch.logical_size_bytes)}
              </span>
              {createdDate && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {createdDate}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onDelete(branch.name)}
          disabled={branch.is_default}
          className={cn(
            'rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors',
            'hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-danger)]',
            'disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]'
          )}
          aria-label={`Delete branch ${branch.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- CompareBranches ---------- */

interface CompareBranchesProps {
  branches: BranchInfo[]
}

function CompareBranches({ branches }: CompareBranchesProps) {
  const [base, setBase] = useState('')
  const [target, setTarget] = useState('')
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<BranchCompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branches.length >= 2 && !base && !target) {
      const def = branches.find((b) => b.is_default)
      const other = branches.find((b) => !b.is_default)
      setBase(def?.name ?? branches[0].name)
      setTarget(other?.name ?? branches[1].name)
    } else if (branches.length === 1 && !base) {
      setBase(branches[0].name)
    }
  }, [branches, base, target])

  async function handleCompare() {
    if (!base || !target || base === target) return
    setComparing(true)
    setError(null)
    setResult(null)

    try {
      const res = await api.get<BranchCompareResponse>('/branches/compare', {
        params: { base, target },
      })
      setResult(res.data)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to compare branches'
      setError(msg)
    } finally {
      setComparing(false)
    }
  }

  const hasSummary = result?.summary

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--color-info)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Compare Branches
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label
            htmlFor="compare-base"
            className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]"
          >
            Base
          </label>
          <select
            id="compare-base"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]',
              'px-3 py-2 text-sm text-[var(--color-text-primary)]',
              'focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]'
            )}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label
            htmlFor="compare-target"
            className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]"
          >
            Target
          </label>
          <select
            id="compare-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]',
              'px-3 py-2 text-sm text-[var(--color-text-primary)]',
              'focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]'
            )}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleCompare}
        disabled={comparing || !base || !target || base === target}
        className={cn(
          'mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
          'border border-[var(--color-info)] text-[var(--color-info)]',
          'hover:bg-[var(--color-info)]/10',
          'disabled:cursor-not-allowed disabled:opacity-40'
        )}
      >
        {comparing ? 'Comparing...' : 'Compare'}
      </button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {hasSummary && (() => {
        const allBaseTables = Object.keys(result.row_counts.base)
        const allTargetTables = Object.keys(result.row_counts.target)
        const addedTableNames = new Set(result.tables_added.map((t) => t.name))
        const removedTableNames = new Set(result.tables_removed.map((t) => t.name))
        const modifiedTableNames = new Set(result.column_diffs.map((d) => d.table))

        const columnDiffsByTable: Record<string, typeof result.column_diffs[number]> = {}
        for (const diff of result.column_diffs) {
          columnDiffsByTable[diff.table] = diff
        }

        const indexesByTable: Record<string, typeof result.indexes_added> = {}
        for (const idx of result.indexes_added) {
          const match = idx.definition.match(/ON\s+\S+\.(\S+)\s*\(/)
          if (match) {
            const tbl = match[1]
            if (!indexesByTable[tbl]) indexesByTable[tbl] = []
            indexesByTable[tbl].push(idx)
          }
        }

        const isNoDiffs =
          result.summary.tables_added === 0 &&
          result.summary.tables_removed === 0 &&
          result.summary.columns_changed === 0 &&
          result.summary.indexes_added === 0 &&
          result.summary.indexes_removed === 0

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-3"
          >
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {result.summary.tables_added > 0 && (
                <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-accent)]">
                  +{result.summary.tables_added} tables
                </span>
              )}
              {result.summary.tables_removed > 0 && (
                <span className="rounded-full bg-[var(--color-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)]">
                  -{result.summary.tables_removed} tables
                </span>
              )}
              {result.summary.columns_changed > 0 && (
                <span className="rounded-full bg-[var(--color-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-warning)]">
                  ~{result.summary.columns_changed} modified
                </span>
              )}
              {result.summary.indexes_added > 0 && (
                <span className="rounded-full bg-[var(--color-info)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-info)]">
                  +{result.summary.indexes_added} indexes
                </span>
              )}
              {result.summary.indexes_removed > 0 && (
                <span className="rounded-full bg-[var(--color-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)]">
                  -{result.summary.indexes_removed} indexes
                </span>
              )}
            </div>

            {/* Side-by-side schema cards */}
            {!isNoDiffs && (
              <div className="grid grid-cols-2 gap-4">
                {/* Left column — Base branch */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {result.base_branch}
                  </div>
                  {allBaseTables.map((table) => {
                    const isRemoved = removedTableNames.has(table)
                    const isModified = modifiedTableNames.has(table)
                    const isUnchanged = !isRemoved && !isModified
                    const diff = columnDiffsByTable[table]

                    return (
                      <div
                        key={table}
                        className={cn(
                          'rounded-lg border bg-[var(--color-bg-tertiary)] p-3',
                          isRemoved && 'border-[var(--color-danger)]',
                          isModified && 'border-[#06B6D4]',
                          !isRemoved && !isModified && 'border-[var(--color-border)]',
                          isUnchanged && 'opacity-50'
                        )}
                      >
                        <div
                          className={cn(
                            'text-sm font-bold text-[var(--color-text-primary)]',
                            isRemoved && 'text-[var(--color-danger)] line-through'
                          )}
                        >
                          {table}
                        </div>
                        <div className="mt-1 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                          {(result.row_counts.base[table] ?? 0).toLocaleString()} rows
                        </div>
                        {diff && (
                          <div className="mt-0.5 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                            {diff.columns_added.length + diff.columns_removed.length} column change{diff.columns_added.length + diff.columns_removed.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Right column — Target branch */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {result.target_branch}
                  </div>
                  {allTargetTables.map((table) => {
                    const isAdded = addedTableNames.has(table)
                    const isModified = modifiedTableNames.has(table)
                    const isUnchanged = !isAdded && !isModified
                    const diff = columnDiffsByTable[table]
                    const tableIndexes = indexesByTable[table]

                    return (
                      <div
                        key={table}
                        className={cn(
                          'rounded-lg border bg-[var(--color-bg-tertiary)] p-3',
                          isAdded && 'border-[#00E599] bg-[#00E599]/5',
                          !isAdded && isModified && 'border-[#06B6D4]',
                          !isAdded && !isModified && 'border-[var(--color-border)]',
                          isUnchanged && 'opacity-50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[var(--color-text-primary)]">
                            {table}
                          </span>
                          {isAdded && (
                            <span className="rounded bg-[#00E599]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#00E599]">
                              New Table
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                          {(result.row_counts.target[table] ?? 0).toLocaleString()} rows
                        </div>

                        {/* Column diffs for modified tables */}
                        {diff && (diff.columns_added.length > 0 || diff.columns_removed.length > 0) && (
                          <div className="mt-2 space-y-0.5">
                            {diff.columns_added.map((col) => (
                              <div
                                key={col.name}
                                className="font-[var(--font-mono)] text-xs text-[var(--color-accent)]"
                              >
                                + {col.name}{' '}
                                <span className="text-[var(--color-text-muted)]">
                                  {col.data_type}
                                </span>
                              </div>
                            ))}
                            {diff.columns_removed.map((col) => (
                              <div
                                key={col.name}
                                className="font-[var(--font-mono)] text-xs text-[var(--color-danger)] line-through"
                              >
                                - {col.name}{' '}
                                <span className="text-[var(--color-text-muted)]">
                                  {col.data_type}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Added columns for new tables */}
                        {isAdded && diff && diff.columns_added.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {diff.columns_added.map((col) => (
                              <div
                                key={col.name}
                                className="font-[var(--font-mono)] text-xs text-[var(--color-accent)]"
                              >
                                + {col.name}{' '}
                                <span className="text-[var(--color-text-muted)]">
                                  {col.data_type}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Index info */}
                        {tableIndexes && tableIndexes.length > 0 && (
                          <div className="mt-1.5 text-[10px] text-[#06B6D4]">
                            +{tableIndexes.length} index{tableIndexes.length !== 1 ? 'es' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state -- no diffs */}
            {isNoDiffs && (
              <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">
                No schema differences between branches
              </p>
            )}
          </motion.div>
        )
      })()}
    </div>
  )
}

/* ---------- Main Branching Page ---------- */

export function Branching() {
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [_deleting, setDeleting] = useState(false)

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get('/branches')
      const data = res.data
      // API returns { branches: [...] }, not a direct array
      setBranches(Array.isArray(data) ? data : data.branches ?? [])
    } catch {
      // Silently handle — branches list stays empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/branches/${deleteTarget}`)
      setDeleteTarget(null)
      await fetchBranches()
    } catch {
      // Error handled by API interceptor
    } finally {
      setDeleting(false)
    }
  }

  const left = (
    <div className="space-y-5">
      <StoryHeader
        label="Branching"
        title="Git for Your Database"
        subtitle="Instant zero-copy branches for safe schema migrations"
      />

      <BranchTree branches={branches} loading={loading} />

      <ZeroCopyDiagram />

      <BeforeAfter
        before={{
          title: 'Before Lakebase',
          stat: 'Hours + 2x storage',
          description:
            'Clone entire database -- hours of downtime, 2x storage cost, immediately stale copy that drifts from production.',
        }}
        after={{
          title: 'With Lakebase',
          stat: '0 bytes, <1 sec',
          description:
            'Zero-copy branch -- instant creation, 0 bytes initial cost, production-scale data, fully isolated writes.',
        }}
      />
    </div>
  )

  const right = (
    <div className="space-y-4">
      {/* Branch list */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Branches
          </h3>
          <span className="rounded-full bg-[var(--color-bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
            {branches.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
              >
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {branches.map((b) => (
                <BranchListCard
                  key={b.name}
                  branch={b}
                  onDelete={setDeleteTarget}
                />
              ))}
            </AnimatePresence>
            {branches.length === 0 && (
              <p className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                No branches found. Is the backend connected?
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create branch form */}
      <CreateBranchForm branches={branches} onCreated={fetchBranches} />

      {/* Compare branches */}
      {branches.length >= 2 && <CompareBranches branches={branches} />}

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={deleteTarget !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Branch"
        message={`Are you sure you want to delete branch "${deleteTarget}"? This action cannot be undone.`}
        variant="danger"
      />
    </div>
  )

  return <SplitLayout left={left} right={right} />
}
