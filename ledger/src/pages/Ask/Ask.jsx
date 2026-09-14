import { useState, useRef, useEffect } from 'react'
import { SendHorizontal, AlertCircle } from 'lucide-react'
import { api } from '../../utils/api'

const SUGGESTED_QUESTIONS = [
  'How much did I spend on dining this month?',
  'What is my budget status?',
  'Which subscriptions look unused?',
  'What were my biggest expenses?',
  'Should I cancel any subscriptions?',
]

// ── Thinking bubble ───────────────────────────────────────────
function ThinkingBubble() {
  return (
    <div className="message assistant" id="message-thinking">
      <div className="message-bubble" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--color-text-muted)',
                display: 'inline-block',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
        Thinking…
      </div>
    </div>
  )
}

export default function Ask() {
  const [messages, setMessages] = useState([])   // start clean — no mock chat
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const q = text.trim()
    if (!q || loading) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: q, time: now },
    ])
    setInput('')
    setLoading(true)
    setApiError('')

    try {
      const data = await api.post('/api/ask', { question: q })
      const answer = data?.answer ?? data?.Answer ?? 'No response received.'

      setMessages((prev) => [
        ...prev,
        {
          id:   Date.now() + 1,
          role: 'assistant',
          text: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      setApiError(err.message || 'Failed to get a response. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Ask</h2>
          <p className="page-subtitle">Ask questions about your spending in plain English.</p>
        </div>
      </div>

      {/* Suggested Questions — shown until first message sent */}
      {messages.length === 0 && (
        <div className="suggested-questions" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              className="suggested-q"
              onClick={() => sendMessage(q)}
              disabled={loading}
              id={`suggested-q-${q.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
            >
              {q}
            </button>
          ))}
        </div>
      )}



      {/* API Error Banner */}
      {apiError && (
        <div
          className="upload-error-banner"
          style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <AlertCircle size={15} />
          {apiError}
          <button className="upload-error-dismiss" onClick={() => setApiError('')}>Dismiss</button>
        </div>
      )}

      {/* Chat Area */}
      <div className="ask-container">
        <div
          className="chat-messages"
          id="chat-messages"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.role}`}
              id={`message-${msg.id}`}
            >
              <div className="message-bubble">{msg.text}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))}

          {loading && <ThinkingBubble />}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar">
          <input
            id="chat-input"
            type="text"
            className="chat-input"
            placeholder="Ask about your spending…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Chat input"
            disabled={loading}
          />
          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Bounce animation keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
