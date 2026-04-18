import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IconRail } from '@/components/shell/IconRail'
import { FeatureStore } from '@/components/pages/FeatureStore'
import { Branching } from '@/components/pages/Branching'
import { CrudQuery } from '@/components/pages/CrudQuery'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
        <IconRail />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/feature-store" />} />
            <Route path="/feature-store" element={<FeatureStore />} />
            <Route path="/branching" element={<Branching />} />
            <Route path="/crud" element={<CrudQuery />} />
            <Route path="/recovery" element={<div className="p-6 text-[var(--color-text-primary)]">Recovery — Plan B</div>} />
            <Route path="/ai-memory" element={<div className="p-6 text-[var(--color-text-primary)]">AI Memory — Plan B</div>} />
            <Route path="/autoscaling" element={<div className="p-6 text-[var(--color-text-primary)]">Autoscaling — Plan B</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
