import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { UserPlus, Mail, Link2, Check, ExternalLink, Loader2 } from 'lucide-react'

// One place to bring people in. Enter a name (+ optional email): with an email we
// send them their personal invite link; without, we just add them and you copy
// their link from the roster. Or grab the open "anyone can join" link.
export function AddPersonModal({ isOpen, onClose, addPerson, sendRoomInvite, shareLink, productionName }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(null) // { name, emailed }
  const [copied, setCopied] = useState(false)

  const hasEmail = email.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim())

  async function submit(e) {
    e?.preventDefault()
    const n = name.trim()
    if (!n) return
    setSending(true)
    const member = addPerson(n, email.trim())
    let emailed = false
    if (member && hasEmail) {
      emailed = await sendRoomInvite({
        name: n, email: email.trim(),
        inviteToken: member.invite_token || member.inviteToken,
        productionName,
      })
    }
    setSending(false)
    setDone({ name: n, emailed })
    setName(''); setEmail('')
  }

  function copyShare() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function close() {
    setName(''); setEmail(''); setDone(null); setCopied(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add people" size="md">
      {/* Just-added confirmation */}
      {done && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-green-500/25 bg-green-500/[0.08] px-3.5 py-3">
          <Check size={16} strokeWidth={2.5} className="text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-zinc-200 leading-relaxed">
            <span className="font-semibold">{done.name}</span> added
            {done.emailed ? '. Invite emailed.' : '. Copy their link from the roster to share.'}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Daniel"
            className="w-full bg-surface-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
            Email <span className="text-zinc-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="daniel@example.com"
            className="w-full bg-surface-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || sending}
          className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold transition-all duration-200 ease-ios shadow-[0_8px_24px_-8px_rgb(94_156_140/0.55)] disabled:opacity-40 disabled:shadow-none"
        >
          {sending
            ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
            : hasEmail
            ? <><Mail size={16} strokeWidth={2} /> Add &amp; send invite</>
            : <><UserPlus size={16} strokeWidth={2} /> Add person</>}
        </button>
      </form>

      {/* Or: open shareable link */}
      {shareLink && (
        <div className="mt-5 pt-5 border-t border-white/[0.06]">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-2.5">Or share one link</p>
          <button
            onClick={copyShare}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] border transition-colors ${
              copied
                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                : 'border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {copied ? <Check size={15} strokeWidth={2} /> : <Link2 size={15} strokeWidth={1.75} className="opacity-70" />}
            {copied ? 'Copied!' : 'Copy shareable link'}
          </button>
          <a
            href={`${shareLink}${shareLink.includes('?') ? '&' : '?'}preview=guest`}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3.5 py-2 mt-1 rounded-xl text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
          >
            <ExternalLink size={14} strokeWidth={1.75} className="opacity-70" />
            Preview as guest
          </a>
          <p className="text-[11px] text-zinc-600 leading-relaxed mt-2.5">
            Anyone with this link can add their availability.
          </p>
        </div>
      )}
    </Modal>
  )
}
