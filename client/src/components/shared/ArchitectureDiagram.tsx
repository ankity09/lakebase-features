import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DiagramNode {
  id: string
  icon: string
  label: string
  sublabel?: string
  highlighted?: boolean
}

interface ArchitectureDiagramProps {
  nodes: DiagramNode[]
  activeNode?: string
  layout?: 'horizontal' | 'two-row'
  splitAfter?: number
  syncLabel?: string
  className?: string
}

function Arrow() {
  return (
    <span className="shrink-0 text-[var(--color-text-muted)] text-sm select-none">
      {'━━▶'}
    </span>
  )
}

function NodeBox({
  node,
  isActive,
}: {
  node: DiagramNode
  isActive: boolean
}) {
  return (
    <motion.div
      animate={
        isActive
          ? {
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 0px rgba(0,229,153,0)',
                '0 0 16px rgba(0,229,153,0.4)',
                '0 0 0px rgba(0,229,153,0)',
              ],
            }
          : { scale: 1, boxShadow: '0 0 0px rgba(0,229,153,0)' }
      }
      transition={{ duration: 0.5 }}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 text-center',
        'border transition-colors min-w-[90px]',
        node.highlighted || isActive
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-glow)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-hover)]'
      )}
    >
      <span className="text-lg leading-none">{node.icon}</span>
      <span className="text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
        {node.label}
      </span>
      {node.sublabel && (
        <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
          {node.sublabel}
        </span>
      )}
    </motion.div>
  )
}

function NodeRow({
  nodes,
  activeNode,
}: {
  nodes: DiagramNode[]
  activeNode?: string
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-center gap-2">
          <NodeBox node={node} isActive={activeNode === node.id} />
          {i < nodes.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  )
}

export function ArchitectureDiagram({
  nodes,
  activeNode,
  layout = 'horizontal',
  splitAfter,
  syncLabel,
  className,
}: ArchitectureDiagramProps) {
  if (layout === 'two-row' && splitAfter != null) {
    const topRow = nodes.slice(0, splitAfter)
    const bottomRow = nodes.slice(splitAfter)

    return (
      <div className={cn('flex flex-col items-center gap-4', className)}>
        <NodeRow nodes={topRow} activeNode={activeNode} />
        <div className="flex flex-col items-center gap-0.5 text-[var(--color-text-muted)]">
          <span className="text-sm select-none">{'▼'}</span>
          {syncLabel && (
            <span className="text-[10px] font-medium text-[var(--color-accent)]">
              {syncLabel}
            </span>
          )}
          <span className="text-sm select-none">{'▼'}</span>
        </div>
        <NodeRow nodes={bottomRow} activeNode={activeNode} />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <NodeRow nodes={nodes} activeNode={activeNode} />
    </div>
  )
}
