// WhatsNewModal — the UI half of the "what's new" feature. All version
// comparison and release content lives in src/utils/whatsNew.js (pure, no
// React); this component only renders what it's given and reports intent
// back through callbacks. It owns no storage and no timing decision.
//
// Integration surface (App.jsx wires this up):
//   import WhatsNewModal from '@/components/WhatsNewModal'
//
//   <WhatsNewModal
//     open={bool}
//     mode={'prompt' | 'notes'}
//     releases={array}   // from releasesSince(seenVersion, currentVersion)
//     version={string}   // currentVersion (__APP_VERSION__), shown in prompt mode
//     onAccept={fn}       // prompt mode only: "See what's new" clicked
//     onDismiss={fn}      // prompt mode only: "Not now" clicked
//     onClose={fn}        // Escape key, backdrop click (notes mode), or the
//                         // notes panel's close button — a neutral "hide this"
//                         // request, distinct from an explicit accept/decline
//   />
//
// Suggested App.jsx wiring, once per session after `user` is set and the
// library has loaded:
//   1. Read STORAGE_KEY from localStorage as seenVersion.
//   2. If shouldPrompt(seenVersion, __APP_VERSION__), open in 'prompt' mode.
//   3. onAccept: write STORAGE_KEY = __APP_VERSION__, switch to 'notes' mode
//      with releases = releasesSince(seenVersion, __APP_VERSION__).
//   4. onDismiss: write STORAGE_KEY = __APP_VERSION__, close — this is what
//      makes "does not ask again for that version" hold.
//   5. onClose: close whatever is open. In prompt mode this is a soft
//      dismissal (App.jsx decides whether to also write STORAGE_KEY — leaving
//      it unwritten means the prompt can reappear next launch); in notes mode
//      the version was already written in step 3, so this just closes it.
// STORAGE_KEY stays device-local (plain localStorage, not user_state): it
// answers "has this browser/install seen this version," which has nothing to
// do with the signed-in account.
import { useEffect } from 'react'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

function formatReleaseDate(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateStr
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PromptCard({ version, onAccept, onDismiss }) {
  return (
    <motion.div
      key="prompt"
      role="status"
      aria-live="polite"
      className="fixed z-[150] inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="rounded-2xl border border-white/10 bg-[#0f0e14]/95 shadow-2xl glass-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgb(139_92_246_/_0.6)]" aria-hidden="true" />
            <h2 className="section-title text-[11px] text-white">What&rsquo;s new</h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 -m-1 p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">
          ListenWell updated to <span className="text-gray-100 font-medium">{version}</span>. Want to see what changed?
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onAccept}
            className="px-4 py-2 rounded-[10px] text-sm font-medium bg-violet-500/15 border border-violet-500/60 text-violet-100 hover:bg-violet-500/25 hover:border-violet-400/70 transition-colors"
          >
            See what&rsquo;s new
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 rounded-[10px] text-sm text-gray-400 hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function NotesPanel({ releases, onClose }) {
  return (
    <motion.div
      key="notes"
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/12 bg-[#0f0e14] shadow-2xl glass-card overflow-hidden"
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="section-title text-sm text-white">What&rsquo;s new</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {releases.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing new to report.</p>
          ) : (
            <div className="space-y-5">
              {releases.map((release) => (
                <div key={release.version}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3 className="section-title text-xs text-white">Version {release.version}</h3>
                    <span className="text-[11px] text-gray-500">{formatReleaseDate(release.date)}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {release.highlights.map((highlight, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-gray-300 leading-relaxed">
                        <span className="mt-[9px] w-1 h-1 rounded-full bg-violet-400 shrink-0" aria-hidden="true" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function WhatsNewModal({ open, mode, releases = [], version, onAccept, onDismiss, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && mode === 'prompt' && (
        <PromptCard version={version} onAccept={onAccept} onDismiss={onDismiss} />
      )}
      {open && mode === 'notes' && (
        <NotesPanel releases={releases} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}
