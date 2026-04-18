import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IconRail } from '@/components/shell/IconRail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
        <IconRail />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/feature-store" />} />
            <Route path="/feature-store" element={<div className="p-6 text-[var(--color-text-primary)]">Feature Store page — Task 5</div>} />
            <Route path="/branching" element={<div className="p-6 text-[var(--color-text-primary)]">Branching page — Task 6</div>} />
            <Route path="/crud" element={<div className="p-6 text-[var(--color-text-primary)]">CRUD & Query page — Task 7</div>} />
            <Route path="/recovery" element={<div className="p-6 text-[var(--color-text-primary)]">Recovery — Plan B</div>} />
            <Route path="/ai-memory" element={<div className="p-6 text-[var(--color-text-primary)]">AI Memory — Plan B</div>} />
            <Route path="/autoscaling" element={<div className="p-6 text-[var(--color-text-primary)]">Autoscaling — Plan B</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
