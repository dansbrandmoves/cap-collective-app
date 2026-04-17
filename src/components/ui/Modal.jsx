import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className={`relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full ${maxWidths[size]} transition-all duration-200 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-2'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
