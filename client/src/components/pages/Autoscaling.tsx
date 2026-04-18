import { useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { BeforeAfter } from '@/components/shared/BeforeAfter'
import { useInterval } from '@/hooks/useInterval'
import api from '@/lib/api'

interface CuDataPoint {
  time: string
  cu: number
}

interface LatencyDataPoint {
  time: string
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
  const [cuHistory, setCuHistory] = useState<CuDataPoint[]>([])
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>([])
  const [totalQueries, setTotalQueries] = useState(0)
  const [errors, setErrors] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [currentCU, setCurrentCU] = useState(4)

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

  useInterval(
    async () => {
      try {
        const [autoscaleRes, statusRes] = await Promise.all([
          api.get('/autoscaling'),
          api.get('/loadtest/status'),
        ])

        const cu = autoscaleRes.data.current_cu ?? 4
        setCurrentCU(cu)
        setCuHistory((prev) => [
          ...prev,
          { time: new Date().toISOString(), cu },
        ])

        const status = statusRes.data
        if (status.latency_history) {
          setLatencyHistory(
            status.latency_history.map(
              (pt: { time: string; p50: number; p99: number }) => ({
                time: pt.time,
                p50: pt.p50,
                p99: pt.p99,
              })
            )
          )
        }
        setTotalQueries(status.total_queries ?? 0)
        setErrors(status.errors ?? 0)
        setElapsed(status.elapsed_seconds ?? 0)
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

  const formatTime = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

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

      {/* Cost Ticker */}
      <div className="rounded-xl bg-[var(--color-bg-tertiary)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Estimated Cost
        </div>
        <div className="mt-1 font-[var(--font-mono)] text-2xl font-bold text-[var(--color-accent)]">
          ${(currentCU * 0.111).toFixed(2)}/hr
        </div>
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Based on current CU
        </div>
      </div>

      {/* Key Stat Card */}
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
            style={{ width: `${(targetQps / 200) * 100}%` }}
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

      {/* CU Chart */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Compute Units
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cuHistory}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              stroke="var(--color-border)"
            />
            <YAxis
              domain={[0, 16]}
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
              labelFormatter={formatTime}
            />
            <ReferenceLine
              y={2}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              label={{ value: 'Min', fill: 'var(--color-text-muted)', fontSize: 10 }}
            />
            <ReferenceLine
              y={16}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              label={{ value: 'Max', fill: 'var(--color-text-muted)', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="cu"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
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
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              stroke="var(--color-border)"
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
              labelFormatter={formatTime}
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
