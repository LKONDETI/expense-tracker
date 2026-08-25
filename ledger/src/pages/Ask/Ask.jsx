import { useState, useRef, useEffect } from 'react'
import { SendHorizontal, Bot } from 'lucide-react'
import { SAMPLE_CHAT, SUGGESTED_QUESTIONS } from '../../data/mockData'

// Simulated AI responses based on keyword matching (replace with real API in Phase 1)
const simulateResponse = (question) => {
  const q = question.toLowerCase()
  if (q.includes('dining'))
    return 'Your dining spend this month is $412.00 — up 22% from your 3-month average of $337. Most of it (about $280) happened on weekdays between 11am–2pm.'
  if (q.includes('budget'))
    return "You've spent $3,214.62 of your $4,000 monthly budget. That leaves $785.38 — you're on track, but projected to reach $4,120 by month end at current pace."
  if (q.includes('subscri'))
    return 'You have 7 active subscriptions totaling $142.45/month. Your gym membership ($39/mo) appears unused — no associated activity detected in 45 days.'
  if (q.includes('biggest') || q.includes('largest'))
    return 'Your biggest expenses this month: Housing/Rent $1,450 · Dining $412 · Shopping $305 · Groceries $380.'
  if (q.includes('cancel'))
    return 'Based on your usage patterns, I\'d suggest reviewing: Gym Membership ($39/mo, unused 45+ days) and Adobe Creative Cloud ($54.99/mo, marked "Up"). Together that\'s $93.99/mo saved.'
  return "I can answer questions about your spending using your transaction data. Try asking about a specific category, your budget status, or subscriptions."
}

export default function Ask() {
  const [messages, setMessages] = useState(SAMPLE_CHAT)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (text) => {
    const q = text.trim()
    if (!q) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: q, time: now },
    ])
    setInput('')
    setLoading(true)

    // Simulate network delay → replace with fetch('/api/ask', ...) in Phase 1
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: simulateResponse(q),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setLoading(false)
    }, 900)
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

      {/* Suggested Questions */}
      <div className="suggested-questions" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            className="suggested-q"
            onClick={() => sendMessage(q)}
            id={`suggested-q-${q.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
          >
            {q}
          </button>
        ))}
      </div>

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

          {loading && (
            <div className="message assistant" id="message-loading">
              <div className="message-bubble" style={{ color: 'var(--color-text-muted)' }}>
                Thinking…
              </div>
            </div>
          )}

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
    </div>
  )
}
