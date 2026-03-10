import { useEffect, useState } from 'react'

/**
 * Circular score badge 0-100, color coded, animates in on mount.
 * Props: score (number), size ('sm'|'md'|'lg'), showLabel (bool)
 */
export default function ScoreBadge({ score, size = 'md', showLabel = false }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (score == null) return
    const duration = 800
    const steps = 40
    const increment = score / steps
    let current = 0
    const timer = setInterval(() => {
      current = Math.min(current + increment, score)
      setDisplayed(Math.round(current))
      if (current >= score) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [score])

  const color =
    score >= 70 ? '#84CC16' : score >= 40 ? '#FFB800' : '#FF4757'

  const sizes = {
    sm: { outer: 48, stroke: 5,  font: 'text-xs' },
    md: { outer: 72, stroke: 7,  font: 'text-base' },
    lg: { outer: 120, stroke: 10, font: 'text-2xl' },
  }

  const { outer, stroke, font } = sizes[size] || sizes.md
  const radius = (outer - stroke * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = score != null ? (displayed / 100) * circumference : 0

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: outer, height: outer, position: 'relative' }}>
        <svg width={outer} height={outer} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            fill="none"
            stroke="#2A2A3E"
            strokeWidth={stroke}
          />
          {/* Progress ring */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.05s ease' }}
          />
        </svg>
        {/* Score number */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontFamily: '"DM Mono", monospace',
            fontWeight: 500,
          }}
          className={font}
        >
          {score != null ? displayed : '—'}
        </div>
      </div>
      {showLabel && (
        <span style={{ color: '#6B6B8A', fontSize: 10, letterSpacing: '0.1em' }}>
          MINTLENS SCORE
        </span>
      )}
    </div>
  )
}
