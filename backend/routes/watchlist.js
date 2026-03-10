import { Router } from 'express'
const router = Router()

// In-memory store — replace with DB in production
const watchlist = []

router.get('/', (req, res) => {
  res.json({ watchlist })
})

router.post('/', (req, res) => {
  const item = req.body
  watchlist.push({ ...item, addedAt: new Date().toISOString() })
  res.json({ success: true, watchlist })
})

export default router
