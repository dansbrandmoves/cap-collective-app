import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'

const TABS = ['Availability', 'Notes']

function NamePrompt({ token, onConfirm }) {
  const [name, setName] = useState('')
  const { theme } = useApp()
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
          <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
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

function NotesTab({ productionId, group, guestName }) {
  const { updateSharedNotes, user } = useApp()
  const ownerName = user?.user_metadata?.full_name || 'the project owner'
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
        <p className="text-xs text-zinc-500">Shared notes — both sides can edit</p>
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

function AvailabilityTab({ isOwner, availabilityRules, groupId, guestName }) {
  const { slots, calendarEvents, connectedCalendars, prefixRules, createDateRequest, slotStates } = useApp()
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
      {!isOwner && (
        <div className="mb-5">
          <p className="text-sm text-zinc-400 mb-1">Tap dates to select them, then send a request.</p>
        </div>
      )}
      <AvailabilityCalendar
        slots={slots}
        calendarEvents={calendarEvents}
        connectedCalendars={connectedCalendars}
        availabilityRules={availabilityRules}
        prefixRules={prefixRules}
        isOwner={isOwner}
        slotStates={slotStates}
        groupId={groupId}
        guestName={guestName}
        onRequestSubmit={createDateRequest}
      />
    </div>
  )
}

export function RoomView() {
  const { token } = useParams()
  const { getProduction, getGroup, user, availabilityRules, loading, refreshRoom, resolveToken, theme } = useApp()
  const [activeTab, setActiveTab] = useState('Availability')
  const [resolved, setResolved] = useState(null)
  const [resolving, setResolving] = useState(true)
  const [guestName, setGuestName] = useState(null)

  useEffect(() => {
    if (loading) return
    resolveToken(token).then(result => {
      setResolved(result)
      setResolving(false)
    })
  }, [token, loading, resolveToken])

  const production = resolved ? getProduction(resolved.productionId) : null
  const isOwner = !!user && production?.ownerId === user.id

  useEffect(() => {
    if (!resolved) return
    if (isOwner) { setGuestName(null); return }
    if (resolved.mode === 'invite_only') {
      setGuestName(resolved.memberName)
    } else {
      const stored = localStorage.getItem(`room-identity-${token}`)
      if (stored) setGuestName(stored)
    }
  }, [resolved, isOwner, token])

  useEffect(() => {
    if (!resolved) return
    const { productionId, groupId } = resolved
    const channel = supabase
      .channel(`room-${groupId}`)
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
  const group = getGroup(productionId, groupId)

  if (!production || !group) {
    return <div className="flex items-center justify-center h-screen text-zinc-500">Room not found.</div>
  }

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
              <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
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
      {activeTab === 'Availability' && (
        <AvailabilityTab isOwner={isOwner} availabilityRules={availabilityRules} groupId={groupId} guestName={guestName} />
      )}
    </div>
  )
}
