import { useState, useMemo } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { SlotTimeline } from './SlotTimeline'
import { SLOT_STATES, deriveSlotState } from '../../utils/availability'
import { Trash2 } from 'lucide-react'

const STATE_KEYS = ['available', 'hold', 'booked', 'blocked']

const HOUR_OPTIONS = (() => {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const period = h >= 12 ? 'PM' : 'AM'
      opts.push({ val, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}` })
    }
  }
  return opts
})()

const PRESETS = [
  { label: 'Morning / Afternoon', slots: [
    { name: 'Morning', startTime: '08:00', endTime: '12:00', color: '#22c55e', defaultState: 'available' },
    { name: 'Afternoon', startTime: '13:00', endTime: '17:00', color: '#6366f1', defaultState: 'available' },
  ]},
  { label: 'Full Day', slots: [
    { name: 'Full Day', startTime: '08:00', endTime: '17:00', color: '#22c55e', defaultState: 'available' },
  ]},
  { label: 'Split Day', slots: [
    { name: 'Morning', startTime: '08:00', endTime: '12:00', color: '#22c55e', defaultState: 'available' },
    { name: 'Afternoon', startTime: '13:00', endTime: '16:00', color: '#6366f1', defaultState: 'available' },
    { name: 'Evening', startTime: '17:00', endTime: '20:00', color: '#f59e0b', defaultState: 'available' },
  ]},
]

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

export function SlotEditor() {
  const { slots, createSlot, updateSlot, deleteSlot, businessHours, calendarEvents, connectedCalendars, prefixRules } = useApp()

  // Derive today's slot states for live timeline coloring
  const todayStates = useMemo(() => {
    const today = new Date()
    const result = {}
    for (const slot of slots) {
      result[slot.id] = deriveSlotState(today, slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
    }
    return result
  }, [slots, calendarEvents, connectedCalendars, prefixRules, businessHours])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', startTime: '08:00', endTime: '12:00', color: '#22c55e', defaultState: 'available' })

  function startEdit(slot) {
    setEditingId(slot.id)
    setEditForm({ name: slot.name, startTime: slot.startTime, endTime: slot.endTime, color: slot.color, defaultState: slot.defaultState })
    setAdding(false)
  }

  function saveEdit() {
    if (!editForm.name.trim()) return
    updateSlot(editingId, editForm)
    setEditingId(null)
    setEditForm(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  function startAdd() {
    setAdding(true)
    setNewForm({ name: '', startTime: '08:00', endTime: '12:00', color: SLOT_STATES.available.color, defaultState: 'available' })
    setEditingId(null)
  }

  function saveNew() {
    if (!newForm.name.trim()) return
    createSlot(newForm)
    setAdding(false)
  }

  function applyPreset(preset) {
    // Clear existing and add preset slots
    slots.forEach(s => deleteSlot(s.id))
    preset.slots.forEach(s => createSlot(s))
  }

  return (
    <div>
      {/* Timeline visualization */}
      <SlotTimeline slots={slots} businessHours={businessHours} slotStates={todayStates} />

      {/* Slot list */}
      <div className="space-y-1">
        {slots.map(slot => {
          if (editingId === slot.id && editForm) {
            return (
              <div key={slot.id} className="bg-surface-800 border border-accent/30 rounded-lg px-4 py-3 space-y-3">
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-surface-700 border border-surface-600 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  placeholder="Slot name" autoFocus />
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                    className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent">
                    {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                  <span className="text-xs text-zinc-600">–</span>
                  <select value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                    className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent">
                    {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                  <select value={editForm.defaultState} onChange={e => setEditForm(f => ({ ...f, defaultState: e.target.value, color: SLOT_STATES[e.target.value]?.color || f.color }))}
                    className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent">
                    {STATE_KEYS.map(s => <option key={s} value={s}>{SLOT_STATES[s].label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!editForm.name.trim()}>Save</Button>
                  <button onClick={cancelEdit} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
                </div>
              </div>
            )
          }

          return (
            <div key={slot.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-surface-800 transition-colors group/slot">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: todayStates[slot.id] ? (SLOT_STATES[todayStates[slot.id].state]?.color || slot.color) : slot.color }} />
              <span className="text-sm font-medium text-zinc-200 w-28 truncate">{slot.name}</span>
              <span className="text-xs text-zinc-500">{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</span>
              <span className="text-[10px] text-zinc-600 ml-auto">{SLOT_STATES[slot.defaultState]?.label}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover/slot:opacity-100 transition-opacity">
                <button onClick={() => startEdit(slot)} className="text-xs text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-surface-700 transition-colors">Edit</button>
                <button onClick={() => deleteSlot(slot.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-surface-700 transition-colors">
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Add new slot — inline */}
        {adding ? (
          <div className="bg-surface-800 border border-accent/30 rounded-lg px-4 py-3 space-y-3">
            <input type="text" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              placeholder="Slot name (e.g. Morning, Golden Hour...)" autoFocus />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={newForm.startTime} onChange={e => setNewForm(f => ({ ...f, startTime: e.target.value }))}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent">
                {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
              <span className="text-xs text-zinc-600">–</span>
              <select value={newForm.endTime} onChange={e => setNewForm(f => ({ ...f, endTime: e.target.value }))}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent">
                {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNew} disabled={!newForm.name.trim()}>Add Slot</Button>
              <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={startAdd} className="text-xs text-accent hover:text-amber-400 transition-colors px-4 py-2">
            + Add slot
          </button>
        )}
      </div>

      {/* Quick-add presets */}
      {slots.length === 0 && (
        <div className="mt-5 pt-5 border-t border-surface-800">
          <p className="text-xs text-zinc-600 mb-3">Quick start — pick a pattern:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className="text-xs bg-surface-800 border border-surface-700 text-zinc-400 hover:text-zinc-200 hover:border-surface-500 px-3 py-1.5 rounded-lg transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
