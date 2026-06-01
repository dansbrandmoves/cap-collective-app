import { useEffect, useState, useCallback, useMemo } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'

// Owner-only "light tasks" — a simple kanban per project (Supabase `tasks` table).
// Optimistic local state; RLS scopes rows to the project owner.

export const TASK_COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

export function useProjectTasks(projectId) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) { setTasks([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase.from('tasks').select('*').eq('project_id', projectId).order('position')
      .then(({ data }) => { if (!cancelled) { setTasks(data || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [projectId])

  // Tasks grouped by column, ordered by position.
  const byColumn = useMemo(() => {
    const map = { todo: [], doing: [], done: [] }
    for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
      (map[t.status] || map.todo).push(t)
    }
    return map
  }, [tasks])

  const addTask = useCallback((title, status = 'todo', assignee = null) => {
    const trimmed = (title || '').trim()
    if (!trimmed || !projectId) return
    // Append to the end of its column.
    const maxPos = tasks.filter(t => t.status === status).reduce((m, t) => Math.max(m, t.position), 0)
    const task = {
      id: `task-${nanoid(8)}`, project_id: projectId, title: trimmed,
      status, assignee: assignee || null, position: maxPos + 1,
      created_at: new Date().toISOString(),
    }
    setTasks(prev => [...prev, task])
    supabase.from('tasks').insert(task).then(({ error }) => { if (error) console.error('addTask:', error) })
  }, [projectId, tasks])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    supabase.from('tasks').update(updates).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateTask:', error) })
  }, [])

  // Move a task to a column, appended to the end of that column.
  const moveTask = useCallback((id, status) => {
    const maxPos = tasks.filter(t => t.status === status && t.id !== id).reduce((m, t) => Math.max(m, t.position), 0)
    updateTask(id, { status, position: maxPos + 1 })
  }, [tasks, updateTask])

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    supabase.from('tasks').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteTask:', error) })
  }, [])

  return { tasks, byColumn, loading, addTask, updateTask, moveTask, deleteTask }
}
