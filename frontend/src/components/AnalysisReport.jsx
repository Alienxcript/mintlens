import { useState } from 'react'
import { CheckCircle, AlertCircle, FileText, User, Users, DollarSign, ShieldAlert } from 'lucide-react'

/**
 * Renders the Claude JSON report.
 * Props: report { score, verdict, sections, redFlags, greenFlags, scoreBreakdown }
 */
export default function AnalysisReport({ report }) {
  if (!report) return null

  const { score, verdict, sections = {}, redFlags = [], greenFlags = [], scoreBreakdown = {} } = report

  return (
    <div className="space-y-4">
      {/* Score Card */}
      <div className="card p-6">
        <div className="flex gap-6">
          {/* Left: large score + label */}
          <div className="flex flex-col items-center justify-center w-28 shrink-0 border-r border-border pr-6">
            <span
              className="font-mono text-5xl font-bold leading-none"
              style={{ color: scoreColor(score) }}
            >
              {score ?? '—'}
            </span>
            <span className="text-[9px] text-text-muted tracking-widest mt-2 uppercase text-center">
              MINTLENS SCORE
            </span>
          </div>

          {/* Right: verdict + bars */}
          <div className="flex-1 min-w-0">
            {verdict && (
              <p className="italic text-text-muted text-sm mb-4 leading-relaxed">
                "{verdict}"
              </p>
            )}
            <ScoreBreakdown breakdown={scoreBreakdown} />
          </div>
        </div>
      </div>

      {/* Flags */}
      {(redFlags.length > 0 || greenFlags.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {greenFlags.length > 0 && (
            <FlagList title="Green Flags" flags={greenFlags} color="#84CC16" Icon={CheckCircle} />
          )}
          {redFlags.length > 0 && (
            <FlagList title="Red Flags" flags={redFlags} color="#FF4757" Icon={AlertCircle} />
          )}
        </div>
      )}

      {/* Analysis Sections */}
      <div className="space-y-2">
        {Object.entries(sections).map(([key, content]) => (
          <CollapsibleSection key={key} title={sectionLabel(key)} icon={sectionIcon(key)} content={content} />
        ))}
      </div>
    </div>
  )
}

function scoreColor(score) {
  if (score == null) return '#6B6B8A'
  return score >= 70 ? '#84CC16' : score >= 40 ? '#FFB800' : '#FF4757'
}

function ScoreBreakdown({ breakdown }) {
  const categories = [
    { key: 'feeTraction', label: 'Fee Traction', max: 25 },
    { key: 'holderHealth', label: 'Holder Health', max: 20 },
    { key: 'creatorCredibility', label: 'Creator Cred', max: 20 },
    { key: 'volumeLiquidity', label: 'Volume / Liq', max: 20 },
    { key: 'riskSignals', label: 'Risk Signals', max: 15 },
  ]

  return (
    <div className="space-y-2.5">
      {categories.map(({ key, label, max }) => {
        const val = breakdown[key] ?? 0
        const pct = (val / max) * 100
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-text-muted w-24 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: '#84CC16' }}
              />
            </div>
            <span className="text-xs font-mono text-text-muted w-10 text-right shrink-0">
              {val}/{max}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FlagList({ title, flags, color, Icon }) {
  return (
    <div className="rounded-xl p-4" style={{ background: `${color}12`, border: `1px solid ${color}35` }}>
      <h4 className="text-xs font-semibold mb-2.5 uppercase tracking-wider flex items-center gap-1.5" style={{ color }}>
        <Icon size={13} />
        {title}
      </h4>
      <ul className="space-y-1.5">
        {flags.map((flag, i) => (
          <li key={i} className="text-sm flex items-start gap-2 text-text-primary">
            <span className="shrink-0 mt-0.5 text-xs" style={{ color }}>◆</span>
            {flag}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CollapsibleSection({ title, icon, content }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-text-primary text-sm flex items-center gap-2 text-text-muted">
          {icon}
          <span className="text-text-primary">{title}</span>
        </span>
        <span className="text-text-muted text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-text-muted leading-relaxed border-t border-border pt-3">
          {content}
        </div>
      )}
    </div>
  )
}

const SECTION_META = {
  summary:            { label: 'Summary',              Icon: FileText },
  creatorCredibility: { label: 'Creator Credibility',  Icon: User },
  holderHealth:       { label: 'Holder Health',         Icon: Users },
  revenueTraction:    { label: 'Revenue & Fee Traction',Icon: DollarSign },
  riskSignals:        { label: 'Risk Signals',          Icon: ShieldAlert },
}

function sectionLabel(key) {
  return SECTION_META[key]?.label || key
}

function sectionIcon(key) {
  const Icon = SECTION_META[key]?.Icon
  return Icon ? <Icon size={14} className="shrink-0" /> : null
}
