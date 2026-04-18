import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <div className="w-[50px] shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
          {/* Icon Rail placeholder */}
        </div>
        <div className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/feature-store" />} />
            <Route path="/feature-store" element={<div className="text-[var(--color-text-primary)]">Feature Store — Coming Soon</div>} />
            <Route path="/branching" element={<div className="text-[var(--color-text-primary)]">Branching — Coming Soon</div>} />
            <Route path="/crud" element={<div className="text-[var(--color-text-primary)]">CRUD & Query — Coming Soon</div>} />
            <Route path="/recovery" element={<div className="text-[var(--color-text-primary)]">Recovery — Coming Soon</div>} />
            <Route path="/ai-memory" element={<div className="text-[var(--color-text-primary)]">AI Memory — Coming Soon</div>} />
            <Route path="/autoscaling" element={<div className="text-[var(--color-text-primary)]">Autoscaling — Coming Soon</div>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
