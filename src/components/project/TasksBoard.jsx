import { useState } from 'react'
import { Plus, X, Check, UserPlus } from 'lucide-react'
import { TASK_COLUMNS } from '../../hooks/useProjectTasks'

// A simple, pretty kanban — three columns, drag cards between them, optional
// assignee from the project roster. Matches the calendar's visual language
// (teal accents, surface cards, rounded-2xl, calm borders). Owner-only.
export function TasksBoard({ byColumn, people = [], addTask, updateTask, moveTask, deleteTask }) {
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
      {TASK_COLUMNS.map(col => {
        const items = byColumn[col.key] || []
        const isOver = overCol === col.key
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(c => (c === col.key ? null : c)) }}
            onDrop={(e) => { e.preventDefault(); if (dragId) moveTask(dragId, col.key); setDragId(null); setOverCol(null) }}
            className={`rounded-2xl border p-3 transition-colors duration-150 ${
              isOver ? 'border-accent/45 bg-accent/[0.05]' : 'border-white/[0.06] bg-surface-900/40'
            }`}
          >
            <div className="flex items-center justify-between px-1.5 mb-3">
              <span className="text-[12px] font-semibold text-zinc-300 uppercase tracking-[0.08em]">{col.label}</span>
              <span className="text-[11px] text-zinc-600 tabular-nums">{items.length}</span>
            </div>

            <div className="space-y-2 min-h-[8px]">
              {items.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  people={people}
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null) }}
                  onAssign={(name) => updateTask(t.id, { assignee: name })}
                  onDelete={() => deleteTask(t.id)}
                  done={col.key === 'done'}
                />
              ))}
            </div>

            <AddTask onAdd={(title) => addTask(title, col.key)} />
          </div>
        )
      })}
    </div>
  )
}

function TaskCard({ task, people, dragging, onDragStart, onDragEnd, onAssign, onDelete, done }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border bg-surface-800/70 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
        dragging ? 'opacity-40 border-accent/40' : 'border-white/[0.07] hover:border-white/[0.16]'
      }`}
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-[13px] leading-snug ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
          {task.title}
        </p>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0 -mr-0.5 -mt-0.5"
          title="Delete task"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
      <div className="mt-2">
        <AssigneePicker current={task.assignee} people={people} onAssign={onAssign} />
      </div>
    </div>
  )
}

function AssigneePicker({ current, people, onAssign }) {
  const [open, setOpen] = useState(false)
  const names = people.map(p => p.name)
  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium transition-colors ${
          current
            ? 'pl-1 pr-2 py-0.5 bg-accent/15 text-accent border border-accent/25'
            : 'px-2 py-0.5 text-zinc-500 border border-dashed border-white/15 hover:text-zinc-300 hover:border-white/25'
        }`}
      >
        {current ? (
          <>
            <span className="w-4 h-4 rounded-full bg-accent/25 text-accent flex items-center justify-center text-[9px] font-bold">
              {current[0]?.toUpperCase()}
            </span>
            {current}
          </>
        ) : (
          <><UserPlus size={11} strokeWidth={2} /> Assign</>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-44 max-h-56 overflow-y-auto no-scrollbar bg-surface-800 border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 py-1 animate-fadeIn">
            {current && (
              <button onClick={() => { onAssign(null); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-white/[0.05] transition-colors">
                Unassign
              </button>
            )}
            {names.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-zinc-600">Add people to the project first.</p>
            )}
            {names.map(name => (
              <button key={name} onClick={() => { onAssign(name); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-zinc-200 hover:bg-white/[0.05] transition-colors">
                <span className="w-4 h-4 rounded-full bg-white/[0.06] text-zinc-300 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                  {name[0]?.toUpperCase()}
                </span>
                <span className="truncate">{name}</span>
                {current === name && <Check size={12} strokeWidth={2.5} className="text-accent ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
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
    onAdd(v)
    setVal('')
    // keep open for rapid entry
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="mt-2 w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
      >
        <Plus size={13} strokeWidth={2} /> Add a task
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="mt-2">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        placeholder="Task…"
        className="w-full bg-surface-800 border border-white/[0.1] rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
      />
    </form>
  )
}
