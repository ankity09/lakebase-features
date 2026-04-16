import { cn } from '../../lib/utils';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export default function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height }}
    />
  );
}
