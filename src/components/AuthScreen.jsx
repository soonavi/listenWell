import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Music2 } from 'lucide-react'

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

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
    <div className="min-h-screen w-full bg-[#0c0c0e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-violet-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">ListenWell</h1>
          <p className="text-xs text-gray-500">Your music, your way.</p>
        </div>

        <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setMessage(null) }}
              className={`flex-1 py-2 capitalize transition ${
                mode === m ? 'bg-violet-500/20 text-violet-100' : 'text-gray-400 hover:bg-white/[0.04]'
              }`}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60"
          />
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        {message && <p className="text-xs text-cyan-400 text-center">{message}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
