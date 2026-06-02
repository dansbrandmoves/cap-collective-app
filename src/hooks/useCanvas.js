import { useEffect, useState, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'

// One collaborative infinite canvas per project (Supabase `canvas_elements`).
// Everyone on the project can read/write; writes are optimistic and a realtime
// channel keeps every viewer in sync. Drag/resize updates local state on every
// move but only persist on release (persistElement) to avoid write storms.

export function useCanvas(projectId) {
  const [elements, setElements] = useState([])
  const [loading, setLoading] = useState(true)
  // Skip echoing our own just-written rows back over realtime (avoids flicker).
  const localWrites = useRef(new Set())

  const load = useCallback(async () => {
    if (!projectId) return
    const { data } = await supabase.from('canvas_elements').select('*').eq('project_id', projectId).order('z')
    setElements(data || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectId) { setElements([]); setLoading(false); return }
    setLoading(true)
    load()
    const channel = supabase
      .channel(`canvas-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'canvas_elements', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new?.id ? payload.new : payload.old
          if (row && localWrites.current.has(row.id)) return // our own write
          load()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, load])

  // Add a new element. Returns the created element (so the caller can select it).
  const addElement = useCallback((partial) => {
    if (!projectId) return null
    const maxZ = elements.reduce((m, e) => Math.max(m, e.z || 0), 0)
    const el = {
      id: `el-${nanoid(8)}`, project_id: projectId,
      type: 'sticky', x: 0, y: 0, w: 160, h: 120, z: maxZ + 1,
      text: '', color: '#fde68a', font: null, author: null,
      created_at: new Date().toISOString(),
      ...partial,
    }
    setElements(prev => [...prev, el])
    localWrites.current.add(el.id)
    supabase.from('canvas_elements').insert(el).then(({ error }) => {
      if (error) console.error('addElement:', error)
      setTimeout(() => localWrites.current.delete(el.id), 1500)
    })
    return el
  }, [projectId, elements])

  // Update local state immediately (for live drag); does NOT persist.
  const patchElement = useCallback((id, updates) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])

  // Persist the given fields for an element (call on drag/resize end or edit blur).
  const persistElement = useCallback((id, updates) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    localWrites.current.add(id)
    supabase.from('canvas_elements').update(updates).eq('id', id).then(({ error }) => {
      if (error) console.error('persistElement:', error)
      setTimeout(() => localWrites.current.delete(id), 1500)
    })
  }, [])

  const deleteElement = useCallback((id) => {
    setElements(prev => prev.filter(e => e.id !== id))
    localWrites.current.add(id)
    supabase.from('canvas_elements').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('deleteElement:', error)
      setTimeout(() => localWrites.current.delete(id), 1500)
    })
  }, [])

  // Bring an element to front (highest z).
  const bringToFront = useCallback((id) => {
    const maxZ = elements.reduce((m, e) => Math.max(m, e.z || 0), 0)
    persistElement(id, { z: maxZ + 1 })
  }, [elements, persistElement])

  return { elements, loading, addElement, patchElement, persistElement, deleteElement, bringToFront }
}
