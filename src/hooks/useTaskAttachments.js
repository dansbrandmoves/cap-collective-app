import { useEffect, useState, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'

const BUCKET = 'task-attachments'

// Attachments for a single card: links (any URL incl. Google Drive share links)
// and uploaded files (public bucket). Realtime so collaborators see them live.
export function useTaskAttachments(taskId, projectId, db = supabase) {
  const clientRef = useRef(db); clientRef.current = db
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!taskId) return
    clientRef.current.from('task_attachments').select('*').eq('task_id', taskId).order('created_at')
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [taskId, db])

  useEffect(() => {
    if (!taskId) { setItems([]); setLoading(false); return }
    setLoading(true)
    load()
    const channel = supabase
      .channel(`task-attachments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${taskId}` }, load)
      .subscribe()
    return () => { clientRef.current.removeChannel(channel) }
  }, [taskId, load])

  const insertRow = useCallback((row) => {
    const full = { id: `att-${nanoid(8)}`, task_id: taskId, project_id: projectId || null, created_at: new Date().toISOString(), ...row }
    setItems(prev => [...prev, full])
    clientRef.current.from('task_attachments').insert(full).then(({ error }) => { if (error) console.error('addAttachment:', error) })
    return full
  }, [taskId, projectId])

  // Paste any URL (Google Drive share link, Figma, doc, etc.).
  const addLink = useCallback((url, name, author) => {
    const u = (url || '').trim()
    if (!u) return
    const isDrive = /drive\.google\.com|docs\.google\.com/.test(u)
    insertRow({ kind: isDrive ? 'drive' : 'link', url: u, name: (name || '').trim() || u, author: author || null })
  }, [insertRow])

  // Upload a file to the public bucket, then record it.
  const addFile = useCallback(async (file, author) => {
    if (!file || !taskId) return
    const path = `${taskId}/${nanoid(8)}-${file.name}`
    const { error } = await clientRef.current.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (error) { console.error('upload attachment:', error); return }
    const { data } = clientRef.current.storage.from(BUCKET).getPublicUrl(path)
    insertRow({ kind: 'file', url: data.publicUrl, name: file.name, author: author || null })
  }, [taskId, insertRow])

  const removeAttachment = useCallback((att) => {
    setItems(prev => prev.filter(a => a.id !== att.id))
    // Best-effort: free the storage file for uploads (row delete is the source of truth).
    if (att.kind === 'file' && att.url) {
      const marker = `/${BUCKET}/`
      const i = att.url.indexOf(marker)
      if (i !== -1) clientRef.current.storage.from(BUCKET).remove([att.url.slice(i + marker.length)]).catch(() => {})
    }
    clientRef.current.from('task_attachments').delete().eq('id', att.id)
      .then(({ error }) => { if (error) console.error('removeAttachment:', error) })
  }, [])

  return { items, loading, addLink, addFile, removeAttachment }
}
