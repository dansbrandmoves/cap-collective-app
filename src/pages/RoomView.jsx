import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

const TABS = ['Notes', 'Chat', 'Availability']

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// --- Notes Tab ---
function NotesTab({ productionId, group, isOwner }) {
  const { updateSharedNotes } = useApp()
  const [value, setValue] = useState(group.room.sharedNotes)
  const [saved, setSaved] = useState(true)
  const timerRef = useRef(null)

  // Auto-save with debounce
  function handleChange(e) {
    setValue(e.target.value)
    setSaved(false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateSharedNotes(productionId, group.id, e.target.value)
      setSaved(true)
    }, 800)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 py-3 border-b border-surface-700">
        <p className="text-xs text-zinc-500">Shared between you and Christian — both can edit</p>
        <span className={`text-xs transition-opacity ${saved ? 'text-zinc-600' : 'text-accent'}`}>
          {saved ? 'Saved' : 'Saving...'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-8 py-6">
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
function ChatTab({ productionId, group, isOwner }) {
  const { sendMessage, markRoomRead } = useApp()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const senderName = isOwner ? 'Christian' : 'You'

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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {group.room.messages.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">
            No messages yet. Start the conversation.
          </div>
        )}
        {group.room.messages.map(msg => {
          const isMe = (isOwner && msg.senderId === 'owner') || (!isOwner && msg.senderId !== 'owner')
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                msg.senderId === 'owner' ? 'bg-accent text-black' : 'bg-surface-700 text-zinc-300'
              }`}>
                {msg.senderName[0]}
              </div>
              <div className={`max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-zinc-400">{msg.senderName}</span>
                  <span className="text-xs text-zinc-600">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-accent text-black rounded-tr-sm'
                    : 'bg-surface-800 text-zinc-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-6 py-4 border-t border-surface-700">
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
  const { slots, calendarEvents, connectedCalendars } = useApp()
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      {!isOwner && (
        <div className="mb-5">
          <p className="text-sm text-zinc-400 mb-1">Christian's availability for this production window.</p>
          <p className="text-xs text-zinc-600">Contact him directly to request a specific date.</p>
        </div>
      )}
      <AvailabilityCalendar
        slots={slots}
        calendarEvents={calendarEvents}
        connectedCalendars={connectedCalendars}
        availabilityRules={availabilityRules}
        isOwner={isOwner}
      />
    </div>
  )
}

// --- Main Room View ---
export function RoomView() {
  const { productionId, groupId } = useParams()
  const { getProduction, getGroup, isOwner, availabilityRules } = useApp()
  const [activeTab, setActiveTab] = useState('Notes')

  const production = getProduction(productionId)
  const group = getGroup(productionId, groupId)

  if (!production || !group) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 flex-col gap-3">
        <p>Room not found.</p>
        {isOwner && <Link to="/" className="text-accent text-sm underline">Back to dashboard</Link>}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950">
      {/* Room header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-surface-700 bg-surface-900">
        <div className="flex items-center gap-4">
          {isOwner && (
            <Link to={`/production/${productionId}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              ← {production.name}
            </Link>
          )}
          {!isOwner && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
                <span className="text-black text-xs font-bold">CC</span>
              </div>
              <span className="text-xs text-zinc-500">Cap Collective</span>
            </div>
          )}
          <div className="h-4 w-px bg-surface-700" />
          <div>
            <span className="text-sm font-semibold text-zinc-100">{group.name}</span>
            <span className="text-zinc-600 mx-2 text-sm">·</span>
            <span className="text-sm text-zinc-500">{production.name}</span>
          </div>
        </div>

        {/* Owner badge */}
        {isOwner && <Badge variant="ghost">Owner view</Badge>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-8 border-b border-surface-700 bg-surface-900">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-accent text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Notes' && (
        <NotesTab productionId={productionId} group={group} isOwner={isOwner} />
      )}
      {activeTab === 'Chat' && (
        <ChatTab productionId={productionId} group={group} isOwner={isOwner} />
      )}
      {activeTab === 'Availability' && (
        <AvailabilityTab isOwner={isOwner} availabilityRules={availabilityRules} />
      )}
    </div>
  )
}
