import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'

// One collaborative board per project (Supabase `board_columns` + `tasks`).
// Everyone on the project — owner and group members — can read and edit, so all
// writes are optimistic and a realtime channel keeps every viewer in sync.

// Columns a brand-new board starts with. Deterministic IDs (per project) make the
// seed idempotent: if two people open an empty board at once, the upsert collides
// on the primary key instead of creating duplicates.
const DEFAULT_COLUMNS = [
  { key: 'todo', title: 'To do' },
  { key: 'doing', title: 'Doing' },
  { key: 'done', title: 'Done' },
]

export function useBoard(projectId) {
  const [columns, setColumns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const seededRef = useRef(false)

  // Fetch columns + tasks, seeding defaults the first time a project's board is empty.
  const load = useCallback(async () => {
    if (!projectId) return
    const [{ data: cols }, { data: tks }] = await Promise.all([
      supabase.from('board_columns').select('*').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('position'),
    ])
    let nextCols = cols || []
    if (nextCols.length === 0 && !seededRef.current) {
      seededRef.current = true
      const seed = DEFAULT_COLUMNS.map((c, i) => ({
        id: `col-${projectId}-${c.key}`, project_id: projectId, title: c.title,
        position: i + 1, created_at: new Date().toISOString(),
      }))
      // Ignore conflicts so a concurrent opener doesn't error out.
      await supabase.from('board_columns').upsert(seed, { onConflict: 'id', ignoreDuplicates: true })
      const { data: reCols } = await supabase.from('board_columns').select('*').eq('project_id', projectId).order('position')
      nextCols = reCols || seed
    }
    setColumns(nextCols)
    setTasks(tks || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectId) { setColumns([]); setTasks([]); setLoading(false); return }
    setLoading(true)
    load()
    // Live collaboration: any change to this project's columns/tasks refetches.
    const channel = supabase
      .channel(`board-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_columns', filter: `project_id=eq.${projectId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, load])

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  )

  // Tasks grouped by column_id, each list ordered by position.
  const tasksByColumn = useMemo(() => {
    const map = {}
    for (const c of columns) map[c.id] = []
    for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
      const key = t.column_id
      if (!map[key]) map[key] = []
      map[key].push(t)
    }
    return map
  }, [columns, tasks])

  // ── Column ops ──
  const addColumn = useCallback((title) => {
    const trimmed = (title || '').trim()
    if (!trimmed || !projectId) return
    const maxPos = columns.reduce((m, c) => Math.max(m, c.position), 0)
    const col = {
      id: `col-${nanoid(8)}`, project_id: projectId, title: trimmed,
      position: maxPos + 1, created_at: new Date().toISOString(),
    }
    setColumns(prev => [...prev, col])
    supabase.from('board_columns').insert(col).then(({ error }) => { if (error) console.error('addColumn:', error) })
  }, [projectId, columns])

  const renameColumn = useCallback((id, title) => {
    const trimmed = (title || '').trim()
    if (!trimmed) return
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c))
    supabase.from('board_columns').update({ title: trimmed }).eq('id', id)
      .then(({ error }) => { if (error) console.error('renameColumn:', error) })
  }, [])

  const deleteColumn = useCallback((id) => {
    // Deleting a column removes its cards too.
    setColumns(prev => prev.filter(c => c.id !== id))
    setTasks(prev => prev.filter(t => t.column_id !== id))
    supabase.from('tasks').delete().eq('column_id', id).then(() => {
      supabase.from('board_columns').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('deleteColumn:', error) })
    })
  }, [])

  // Reorder columns: place `id` at the target index among siblings.
  const moveColumn = useCallback((id, targetIndex) => {
    const ordered = [...columns].sort((a, b) => a.position - b.position)
    const from = ordered.findIndex(c => c.id === id)
    if (from === -1) return
    const [moved] = ordered.splice(from, 1)
    ordered.splice(Math.max(0, Math.min(targetIndex, ordered.length)), 0, moved)
    const repositioned = ordered.map((c, i) => ({ ...c, position: i + 1 }))
    setColumns(repositioned)
    repositioned.forEach(c => {
      supabase.from('board_columns').update({ position: c.position }).eq('id', c.id)
        .then(({ error }) => { if (error) console.error('moveColumn:', error) })
    })
  }, [columns])

  // ── Task ops ──
  const addTask = useCallback((columnId, title, assignee = null) => {
    const trimmed = (title || '').trim()
    if (!trimmed || !projectId || !columnId) return
    const maxPos = tasks.filter(t => t.column_id === columnId).reduce((m, t) => Math.max(m, t.position), 0)
    const task = {
      id: `task-${nanoid(8)}`, project_id: projectId, column_id: columnId, title: trimmed,
      assignee: assignee || null, position: maxPos + 1, created_at: new Date().toISOString(),
    }
    setTasks(prev => [...prev, task])
    supabase.from('tasks').insert(task).then(({ error }) => { if (error) console.error('addTask:', error) })
  }, [projectId, tasks])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    supabase.from('tasks').update(updates).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateTask:', error) })
  }, [])

  // Move a task into a column, appended to the end of that column.
  const moveTask = useCallback((id, columnId) => {
    const maxPos = tasks.filter(t => t.column_id === columnId && t.id !== id).reduce((m, t) => Math.max(m, t.position), 0)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, column_id: columnId, position: maxPos + 1 } : t))
    supabase.from('tasks').update({ column_id: columnId, position: maxPos + 1 }).eq('id', id)
      .then(({ error }) => { if (error) console.error('moveTask:', error) })
  }, [tasks])

  // Reorder: drop `id` into `columnId` at `targetIndex` (Trello-style precise drop).
  // Renumbers the affected column and persists only the rows whose position changed.
  const reorderTask = useCallback((id, columnId, targetIndex) => {
    setTasks(prev => {
      const moving = prev.find(t => t.id === id)
      if (!moving) return prev
      const col = prev
        .filter(t => t.column_id === columnId && t.id !== id)
        .sort((a, b) => a.position - b.position)
      const idx = Math.max(0, Math.min(targetIndex, col.length))
      col.splice(idx, 0, { ...moving, column_id: columnId })
      const repositioned = new Map(col.map((t, i) => [t.id, i + 1]))
      // Persist every row in the target column whose (column_id, position) changed.
      col.forEach(t => {
        const newPos = repositioned.get(t.id)
        const old = prev.find(p => p.id === t.id)
        if (!old || old.position !== newPos || old.column_id !== columnId) {
          supabase.from('tasks').update({ column_id: columnId, position: newPos }).eq('id', t.id)
            .then(({ error }) => { if (error) console.error('reorderTask:', error) })
        }
      })
      return prev.map(t => repositioned.has(t.id) ? { ...t, column_id: columnId, position: repositioned.get(t.id) } : t)
    })
  }, [])

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    supabase.from('tasks').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteTask:', error) })
  }, [])

  return {
    columns: sortedColumns, tasks, tasksByColumn, loading,
    addColumn, renameColumn, deleteColumn, moveColumn,
    addTask, updateTask, moveTask, reorderTask, deleteTask,
  }
}
