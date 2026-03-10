/**
 * shareCardService.js — node-canvas share card generator
 * Produces a 1200×675 PNG for a given token + report.
 */
import { createCanvas, loadImage } from 'canvas'

const W = 1200
const H = 675

const COLORS = {
  bg: '#0A0A0F',
  surface: '#12121A',
  border: '#1E1E2E',
  primary: '#6C63FF',
  green: '#00D4AA',
  yellow: '#FFB800',
  red: '#FF4757',
  textPrimary: '#F0F0FF',
  textMuted: '#6B6B8A',
}

function scoreColor(score) {
  if (score >= 70) return COLORS.green
  if (score >= 40) return COLORS.yellow
  return COLORS.red
}

/**
 * Generate a share card PNG buffer.
 * @param {{ mint, metadata, holders, lifetimeFees, report }} data
 * @returns {Buffer} PNG buffer
 */
export async function generateShareCard({ mint, metadata = {}, holders = {}, lifetimeFees, report }) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Subtle grid texture
  ctx.strokeStyle = '#1A1A26'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Purple accent bar at top
  ctx.fillStyle = COLORS.primary
  ctx.fillRect(0, 0, W, 5)

  // ── Token logo (top-left) ────────────────────────────────────────────────────
  const LOGO_SIZE = 60
  const LOGO_X = 48
  const LOGO_Y = 36

  if (metadata.logoURI) {
    try {
      const img = await loadImage(metadata.logoURI)
      ctx.save()
      ctx.beginPath()
      ctx.arc(LOGO_X + LOGO_SIZE / 2, LOGO_Y + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE)
      ctx.restore()
    } catch {
      drawAvatarFallback(ctx, metadata.name, LOGO_X, LOGO_Y, LOGO_SIZE)
    }
  } else {
    drawAvatarFallback(ctx, metadata.name, LOGO_X, LOGO_Y, LOGO_SIZE)
  }

  // Token name
  ctx.fillStyle = COLORS.textPrimary
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(metadata.name || 'Unknown Token', LOGO_X + LOGO_SIZE + 16, LOGO_Y + 28)

  // Symbol
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '18px monospace'
  ctx.fillText(metadata.symbol || '', LOGO_X + LOGO_SIZE + 16, LOGO_Y + 52)

  // ── Score (center) ───────────────────────────────────────────────────────────
  const score = report?.score ?? null
  const color = score != null ? scoreColor(score) : COLORS.textMuted

  ctx.fillStyle = color
  ctx.font = 'bold 140px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(score != null ? String(score) : '—', W / 2, 290)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '14px monospace'
  ctx.fillText('MINTLENS SCORE', W / 2, 316)

  // Score breakdown bar
  if (report?.scoreBreakdown) {
    drawScoreBar(ctx, report.scoreBreakdown, W / 2 - 200, 334, 400)
  }

  // Verdict
  const verdict = report?.verdict
  if (verdict) {
    ctx.fillStyle = COLORS.textPrimary
    ctx.font = 'italic 20px sans-serif'
    ctx.textAlign = 'center'
    wrapText(ctx, `"${verdict}"`, W / 2, 390, W - 280, 28)
  }

  // ── Top signal (right side) ──────────────────────────────────────────────────
  const topRedFlag = report?.redFlags?.[0]
  const topGreenFlag = report?.greenFlags?.[0]
  const topSignal = topRedFlag || topGreenFlag
  const signalType = topRedFlag ? 'red' : 'green'

  if (topSignal) {
    const sigColor = signalType === 'red' ? COLORS.red : COLORS.green
    const BOX_X = W - 360
    const BOX_Y = 56
    const BOX_W = 300
    const BOX_H = 110

    ctx.fillStyle = sigColor + '18'
    roundRect(ctx, BOX_X, BOX_Y, BOX_W, BOX_H, 12)
    ctx.strokeStyle = sigColor + '50'
    ctx.lineWidth = 1
    ctx.strokeRect(BOX_X + 0.5, BOX_Y + 0.5, BOX_W - 1, BOX_H - 1)

    ctx.fillStyle = sigColor
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(signalType === 'red' ? '⚠ TOP RISK' : '✓ TOP SIGNAL', BOX_X + 16, BOX_Y + 28)

    ctx.fillStyle = COLORS.textPrimary
    ctx.font = '14px sans-serif'
    wrapText(ctx, topSignal, BOX_X + 16, BOX_Y + 55, BOX_W - 32, 20)
  }

  // ── Stats bottom row ─────────────────────────────────────────────────────────
  const fees = lifetimeFees?.totalFees ?? lifetimeFees?.total
  const statData = [
    { label: 'Lifetime Fees', value: fees != null ? `${Number(fees).toFixed(2)} SOL` : '—' },
    { label: 'Holders', value: holders.totalHolders != null ? holders.totalHolders.toLocaleString() : '—' },
    { label: 'Top-10 Conc.', value: holders.top10Concentration != null ? `${holders.top10Concentration}%` : '—' },
  ]

  const STAT_Y = 480
  const STAT_W = 280
  const STAT_H = 100
  const STAT_GAP = 20
  const TOTAL_W = statData.length * STAT_W + (statData.length - 1) * STAT_GAP
  const STAT_START_X = (W - TOTAL_W) / 2

  statData.forEach(({ label, value }, i) => {
    const x = STAT_START_X + i * (STAT_W + STAT_GAP)
    ctx.fillStyle = COLORS.surface
    roundRect(ctx, x, STAT_Y, STAT_W, STAT_H, 12)

    ctx.fillStyle = COLORS.textMuted
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label, x + STAT_W / 2, STAT_Y + 32)

    ctx.fillStyle = COLORS.textPrimary
    ctx.font = 'bold 24px monospace'
    ctx.fillText(value, x + STAT_W / 2, STAT_Y + 68)
  })

  // ── Branding bottom-right ────────────────────────────────────────────────────
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '14px monospace'
  ctx.textAlign = 'right'
  ctx.fillText('mintlens.xyz', W - 48, H - 24)

  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawAvatarFallback(ctx, name, x, y, size) {
  const avatarColors = [COLORS.primary, COLORS.green, COLORS.yellow, COLORS.red]
  const idx = (name?.charCodeAt(0) || 0) % avatarColors.length
  ctx.fillStyle = avatarColors[idx]
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0A0A0F'
  ctx.font = `bold ${size * 0.45}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText((name || '?')[0].toUpperCase(), x + size / 2, y + size / 2 + size * 0.16)
  ctx.textAlign = 'left'
}

function drawScoreBar(ctx, breakdown, x, y, width) {
  const cats = [
    { key: 'feeTraction', max: 25 },
    { key: 'holderHealth', max: 20 },
    { key: 'creatorCredibility', max: 20 },
    { key: 'volumeLiquidity', max: 20 },
    { key: 'riskSignals', max: 15 },
  ]
  const segW = width / cats.length
  cats.forEach(({ key, max }, i) => {
    const val = breakdown[key] ?? 0
    const pct = val / max
    const color = pct >= 0.7 ? COLORS.green : pct >= 0.4 ? COLORS.yellow : COLORS.red
    const bx = x + i * segW
    ctx.fillStyle = '#1E1E2E'
    ctx.fillRect(bx + 2, y, segW - 4, 6)
    ctx.fillStyle = color
    ctx.fillRect(bx + 2, y, (segW - 4) * pct, 6)
  })
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
  let cy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, cy)
      line = word + ' '
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, cy)
}

export default { generateShareCard }
