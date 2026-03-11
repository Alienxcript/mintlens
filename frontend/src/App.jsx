import { Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Home from './pages/Home.jsx'
import TokenReport from './pages/TokenReport.jsx'
import CreatorProfile from './pages/CreatorProfile.jsx'
import Wallet from './pages/Wallet.jsx'
import Leaderboard from './pages/Leaderboard.jsx'

export default function App() {
  return (
    <>
    <Analytics />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/token/:mint" element={<TokenReport />} />
      <Route path="/creator/:handle" element={<CreatorProfile />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
    </>
  )
}
