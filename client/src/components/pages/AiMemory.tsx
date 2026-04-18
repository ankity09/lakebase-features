import { useState, useEffect, useRef, useCallback } from 'react'
import { SplitLayout } from '@/components/shell/SplitLayout'
import { StoryHeader } from '@/components/shared/StoryHeader'
import { ArchitectureDiagram } from '@/components/shared/ArchitectureDiagram'
import { InsightCard } from '@/components/shared/InsightCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import api from '@/lib/api'

interface ChatMessage {
  role: string
  content: string
  recalledCount?: number
}

interface Memory {
  content: string
  memory_type: string
  similarity?: number
}

const architectureNodes = [
  { id: 'user', icon: '\uD83D\uDC64', label: 'User' },
  { id: 'agent', icon: '\uD83E\uDD16', label: 'Agent' },
  { id: 'lakebase', icon: '\u26A1', label: 'Lakebase', highlighted: true },
  { id: 'pgvector', icon: '\uD83D\uDD0D', label: 'pgvector', sublabel: 'Semantic Recall' },
]

const memoryTypes = [
  { icon: '\uD83D\uDD27', type: 'failure_mode', description: 'How equipment fails' },
  { icon: '\uD83D\uDD29', type: 'part_preference', description: 'Preferred parts & vendors' },
  { icon: '\uD83D\uDCCB', type: 'procedure', description: 'Repair steps' },
  { icon: '\u2699\uFE0F', type: 'machine_quirk', description: 'Equipment-specific behaviors' },
  { icon: '\uD83D\uDCE6', type: 'vendor_info', description: 'Supplier details' },
]

const SQL_SNIPPET = `SELECT content, memory_type,
       1 - (embedding <=> query_vec) AS similarity
FROM appshield.agent_memories
ORDER BY embedding <=> query_vec
LIMIT 5`

export function AiMemory() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recalledMemories, setRecalledMemories] = useState<Memory[]>([])
  const [allMemories, setAllMemories] = useState<Memory[]>([])
  const [showSql, setShowSql] = useState(false)
  const [memoryTab, setMemoryTab] = useState<'recalled' | 'all'>('recalled')
  const [activeNode, setActiveNode] = useState<string | undefined>()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Fetch all memories when "All" tab is selected
  useEffect(() => {
    if (memoryTab !== 'all') return
    let cancelled = false
    api
      .get('/memory/memories')
      .then((res) => {
        const data = res.data
        const list = Array.isArray(data) ? data : (data.memories ?? [])
        if (!cancelled) setAllMemories(list)
      })
      .catch(() => {
        if (!cancelled) setAllMemories([])
      })
    return () => {
      cancelled = true
    }
  }, [memoryTab])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/memory/chat', {
        message: trimmed,
        history: history.map(({ role, content }) => ({ role, content })),
      })

      const recalled: Memory[] = res.data.recalled_memories ?? []
      setRecalledMemories(recalled)

      if (recalled.length > 0) {
        setActiveNode('lakebase')
        setTimeout(() => setActiveNode(undefined), 2000)
      }

      const botMsg: ChatMessage = {
        role: 'assistant',
        content: res.data.response,
        recalledCount: recalled.length,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      const fallback: ChatMessage = {
        role: 'assistant',
        content:
          'MaintBot: LLM backend not configured. Try asking about HP-L4-001 or CONV-B1-008.',
        recalledCount: 0,
      }
      setMessages((prev) => [...prev, fallback])
      setRecalledMemories([])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleExport = useCallback(async () => {
    try {
      const res = await api.get('/memory/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'memories_export.json'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // silent fail — endpoint may not be available
    }
  }, [])

  const handleDeleteAll = useCallback(async () => {
    try {
      await api.delete('/memory/memories')
      setAllMemories([])
      setRecalledMemories([])
    } catch {
      // silent fail
    } finally {
      setShowDeleteConfirm(false)
    }
  }, [])

  const left = (
    <div className="flex flex-col gap-6">
      <StoryHeader
        label="AI MEMORY"
        title="Your Agent Remembers Everything"
        subtitle="Persistent conversational memory powered by Lakebase + pgvector"
      />

      <ArchitectureDiagram
        nodes={architectureNodes}
        activeNode={activeNode}
        layout="horizontal"
      />

      {/* Memory type cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {memoryTypes.map((m) => (
          <div
            key={m.type}
            className="rounded-lg bg-[var(--color-bg-tertiary)] p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{m.icon}</span>
              <span className="font-[var(--font-mono)] text-xs font-semibold text-[var(--color-text-primary)]">
                {m.type}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">
              {m.description}
            </p>
          </div>
        ))}
      </div>

      <InsightCard>
        It's just a Postgres table with pgvector. Your agent's memory is a SQL
        query — no separate vector database needed.
      </InsightCard>

      {/* Show SQL toggle */}
      <div>
        <button
          onClick={() => setShowSql((v) => !v)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        {showSql && (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--color-bg-hover)] p-4 font-[var(--font-mono)] text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {SQL_SNIPPET}
          </pre>
        )}
      </div>
    </div>
  )

  const right = (
    <div className="flex h-full gap-0">
      {/* Chat area */}
      <div className="flex flex-[2] flex-col border-r border-[var(--color-border)]">
        {/* Chat header */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <span className="text-lg leading-none">{'\uD83E\uDD16'}</span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            MaintBot
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Ask MaintBot about equipment maintenance. Try &quot;What usually
              goes wrong with HP-L4-001?&quot;
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }
            >
              <div className="max-w-[85%]">
                <div
                  className={
                    msg.role === 'user'
                      ? 'rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm text-[var(--color-bg-primary)]'
                      : 'rounded-xl bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)]'
                  }
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' &&
                  msg.recalledCount != null &&
                  msg.recalledCount > 0 && (
                    <span className="mt-1 inline-block text-[10px] text-[var(--color-text-muted)]">
                      Recalled {msg.recalledCount} memories
                    </span>
                  )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-xl bg-[var(--color-bg-tertiary)] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 border-t border-[var(--color-border)] p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about equipment..."
            className="flex-1 rounded-lg bg-[var(--color-bg-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Memory sidebar */}
      <div className="flex flex-1 flex-col">
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Memories
          </span>
          <span className="rounded-full bg-[var(--color-bg-hover)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
            {memoryTab === 'recalled'
              ? recalledMemories.length
              : allMemories.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['recalled', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMemoryTab(tab)}
              className={
                memoryTab === tab
                  ? 'flex-1 border-b-2 border-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-[var(--color-accent)]'
                  : 'flex-1 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]'
              }
            >
              {tab === 'recalled' ? 'Recalled' : 'All'}
            </button>
          ))}
        </div>

        {/* Memory cards */}
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {(memoryTab === 'recalled' ? recalledMemories : allMemories).length ===
          0 ? (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
              {memoryTab === 'recalled'
                ? 'Send a message to recall memories'
                : 'No memories stored yet'}
            </p>
          ) : (
            (memoryTab === 'recalled' ? recalledMemories : allMemories).map(
              (mem, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-2.5"
                >
                  <p className="line-clamp-2 text-xs leading-snug text-[var(--color-text-secondary)]">
                    {mem.content}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge status={mem.memory_type} />
                    {memoryTab === 'recalled' && mem.similarity != null && (
                      <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                        {Math.round(mem.similarity * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* GDPR buttons */}
        <div className="flex gap-2 border-t border-[var(--color-border)] p-3">
          <button
            onClick={handleExport}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Export
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
          >
            Delete All
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete All Memories"
        message="This will permanently delete all stored agent memories. This action cannot be undone."
        variant="danger"
      />
    </div>
  )

  return <SplitLayout left={left} right={right} />
}
