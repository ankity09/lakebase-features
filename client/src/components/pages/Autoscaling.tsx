import { useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { BeforeAfter } from '@/components/shared/BeforeAfter'
import { useInterval } from '@/hooks/useInterval'
import api from '@/lib/api'

interface LatencyDataPoint {
  ts: string
  p50: number
  p99: number
}

const QPS_LEVELS = [
  { label: 'Idle', qps: 0 },
  { label: 'Light (50)', qps: 50 },
  { label: 'Medium (200)', qps: 200 },
  { label: 'Heavy (500)', qps: 500 },
  { label: 'Spike (1000)', qps: 1000 },
] as const

export function Autoscaling() {
  const [targetQps, setTargetQps] = useState(0)
  const [running, setRunning] = useState(false)
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>([])
  const [totalQueries, setTotalQueries] = useState(0)
  const [errors, setErrors] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [activeConnections, setActiveConnections] = useState<number | null>(null)

  const handleStart = useCallback(async (qps: number) => {
    setTargetQps(qps)
    if (qps === 0) {
      try {
        await api.post('/loadtest/stop')
      } catch {
        /* ignore */
      }
      setRunning(false)
      return
    }
    try {
      await api.post('/loadtest/start', { qps })
      setRunning(true)
    } catch {
      /* ignore */
    }
  }, [])

  const handleStop = useCallback(async () => {
    try {
      await api.post('/loadtest/stop')
    } catch {
      /* ignore */
    }
    setRunning(false)
    setTargetQps(0)
  }, [])

  // Poll loadtest status and active connections
  useInterval(
    async () => {
      try {
        const [statusRes, metricsRes] = await Promise.all([
          api.get('/loadtest/status'),
          api.get('/monitoring/metrics').catch(() => null),
        ])

        const status = statusRes.data
        if (status.latency_history) {
          setLatencyHistory(
            status.latency_history.map(
              (pt: { ts?: string; time?: string; p50: number; p99: number }) => ({
                ts: pt.ts ?? pt.time ?? new Date().toISOString(),
                p50: pt.p50,
                p99: pt.p99,
              })
            )
          )
        }
        setTotalQueries(status.total_queries ?? 0)
        setErrors(status.errors ?? 0)
        setElapsed(status.elapsed_seconds ?? 0)

        if (metricsRes?.data) {
          const conn =
            metricsRes.data.active_connections ??
            metricsRes.data.connections ??
            null
          setActiveConnections(typeof conn === 'number' ? conn : null)
        }
      } catch {
        /* ignore polling errors */
      }
    },
    running ? 3000 : null
  )

  const maxP99 =
    latencyHistory.length > 0
      ? Math.max(...latencyHistory.map((pt) => pt.p99))
      : 0

  const left = (
    <div className="flex flex-col gap-6">
      <StoryHeader
        label="AUTOSCALING"
        title="Watch It Scale Under Load"
        subtitle="Zero downtime, automatic compute adjustment"
      />

      <BeforeAfter
        before={{
          title: 'MANUAL RESIZE',
          stat: '5-15 min',
          description:
            'DBA resizes instance manually. Queries fail during resize. Downtime guaranteed.',
        }}
        after={{
          title: 'LAKEBASE AUTO-SCALE',
          stat: '0 downtime',
          description:
            'Compute scales automatically. Queries stay at <10ms. No manual intervention.',
        }}
      />

      {/* Demo Tip */}
      <div className="rounded-xl border border-[var(--color-info)] bg-[var(--color-info)]/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-info)]">
          Demo Tip
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Open the{' '}
          <strong className="text-[var(--color-text-primary)]">
            Lakebase dashboard
          </strong>{' '}
          in a split screen to show the real-time RAM/CU chart alongside this
          traffic generator. The dashboard shows allocated memory scaling up as
          queries hit the database.
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Databricks → Lakebase → lakebase-features → Monitoring tab
        </p>
      </div>

      {/* Key Stat Card — shown after load test starts */}
      {totalQueries > 0 && (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-tertiary)] p-4">
          <p className="text-sm font-bold text-[var(--color-accent)]">
            Traffic: {targetQps} qps. Latency stayed under {maxP99}ms. Zero
            downtime.
          </p>
        </div>
      )}
    </div>
  )

  const right = (
    <div className="flex flex-col gap-4">
      {/* Traffic Generator */}
      <div className="rounded-xl bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Traffic Generator
        </h3>
        <div className="flex flex-wrap gap-2">
          {QPS_LEVELS.map((level) => (
            <button
              key={level.label}
              onClick={() => handleStart(level.qps)}
              className={
                targetQps === level.qps
                  ? 'rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-[var(--color-bg-primary)] transition-colors'
                  : 'rounded-lg bg-[var(--color-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]'
              }
            >
              {level.label}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${Math.min((targetQps / 1000) * 100, 100)}%` }}
          />
        </div>

        {/* Stats row */}
        {running && (
          <div className="mt-2 flex gap-4 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
            <span>Running for {elapsed}s</span>
            <span>{totalQueries} queries</span>
            <span>{errors} errors</span>
          </div>
        )}
      </div>

      {/* Active Connections Gauge */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Active Connections
        </h3>
        <div className="flex items-end gap-3">
          <span className="font-[var(--font-mono)] text-4xl font-bold text-[var(--color-accent)]">
            {activeConnections !== null ? activeConnections : '—'}
          </span>
          <span className="mb-1 text-xs text-[var(--color-text-muted)]">
            {running ? 'live · polling every 3s' : 'start a load level to monitor'}
          </span>
        </div>
        {/* Mini bar representing connection load */}
        {activeConnections !== null && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
              style={{ width: `${Math.min((activeConnections / 100) * 100, 100)}%` }}
            />
          </div>
        )}
        {activeConnections !== null && (
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            {activeConnections} / 100 max connections
          </p>
        )}
      </div>

      {/* Latency Chart */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Latency
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={latencyHistory}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="ts"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              stroke="var(--color-border)"
              tickFormatter={(val) => {
                try {
                  return new Date(val).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                } catch {
                  return ''
                }
              }}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              stroke="var(--color-border)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text-primary)',
                fontSize: 12,
              }}
              labelFormatter={(val) => {
                try {
                  return new Date(val).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                } catch {
                  return String(val)
                }
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            />
            <Line
              type="monotone"
              dataKey="p50"
              name="p50"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p99"
              name="p99"
              stroke="var(--color-warning)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stop button */}
      {running && (
        <button
          onClick={handleStop}
          className="w-full rounded-lg bg-[var(--color-danger)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Stop Load Test
        </button>
      )}
    </div>
  )

  return <SplitLayout left={left} right={right} />
}
