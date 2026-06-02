import { useEffect, useState, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/supabase'
import { optimizeImage } from '../utils/imageOptimizer'

// Reasonable storage caps so the whiteboard can't blow through Supabase storage.
// Images are optimized to ~320KB, so these allow plenty: ~90 imgs/project, ~600/account.
export const PROJECT_IMAGE_LIMIT = 30 * 1024 * 1024   // 30 MB per project
export const ACCOUNT_IMAGE_LIMIT = 200 * 1024 * 1024  // 200 MB per account
const IMG_BUCKET = 'canvas-images'

// One collaborative infinite canvas per project (Supabase `canvas_elements`).
// Everyone on the project can read/write; writes are optimistic and a realtime
// channel keeps every viewer in sync. Drag/resize updates local state on every
// move but only persist on release (persistElement) to avoid write storms.

export function useCanvas(projectId, ownerId) {
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
    const el = elements.find(e => e.id === id)
    setElements(prev => prev.filter(e => e.id !== id))
    localWrites.current.add(id)
    // Free the stored file too so it stops counting against the quota.
    if (el?.type === 'image' && el.src) {
      const path = el.src.split(`/${IMG_BUCKET}/`)[1]
      if (path) supabase.storage.from(IMG_BUCKET).remove([path])
    }
    supabase.from('canvas_elements').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('deleteElement:', error)
      setTimeout(() => localWrites.current.delete(id), 1500)
    })
  }, [])

  // Connector: links two elements with a curved arrow. Recomputes endpoints from
  // the linked elements at render time, so it tracks them as they move.
  const addConnector = useCallback((fromId, toId) => {
    if (!projectId || !fromId || !toId || fromId === toId) return null
    return addElement({
      type: 'connector', from_id: fromId, to_id: toId,
      color: '#94a3b8', w: 0, h: 0, meta: { thickness: 2.5, arrow: 'end' },
    })
  }, [projectId, addElement])

  // Bring an element to front (highest z).
  const bringToFront = useCallback((id) => {
    const maxZ = elements.reduce((m, e) => Math.max(m, e.z || 0), 0)
    persistElement(id, { z: maxZ + 1 })
  }, [elements, persistElement])

  // Optimize → quota-check → upload → add an image element. Returns { ok } or
  // { error } so the UI can show a friendly message. Placed at the given canvas
  // point (its center), sized to ~280px on the longest edge.
  const addImage = useCallback(async (file, { author = null, at = null } = {}) => {
    if (!projectId) return { error: 'No project.' }
    let opt
    try { opt = await optimizeImage(file) } catch (e) { return { error: e?.message || 'Could not read that image.' } }
    const bytes = opt.blob.size

    // Project quota
    const { data: projRows } = await supabase.from('canvas_elements').select('bytes').eq('project_id', projectId)
    const projUsed = (projRows || []).reduce((s, r) => s + (r.bytes || 0), 0)
    if (projUsed + bytes > PROJECT_IMAGE_LIMIT) {
      return { error: 'This project has hit its image storage limit. Delete some images to add more.' }
    }
    // Account quota (best-effort; needs ownerId)
    if (ownerId) {
      const { data: projIds } = await supabase.from('productions').select('id').eq('owner_id', ownerId)
      const ids = (projIds || []).map(p => p.id)
      if (ids.length) {
        const { data: accRows } = await supabase.from('canvas_elements').select('bytes').in('project_id', ids)
        const accUsed = (accRows || []).reduce((s, r) => s + (r.bytes || 0), 0)
        if (accUsed + bytes > ACCOUNT_IMAGE_LIMIT) {
          return { error: 'Your account has hit its image storage limit.' }
        }
      }
    }

    const id = `el-${nanoid(8)}`
    const ext = opt.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${projectId}/${id}.${ext}`
    const { error: upErr } = await supabase.storage.from(IMG_BUCKET).upload(path, opt.blob, { contentType: opt.type, upsert: true })
    if (upErr) return { error: 'Upload failed: ' + upErr.message }
    const { data: pub } = supabase.storage.from(IMG_BUCKET).getPublicUrl(path)

    const fit = 280 / Math.max(opt.width, opt.height)
    const w = Math.max(60, Math.round(opt.width * fit))
    const h = Math.max(60, Math.round(opt.height * fit))
    const el = addElement({
      id, type: 'image', src: pub.publicUrl, bytes, w, h, color: 'transparent',
      x: at ? at.x - w / 2 : 0, y: at ? at.y - h / 2 : 0, author,
    })
    return { ok: true, element: el }
  }, [projectId, ownerId, addElement])

  return { elements, loading, addElement, addImage, addConnector, patchElement, persistElement, deleteElement, bringToFront }
}
