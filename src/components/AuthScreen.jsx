import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
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

const MODES = [
  { key: 'login', label: 'Log in' },
  { key: 'signup', label: 'Sign up' },
]

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [showWhy, setShowWhy] = useState(false)

  const switchMode = (key) => {
    setMode(key)
    setError(null)
    setMessage(null)
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading || !email || !password) return
    setError(null)
    setMessage(null)
    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
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
      className="relative min-h-screen w-full bg-[#0c0c0e] flex flex-col items-center justify-center px-6 gap-8 overflow-hidden"
      style={{ '--accent-rgb': '139 92 246' }}
    >
      <div className="aurora aurora-one" aria-hidden />
      <div className="aurora aurora-two" aria-hidden />

      {/* Branding */}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <img src="/logo.svg" alt="" className="w-12 h-12" aria-hidden />
        </div>
        <h1 className="section-title text-2xl sm:text-3xl font-bold text-gray-100">ListenWell</h1>
        <p className="text-base text-gray-400">Your music, your way.</p>
      </div>

      {/* Auth card */}
      <div
        className="parallax-card glass-card w-full max-w-md rounded-2xl p-8 flex flex-col gap-6"
        onMouseMove={onParallaxMove}
        onMouseLeave={onParallaxLeave}
      >
        {/* Mode toggle */}
        <div className="grid grid-cols-2 rounded-[10px] border border-white/10 bg-white/[0.03] p-1 gap-1" role="tablist" aria-label="Log in or sign up">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => switchMode(key)}
              className={`relative block w-full py-2.5 text-center rounded-md text-base font-medium transition-colors ${
                mode === key ? 'text-violet-100' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              {mode === key && (
                <motion.span
                  layoutId="auth-mode-indicator"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-md bg-violet-500/15 border border-violet-500/40"
                  aria-hidden
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Inputs */}
          <div className="flex flex-col gap-4">
            <input
              type="email"
              name="email"
              autoComplete="email"
              aria-label="Email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ui-input w-full rounded-[10px] px-4 py-3.5 text-base transition-colors focus:outline-none"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-label="Password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-input w-full rounded-[10px] px-4 py-3.5 pr-12 text-base transition-colors focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {mode === 'signup' && (
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                aria-label="Confirm password"
                placeholder="Confirm password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="ui-input w-full rounded-[10px] px-4 py-3.5 text-base transition-colors focus:outline-none"
              />
            )}
          </div>

          {/* Feedback */}
          <div aria-live="polite">
            <AnimatePresence initial={false} mode="wait">
              {error && (
                <motion.p
                  key={`error-${error}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden text-sm text-red-200 bg-red-500/10 border border-red-500/25 rounded-[10px] px-4 py-3"
                >
                  {error}
                </motion.p>
              )}
              {message && (
                <motion.p
                  key="message"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden text-sm text-violet-100 bg-violet-500/10 border border-violet-500/30 rounded-[10px] px-4 py-3"
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="ui-btn-primary block w-full text-center py-3.5 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? (mode === 'login' ? 'Logging in…' : 'Creating account…')
              : (mode === 'login' ? 'Log in' : 'Create account')}
          </button>
        </form>
      </div>

      {/* Ownership notice */}
      <div className="relative w-full max-w-md rounded-[10px] border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3 text-center">
        <p className="text-xs leading-relaxed text-gray-300">
          ListenWell is for music you <span className="font-semibold text-violet-200">own</span>. Upload only files you have the right to use. This is a personal library for your own collection, not a tool for piracy or sharing copyrighted music.
        </p>
      </div>

      {/* Why dropdown — outside and below the card */}
      <div className="relative w-full max-w-md rounded-[10px] border border-white/10 bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
        >
          Why do I need to create an account?
          <motion.span
            animate={{ rotate: showWhy ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex shrink-0"
            aria-hidden
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
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <p className="text-sm leading-relaxed px-4 pb-4 pt-3 text-center text-gray-400 border-t border-white/[0.08]">
                So you can access your song files from any device or browser. Your email is never shared or sold.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
