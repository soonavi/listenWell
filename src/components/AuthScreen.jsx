import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Music2, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

function onParallaxMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
  const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
  e.currentTarget.style.setProperty('--rx', `${-y * 3.5}deg`)
  e.currentTarget.style.setProperty('--ry', `${x * 4.9}deg`)
}

function onParallaxLeave(e) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [showWhy, setShowWhy] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onAuth(data.user)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account, then log in.')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen w-full bg-[#0c0c0e] flex flex-col items-center justify-center px-6 gap-8"
      style={{ color: '#9ca3af' }}
    >
      {/* Branding */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-3xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <Music2 className="w-10 h-10 text-violet-400" />
        </div>
        <h1 className="text-4xl font-semibold text-white">ListenWell</h1>
        <p className="text-base" style={{ color: '#9ca3af' }}>Your music, your way.</p>
      </div>

      {/* Glassy card */}
      <div className="parallax-card w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 p-8 flex flex-col gap-6" onMouseMove={onParallaxMove} onMouseLeave={onParallaxLeave}>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 rounded-xl border border-white/10 overflow-hidden">
          {[
            { key: 'login', label: 'Log in' },
            { key: 'signup', label: 'Sign up' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setError(null); setMessage(null) }}
              style={{ display: 'block', width: '100%', padding: '12px 0', textAlign: 'center', color: '#9ca3af' }}
              className={`text-base font-medium transition ${mode === key ? 'bg-violet-500/20' : 'hover:bg-white/[0.04]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition"
            style={{ color: '#e5e7eb' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition"
            style={{ color: '#e5e7eb' }}
          />
        </div>

        {/* Feedback */}
        {error && (
          <p className="text-sm bg-red-500/15 border border-red-500/20 rounded-xl px-4 py-3" style={{ color: '#9ca3af' }}>
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm bg-violet-500/15 border border-violet-500/20 rounded-xl px-4 py-3" style={{ color: '#9ca3af' }}>
            {message}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          style={{ display: 'block', width: '100%', textAlign: 'center', color: '#9ca3af', marginTop: '4px', marginBottom: '4px' }}
          className="py-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : 'Continue'}
        </button>
      </div>

      {/* Why dropdown — outside and below the card */}
      <div className="parallax-card w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" onMouseMove={onParallaxMove} onMouseLeave={onParallaxLeave}>
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', color: '#9ca3af', textAlign: 'center' }}
          className="text-sm transition hover:bg-white/[0.04]"
        >
          Why do I need to create an account?
          <motion.span
            animate={{ rotate: showWhy ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexShrink: 0 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {showWhy && (
            <motion.div
              key="why"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <p
                className="text-sm leading-relaxed px-4 pb-4 pt-1 text-center"
                style={{ color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.08)' }}
              >
                So that you can access your song files from any device or browser - your email will not be sold to anyone.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
