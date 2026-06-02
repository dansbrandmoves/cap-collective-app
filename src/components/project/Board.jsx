import { useState, useRef, useEffect } from 'react'
import { Plus, X, Check, UserPlus, MoreHorizontal, Pencil, Trash2, GripVertical } from 'lucide-react'

// A real board — Trello-style. Horizontally scrolling columns you can add, rename,
// delete, and reorder; cards drag between columns and carry an optional assignee
// from the project's people. Matches the calendar's visual language (teal accents,
// surface cards, calm borders). No decorative backgrounds — just the work.
export function Board({
  columns = [], tasksByColumn = {}, people = [],
  addColumn, renameColumn, deleteColumn, moveColumn,
  addTask, updateTask, moveTask, deleteTask,
}) {
  // drag = { type: 'card' | 'column', id }
  const [drag, setDrag] = useState(null)
  const [overCol, setOverCol] = useState(null)      // column id a card is hovering
  const [overColIdx, setOverColIdx] = useState(null) // index a column is hovering

  function onCardDrop(colId) {
    if (drag?.type === 'card') moveTask(drag.id, colId)
    setDrag(null); setOverCol(null)
  }
  function onColumnDrop(targetIdx) {
    if (drag?.type === 'column') moveColumn(drag.id, targetIdx)
    setDrag(null); setOverColIdx(null)
  }

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4 -mx-1 px-1 no-scrollbar">
      {columns.map((col, idx) => (
        <Column
          key={col.id}
          column={col}
          index={idx}
          tasks={tasksByColumn[col.id] || []}
          people={people}
          drag={drag}
          isCardOver={overCol === col.id}
          isColOver={overColIdx === idx}
          setDrag={setDrag}
          setOverCol={setOverCol}
          setOverColIdx={setOverColIdx}
          onCardDrop={onCardDrop}
          onColumnDrop={onColumnDrop}
          onRename={(title) => renameColumn(col.id, title)}
          onDelete={() => deleteColumn(col.id)}
          onAddTask={(title) => addTask(col.id, title)}
          updateTask={updateTask}
          deleteTask={deleteTask}
        />
      ))}
      <AddColumn onAdd={addColumn} />
    </div>
  )
}

function Column({
  column, index, tasks, people, drag, isCardOver, isColOver,
  setDrag, setOverCol, setOverColIdx, onCardDrop, onColumnDrop,
  onRename, onDelete, onAddTask, updateTask, deleteTask,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(column.title)
  useEffect(() => { setTitle(column.title) }, [column.title])

  const draggingThisCol = drag?.type === 'column' && drag.id === column.id
  const cardDragActive = drag?.type === 'card'
  const colDragActive = drag?.type === 'column'

  function commitRename() {
    const v = title.trim()
    if (v && v !== column.title) onRename(v)
    else setTitle(column.title)
    setEditing(false)
  }

  return (
    <div
      // Column-reorder drop target (active only while dragging a column)
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
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setTitle(column.title); setEditing(false) } }}
            className="flex-1 min-w-0 bg-surface-800 border border-accent/50 rounded-md px-2 py-1 text-[13px] font-semibold text-zinc-100 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 min-w-0 text-left text-[13px] font-semibold text-zinc-200 truncate px-1 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
            title="Click to rename"
          >
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

      {/* Cards + card-drop target */}
      <div
        onDragOver={(e) => { if (cardDragActive) { e.preventDefault(); if (!isCardOver) setOverCol(column.id) } }}
        onDragLeave={(e) => { if (cardDragActive && !e.currentTarget.contains(e.relatedTarget)) setOverCol(null) }}
        onDrop={(e) => { if (cardDragActive) { e.preventDefault(); onCardDrop(column.id) } }}
        className={`flex-1 min-h-[12px] px-2.5 pb-1 space-y-2 rounded-xl transition-colors ${
          isCardOver && cardDragActive ? 'bg-accent/[0.05]' : ''
        }`}
      >
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            people={people}
            dragging={drag?.type === 'card' && drag.id === t.id}
            onDragStart={() => setDrag({ type: 'card', id: t.id })}
            onDragEnd={() => { setDrag(null); setOverCol(null) }}
            onAssign={(name) => updateTask(t.id, { assignee: name })}
            onDelete={() => deleteTask(t.id)}
          />
        ))}
      </div>

      <AddTask onAdd={onAddTask} />
    </div>
  )
}

function TaskCard({ task, people, dragging, onDragStart, onDragEnd, onAssign, onDelete }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border bg-surface-800/80 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
        dragging ? 'opacity-40 border-accent/40' : 'border-white/[0.07] hover:border-white/[0.16]'
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[13px] leading-snug text-zinc-100 break-words">{task.title}</p>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0 -mr-0.5 -mt-0.5"
          title="Delete card"
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
        className="m-2 mt-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
      >
        <Plus size={13} strokeWidth={2} /> Add a card
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="m-2 mt-1">
      <input
        autoFocus
        value={val}
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
    setVal('')
    setAdding(false)
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="w-[280px] flex-shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-dashed border-white/[0.1] text-[13px] text-zinc-500 hover:text-zinc-200 hover:border-white/20 hover:bg-white/[0.02] transition-colors"
      >
        <Plus size={15} strokeWidth={2} /> Add list
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="w-[300px] flex-shrink-0 rounded-2xl bg-surface-900/50 border border-white/[0.06] p-2.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        placeholder="List title…"
        className="w-full bg-surface-800 border border-white/[0.1] rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
      />
    </form>
  )
}
