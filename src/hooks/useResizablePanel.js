import { useState, useCallback, useRef, useEffect } from 'react'

// Collapsible + drag-resizable side panel state, persisted per key in localStorage.
// Desktop only — callers keep their mobile drawer behavior untouched.
//
//   const p = useResizablePanel('coordie-nav', { defaultWidth: 224, min: 180, max: 360 })
//   <aside style={{ width: p.collapsed ? RAIL : p.width }}>
//   <ResizeHandle onPointerDown={p.startDrag} side="right" />   // edge being dragged
//
// side: which edge the drag handle sits on. 'right' = panel grows when dragged
// rightward (left-docked panels); 'left' = grows when dragged leftward.
export function useResizablePanel(key, { defaultWidth = 224, min = 180, max = 380, side = 'right' } = {}) {
  const widthKey = `${key}-w`
  const collapsedKey = `${key}-collapsed`

  const [width, setWidth] = useState(() => {
    try { const v = parseInt(localStorage.getItem(widthKey), 10); if (v >= min && v <= max) return v } catch { /* */ }
    return defaultWidth
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(collapsedKey) === '1' } catch { return false }
  })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => { try { localStorage.setItem(widthKey, String(width)) } catch { /* */ } }, [width, widthKey])
  useEffect(() => { try { localStorage.setItem(collapsedKey, collapsed ? '1' : '0') } catch { /* */ } }, [collapsed, collapsedKey])

  const startDrag = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: width }
    setDragging(true)
  }, [width])

  useEffect(() => {
    if (!dragging) return
    function onMove(e) {
      const d = dragRef.current
      if (!d) return
      const delta = side === 'right' ? e.clientX - d.startX : d.startX - e.clientX
      const next = Math.min(max, Math.max(min, d.startW + delta))
      setWidth(next)
    }
    function onUp() { setDragging(false); dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    // Prevent text selection / cursor flicker while dragging.
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [dragging, side, min, max])

  const toggle = useCallback(() => setCollapsed(c => !c), [])
  const reset = useCallback(() => setWidth(defaultWidth), [defaultWidth])

  return { width, collapsed, dragging, startDrag, toggle, reset, setCollapsed }
}

// Thin draggable handle that sits on a panel's resize edge. `side` matches the hook.
export function ResizeHandle({ onPointerDown, onDoubleClick, side = 'right', dragging }) {
  const edge = side === 'right' ? 'right-0' : 'left-0'
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title="Drag to resize · double-click to reset"
      className={`hidden md:block absolute top-0 ${edge} h-full w-1.5 cursor-col-resize z-20 group`}
      style={{ transform: side === 'right' ? 'translateX(50%)' : 'translateX(-50%)' }}
    >
      <div className={`mx-auto h-full w-px transition-colors ${dragging ? 'bg-accent/70' : 'bg-transparent group-hover:bg-accent/40'}`} />
    </div>
  )
}
