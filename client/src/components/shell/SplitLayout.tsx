interface SplitLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
}

export function SplitLayout({ left, right }: SplitLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-0px)]">
      <div className="flex-1 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] overflow-y-auto p-6">
        {left}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {right}
      </div>
    </div>
  )
}
