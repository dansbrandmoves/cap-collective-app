import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { SLOT_STATES } from '../../utils/availability'

const PRESET_COLORS = ['#22c55e', '#f59e0b', '#6366f1', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16']
const DEFAULT_STATES = ['available', 'hold', 'booked', 'blocked']

function SlotRow({ slot, onEdit, onDelete }) {
  const meta = SLOT_STATES[slot.defaultState]
  return (
    <div className="flex items-center gap-3 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: slot.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200">{slot.name}</p>
        <p className="text-xs text-zinc-500">{slot.startTime} – {slot.endTime} · Default: {meta.label}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onEdit(slot)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-surface-700">Edit</button>
        <button onClick={() => onDelete(slot.id)} className="text-xs text-red-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-surface-700">Remove</button>
      </div>
    </div>
  )
}

export function SlotEditor() {
  const { slots, createSlot, updateSlot, deleteSlot } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [form, setForm] = useState({ name: '', startTime: '08:00', endTime: '12:00', color: '#22c55e', defaultState: 'available' })

  function openCreate() {
    setEditingSlot(null)
    setForm({ name: '', startTime: '08:00', endTime: '12:00', color: '#22c55e', defaultState: 'available' })
    setShowModal(true)
  }

  function openEdit(slot) {
    setEditingSlot(slot)
    setForm({ name: slot.name, startTime: slot.startTime, endTime: slot.endTime, color: slot.color, defaultState: slot.defaultState })
    setShowModal(true)
  }

  function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editingSlot) {
      updateSlot(editingSlot.id, form)
    } else {
      createSlot(form)
    }
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Availability Slots</p>
          <p className="text-xs text-zinc-600 mt-0.5">Define the time blocks you offer for coordination.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={openCreate}>+ Add Slot</Button>
      </div>

      {slots.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-xl p-6 text-center">
          <p className="text-xs text-zinc-600 mb-3">No slots defined.</p>
          <Button size="sm" onClick={openCreate}>Create first slot</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => (
            <SlotRow key={slot.id} slot={slot} onEdit={openEdit} onDelete={deleteSlot} />
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingSlot ? 'Edit Slot' : 'New Slot'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Slot Name</label>
            <input
              type="text"
              placeholder="e.g. Morning, Full Day, Golden Hour..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Time</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Time</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-800' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-6 h-6 rounded-full border-0 bg-transparent cursor-pointer" title="Custom color" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Default State</label>
            <select value={form.defaultState} onChange={e => setForm(f => ({ ...f, defaultState: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent">
              {DEFAULT_STATES.map(s => (
                <option key={s} value={s}>{SLOT_STATES[s].label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim()}>
              {editingSlot ? 'Save Changes' : 'Create Slot'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
