import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }}
    />
  )
}
