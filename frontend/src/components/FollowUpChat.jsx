import { useState, useRef, useEffect } from 'react'
import { analysisApi } from '../lib/api.js'

const SUGGESTED_QUESTIONS = [
  'Who are the creators and what is their track record?',
  'What are the biggest risks with this token?',
  'How does the holder distribution look?',
  'Is the fee revenue sustainable?',
  'Compare this to a typical healthy Bags token.',
]

/**
 * Props: mint (string), tokenContext (object — brief token summary for Claude)
 */
export default function FollowUpChat({ mint, tokenContext }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')

    const updated = [...messages, { role: 'user', content: userMsg }]
    setMessages(updated)
    setLoading(true)

    try {
      const { reply } = await analysisApi.chat(mint, updated, tokenContext)
      setMessages([...updated, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages([
        ...updated,
        { role: 'assistant', content: `Error: ${err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#84CC16' }}
        >
          <span style={{ fontSize: 14, color: '#0A0A0F' }}>✦</span>
        </div>
        <div>
          <h3 className="font-semibold text-text-primary text-sm">Ask Claude a Follow-Up</h3>
          <p className="text-xs text-text-muted">Dig deeper into any part of the analysis</p>
        </div>
      </div>

      {/* Suggested questions (shown before any messages) */}
      {messages.length === 0 && (
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
          <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">Suggested</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs bg-bg border border-border hover:border-primary text-text-muted hover:text-text-primary px-3 py-1.5 rounded-full transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 max-h-[60vh] sm:max-h-[480px] overflow-y-auto">
          {messages.map((msg, i) => (
            msg.role === 'user'
              ? <UserMessage key={i} content={msg.content} />
              : <AssistantMessage key={i} content={msg.content} />
          ))}
          {loading && (
            <div className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: '#84CC16' }}
              >
                <span style={{ fontSize: 12, color: '#0A0A0F' }}>✦</span>
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-muted border border-border"
                style={{ background: '#1E1E2E' }}
              >
                <ThinkingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar — sticky at bottom */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-border bg-bg/50 sticky bottom-0">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 min-w-0 bg-surface border border-border rounded-xl px-3 sm:px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            placeholder="Ask anything about this token…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: '#84CC16' }}
            title="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
        style={{ backgroundColor: '#84CC16', color: '#0A0A0F' }}
      >
        {content}
      </div>
    </div>
  )
}

function AssistantMessage({ content }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: '#84CC16' }}
      >
        <span style={{ fontSize: 12, color: '#0A0A0F' }}>✦</span>
      </div>
      <div
        className="flex-1 max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 border border-border"
        style={{ background: '#1E1E2E' }}
      >
        <FormattedResponse text={content} />
      </div>
    </div>
  )
}

/**
 * Renders Claude's response with:
 * - **text** → <strong>
 * - Lines starting with •, -, * → <li> elements
 * - Blank lines → paragraph breaks
 * - First sentence of first paragraph → bold lead-in
 */
function FormattedResponse({ text }) {
  if (!text) return null

  const paragraphs = text.split(/\n{2,}/).filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n').filter(Boolean)

        // Check if this paragraph is a bullet list
        const isList = lines.every((l) => /^[-•*]\s/.test(l.trimStart()))
        if (isList) {
          return (
            <ul key={pi} className="space-y-1.5 pl-1">
              {lines.map((line, li) => (
                <li key={li} className="flex items-start gap-2 text-sm text-text-muted leading-relaxed">
                  <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#84CC16' }}>◆</span>
                  <span>{applyBold(line.replace(/^[-•*]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Mixed bullets and plain text
        const hasBullets = lines.some((l) => /^[-•*]\s/.test(l.trimStart()))
        if (hasBullets) {
          return (
            <div key={pi} className="space-y-2">
              {lines.map((line, li) => {
                if (/^[-•*]\s/.test(line.trimStart())) {
                  return (
                    <div key={li} className="flex items-start gap-2 text-sm text-text-muted leading-relaxed">
                      <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#84CC16' }}>◆</span>
                      <span>{applyBold(line.replace(/^[-•*]\s+/, ''))}</span>
                    </div>
                  )
                }
                return (
                  <p key={li} className="text-sm text-text-muted leading-relaxed">
                    {applyBold(line)}
                  </p>
                )
              })}
            </div>
          )
        }

        // Plain paragraph — bold the first sentence of the first paragraph
        const fullText = lines.join(' ')
        if (pi === 0) {
          const firstDot = fullText.search(/[.!?]\s/)
          if (firstDot > 0 && firstDot < 200) {
            const lead = fullText.slice(0, firstDot + 1)
            const rest = fullText.slice(firstDot + 1).trimStart()
            return (
              <p key={pi} className="text-sm leading-relaxed">
                <strong className="text-text-primary font-semibold">{applyBold(lead)}</strong>
                {rest && <span className="text-text-muted"> {applyBold(rest)}</span>}
              </p>
            )
          }
        }

        return (
          <p key={pi} className="text-sm text-text-muted leading-relaxed">
            {applyBold(fullText)}
          </p>
        )
      })}
    </div>
  )
}

/** Converts **text** → <strong>text</strong> within a string */
function applyBold(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-text-primary">{part}</strong>
      : part
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      Thinking
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ animation: `blink 1.2s infinite ${i * 0.4}s`, display: 'inline-block' }}
        >
          .
        </span>
      ))}
      <style>{`@keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }`}</style>
    </span>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
