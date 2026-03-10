import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import tokensRouter from './routes/tokens.js'
import analysisRouter from './routes/analysis.js'
import creatorsRouter from './routes/creators.js'
import watchlistRouter from './routes/watchlist.js'
import alertsRouter from './routes/alerts.js'
import skillRouter from './routes/skill.js'
import leaderboardRouter from './routes/leaderboard.js'

const app = express()
const PORT = process.env.PORT || 3001

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, MCP server, same-origin)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Claude analysis — expensive; limit tightly
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait a minute before trying again.' },
})

// Live feed — polled every 30s by the UI; allow a reasonable burst
const feedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many feed requests. Please slow down.' },
})

// General — all other API routes
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

// ── Health checks (no rate limit) ────────────────────────────────────────────
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/health', async (req, res) => {
  const checks = {
    bags: !!process.env.BAGS_API_KEY,
    helius: !!process.env.HELIUS_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  }
  res.json({
    status: 'ok',
    services: checks,
    allConfigured: Object.values(checks).every(Boolean),
    timestamp: new Date().toISOString(),
  })
})

// ── Routes with rate limiters ─────────────────────────────────────────────────
app.use('/api/analysis', analysisLimiter, analysisRouter)
app.use('/api/tokens/feed', feedLimiter)
app.use('/api/tokens', generalLimiter, tokensRouter)
app.use('/api/creators', generalLimiter, creatorsRouter)
app.use('/api/watchlist', generalLimiter, watchlistRouter)
app.use('/api/alerts', generalLimiter, alertsRouter)
app.use('/api/skill', generalLimiter, skillRouter)
app.use('/api/leaderboard', generalLimiter, leaderboardRouter)

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Suppress CORS errors from being logged as server errors
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message })
  }
  console.error('[ERROR]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`✅ MINTLENS backend running on http://localhost:${PORT}`)
  console.log(`   Bags API key: ${process.env.BAGS_API_KEY ? '✓' : '✗ missing'}`)
  console.log(`   Helius key:   ${process.env.HELIUS_API_KEY ? '✓' : '✗ missing'}`)
  console.log(`   Anthropic key:${process.env.ANTHROPIC_API_KEY ? '✓' : '✗ missing'}`)
  console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
