import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'

const TABS = ['Availability', 'Chat', 'Notes']
const OWNER_NAME = localStorage.getItem('ownerName') || 'Christian'

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// --- Name Prompt (open_link guests on first visit) ---
function NamePrompt({ token, onConfirm }) {
  const [name, setName] = useState('')
  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    localStorage.setItem(`room-identity-${token}`, name.trim())
    onConfirm(name.trim())
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl px-8 py-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-black font-bold text-sm">CC</span>
          </div>
          <span className="text-sm font-medium text-zinc-300">Cap Collective</span>
        </div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">What's your name?</h2>
        <p className="text-sm text-zinc-500 mb-6">So the team knows who they're talking to.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
          <Button type="submit" disabled={!name.trim()} className="w-full">Enter Room →</Button>
        </form>
      </div>
    </div>
  )
}

// --- Notes Tab ---
function NotesTab({ productionId, group, guestName }) {
  const { updateSharedNotes } = useApp()
  const [value, setValue] = useState(group.room.sharedNotes)
  const [saved, setSaved] = useState(true)
  const timerRef = useRef(null)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!pendingRef.current) setValue(group.room.sharedNotes)
  }, [group.room.sharedNotes])

  function handleChange(e) {
    setValue(e.target.value)
    setSaved(false)
    pendingRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateSharedNotes(productionId, group.id, e.target.value)
      setSaved(true)
      pendingRef.current = false
    }, 800)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-surface-700">
        <p className="text-xs text-zinc-500">Shared with {OWNER_NAME} — both can edit</p>
        <span className={`text-xs transition-opacity ${saved ? 'text-zinc-600' : 'text-accent'}`}>
          {saved ? 'Saved' : 'Saving...'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-4 sm:px-8 py-4 sm:py-6">
        <textarea
          value={value}
          onChange={handleChange}
          className="w-full h-full bg-transparent text-sm text-zinc-200 leading-relaxed resize-none focus:outline-none font-mono placeholder-zinc-700"
          placeholder="Start typing shared notes..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}

// --- Chat Tab ---
function ChatTab({ productionId, group, isOwner, guestName }) {
  const { sendMessage, markRoomRead } = useApp()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const senderName = isOwner ? OWNER_NAME : guestName

  useEffect(() => {
    markRoomRead(productionId, group.id)
  }, [productionId, group.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [group.room.messages.length])

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(productionId, group.id, input.trim(), senderName)
    setInput('')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-4">
        {group.room.messages.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">No messages yet. Start the conversation.</div>
        )}
        {group.room.messages.map(msg => {
          const isMe = (isOwner && msg.senderId === 'owner') || (!isOwner && msg.senderId !== 'owner')
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                msg.senderId === 'owner' ? 'bg-accent text-black' : 'bg-surface-700 text-zinc-300'
              }`}>
                {msg.senderName?.[0] ?? '?'}
              </div>
              <div className={`max-w-[75%] sm:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-zinc-400">{msg.senderName}</span>
                  <span className="text-xs text-zinc-600">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe ? 'bg-accent text-black rounded-tr-sm' : 'bg-surface-800 text-zinc-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="px-3 sm:px-6 py-3 sm:py-4 border-t border-surface-700">
        <div className="flex gap-3 items-end bg-surface-800 rounded-xl px-4 py-3 border border-surface-600 focus-within:border-surface-500">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-accent hover:bg-accent-hover disabled:opacity-30 text-black rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Availability Tab ---
function AvailabilityTab({ isOwner, availabilityRules }) {
  const { slots, calendarEvents, connectedCalendars, prefixRules } = useApp()
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
      {!isOwner && (
        <div className="mb-5">
          <p className="text-sm text-zinc-400 mb-1">{OWNER_NAME}'s availability for this production window.</p>
          <p className="text-xs text-zinc-600">Contact him directly to request a specific date.</p>
        </div>
      )}
      <AvailabilityCalendar
        slots={slots}
        calendarEvents={calendarEvents}
        connectedCalendars={connectedCalendars}
        availabilityRules={availabilityRules}
        prefixRules={prefixRules}
        isOwner={isOwner}
      />
    </div>
  )
}

// --- Main Room View ---
export function RoomView() {
  const { token } = useParams()
  const { getProduction, getGroup, isOwner, availabilityRules, loading, refreshRoom, resolveToken } = useApp()
  const [activeTab, setActiveTab] = useState('Availability')
  const [resolved, setResolved] = useState(null) // { productionId, groupId, mode, memberName }
  const [resolving, setResolving] = useState(true)
  const [guestName, setGuestName] = useState(null)

  // Resolve token → productionId + groupId
  useEffect(() => {
    if (loading) return
    resolveToken(token).then(result => {
      setResolved(result)
      setResolving(false)
    })
  }, [token, loading, resolveToken])

  // Determine guest name once resolved
  useEffect(() => {
    if (!resolved) return
    if (isOwner) { setGuestName(null); return }
    if (resolved.mode === 'invite_only') {
      setGuestName(resolved.memberName)
    } else {
      const stored = localStorage.getItem(`room-identity-${token}`)
      if (stored) setGuestName(stored)
      // else: null → name prompt will show
    }
  }, [resolved, isOwner, token])

  // Real-time subscription
  useEffect(() => {
    if (!resolved) return
    const { productionId, groupId } = resolved
    const channel = supabase
      .channel(`room-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        () => refreshRoom(productionId, groupId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_notes', filter: `group_id=eq.${groupId}` },
        () => refreshRoom(productionId, groupId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [resolved, refreshRoom])

  if (loading || resolving) {
    return <div className="flex items-center justify-center h-screen text-zinc-500">Loading room...</div>
  }

  if (!resolved) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-500 flex-col gap-3">
        <p>Room not found.</p>
        <p className="text-xs text-zinc-600">This link may be invalid or expired.</p>
      </div>
    )
  }

  const { productionId, groupId, mode } = resolved
  const production = getProduction(productionId)
  const group = getGroup(productionId, groupId)

  if (!production || !group) {
    return <div className="flex items-center justify-center h-screen text-zinc-500">Room not found.</div>
  }

  // Open link guest — show name prompt if name not yet captured
  if (!isOwner && mode === 'open_link' && !guestName) {
    return <NamePrompt token={token} onConfirm={setGuestName} />
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950">
      {/* Room header */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-surface-700 bg-surface-900">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {isOwner && (
            <Link to={`/production/${productionId}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
              ← <span className="hidden sm:inline">{production.name}</span><span className="sm:hidden">Back</span>
            </Link>
          )}
          {!isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
                <span className="text-black text-xs font-bold">CC</span>
              </div>
              <span className="text-xs text-zinc-500 hidden sm:inline">Cap Collective</span>
            </div>
          )}
          <div className="h-4 w-px bg-surface-700 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-zinc-100 truncate">{group.name}</span>
            <span className="text-zinc-600 mx-1.5 text-sm hidden sm:inline">·</span>
            <span className="text-sm text-zinc-500 hidden sm:inline truncate">{production.name}</span>
          </div>
        </div>
        {isOwner && <Badge variant="ghost" className="flex-shrink-0">Owner</Badge>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 sm:px-8 border-b border-surface-700 bg-surface-900">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab ? 'border-accent text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Notes' && (
        <NotesTab productionId={productionId} group={group} guestName={guestName} />
      )}
      {activeTab === 'Chat' && (
        <ChatTab productionId={productionId} group={group} isOwner={isOwner} guestName={guestName} />
      )}
      {activeTab === 'Availability' && (
        <AvailabilityTab isOwner={isOwner} availabilityRules={availabilityRules} />
      )}
    </div>
  )
}
