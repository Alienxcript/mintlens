/**
 * alerts.js — Launch alert subscriptions
 * POST /api/alerts/subscribe
 */
import { Router } from 'express'
import alertService from '../services/alertService.js'

const router = Router()

router.post('/subscribe', async (req, res, next) => {
  try {
    const { type, threshold, pushSubscription, email } = req.body

    if (!type || !['push', 'email'].includes(type)) {
      return res.status(400).json({ error: 'type must be "push" or "email"' })
    }

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return res.status(400).json({ error: 'threshold must be a number 0-100' })
    }

    if (type === 'push' && !pushSubscription) {
      return res.status(400).json({ error: 'pushSubscription required for push type' })
    }

    if (type === 'email' && !email) {
      return res.status(400).json({ error: 'email required for email type' })
    }

    const id = alertService.addSubscription({ type, threshold, pushSubscription, email })
    res.json({ success: true, subscriptionId: id })
  } catch (err) {
    next(err)
  }
})

router.delete('/subscribe/:id', (req, res) => {
  alertService.removeSubscription(req.params.id)
  res.json({ success: true })
})

export default router
