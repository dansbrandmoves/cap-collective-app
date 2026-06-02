import { useEffect, useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'

// Comments + activity for a single task card. Realtime so everyone on the
// project sees new comments live. `kind` is 'comment' (people) or 'activity'
// (system lines like "added this card").
export function useTaskComments(taskId, projectId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!taskId) return
    supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at')
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [taskId])

  useEffect(() => {
    if (!taskId) { setItems([]); setLoading(false); return }
    setLoading(true)
    load()
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId, load])

  const addComment = useCallback((text, author) => {
    const trimmed = (text || '').trim()
    if (!trimmed || !taskId) return
    const row = {
      id: `cmt-${nanoid(8)}`, task_id: taskId, project_id: projectId || null,
      author: author || null, text: trimmed, kind: 'comment',
      created_at: new Date().toISOString(),
    }
    setItems(prev => [...prev, row])
    supabase.from('task_comments').insert(row).then(({ error }) => { if (error) console.error('addComment:', error) })
  }, [taskId, projectId])

  const deleteComment = useCallback((id) => {
    setItems(prev => prev.filter(c => c.id !== id))
    supabase.from('task_comments').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteComment:', error) })
  }, [])

  return { items, loading, addComment, deleteComment }
}
