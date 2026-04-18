import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IconRail } from '@/components/shell/IconRail'
import { FeatureStore } from '@/components/pages/FeatureStore'
import { Branching } from '@/components/pages/Branching'
import { CrudQuery } from '@/components/pages/CrudQuery'
import { Recovery } from '@/components/pages/Recovery'
import { Autoscaling } from '@/components/pages/Autoscaling'
import { AiMemory } from '@/components/pages/AiMemory'

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
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/ai-memory" element={<AiMemory />} />
            <Route path="/autoscaling" element={<Autoscaling />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
