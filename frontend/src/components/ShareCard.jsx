import { useRef, useEffect } from 'react'

const W = 1200
const H = 675

/**
 * Renders a 1200×675 canvas share card and provides PNG download.
 * Props: token { name, symbol, mint }, score, verdict, stats { fees, holders, volume }, topSignal { text, type: 'red'|'green' }
 */
export default function ShareCard({ token = {}, score, verdict, stats = {}, topSignal }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    drawCard(canvasRef.current, { token, score, verdict, stats, topSignal })
  }, [token, score, verdict, stats, topSignal])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `mintlens-${(token.symbol || token.mint || 'token').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-4">
      <div className="overflow-auto">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ width: '100%', maxWidth: W, borderRadius: 12, display: 'block' }}
        />
      </div>
      <button onClick={download} className="btn-primary w-full">
        Download PNG
      </button>
    </div>
  )
}

function drawCard(canvas, { token, score, verdict, stats, topSignal }) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0A0A0F'
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = '#1E1E2E'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Lime accent top bar
  ctx.fillStyle = '#84CC16'
  ctx.fillRect(0, 0, W, 5)

  // Token name + symbol top-left
  ctx.fillStyle = '#F0F0FF'
  ctx.font = 'bold 36px Inter, sans-serif'
  ctx.fillText(token.name || 'Unknown Token', 48, 80)

  ctx.fillStyle = '#6B6B8A'
  ctx.font = '20px "DM Mono", monospace'
  ctx.fillText(token.symbol || '', 48, 110)

  // Score — center
  const scoreColor = score >= 70 ? '#00D4AA' : score >= 40 ? '#FFB800' : '#FF4757'
  ctx.fillStyle = scoreColor
  ctx.font = 'bold 160px "DM Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(score != null ? String(score) : '—', W / 2, 300)

  ctx.fillStyle = '#6B6B8A'
  ctx.font = '16px "DM Mono", monospace'
  ctx.fillText('MINTLENS SCORE', W / 2, 330)

  // Verdict — italic below score
  if (verdict) {
    ctx.fillStyle = '#F0F0FF'
    ctx.font = 'italic 22px Inter, sans-serif'
    ctx.fillText(`"${verdict}"`, W / 2, 380, W - 200)
  }

  // Stats bottom row
  ctx.textAlign = 'left'
  const statLabels = ['Lifetime Fees', 'Holders', '24h Volume']
  const statValues = [
    stats.fees != null ? `${Number(stats.fees).toFixed(2)} SOL` : '—',
    stats.holders != null ? stats.holders.toLocaleString() : '—',
    stats.volume != null ? `$${Number(stats.volume).toLocaleString()}` : '—',
  ]
  const statW = 320
  statLabels.forEach((label, i) => {
    const x = 60 + i * statW
    const y = 530
    ctx.fillStyle = '#1E1E2E'
    roundRect(ctx, x, y, 280, 90, 12)
    ctx.fillStyle = '#6B6B8A'
    ctx.font = '13px Inter, sans-serif'
    ctx.fillText(label, x + 16, y + 28)
    ctx.fillStyle = '#F0F0FF'
    ctx.font = 'bold 22px "DM Mono", monospace'
    ctx.fillText(statValues[i], x + 16, y + 60)
  })

  // Top signal box right side
  if (topSignal) {
    const sigColor = topSignal.type === 'red' ? '#FF4757' : '#00D4AA'
    ctx.fillStyle = `${sigColor}20`
    roundRect(ctx, W - 340, 100, 300, 100, 12)
    ctx.strokeStyle = sigColor
    ctx.lineWidth = 1
    ctx.strokeRect(W - 340 + 0.5, 100.5, 299, 99)
    ctx.fillStyle = sigColor
    ctx.font = '12px "DM Mono", monospace'
    ctx.fillText(topSignal.type === 'red' ? '⚠ TOP RISK' : '✓ TOP SIGNAL', W - 320, 128)
    ctx.fillStyle = '#F0F0FF'
    ctx.font = '14px Inter, sans-serif'
    wrapText(ctx, topSignal.text, W - 320, 155, 260, 20)
  }

  // mintlens.xyz bottom-right
  ctx.fillStyle = '#6B6B8A'
  ctx.font = '14px "DM Mono", monospace'
  ctx.textAlign = 'right'
  ctx.fillText('mintlens.xyz', W - 48, H - 24)

  ctx.textAlign = 'left'
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word + ' '
      y += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, y)
}
