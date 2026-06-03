import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn } from 'lucide-react'

// LinkedIn-style square crop for profile photos. The picked image is shown in a
// fixed square viewport; you drag to reposition and use the slider to zoom. On
// save we redraw the visible square to a canvas and hand back a square blob —
// AppContext.uploadAvatar then re-encodes it to a small webp.
//
// The on-screen image is positioned with explicit width/height/left/top (not CSS
// transforms) so the export math below is an exact mirror of what you see.

const VIEW = 288       // viewport size on screen (px)
const OUT = 512        // exported square size (px) — downscaled to 256 on upload
const MAX_ZOOM = 3

export function AvatarCropper({ file, onCancel, onSave }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [nat, setNat] = useState(null)        // { w, h } natural size
  const [scale, setScale] = useState(1)       // 1 = cover the viewport
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const imgRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const im = new Image()
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight })
    im.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // baseScale = "cover" — smallest scale that fully fills the square viewport.
  const baseScale = nat ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1
  const dispW = nat ? nat.w * baseScale * scale : VIEW
  const dispH = nat ? nat.h * baseScale * scale : VIEW

  // Clamp offset so the image always covers the viewport (no empty gaps).
  const clamp = useCallback((o, dW = dispW, dH = dispH) => {
    const maxX = Math.max(0, (dW - VIEW) / 2)
    const maxY = Math.max(0, (dH - VIEW) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }
  }, [dispW, dispH])

  useEffect(() => { setOffset(o => clamp(o)) }, [scale, nat]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, base: offset }
  }
  function onPointerMove(e) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    setOffset(clamp({ x: drag.current.base.x + dx, y: drag.current.base.y + dy }))
  }
  function onPointerUp() { drag.current = null }

  async function handleSave() {
    if (!nat) return
    setSaving(true)
    try {
      const left = (VIEW - dispW) / 2 + offset.x
      const top = (VIEW - dispH) / 2 + offset.y
      // Source rect of the natural image that's visible in the viewport.
      const sx = (-left / dispW) * nat.w
      const sy = (-top / dispH) * nat.h
      const sw = (VIEW / dispW) * nat.w
      const sh = (VIEW / dispH) * nat.h
      const canvas = document.createElement('canvas')
      canvas.width = OUT; canvas.height = OUT
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUT, OUT)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.9))
      await onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Position your photo</h2>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Viewport */}
        <div
          className="relative mx-auto overflow-hidden bg-surface-950 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ width: VIEW, height: VIEW, borderRadius: 16 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              draggable={false}
              style={{ position: 'absolute', width: dispW, height: dispH, left: (VIEW - dispW) / 2 + offset.x, top: (VIEW - dispH) / 2 + offset.y, maxWidth: 'none' }}
            />
          )}
          {/* Circular mask hint — dims outside the round avatar area */}
          <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 9999px rgba(12,12,14,0.55)`, WebkitMaskImage: 'radial-gradient(circle at center, transparent 49%, black 50%)', maskImage: 'radial-gradient(circle at center, transparent 49%, black 50%)' }} />
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/20" />
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3 mt-4">
          <ZoomIn size={16} strokeWidth={1.75} className="text-zinc-500 flex-shrink-0" />
          <input
            type="range" min="1" max={MAX_ZOOM} step="0.01" value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
        </div>
        <p className="text-[11px] text-zinc-600 mt-2 text-center">Drag to reposition · slide to zoom</p>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onCancel} className="text-[13px] font-medium text-zinc-400 hover:text-zinc-100 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !nat}
            className="text-[13px] font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 px-4 py-2 rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
