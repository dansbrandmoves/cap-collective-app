import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  MousePointer2, StickyNote, Square, Circle, Type, MessageSquare,
  Grid3x3, Minus, Plus, Maximize, Trash2, Image as ImageIcon, Loader2,
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'

// A slimmed-down infinite canvas (think Miro, minus the bloat). Pan by dragging
// empty space, zoom with the wheel or the toolbar, drop stickies / shapes / text /
// comment pins, toggle a dot grid, and "Fit" to frame everything. Collaborative +
// realtime via useCanvas. Built from scratch — no canvas library dependency.

const GRID = 24 // canvas units between grid dots

// Curated, Google-Fonts-friendly type choices. Inter ships with the app; the rest
// are injected on mount.
const FONTS = [
  { label: 'Sans', css: 'Inter' },
  { label: 'Hand', css: 'Caveat' },
  { label: 'Marker', css: 'Permanent Marker' },
  { label: 'Serif', css: 'Playfair Display' },
  { label: 'Mono', css: 'Roboto Mono' },
  { label: 'Casual', css: 'Architects Daughter' },
]

// Sticky / shape colors — bright on the dark canvas, on-brand.
const COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#e5e7eb', '#5e9c8c']

const TOOLS = [
  { key: 'select', icon: MousePointer2, label: 'Select' },
  { key: 'sticky', icon: StickyNote, label: 'Sticky note' },
  { key: 'rect', icon: Square, label: 'Rectangle' },
  { key: 'circle', icon: Circle, label: 'Circle' },
  { key: 'text', icon: Type, label: 'Text' },
  { key: 'comment', icon: MessageSquare, label: 'Comment' },
]

const DEFAULTS = {
  sticky:  { w: 180, h: 180, color: '#fde68a', font: 'Caveat', text: '' },
  rect:    { w: 220, h: 130, color: '#bfdbfe', font: 'Inter', text: '' },
  circle:  { w: 150, h: 150, color: '#bbf7d0', font: 'Inter', text: '' },
  text:    { w: 240, h: 56,  color: '#e5e7eb', font: 'Inter', text: 'Text' },
  comment: { w: 28,  h: 28,  color: '#5e9c8c', font: 'Inter', text: '' },
}

// ── Connector geometry ──
// Snap an endpoint to one of the box's FOUR side dots (the same N/E/S/W handles
// shown on selection), choosing the side that best faces the target. Anchoring to
// these fixed points "grounds" the line so its ends never slide along an edge.
function anchorWithSide(b, tx, ty) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const dx = tx - cx, dy = ty - cy
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { x: b.x + b.w, y: cy, side: 'right' } : { x: b.x, y: cy, side: 'left' }
  }
  return dy >= 0 ? { x: cx, y: b.y + b.h, side: 'bottom' } : { x: cx, y: b.y, side: 'top' }
}

function sideNormal(side) {
  return side === 'right' ? { x: 1, y: 0 } : side === 'left' ? { x: -1, y: 0 }
    : side === 'top' ? { x: 0, y: -1 } : side === 'bottom' ? { x: 0, y: 1 } : { x: 0, y: 0 }
}

// Cubic bezier that leaves each anchor perpendicular to its side, so the curve grows
// straight out of the dot (Miro-like) instead of cutting across the corner.
function curveAnchored(p1, side1, p2, side2) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const k = Math.max(38, dist * 0.4)
  const n1 = sideNormal(side1), n2 = sideNormal(side2)
  const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k }
  const c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k }
  return { d: `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`, c1, c2 }
}

// Arrowhead polygon points string at `tip`, pointing along `angle`.
function arrowHead(tip, angle, size = 11, width = 7) {
  const back = { x: tip.x - size * Math.cos(angle), y: tip.y - size * Math.sin(angle) }
  const left = { x: back.x - width * Math.sin(angle), y: back.y + width * Math.cos(angle) }
  const right = { x: back.x + width * Math.sin(angle), y: back.y - width * Math.cos(angle) }
  return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
}

// Compact timestamp for comment notes — "2:45 PM" today, else "Jun 1, 2:45 PM".
function formatStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

let fontsInjected = false
function injectFonts() {
  if (fontsInjected || typeof document === 'undefined') return
  fontsInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@400;700&family=Permanent+Marker&family=Playfair+Display:wght@400;700&family=Roboto+Mono&display=swap'
  document.head.appendChild(link)
}

export function Whiteboard({ canvas, authorName }) {
  const { theme } = useApp()
  const isLight = theme === 'light'
  const dotColor = isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.10)'
  const { elements, addElement, addImage, addConnector, patchElement, persistElement, deleteElement, bringToFront } = canvas
  const [tool, setTool] = useState('select')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [linkFrom, setLinkFrom] = useState(null)  // element id we're dragging a connector from
  const [linkPoint, setLinkPoint] = useState(null) // current cursor in canvas coords while linking
  const viewportRef = useRef(null)
  const fileRef = useRef(null)
  const drag = useRef(null) // { mode:'pan'|'move'|'resize'|'link'|'pinch', ... }
  const pointers = useRef(new Map()) // active touch/pen pointers on the canvas (for pinch)
  const pinchRef = useRef(null)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => { injectFonts() }, [])

  // Zoom toward a viewport point, reading current pan/zoom from refs so it can run
  // inside long-lived pointer listeners (pinch) without stale-closure issues.
  const applyZoom = useCallback((nextZoom, px, py) => {
    const z = Math.min(3, Math.max(0.2, nextZoom))
    const cp = panRef.current, cz = zoomRef.current
    const canvasX = (px - cp.x) / cz
    const canvasY = (py - cp.y) / cz
    setPan({ x: px - canvasX * z, y: py - canvasY * z })
    setZoom(z)
  }, [])

  // Image upload: optimize + quota-check + upload happen in the hook; we just place
  // it at the viewport center and surface any error.
  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setUploading(true)
    const rect = viewportRef.current?.getBoundingClientRect()
    const at = rect ? screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 0, y: 0 }
    const res = await addImage(file, { author: authorName, at })
    setUploading(false)
    if (res?.error) { setToast(res.error); setTimeout(() => setToast(null), 4000) }
    else if (res?.element) { setTool('select'); setSelectedId(res.element.id) }
  }

  const selected = elements.find(e => e.id === selectedId) || null

  // ── coordinate helpers ──
  const screenToCanvas = useCallback((clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }, [pan, zoom])

  // ── zoom ──
  const zoomTo = useCallback((nextZoom, cx, cy) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = cx ?? rect.width / 2
    const py = cy ?? rect.height / 2
    const z = Math.min(3, Math.max(0.2, nextZoom))
    // keep the point under the cursor fixed
    const canvasX = (px - pan.x) / zoom
    const canvasY = (py - pan.y) / zoom
    setPan({ x: px - canvasX * z, y: py - canvasY * z })
    setZoom(z)
  }, [pan, zoom])

  function handleWheel(e) {
    e.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    zoomTo(zoom * factor, e.clientX - rect.left, e.clientY - rect.top)
  }

  function fitToContent() {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    if (!elements.length) { setPan({ x: rect.width / 2, y: rect.height / 2 }); setZoom(1); return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const e of elements) {
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y)
      maxX = Math.max(maxX, e.x + e.w); maxY = Math.max(maxY, e.y + e.h)
    }
    const pad = 80
    const cw = maxX - minX + pad * 2
    const ch = maxY - minY + pad * 2
    const z = Math.min(3, Math.max(0.2, Math.min(rect.width / cw, rect.height / ch)))
    setZoom(z)
    setPan({
      x: rect.width / 2 - ((minX + maxX) / 2) * z,
      y: rect.height / 2 - ((minY + maxY) / 2) * z,
    })
  }

  // ── background interactions: place a new element, or pan ──
  function handleBackgroundPointerDown(e) {
    if (e.target.closest('[data-ui]')) return // clicks on toolbars
    if (tool !== 'select') {
      const pt = screenToCanvas(e.clientX, e.clientY)
      const d = DEFAULTS[tool]
      // Text sits on the (theme-adaptive) canvas, so its default ink must contrast.
      const color = tool === 'text' ? (isLight ? '#1a1a1e' : '#e5e7eb') : d.color
      const el = addElement({
        type: tool,
        x: tool === 'comment' ? pt.x : pt.x - d.w / 2,
        y: tool === 'comment' ? pt.y : pt.y - d.h / 2,
        w: d.w, h: d.h, color, font: d.font, text: d.text,
        author: authorName || null,
      })
      setTool('select')
      setSelectedId(el?.id || null)
      if (el && tool !== 'comment') setEditingId(el.id)
      if (el && tool === 'comment') setEditingId(el.id)
      return
    }
    // Track the pointer (for pinch). One finger = pan; two fingers = pinch-zoom.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const first = pointers.current.size === 1
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      pinchRef.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y), startZoom: zoomRef.current }
      drag.current = { mode: 'pinch' }
    } else {
      setSelectedId(null)
      setEditingId(null)
      drag.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, origin: { ...panRef.current } }
    }
    if (first) {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    }
  }

  const onPointerMove = useCallback((e) => {
    const d = drag.current
    if (!d) return
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (d.mode === 'pinch') {
      if (pointers.current.size < 2 || !pinchRef.current) return
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = viewportRef.current.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - rect.left
      const my = (a.y + b.y) / 2 - rect.top
      applyZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist), mx, my)
    } else if (d.mode === 'link') {
      setLinkPoint(screenToCanvas(e.clientX, e.clientY))
    } else if (d.mode === 'pan') {
      setPan({ x: d.origin.x + (e.clientX - d.startX), y: d.origin.y + (e.clientY - d.startY) })
    } else if (d.mode === 'move') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      patchElement(d.id, { x: d.origin.x + dx, y: d.origin.y + dy })
    } else if (d.mode === 'resize') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      const { x, y, w, h } = d.origin
      const c = d.corner || 'se'
      const minW = 40, minH = 32
      const east = c === 'se' || c === 'ne'   // grows with +dx
      const south = c === 'se' || c === 'sw'  // grows with +dy
      let nw = Math.max(minW, east ? w + dx : w - dx)
      let nh
      if (d.lockAspect) {
        const aspect = w / h
        nh = Math.max(minH, nw / aspect)
        nw = nh * aspect // re-derive so aspect holds even when minH clamps
      } else {
        nh = Math.max(minH, south ? h + dy : h - dy)
      }
      // Keep the opposite corner fixed.
      const nx = (c === 'sw' || c === 'nw') ? x + (w - nw) : x
      const ny = (c === 'ne' || c === 'nw') ? y + (h - nh) : y
      patchElement(d.id, { x: nx, y: ny, w: nw, h: nh })
    }
  }, [zoom, patchElement, screenToCanvas, applyZoom])

  // Topmost non-connector element whose box contains a canvas point (for link drops).
  const elementAt = useCallback((pt, excludeId) => {
    const hits = elementsRef.current.filter(e =>
      e.type !== 'connector' && e.id !== excludeId &&
      pt.x >= e.x && pt.x <= e.x + (e.w || 28) && pt.y >= e.y && pt.y <= e.y + (e.h || 28))
    return hits.sort((a, b) => (b.z || 0) - (a.z || 0))[0] || null
  }, [])

  const onPointerUp = useCallback((e) => {
    const d = drag.current
    // Background pan/pinch use the multi-pointer map: lift one finger to step
    // pinch→pan, lift the last to end. Listeners stay until all fingers are up.
    if (d && (d.mode === 'pan' || d.mode === 'pinch')) {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size >= 2) return
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()]
        pinchRef.current = null
        drag.current = { mode: 'pan', startX: p.x, startY: p.y, origin: { ...panRef.current } }
        return
      }
      pinchRef.current = null
      drag.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      return
    }
    if (d?.mode === 'link') {
      const pt = screenToCanvas(e.clientX, e.clientY)
      const target = elementAt(pt, d.fromId)
      if (target) { const c = addConnector(d.fromId, target.id); if (c) setSelectedId(c.id) }
      setLinkFrom(null); setLinkPoint(null)
    } else if (d && (d.mode === 'move' || d.mode === 'resize')) {
      const el = elementsRef.current.find(x => x.id === d.id)
      if (el) persistElement(d.id, d.mode === 'move' ? { x: el.x, y: el.y } : { x: el.x, y: el.y, w: el.w, h: el.h })
    }
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove, persistElement, screenToCanvas, elementAt, addConnector])

  // keep a ref of latest elements for the pointerup persist
  const elementsRef = useRef(elements)
  useEffect(() => { elementsRef.current = elements }, [elements])

  // Reliably persist text when editing ends. onBlur alone is lossy: clicking the
  // canvas clears editingId, which unmounts the textarea before its blur fires, so
  // the typed text never reaches Supabase. This flushes the element's current text
  // whenever the edit target changes (or clears), regardless of how it ended.
  const prevEditingRef = useRef(null)
  useEffect(() => {
    const prev = prevEditingRef.current
    if (prev && prev !== editingId) {
      const el = elementsRef.current?.find(e => e.id === prev)
      if (el) persistElement(prev, { text: el.text || '' })
    }
    prevEditingRef.current = editingId
  }, [editingId, persistElement])

  function startMove(e, el) {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelectedId(el.id)
    bringToFront(el.id)
    if (editingId === el.id) return // let text selection work while editing
    drag.current = { mode: 'move', id: el.id, startX: e.clientX, startY: e.clientY, origin: { x: el.x, y: el.y } }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function startResize(e, el, corner = 'se') {
    e.stopPropagation()
    // Images resize proportionally (keep aspect) so they scale, not stretch.
    drag.current = { mode: 'resize', id: el.id, corner, lockAspect: el.type === 'image', startX: e.clientX, startY: e.clientY, origin: { x: el.x, y: el.y, w: el.w, h: el.h } }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Drag from an element's side handle to another element to connect them.
  function startLink(e, el) {
    e.stopPropagation()
    drag.current = { mode: 'link', fromId: el.id }
    setLinkFrom(el.id)
    setLinkPoint(screenToCanvas(e.clientX, e.clientY))
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // delete with keyboard when something's selected (and not editing text)
  useEffect(() => {
    function onKey(e) {
      if (editingId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault(); deleteElement(selectedId); setSelectedId(null)
      }
      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); setTool('select') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId, selectedId, deleteElement])

  const cursor = tool === 'select' ? (drag.current?.mode === 'pan' ? 'grabbing' : 'grab') : 'crosshair'

  // Connector geometry, recomputed from current element positions so arrows track moves.
  const elMap = useMemo(() => new Map(elements.map(e => [e.id, e])), [elements])
  const boxOf = (el) => ({ x: el.x, y: el.y, w: el.w || 28, h: el.h || 28 })
  const connectorViews = useMemo(() => {
    const out = []
    for (const c of elements) {
      if (c.type !== 'connector') continue
      const from = elMap.get(c.from_id), to = elMap.get(c.to_id)
      if (!from || !to) continue
      const fb = boxOf(from), tb = boxOf(to)
      const fc = { x: fb.x + fb.w / 2, y: fb.y + fb.h / 2 }
      const tc = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 }
      const a1 = anchorWithSide(fb, tc.x, tc.y)
      const a2 = anchorWithSide(tb, fc.x, fc.y)
      const p1 = { x: a1.x, y: a1.y }, p2 = { x: a2.x, y: a2.y }
      const { d, c1, c2 } = curveAnchored(a1, a1.side, a2, a2.side)
      const meta = c.meta || {}
      out.push({
        id: c.id, d, p1, p2,
        color: c.color || '#94a3b8', thickness: meta.thickness || 2.5, arrow: meta.arrow || 'end',
        headEnd: arrowHead(p2, Math.atan2(p2.y - c2.y, p2.x - c2.x)),
        headStart: arrowHead(p1, Math.atan2(p1.y - c1.y, p1.x - c1.x)),
      })
    }
    return out
  }, [elements, elMap])
  const linkView = useMemo(() => {
    if (!linkFrom || !linkPoint) return null
    const from = elMap.get(linkFrom); if (!from) return null
    const a1 = anchorWithSide(boxOf(from), linkPoint.x, linkPoint.y)
    const { d, c2 } = curveAnchored(a1, a1.side, linkPoint, '')
    return { d, head: arrowHead(linkPoint, Math.atan2(linkPoint.y - c2.y, linkPoint.x - c2.x)) }
  }, [linkFrom, linkPoint, elMap])
  const selectedConnector = connectorViews.find(cv => cv.id === selectedId) || null

  return (
    <div className="relative w-full h-full overflow-hidden bg-surface-950 select-none"
      ref={viewportRef}
      onPointerDown={handleBackgroundPointerDown}
      onWheel={handleWheel}
      style={{
        cursor,
        // Stop the browser from claiming touch gestures (native scroll/zoom) so our
        // pointer-driven pan / drag / resize / pinch stay smooth — for every object.
        touchAction: 'none',
        backgroundImage: showGrid ? `radial-gradient(circle, ${dotColor} 1px, transparent 1px)` : 'none',
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Transformed canvas layer */}
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/* Connectors (behind elements) + the temp line while dragging a new one */}
        <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" width="1" height="1">
          {connectorViews.map(cv => (
            <g key={cv.id}>
              {/* fat invisible hit area for easy clicking */}
              <path d={cv.d} stroke="transparent" strokeWidth={16} fill="none"
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => { e.stopPropagation(); setSelectedId(cv.id); setEditingId(null) }} />
              <path d={cv.d} stroke={selectedId === cv.id ? '#5e9c8c' : cv.color} strokeWidth={selectedId === cv.id ? cv.thickness + 0.75 : cv.thickness} fill="none" strokeLinecap="round" />
              {(cv.arrow === 'end' || cv.arrow === 'both') && <polygon points={cv.headEnd} fill={selectedId === cv.id ? '#5e9c8c' : cv.color} />}
              {cv.arrow === 'both' && <polygon points={cv.headStart} fill={selectedId === cv.id ? '#5e9c8c' : cv.color} />}
              {selectedId === cv.id && (
                <>
                  <circle cx={cv.p1.x} cy={cv.p1.y} r={3.5} fill="#5e9c8c" />
                  <circle cx={cv.p2.x} cy={cv.p2.y} r={3.5} fill="#5e9c8c" />
                </>
              )}
            </g>
          ))}
          {linkFrom && linkPoint && linkView && (
            <g>
              <path d={linkView.d} stroke="#5e9c8c" strokeWidth={2} fill="none" strokeDasharray="5 5" strokeLinecap="round" />
              <polygon points={linkView.head} fill="#5e9c8c" />
            </g>
          )}
        </svg>

        {elements.filter(el => el.type !== 'connector').map(el => (
          <CanvasElement
            key={el.id}
            el={el}
            selected={selectedId === el.id}
            editing={editingId === el.id}
            tool={tool}
            linking={!!linkFrom}
            onPointerDown={(e) => startMove(e, el)}
            onStartResize={(e, corner) => startResize(e, el, corner)}
            onStartLink={(e) => startLink(e, el)}
            onDoubleClick={() => { if (el.type !== 'comment') { setSelectedId(el.id); setEditingId(el.id) } }}
            onOpenComment={() => { setSelectedId(el.id); setEditingId(el.id) }}
            onChangeText={(text) => patchElement(el.id, { text })}
            onCommitText={(text) => persistElement(el.id, { text })}
            onCloseEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      {/* Contextual element bar (color / font / delete) — elements only */}
      {selected && selected.type !== 'connector' && tool === 'select' && (
        <ElementBar
          el={selected}
          pan={pan}
          zoom={zoom}
          onColor={(color) => persistElement(selected.id, { color })}
          onFont={(font) => persistElement(selected.id, { font })}
          onDelete={() => { deleteElement(selected.id); setSelectedId(null) }}
        />
      )}

      {/* Connector style bar (thickness / arrow / color / delete) */}
      {selectedConnector && tool === 'select' && (
        <ConnectorBar
          cv={selectedConnector}
          pan={pan}
          zoom={zoom}
          onStyle={(patch) => persistElement(selectedConnector.id, { meta: { thickness: selectedConnector.thickness, arrow: selectedConnector.arrow, ...patch } })}
          onColor={(color) => persistElement(selectedConnector.id, { color })}
          onDelete={() => { deleteElement(selectedConnector.id); setSelectedId(null) }}
        />
      )}

      {/* Bottom-center toolbar */}
      <div data-ui className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 max-w-[calc(100vw-16px)] bg-surface-900/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-2 py-1.5 shadow-lift"
        onPointerDown={(e) => e.stopPropagation()}>
        {TOOLS.map(t => {
          const Icon = t.icon
          const active = tool === t.key
          return (
            <button key={t.key} onClick={() => setTool(t.key)} title={t.label}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                active ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'
              }`}>
              <Icon size={17} strokeWidth={1.9} />
            </button>
          )
        })}
        {/* Add image */}
        <button onClick={() => fileRef.current?.click()} title="Add image" disabled={uploading}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors disabled:opacity-50">
          {uploading ? <Loader2 size={17} strokeWidth={1.9} className="animate-spin" /> : <ImageIcon size={17} strokeWidth={1.9} />}
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button onClick={() => setShowGrid(g => !g)} title="Toggle grid"
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
            showGrid ? 'text-accent' : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06]'
          }`}>
          <Grid3x3 size={17} strokeWidth={1.9} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button onClick={() => zoomTo(zoom / 1.2)} title="Zoom out"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors">
          <Minus size={17} strokeWidth={1.9} />
        </button>
        <button onClick={() => zoomTo(1)} title="Reset zoom"
          className="min-w-[46px] h-9 px-1 text-[12px] font-medium text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.06] rounded-xl tabular-nums transition-colors">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => zoomTo(zoom * 1.2)} title="Zoom in"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors">
          <Plus size={17} strokeWidth={1.9} />
        </button>
        <button onClick={fitToContent} title="Zoom to fit everything"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors">
          <Maximize size={16} strokeWidth={1.9} />
        </button>
      </div>

      {/* Hidden file input for image upload */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

      {/* Toast (quota / upload errors) */}
      {toast && (
        <div data-ui className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-surface-800 border border-red-500/30 text-red-300 text-[13px] rounded-xl px-4 py-2.5 shadow-lift max-w-xs text-center">
          {toast}
        </div>
      )}

      {/* Empty hint */}
      {elements.length === 0 && (
        <div data-ui className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-[15px] font-medium text-zinc-400">Your team’s whiteboard</p>
            <p className="text-[13px] text-zinc-600 mt-1">Pick a tool below and click to drop a sticky, shape, or note.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function CanvasElement({ el, selected, editing, tool, linking, onPointerDown, onStartResize, onStartLink, onDoubleClick, onOpenComment, onChangeText, onCommitText, onCloseEdit }) {
  const base = {
    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
    fontFamily: `'${el.font || 'Inter'}', sans-serif`,
  }

  // Comment pin — small marker that opens a note popover.
  if (el.type === 'comment') {
    return (
      <div style={{ position: 'absolute', left: el.x, top: el.y }} onPointerDown={onPointerDown}>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenComment() }}
          className="w-7 h-7 rounded-full rounded-bl-none flex items-center justify-center shadow-lg"
          style={{ background: el.color }}
        >
          <MessageSquare size={14} strokeWidth={2.2} className="text-surface-950" />
        </button>
        {(editing || (el.text && selected)) && (
          <div data-ui onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-8 top-0 w-56 bg-surface-900 border border-white/[0.1] rounded-xl shadow-xl p-2.5 z-10">
            {(el.author || el.created_at) && (
              <div className="flex items-baseline justify-between gap-2 mb-1">
                {el.author && <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide truncate">{el.author}</span>}
                {el.created_at && <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">{formatStamp(el.created_at)}</span>}
              </div>
            )}
            <textarea
              autoFocus={editing}
              value={el.text || ''}
              onChange={(e) => onChangeText(e.target.value)}
              onBlur={(e) => { onCommitText(e.target.value); onCloseEdit() }}
              placeholder="Add a note…"
              className="w-full h-20 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none leading-snug"
            />
          </div>
        )}
      </div>
    )
  }

  // Image element — fills its box; resizes from the four corners. The image is
  // clipped by an inner wrapper so the edge/corner handles stay outside and clickable.
  if (el.type === 'image') {
    return (
      <div style={base} onPointerDown={onPointerDown}
        className={`group rounded-xl ${selected ? 'outline outline-2 outline-accent outline-offset-2' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}>
        <div className="w-full h-full overflow-hidden rounded-xl bg-surface-800">
          {el.src && <img src={el.src} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none select-none" />}
        </div>
        <ResizeHandles show={selected && tool === 'select'} onStart={onStartResize} />
        <SideHandles show={selected && tool === 'select'} onStart={onStartLink} />
      </div>
    )
  }

  const isShape = el.type === 'rect' || el.type === 'circle'
  // Stickies read as paper: a whisper of a gradient + soft drop shadow, sharper corners.
  const stickyBg = `linear-gradient(155deg, rgba(255,255,255,0.18), rgba(0,0,0,0.06)), ${el.color}`
  const style = {
    ...base,
    background: el.type === 'text' ? 'transparent' : el.type === 'sticky' ? stickyBg : el.color,
    borderRadius: el.type === 'circle' ? '50%' : el.type === 'sticky' ? 3 : el.type === 'rect' ? 12 : 0,
    color: el.type === 'text' ? el.color : '#1a1a1e',
    boxShadow: el.type === 'sticky' ? '0 10px 22px -8px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.12) inset' : 'none',
  }

  return (
    <div
      style={style}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={`group ${selected ? 'outline outline-2 outline-accent outline-offset-2' : ''} ${tool === 'select' ? 'cursor-move' : ''}`}
    >
      {editing ? (
        <textarea
          autoFocus
          value={el.text || ''}
          onChange={(e) => onChangeText(e.target.value)}
          onBlur={(e) => { onCommitText(e.target.value); onCloseEdit() }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent resize-none focus:outline-none p-3 text-center"
          style={{
            fontFamily: base.fontFamily,
            color: style.color,
            fontSize: el.type === 'text' ? 22 : el.type === 'sticky' ? 18 : 15,
            fontWeight: el.type === 'text' ? 600 : 500,
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-3 overflow-hidden text-center break-words"
          style={{
            color: style.color,
            fontSize: el.type === 'text' ? 22 : el.type === 'sticky' ? 18 : 15,
            fontWeight: el.type === 'text' ? 600 : 500,
            justifyContent: 'center',
          }}>
          {el.text || (el.type === 'sticky' ? <span className="opacity-40">Double-click to write</span> : '')}
        </div>
      )}

      {/* Four-corner resize handles + side connector handles */}
      <ResizeHandles show={selected && tool === 'select' && (isShape || el.type === 'sticky' || el.type === 'text')} onStart={onStartResize} />
      <SideHandles show={selected && tool === 'select'} onStart={onStartLink} />
    </div>
  )
}

// Classic four-corner resize handles — standard white circles.
function ResizeHandles({ show, onStart }) {
  if (!show) return null
  const corners = [
    ['nw', '-top-1.5 -left-1.5 cursor-nw-resize'],
    ['ne', '-top-1.5 -right-1.5 cursor-ne-resize'],
    ['sw', '-bottom-1.5 -left-1.5 cursor-sw-resize'],
    ['se', '-bottom-1.5 -right-1.5 cursor-se-resize'],
  ]
  return corners.map(([c, cls]) => (
    <div key={c} data-ui
      onPointerDown={(e) => { e.stopPropagation(); onStart(e, c) }}
      className={`absolute w-3 h-3 rounded-full bg-white border-2 border-accent shadow-sm ${cls}`} />
  ))
}

// Side handles (N/E/S/W) — drag from one to another element to connect them.
function SideHandles({ show, onStart }) {
  if (!show) return null
  const sides = [
    ['top-1/2 -left-2 -translate-y-1/2', 'cursor-crosshair'],
    ['top-1/2 -right-2 -translate-y-1/2', 'cursor-crosshair'],
    ['left-1/2 -top-2 -translate-x-1/2', 'cursor-crosshair'],
    ['left-1/2 -bottom-2 -translate-x-1/2', 'cursor-crosshair'],
  ]
  return sides.map(([pos, cur], i) => (
    <div key={i} data-ui title="Drag to connect"
      onPointerDown={(e) => { e.stopPropagation(); onStart(e) }}
      className={`absolute w-2.5 h-2.5 rounded-full bg-accent/90 border border-white/70 shadow-sm hover:scale-125 transition-transform ${pos} ${cur}`} />
  ))
}

// Style bar for a selected connector — thickness, arrow direction, color, delete.
function ConnectorBar({ cv, pan, zoom, onStyle, onColor, onDelete }) {
  const midX = ((cv.p1.x + cv.p2.x) / 2) * zoom + pan.x
  const midY = ((cv.p1.y + cv.p2.y) / 2) * zoom + pan.y
  const THICK = [['S', 1.5], ['M', 2.5], ['L', 5]]
  const ARROWS = [['→', 'end'], ['↔', 'both'], ['—', 'none']]
  const LINE_COLORS = ['#94a3b8', '#5e9c8c', '#f59e0b', '#ef4444', '#a78bfa', '#e5e7eb']
  return (
    <div data-ui onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex items-center gap-2 bg-surface-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-2.5 py-1.5 shadow-lift"
      style={{ left: midX, top: Math.max(8, midY - 48), transform: 'translateX(-50%)' }}>
      <div className="flex items-center gap-0.5">
        {THICK.map(([lbl, val]) => (
          <button key={lbl} onClick={() => onStyle({ thickness: val })} title={`Thickness ${lbl}`}
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${cv.thickness === val ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'}`}>{lbl}</button>
        ))}
      </div>
      <div className="w-px h-5 bg-white/10" />
      <div className="flex items-center gap-0.5">
        {ARROWS.map(([lbl, val]) => (
          <button key={val} onClick={() => onStyle({ arrow: val })} title={`Arrow ${val}`}
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[13px] transition-colors ${cv.arrow === val ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'}`}>{lbl}</button>
        ))}
      </div>
      <div className="w-px h-5 bg-white/10" />
      <div className="flex items-center gap-1">
        {LINE_COLORS.map(c => (
          <button key={c} onClick={() => onColor(c)} title="Color"
            className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${cv.color === c ? 'border-white ring-1 ring-white' : 'border-black/20'}`}
            style={{ background: c }} />
        ))}
      </div>
      <div className="w-px h-5 bg-white/10" />
      <button onClick={onDelete} title="Delete"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
        <Trash2 size={14} strokeWidth={1.9} />
      </button>
    </div>
  )
}

function ElementBar({ el, pan, zoom, onColor, onFont, onDelete }) {
  // Anchor above the element in screen space.
  const left = el.x * zoom + pan.x + (el.w * zoom) / 2
  const top = el.y * zoom + pan.y
  const isImage = el.type === 'image'
  const showFont = el.type === 'sticky' || el.type === 'text' || el.type === 'rect' || el.type === 'circle'
  return (
    <div data-ui onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex items-center gap-2 bg-surface-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-2.5 py-1.5 shadow-lift"
      style={{ left, top: Math.max(8, top - 52), transform: 'translateX(-50%)' }}>
      {!isImage && (
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => onColor(c)} title="Color"
              className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${el.color === c ? 'border-white ring-1 ring-white' : 'border-black/20'}`}
              style={{ background: c }} />
          ))}
        </div>
      )}
      {showFont && (
        <>
          <div className="w-px h-5 bg-white/10" />
          <select
            value={el.font || 'Inter'}
            onChange={(e) => onFont(e.target.value)}
            className="bg-surface-800 border border-white/[0.1] rounded-lg text-[12px] text-zinc-200 px-1.5 py-1 focus:outline-none focus:border-accent/60 cursor-pointer"
          >
            {FONTS.map(f => <option key={f.css} value={f.css}>{f.label}</option>)}
          </select>
        </>
      )}
      {(!isImage || showFont) && <div className="w-px h-5 bg-white/10" />}
      <button onClick={onDelete} title="Delete"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
        <Trash2 size={14} strokeWidth={1.9} />
      </button>
    </div>
  )
}
