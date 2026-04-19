import { useState, useEffect } from 'react'
import { X, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'

function GuideCursor() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="#1a1a1a" strokeWidth="1.4"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  )
}

// Animated full-flow guide shown before Google OAuth.
// Demonstrates: click Advanced → section expands → click "Go to coordie.com (unsafe)"
export function GoogleOAuthGuide({ onConfirm, onCancel }) {
  // phase: 0=initial 1=cursor→Advanced 2=Advanced clicked+expand 3=cursor→GoTo 4=GoTo clicked 5=done
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const seq = [
      [300,  () => setPhase(1)],
      [2900, () => setPhase(2)],
      [3400, () => setPhase(3)],
      [6000, () => setPhase(4)],
      [6800, () => setPhase(5)],
    ]
    const timers = seq.map(([delay, fn]) => setTimeout(fn, delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  const expanded = phase >= 2
  const TOTAL_MS = 6800

  const instruction = phase < 2
    ? '① Click "Advanced" at the bottom'
    : phase < 5
    ? '② Click "Go to coordie.com (unsafe)"'
    : "✓ You're in — tap connect below"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-[420px] bg-surface-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-sheet overflow-hidden animate-slideUp">

        <div className="h-[2px] bg-white/5">
          <div className="h-full bg-accent animate-progress-fill" style={{ animationDuration: `${TOTAL_MS}ms` }} />
        </div>

        <div className="px-6 pt-5 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert size={14} strokeWidth={1.75} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100 tracking-tight">What you'll see next</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Google shows a warning — here's the full walkthrough</p>
              </div>
            </div>
            <button onClick={onCancel} className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors mt-0.5">
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/8 shadow-xl mb-4">
            <div className="bg-white px-4 pt-4 pb-3">

              <div className="mb-2.5">
                <span style={{ fontSize: 17, fontFamily: 'system-ui', letterSpacing: '-0.01em' }}>
                  <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span>
                  <span style={{ color: '#FBBC05' }}>o</span><span style={{ color: '#4285F4' }}>g</span>
                  <span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
                </span>
              </div>

              <p className="text-[10px] text-gray-500 mb-2 leading-snug">coordie.com wants to access your Google Account</p>

              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-md px-2.5 py-2 mb-2">
                <span className="text-yellow-500 text-xs leading-none mt-px">⚠</span>
                <p className="text-[10px] text-gray-700 font-semibold leading-snug">Google hasn't verified this app</p>
              </div>

              <p className="text-[9px] text-gray-400 leading-snug mb-3">
                The app is requesting access to sensitive info in your Google Account. Only proceed if you trust the developer.
              </p>

              <div className="w-full py-1.5 bg-[#1a73e8] rounded text-center text-[10px] text-white font-medium mb-3">
                Back to safety
              </div>

              {/* Advanced row */}
              <div className="relative">
                <div className={`inline-flex items-center gap-1 text-[#1a73e8] text-[10px] font-medium rounded px-1 py-0.5 transition-colors duration-300 ${phase >= 1 && phase < 2 ? 'animate-click-flash' : ''}`}>
                  {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                  <span>Advanced</span>
                </div>
                {phase >= 1 && phase < 2 && (
                  <div className="absolute -inset-0.5 rounded animate-pulse-ring pointer-events-none" />
                )}
                {phase === 1 && (
                  <div className="absolute -top-0.5 left-12 animate-cursor-fly-click pointer-events-none">
                    <GuideCursor />
                  </div>
                )}
              </div>

              {/* Expanded section */}
              <div className={`overflow-hidden transition-all duration-500 ${expanded ? 'max-h-24 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
                <p className="text-[9px] text-gray-400 leading-snug mb-2">
                  coordie.com has not been verified by Google yet. Only proceed if you understand the risks.
                </p>
                <div className="relative inline-block">
                  <div className={`text-[#1a73e8] text-[10px] underline font-medium rounded px-1 py-0.5 transition-colors duration-300 ${phase >= 3 && phase < 5 ? 'animate-click-flash' : ''}`}>
                    Go to coordie.com (unsafe)
                  </div>
                  {phase >= 3 && phase < 5 && (
                    <div className="absolute -inset-0.5 rounded animate-pulse-ring pointer-events-none" />
                  )}
                  {phase >= 3 && phase < 5 && (
                    <div className="absolute -top-0.5 left-32 animate-cursor-fly-click-down pointer-events-none">
                      <GuideCursor />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-surface-800 border-t border-white/8 px-4 py-2.5 flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${phase >= 5 ? 'bg-green-500/20 border border-green-500/30' : 'bg-accent/20 border border-accent/30'}`}>
                {phase >= 5
                  ? <span className="text-[9px] text-green-400">✓</span>
                  : <span className="text-[9px] font-bold text-accent">{phase < 2 ? '1' : '2'}</span>
                }
              </div>
              <p className="text-[11px] text-zinc-300 font-medium">{instruction}</p>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed mb-4 text-center">
            This appears because Coordie is pending Google's verification. Your calendar data never leaves your device.
          </p>

          <button
            onClick={onConfirm}
            className={`w-full py-3 text-white text-sm font-semibold rounded-xl transition-all duration-300 ${phase >= 5 ? 'bg-accent shadow-lg scale-[1.02]' : 'bg-accent/70 hover:bg-accent/80'}`}
          >
            Got it — connect my calendar
          </button>
          <button onClick={onCancel}
            className="w-full py-2 mt-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
