import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'

interface DataTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  loading?: boolean
  maxRows?: number
  className?: string
}

export function DataTable({
  columns,
  rows,
  loading = false,
  maxRows,
  className,
}: DataTableProps) {
  const displayRows = maxRows != null ? rows.slice(0, maxRows) : rows

  return (
    <div className={cn('overflow-auto rounded-xl border border-[var(--color-border)]', className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--color-bg-hover)]">
            {columns.map((col) => (
              <th
                key={col}
                className="sticky top-0 z-10 bg-[var(--color-bg-hover)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : displayRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]"
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2 font-[var(--font-mono)] text-sm text-[var(--color-text-secondary)]"
                    >
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
