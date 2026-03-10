/**
 * alertService.js — In-memory alert subscription management + notification dispatch
 * Milestone 7: Web Push + Email support
 */
import webpush from 'web-push'
import nodemailer from 'nodemailer'
import 'dotenv/config'

// Configure VAPID for web push (only if keys are present and look real)
const vapidPub = process.env.VAPID_PUBLIC_KEY || ''
const vapidPriv = process.env.VAPID_PRIVATE_KEY || ''
if (vapidPub.length > 20 && vapidPriv.length > 20 && !vapidPub.startsWith('your_')) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.EMAIL_FROM || 'alerts@mintlens.xyz'}`,
      vapidPub,
      vapidPriv
    )
  } catch (err) {
    console.warn('[alerts] VAPID config error (generate real keys with: npx web-push generate-vapid-keys):', err.message)
  }
}

// In-memory subscription store
const subscriptions = new Map() // id → subscription

let _idCounter = 1

function addSubscription({ type, threshold, pushSubscription, email }) {
  const id = String(_idCounter++)
  subscriptions.set(id, { id, type, threshold, pushSubscription, email, createdAt: new Date().toISOString() })
  console.log(`[alerts] New ${type} subscription #${id} (threshold: ${threshold})`)
  return id
}

function removeSubscription(id) {
  subscriptions.delete(id)
}

function getSubscriptions() {
  return Array.from(subscriptions.values())
}

/**
 * Check a newly scored token against all subscriptions and fire notifications.
 * @param {{ mint, name, symbol, score, verdict }} tokenInfo
 */
async function notifyIfQualifies(tokenInfo) {
  const { mint, name, symbol, score, verdict } = tokenInfo

  for (const sub of subscriptions.values()) {
    if (score < sub.threshold) continue

    if (sub.type === 'push' && sub.pushSubscription) {
      await sendPushNotification(sub.pushSubscription, { mint, name, symbol, score, verdict })
    } else if (sub.type === 'email' && sub.email) {
      await sendEmailNotification(sub.email, { mint, name, symbol, score, verdict })
    }
  }
}

async function sendPushNotification(pushSubscription, data) {
  if (!process.env.VAPID_PUBLIC_KEY) {
    console.warn('[alerts] VAPID keys not configured, skipping push')
    return
  }
  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: `MINTLENS: ${data.name} scored ${data.score}/100`,
        body: data.verdict,
        icon: '/icon-192.png',
        data: { url: `/token/${data.mint}` },
      })
    )
  } catch (err) {
    console.error('[alerts] Push failed:', err.message)
  }
}

async function sendEmailNotification(email, data) {
  if (!process.env.SMTP_HOST) {
    console.warn('[alerts] SMTP not configured, skipping email')
    return
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'alerts@mintlens.xyz',
      to: email,
      subject: `MINTLENS Alert: ${data.name} (${data.symbol}) scored ${data.score}/100`,
      html: `
        <h2>MINTLENS Token Alert</h2>
        <p><strong>${data.name} (${data.symbol})</strong> scored <strong>${data.score}/100</strong></p>
        <p><em>${data.verdict}</em></p>
        <p><a href="https://mintlens.xyz/token/${data.mint}">View Full Report</a></p>
        <hr/>
        <small>Mint: ${data.mint}</small>
      `,
    })
  } catch (err) {
    console.error('[alerts] Email failed:', err.message)
  }
}

export default {
  addSubscription,
  removeSubscription,
  getSubscriptions,
  notifyIfQualifies,
}
