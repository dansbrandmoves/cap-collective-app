import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Check, MoreHorizontal, Pencil, Trash2, GripVertical,
  AlignLeft, MessageSquare, UserPlus, Tag, CalendarDays, CheckSquare, Square,
  Paperclip, Link2, ExternalLink, Upload, FileText, CheckCircle2, Circle,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useTaskComments } from '../../hooks/useTaskComments'
import { useTaskAttachments } from '../../hooks/useTaskAttachments'

// Calm, Coordie-forward label palette (teal first).
const LABEL_PALETTE = [
  { color: '#5e9c8c', name: 'Teal' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#ef4444', name: 'Red' },
  { color: '#22c55e', name: 'Green' },
  { color: '#a855f7', name: 'Purple' },
]

// Due-date urgency → chip tone.
function dueMeta(due) {
  if (!due) return null
  const d = new Date(due + 'T00:00:00'); if (isNaN(d)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 86400000)
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { label, tone: days < 0 ? 'overdue' : days <= 2 ? 'soon' : 'normal' }
}
const DUE_TONE = {
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
  soon:    'bg-amber-500/15 text-amber-400 border-amber-500/25',
  normal:  'bg-white/[0.06] text-zinc-300 border-white/[0.1]',
}

// A real board — Trello-style. Horizontally scrolling lists you can add, rename,
// delete, and reorder; cards drag between and within lists with a precise drop
// position; clean card tiles open a rich detail panel (description, members,
// comments). Matches the calendar's visual language. Collaborative + realtime.
export function Board({
  columns = [], tasksByColumn = {}, people = [], projectId, authorName,
  addColumn, renameColumn, deleteColumn, moveColumn,
  addTask, updateTask, moveTask, reorderTask, deleteTask,
  // Display-only mapping for assignee names. The owner assigns themselves as
  // "You" (OWNER_LABEL) — guests should see the owner's real name instead.
  assigneeDisplay = null,
  // Active Supabase client — the guest's scoped client in RoomView, undefined
  // (→ singleton default) for the owner. Threaded to the task-detail hooks.
  db,
}) {
  const [drag, setDrag] = useState(null)         // { type:'card'|'column', id }
  const [overCol, setOverCol] = useState(null)   // column id a card hovers
  const [overIndex, setOverIndex] = useState(null) // insertion index within that column
  const [overColIdx, setOverColIdx] = useState(null) // index a column hovers
  const [openTaskId, setOpenTaskId] = useState(null)

  function onCardDrop(colId) {
    if (drag?.type === 'card') {
      const idx = overIndex == null ? (tasksByColumn[colId]?.length || 0) : overIndex
      reorderTask(drag.id, colId, idx)
    }
    setDrag(null); setOverCol(null); setOverIndex(null)
  }
  function onColumnDrop(targetIdx) {
    if (drag?.type === 'column') moveColumn(drag.id, targetIdx)
    setDrag(null); setOverColIdx(null)
  }

  const mapTask = (t) =>
    assigneeDisplay && t.assignee ? { ...t, assignee: assigneeDisplay(t.assignee) } : t

  const openTask = openTaskId
    ? Object.values(tasksByColumn).flat().find(t => t.id === openTaskId)
    : null

  return (
    <>
      <div className="flex items-start gap-4 overflow-x-auto pb-4 -mx-1 px-1 no-scrollbar">
        {columns.map((col, idx) => (
          <Column
            key={col.id}
            column={col}
            index={idx}
            tasks={(tasksByColumn[col.id] || []).map(mapTask)}
            drag={drag}
            overCol={overCol}
            overIndex={overIndex}
            isColOver={overColIdx === idx}
            setDrag={setDrag}
            setOverCol={setOverCol}
            setOverIndex={setOverIndex}
            setOverColIdx={setOverColIdx}
            onCardDrop={onCardDrop}
            onColumnDrop={onColumnDrop}
            onRename={(title) => renameColumn(col.id, title)}
            onDelete={() => deleteColumn(col.id)}
            onAddTask={(title) => addTask(col.id, title)}
            onOpenTask={setOpenTaskId}
            onToggleComplete={(taskId, completed) => updateTask(taskId, { completed, completed_at: completed ? new Date().toISOString() : null })}
          />
        ))}
        <AddColumn onAdd={addColumn} />
      </div>

      {openTask && (
        <TaskDetailModal
          task={mapTask(openTask)}
          people={people}
          projectId={projectId}
          db={db}
          authorName={authorName}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(updates) => updateTask(openTask.id, updates)}
          onDelete={() => { deleteTask(openTask.id); setOpenTaskId(null) }}
        />
      )}
    </>
  )
}

function Avatar({ name, size = 20 }) {
  if (!name) return null
  return (
    <span className="rounded-full bg-accent/25 text-accent flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }} title={name}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

function Column({
  column, index, tasks, drag, overCol, overIndex, isColOver,
  setDrag, setOverCol, setOverIndex, setOverColIdx, onCardDrop, onColumnDrop,
  onRename, onDelete, onAddTask, onOpenTask, onToggleComplete,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(column.title)
  useEffect(() => { setTitle(column.title) }, [column.title])

  const draggingThisCol = drag?.type === 'column' && drag.id === column.id
  const cardDragActive = drag?.type === 'card'
  const colDragActive = drag?.type === 'column'
  const showLineAt = (i) => cardDragActive && overCol === column.id && overIndex === i

  function commitRename() {
    const v = title.trim()
    if (v && v !== column.title) onRename(v)
    else setTitle(column.title)
    setEditing(false)
  }

  return (
    <div
      onDragOver={(e) => { if (colDragActive) { e.preventDefault(); if (!isColOver) setOverColIdx(index) } }}
      onDrop={(e) => { if (colDragActive) { e.preventDefault(); onColumnDrop(index) } }}
      className={`w-[300px] flex-shrink-0 flex flex-col rounded-2xl bg-surface-900/50 border transition-colors duration-150 ${
        isColOver && colDragActive ? 'border-accent/50' : 'border-white/[0.06]'
      } ${draggingThisCol ? 'opacity-40' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        <button
          draggable
          onDragStart={() => setDrag({ type: 'column', id: column.id })}
          onDragEnd={() => { setDrag(null); setOverColIdx(null) }}
          className="text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing -ml-0.5"
          title="Drag to reorder"
        >
          <GripVertical size={14} strokeWidth={2} />
        </button>
        {editing ? (
          <input
            autoFocus value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setTitle(column.title); setEditing(false) } }}
            className="flex-1 min-w-0 bg-surface-800 border border-accent/50 rounded-md px-2 py-1 text-[13px] font-semibold text-zinc-100 focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)}
            className="flex-1 min-w-0 text-left text-[13px] font-semibold text-zinc-200 truncate px-1 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
            title="Click to rename">
            {column.title}
          </button>
        )}
        <span className="text-[11px] text-zinc-600 tabular-nums flex-shrink-0">{tasks.length}</span>
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen(o => !o)}
            className="text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.05] rounded p-1 transition-colors">
            <MoreHorizontal size={14} strokeWidth={2} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-surface-800 border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 py-1 animate-fadeIn">
                <button onClick={() => { setMenuOpen(false); setEditing(true) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-200 hover:bg-white/[0.05] transition-colors">
                  <Pencil size={12} strokeWidth={1.75} /> Rename
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={12} strokeWidth={1.75} /> Delete list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards + drop target. Card dragover sets a precise insertion index; the
          container fallback drops at the end. */}
      <div
        onDragOver={(e) => { if (cardDragActive) { e.preventDefault(); if (overCol !== column.id || overIndex !== tasks.length) { setOverCol(column.id); setOverIndex(tasks.length) } } }}
        onDrop={(e) => { if (cardDragActive) { e.preventDefault(); onCardDrop(column.id) } }}
        className={`flex-1 px-2.5 pb-1 ${tasks.length === 0 ? 'min-h-[64px]' : 'min-h-[12px]'}`}
      >
        {tasks.map((t, i) => (
          <div key={t.id}>
            <DropLine show={showLineAt(i)} />
            <TaskCard
              task={t}
              dragging={drag?.type === 'card' && drag.id === t.id}
              onDragStart={() => setDrag({ type: 'card', id: t.id })}
              onDragEnd={() => { setDrag(null); setOverCol(null); setOverIndex(null) }}
              onDragOverCard={(e) => {
                if (!cardDragActive) return
                e.preventDefault(); e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const after = e.clientY > rect.top + rect.height / 2
                const idx = i + (after ? 1 : 0)
                if (overCol !== column.id || overIndex !== idx) { setOverCol(column.id); setOverIndex(idx) }
              }}
              onOpen={() => onOpenTask(t.id)}
              onToggleComplete={() => onToggleComplete(t.id, !t.completed)}
            />
          </div>
        ))}
        {/* Empty column: a roomy drop target so you can drop into a column that has
            no cards (the old paper-thin line was nearly impossible to hit). */}
        {tasks.length === 0 ? (
          <div className={`rounded-lg border border-dashed h-14 flex items-center justify-center text-[11px] transition-colors ${
            cardDragActive && overCol === column.id ? 'border-accent/50 bg-accent/[0.05] text-accent' : 'border-white/[0.08] text-zinc-600'
          }`}>
            {cardDragActive ? 'Drop here' : 'No cards yet'}
          </div>
        ) : (
          <DropLine show={showLineAt(tasks.length)} />
        )}
      </div>

      <AddTask onAdd={onAddTask} />
    </div>
  )
}

function DropLine({ show }) {
  return <div className={`h-0.5 rounded-full my-1 transition-colors ${show ? 'bg-accent' : 'bg-transparent'}`} />
}

function TaskCard({ task, dragging, onDragStart, onDragEnd, onDragOverCard, onOpen, onToggleComplete }) {
  const labels = task.labels || []
  const checklist = task.checklist || []
  const checkDone = checklist.filter(i => i.done).length
  const due = dueMeta(task.due_on)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      onClick={onOpen}
      className={`group rounded-xl border bg-surface-800/80 px-3 py-2.5 cursor-pointer transition-all duration-150 shadow-sm shadow-black/5 ${
        dragging ? 'opacity-40 border-accent/40' : 'border-zinc-500/20 hover:border-zinc-500/40'
      }`}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {labels.map((l, i) => (
            <span key={i} className="h-1.5 w-8 rounded-full" style={{ backgroundColor: l.color }} title={l.text || ''} />
          ))}
        </div>
      )}
      {/* Title is flush-left by default; on hover the check slides in and nudges the
          title right (always open once complete). */}
      <div className="flex items-start">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete() }}
          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`mt-[1px] flex-shrink-0 overflow-hidden pr-1.5 transition-all duration-150 ease-out ${
            task.completed ? 'w-[22px] opacity-100' : 'w-0 opacity-0 group-hover:w-[22px] group-hover:opacity-100'
          }`}
        >
          {task.completed
            ? <CheckCircle2 size={16} strokeWidth={2} className="text-green-500" />
            : <Circle size={16} strokeWidth={2} className="text-zinc-500 hover:text-green-500 transition-colors" />}
        </button>
        <p className={`flex-1 text-[13px] leading-snug break-words ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{task.title}</p>
      </div>
      <div className="flex items-center gap-2 mt-2 empty:hidden">
        {task.description && <AlignLeft size={13} strokeWidth={2} className="text-zinc-500" />}
        {due && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${DUE_TONE[due.tone]}`}>
            <CalendarDays size={10} strokeWidth={2} />{due.label}
          </span>
        )}
        {checklist.length > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${checkDone === checklist.length ? 'text-green-400' : 'text-zinc-500'}`}>
            <CheckSquare size={11} strokeWidth={2} />{checkDone}/{checklist.length}
          </span>
        )}
        {task.assignee && <span className="ml-auto"><Avatar name={task.assignee} size={20} /></span>}
      </div>
    </div>
  )
}

function AddTask({ onAdd }) {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')

  function submit(e) {
    e?.preventDefault()
    const v = val.trim()
    if (!v) { setAdding(false); return }
    onAdd(v); setVal('')
  }

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="m-2 mt-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors">
        <Plus size={13} strokeWidth={2} /> Add a card
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="m-2 mt-1">
      <input autoFocus value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        placeholder="Card title…"
        className="w-full bg-surface-800 border border-white/[0.1] rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
      />
    </form>
  )
}

function AddColumn({ onAdd }) {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')

  function submit(e) {
    e?.preventDefault()
    const v = val.trim()
    if (v) onAdd(v)
    setVal(''); setAdding(false)
  }

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="w-[280px] flex-shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-dashed border-white/[0.1] text-[13px] text-zinc-500 hover:text-zinc-200 hover:border-white/20 hover:bg-white/[0.02] transition-colors">
        <Plus size={15} strokeWidth={2} /> Add list
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="w-[300px] flex-shrink-0 rounded-2xl bg-surface-900/50 border border-white/[0.06] p-2.5">
      <input autoFocus value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        placeholder="List title…"
        className="w-full bg-surface-800 border border-white/[0.1] rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
      />
    </form>
  )
}

// ── Card detail (Trello-style): title, description, members, comments/activity ──
function TaskDetailModal({ task, people = [], projectId, authorName, onClose, onUpdate, onDelete, db }) {
  const { items, addComment, deleteComment } = useTaskComments(task.id, projectId, db)
  const { items: attachments, addLink, addFile, removeAttachment } = useTaskAttachments(task.id, projectId, db)
  const [attUrl, setAttUrl] = useState('')
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description || '')
  const [comment, setComment] = useState('')
  const [membersOpen, setMembersOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [labelText, setLabelText] = useState('')
  const [checkInput, setCheckInput] = useState('')

  const labels = task.labels || []
  const checklist = task.checklist || []
  const checkDone = checklist.filter(i => i.done).length

  function addLabel(color) { onUpdate({ labels: [...labels, { color, text: labelText.trim() }] }); setLabelText('') }
  function removeLabel(idx) { onUpdate({ labels: labels.filter((_, i) => i !== idx) }) }
  function setDue(date) { onUpdate({ due_on: date || null }) }
  function addCheckItem(text) { const t = (text || '').trim(); if (!t) return; onUpdate({ checklist: [...checklist, { id: nanoid(6), text: t, done: false }] }) }
  function toggleCheck(id) { onUpdate({ checklist: checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) }) }
  function removeCheck(id) { onUpdate({ checklist: checklist.filter(i => i.id !== id) }) }
  function toggleComplete() { onUpdate({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }) }

  // Minimal card by default: optional sections only render once they have content
  // or you explicitly add them via the "Add to card" row.
  const [shown, setShown] = useState(() => new Set())
  const reveal = (k) => setShown(prev => new Set(prev).add(k))
  const showLabels = labels.length > 0 || shown.has('labels')
  const showDue = !!task.due_on || shown.has('due')
  const showChecklist = checklist.length > 0 || shown.has('checklist')
  const showAttach = attachments.length > 0 || shown.has('attachments')
  const addable = [
    !showLabels && { k: 'labels', icon: Tag, label: 'Labels' },
    !showDue && { k: 'due', icon: CalendarDays, label: 'Dates' },
    !showChecklist && { k: 'checklist', icon: CheckSquare, label: 'Checklist' },
    !showAttach && { k: 'attachments', icon: Paperclip, label: 'Attachment' },
  ].filter(Boolean)

  useEffect(() => { setTitle(task.title); setDesc(task.description || ''); setShown(new Set()) }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function commitTitle() { const v = title.trim(); if (v && v !== task.title) onUpdate({ title: v }); else setTitle(task.title) }
  function commitDesc() { if ((task.description || '') !== desc) onUpdate({ description: desc }) }
  function submitComment(e) {
    e?.preventDefault()
    const v = comment.trim(); if (!v) return
    addComment(v, authorName); setComment('')
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl my-4 bg-surface-900 border border-white/[0.08] rounded-2xl shadow-lift animate-fadeIn">
        {/* Header */}
        <div className="flex items-start gap-2.5 px-5 sm:px-6 py-4 border-b border-white/[0.06]">
          <button onClick={toggleComplete} title={task.completed ? 'Mark incomplete' : 'Mark complete'} className="mt-1 flex-shrink-0">
            {task.completed
              ? <CheckCircle2 size={20} strokeWidth={2} className="text-green-500" />
              : <Circle size={20} strokeWidth={2} className="text-zinc-500 hover:text-green-500 transition-colors" />}
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className={`flex-1 bg-transparent text-[19px] font-semibold tracking-tight focus:outline-none focus:bg-white/[0.03] rounded-md px-1 -mx-1 ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-50'}`}
          />
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors flex-shrink-0">
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid sm:grid-cols-[1fr_300px] gap-0">
          {/* Left: members + description */}
          <div className="px-5 sm:px-6 py-5 space-y-6 sm:border-r border-white/[0.06]">
            {/* Members */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">Members</p>
              <div className="flex items-center gap-2 flex-wrap">
                {task.assignee && (
                  <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25 text-[12px] font-medium">
                    <Avatar name={task.assignee} size={18} /> {task.assignee}
                  </span>
                )}
                <div className="relative">
                  <button onClick={() => setMembersOpen(o => !o)}
                    className="w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-white/20 text-zinc-400 hover:text-zinc-100 hover:border-white/40 transition-colors">
                    <UserPlus size={13} strokeWidth={2} />
                  </button>
                  {membersOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMembersOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-20 w-48 max-h-56 overflow-y-auto no-scrollbar bg-surface-800 border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 py-1 animate-fadeIn">
                        {task.assignee && (
                          <button onClick={() => { onUpdate({ assignee: null }); setMembersOpen(false) }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-white/[0.05] transition-colors">Unassign</button>
                        )}
                        {people.length === 0 && <p className="px-3 py-1.5 text-[12px] text-zinc-600">Add people to the project first.</p>}
                        {people.map(p => (
                          <button key={p.name} onClick={() => { onUpdate({ assignee: p.name }); setMembersOpen(false) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-zinc-200 hover:bg-white/[0.05] transition-colors">
                            <Avatar name={p.name} size={18} /> <span className="truncate">{p.name}</span>
                            {task.assignee === p.name && <Check size={12} strokeWidth={2.5} className="text-accent ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Labels */}
            {showLabels && (
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">Labels</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {labels.map((l, i) => (
                  <span key={i} className="group/lbl inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md text-[12px] font-medium text-white" style={{ backgroundColor: l.color }}>
                    {l.text || '  '}
                    <button onClick={() => removeLabel(i)} className="opacity-70 hover:opacity-100"><X size={11} strokeWidth={2.5} /></button>
                  </span>
                ))}
                <div className="relative">
                  <button onClick={() => setLabelOpen(o => !o)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-dashed border-white/20 text-zinc-400 hover:text-zinc-100 hover:border-white/40 transition-colors">
                    <Tag size={13} strokeWidth={2} />
                  </button>
                  {labelOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setLabelOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-surface-800 border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 p-3 animate-fadeIn">
                        <input value={labelText} onChange={(e) => setLabelText(e.target.value)}
                          placeholder="Label name (optional)"
                          className="w-full mb-2.5 bg-surface-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/50" />
                        <div className="grid grid-cols-6 gap-1.5">
                          {LABEL_PALETTE.map(p => (
                            <button key={p.color} onClick={() => addLabel(p.color)} title={p.name}
                              className="h-7 rounded-md hover:ring-2 hover:ring-white/40 transition-all" style={{ backgroundColor: p.color }} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Due date */}
            {showDue && (
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">Due date</p>
              <div className="flex items-center gap-2">
                <input type="date" value={task.due_on || ''} onChange={(e) => setDue(e.target.value)}
                  className="bg-surface-800/60 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-100 focus:outline-none focus:border-accent/50" />
                {task.due_on && <button onClick={() => setDue(null)} className="text-[12px] text-zinc-500 hover:text-red-400 transition-colors">Clear</button>}
              </div>
            </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft size={14} strokeWidth={2} className="text-zinc-400" />
                <p className="text-[13px] font-semibold text-zinc-200">Description</p>
              </div>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={commitDesc}
                placeholder="Add a more detailed description…"
                className="w-full min-h-[120px] bg-surface-800/60 border border-white/[0.07] rounded-xl px-3 py-2.5 text-[13px] text-zinc-100 placeholder-zinc-600 leading-relaxed resize-y focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Checklist */}
            {showChecklist && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare size={14} strokeWidth={2} className="text-zinc-400" />
                <p className="text-[13px] font-semibold text-zinc-200">Checklist</p>
                {checklist.length > 0 && <span className="text-[11px] text-zinc-500 ml-auto tabular-nums">{checkDone}/{checklist.length}</span>}
              </div>
              {checklist.length > 0 && (
                <div className="h-1 rounded-full bg-white/[0.06] mb-2.5 overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-200" style={{ width: `${Math.round((100 * checkDone) / checklist.length)}%` }} />
                </div>
              )}
              <div className="space-y-1">
                {checklist.map(item => (
                  <div key={item.id} className="group/ck flex items-center gap-2">
                    <button onClick={() => toggleCheck(item.id)} className="flex-shrink-0 text-zinc-400 hover:text-accent transition-colors">
                      {item.done ? <CheckSquare size={15} strokeWidth={2} className="text-accent" /> : <Square size={15} strokeWidth={2} />}
                    </button>
                    <span className={`flex-1 text-[13px] break-words ${item.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{item.text}</span>
                    <button onClick={() => removeCheck(item.id)} className="opacity-0 group-hover/ck:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0"><X size={11} strokeWidth={2} /></button>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addCheckItem(checkInput); setCheckInput('') }} className="mt-2">
                <input value={checkInput} onChange={(e) => setCheckInput(e.target.value)}
                  placeholder="Add an item…"
                  className="w-full bg-surface-800/60 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/50 transition-colors" />
              </form>
            </div>
            )}

            {/* Attachments */}
            {showAttach && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Paperclip size={14} strokeWidth={2} className="text-zinc-400" />
                <p className="text-[13px] font-semibold text-zinc-200">Attachments</p>
              </div>
              <div className="space-y-1.5">
                {attachments.map(a => (
                  <div key={a.id} className="group/at flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-surface-800/40 px-2.5 py-2">
                    <span className="flex-shrink-0 text-zinc-500">
                      {a.kind === 'file' ? <FileText size={14} strokeWidth={2} /> : <Link2 size={14} strokeWidth={2} />}
                    </span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[12px] text-zinc-200 hover:text-accent truncate transition-colors" title={a.name || a.url}>
                      {a.name || a.url}
                    </a>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-zinc-600 hover:text-zinc-200 transition-colors"><ExternalLink size={12} strokeWidth={2} /></a>
                    <button onClick={() => removeAttachment(a)} className="opacity-0 group-hover/at:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0"><X size={12} strokeWidth={2} /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <form onSubmit={(e) => { e.preventDefault(); addLink(attUrl, '', authorName); setAttUrl('') }} className="flex-1">
                  <input value={attUrl} onChange={(e) => setAttUrl(e.target.value)}
                    placeholder="Paste a link…"
                    className="w-full bg-surface-800/60 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/50 transition-colors" />
                </form>
                <label className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.1] text-[12px] text-zinc-300 hover:text-zinc-100 hover:border-white/20 cursor-pointer transition-colors" title="Upload a file">
                  <Upload size={13} strokeWidth={2} /> Upload
                  <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f, authorName); e.target.value = '' }} />
                </label>
              </div>
            </div>
            )}

            {/* Add to card — reveal optional sections on demand (keeps the card minimal) */}
            {addable.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">Add to card</p>
                <div className="flex flex-wrap gap-1.5">
                  {addable.map(a => (
                    <button key={a.k} onClick={() => reveal(a.k)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-800/60 border border-white/[0.07] text-[12px] text-zinc-300 hover:text-zinc-100 hover:border-white/20 transition-colors">
                      <a.icon size={13} strokeWidth={2} /> {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={onDelete}
              className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-red-400 transition-colors">
              <Trash2 size={13} strokeWidth={1.75} /> Delete card
            </button>
          </div>

          {/* Right: comments + activity */}
          <div className="px-5 sm:px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} strokeWidth={2} className="text-zinc-400" />
              <p className="text-[13px] font-semibold text-zinc-200">Comments &amp; activity</p>
            </div>
            <form onSubmit={submitComment} className="mb-4">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
                className="w-full bg-surface-800/60 border border-white/[0.07] rounded-xl px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </form>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar">
              {items.map(c => (
                <div key={c.id} className="group flex gap-2.5">
                  <Avatar name={c.author || '?'} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-zinc-200 truncate">{c.author || 'Someone'}</span>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0">{relTime(c.created_at)}</span>
                      <button onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 ml-auto text-zinc-600 hover:text-red-400 transition-all flex-shrink-0" title="Delete">
                        <X size={11} strokeWidth={2} />
                      </button>
                    </div>
                    <p className="text-[13px] text-zinc-300 leading-snug break-words mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
              {/* synthetic activity line */}
              <div className="flex gap-2.5 pt-1">
                <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Plus size={12} strokeWidth={2} className="text-zinc-500" />
                </span>
                <p className="text-[12px] text-zinc-500 leading-snug">Card created <span className="text-zinc-600">· {relTime(task.created_at)}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(d)) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}
