import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../contexts/AppContext'
import { CalendarDays, Users, CheckCircle2, Mail, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: CalendarDays, label: 'Connect your calendar', desc: 'Pull real availability from Google Calendar automatically.' },
  { icon: Users, label: 'Share rooms with groups', desc: 'Clients and collaborators get their own scoped view.' },
  { icon: CheckCircle2, label: 'Coordinate without chaos', desc: 'Date requests, shared notes, and availability — all in one place.' },
]

export function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const { theme } = useApp()

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleEmailSignIn(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setEmailSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col md:flex-row">
      {/* Left panel — branding + features */}
      <div className="hidden md:flex flex-col justify-between w-[420px] flex-shrink-0 bg-surface-900 border-r border-surface-700 px-12 py-16">
        <div>
          <img
            src="/coordie-logo.svg"
            alt="Coordie"
            className="h-7 mb-12"
            style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
          />
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3 leading-snug">
            Coordinate your projects, beautifully.
          </h2>
          <p className="text-sm text-zinc-500 mb-10 leading-relaxed">
            Built for creatives who need to stay organized without the noise.
          </p>

          <div className="space-y-7">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={15} className="text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200 mb-0.5">{label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-600">Room links work without an account.</p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="md:hidden mb-8 text-center">
          <img
            src="/coordie-logo.svg"
            alt="Coordie"
            className="h-6 mx-auto mb-3"
            style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
          />
          <p className="text-sm text-zinc-500">Coordinate your projects, beautifully.</p>
        </div>

        <div className="w-full max-w-sm">
          {emailSent ? (
            /* Magic link sent state */
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
                <Mail size={20} className="text-accent" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-semibold text-zinc-100 mb-2">Check your email</h1>
              <p className="text-sm text-zinc-500 mb-6">
                We sent a sign-in link to <span className="text-zinc-300 font-medium">{email}</span>.
                Click the link to sign in — no password needed.
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail('') }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-zinc-100 mb-1">Welcome back</h1>
              <p className="text-sm text-zinc-500 mb-8">Sign in to manage your projects and rooms.</p>

              {error && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-5">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Google sign-in */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium text-sm rounded-xl px-4 py-3 transition-colors disabled:opacity-50 shadow-sm mb-3"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loading ? 'Signing in...' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-surface-700" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="flex-1 h-px bg-surface-700" />
              </div>

              {/* Email sign-in */}
              {showEmail ? (
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <div className="relative">
                    <Mail size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!email.trim() || loading}
                    className="w-full flex items-center justify-center gap-2 bg-surface-700 hover:bg-surface-600 border border-surface-600 text-zinc-200 font-medium text-sm rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
                  >
                    Send magic link
                    <ArrowRight size={15} strokeWidth={1.75} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-3 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-zinc-300 font-medium text-sm rounded-xl px-4 py-3 transition-colors"
                >
                  <Mail size={15} strokeWidth={1.75} />
                  Continue with Email
                </button>
              )}

              <p className="text-xs text-zinc-600 text-center mt-6">
                Room links work without an account.
              </p>

              <div className="mt-10 pt-8 border-t border-surface-700 flex items-center justify-center gap-4 text-xs text-zinc-600">
                <a href="/home" className="hover:text-zinc-400 transition-colors">Home</a>
                <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
