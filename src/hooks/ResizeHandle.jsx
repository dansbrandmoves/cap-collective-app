// Thin draggable handle that sits on a panel's resize edge. `side` matches the
// useResizablePanel hook ('right' for left-docked panels). Lives in its own .jsx
// file because Vite/esbuild won't parse JSX inside a .js module.
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
