import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MousePointer2, StickyNote, Square, Circle, Type, MessageSquare,
  Grid3x3, Minus, Plus, Maximize, Trash2,
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
  const { elements, addElement, patchElement, persistElement, deleteElement, bringToFront } = canvas
  const [tool, setTool] = useState('select')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const viewportRef = useRef(null)
  const drag = useRef(null) // { mode:'pan'|'move'|'resize', ... }

  useEffect(() => { injectFonts() }, [])

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
    // pan
    setSelectedId(null)
    setEditingId(null)
    drag.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, origin: { ...pan } }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const onPointerMove = useCallback((e) => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'pan') {
      setPan({ x: d.origin.x + (e.clientX - d.startX), y: d.origin.y + (e.clientY - d.startY) })
    } else if (d.mode === 'move') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      patchElement(d.id, { x: d.origin.x + dx, y: d.origin.y + dy })
    } else if (d.mode === 'resize') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      patchElement(d.id, { w: Math.max(40, d.origin.w + dx), h: Math.max(32, d.origin.h + dy) })
    }
  }, [zoom, patchElement])

  const onPointerUp = useCallback(() => {
    const d = drag.current
    if (d && (d.mode === 'move' || d.mode === 'resize')) {
      const el = elementsRef.current.find(x => x.id === d.id)
      if (el) persistElement(d.id, d.mode === 'move' ? { x: el.x, y: el.y } : { w: el.w, h: el.h })
    }
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove, persistElement])

  // keep a ref of latest elements for the pointerup persist
  const elementsRef = useRef(elements)
  useEffect(() => { elementsRef.current = elements }, [elements])

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

  function startResize(e, el) {
    e.stopPropagation()
    drag.current = { mode: 'resize', id: el.id, startX: e.clientX, startY: e.clientY, origin: { w: el.w, h: el.h } }
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-surface-950 select-none"
      ref={viewportRef}
      onPointerDown={handleBackgroundPointerDown}
      onWheel={handleWheel}
      style={{
        cursor,
        backgroundImage: showGrid ? `radial-gradient(circle, ${dotColor} 1px, transparent 1px)` : 'none',
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Transformed canvas layer */}
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {elements.map(el => (
          <CanvasElement
            key={el.id}
            el={el}
            selected={selectedId === el.id}
            editing={editingId === el.id}
            tool={tool}
            onPointerDown={(e) => startMove(e, el)}
            onStartResize={(e) => startResize(e, el)}
            onDoubleClick={() => { if (el.type !== 'comment') { setSelectedId(el.id); setEditingId(el.id) } }}
            onOpenComment={() => { setSelectedId(el.id); setEditingId(el.id) }}
            onChangeText={(text) => patchElement(el.id, { text })}
            onCommitText={(text) => persistElement(el.id, { text })}
            onCloseEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      {/* Contextual element bar (color / font / delete) */}
      {selected && tool === 'select' && (
        <ElementBar
          el={selected}
          pan={pan}
          zoom={zoom}
          onColor={(color) => persistElement(selected.id, { color })}
          onFont={(font) => persistElement(selected.id, { font })}
          onDelete={() => { deleteElement(selected.id); setSelectedId(null) }}
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

function CanvasElement({ el, selected, editing, tool, onPointerDown, onStartResize, onDoubleClick, onOpenComment, onChangeText, onCommitText, onCloseEdit }) {
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

  const isShape = el.type === 'rect' || el.type === 'circle'
  const style = {
    ...base,
    background: el.type === 'text' ? 'transparent' : el.color,
    borderRadius: el.type === 'circle' ? '50%' : el.type === 'sticky' ? 10 : el.type === 'rect' ? 12 : 0,
    color: el.type === 'text' ? el.color : '#1a1a1e',
    boxShadow: el.type === 'sticky' ? '0 6px 16px -6px rgba(0,0,0,0.5)' : 'none',
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

      {/* Resize handle */}
      {selected && tool === 'select' && (isShape || el.type === 'sticky' || el.type === 'text') && (
        <div
          data-ui
          onPointerDown={(e) => { e.stopPropagation(); onStartResize(e) }}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-accent border-2 border-surface-950 cursor-se-resize"
        />
      )}
    </div>
  )
}

function ElementBar({ el, pan, zoom, onColor, onFont, onDelete }) {
  // Anchor above the element in screen space.
  const left = el.x * zoom + pan.x + (el.w * zoom) / 2
  const top = el.y * zoom + pan.y
  const showFont = el.type === 'sticky' || el.type === 'text' || el.type === 'rect' || el.type === 'circle'
  return (
    <div data-ui onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex items-center gap-2 bg-surface-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-2.5 py-1.5 shadow-lift"
      style={{ left, top: Math.max(8, top - 52), transform: 'translateX(-50%)' }}>
      <div className="flex items-center gap-1">
        {COLORS.map(c => (
          <button key={c} onClick={() => onColor(c)} title="Color"
            className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${el.color === c ? 'border-white ring-1 ring-white' : 'border-black/20'}`}
            style={{ background: c }} />
        ))}
      </div>
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
      <div className="w-px h-5 bg-white/10" />
      <button onClick={onDelete} title="Delete"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
        <Trash2 size={14} strokeWidth={1.9} />
      </button>
    </div>
  )
}
