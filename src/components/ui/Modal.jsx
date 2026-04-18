import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
      // Prevent body scroll on mobile
      document.body.style.overflow = 'hidden'
    } else {
      setVisible(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
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
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Desktop: centered modal */}
      <div className="hidden sm:flex items-center justify-center h-full p-4">
        <div className={`relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full ${maxWidths[size]} max-h-[85vh] flex flex-col transition-all duration-200 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-2'}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 flex-shrink-0">
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>

      {/* Mobile: slide-up sheet */}
      <div className={`sm:hidden absolute inset-x-0 bottom-0 transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-surface-900 border-t border-surface-700 rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col safe-bottom">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-surface-600" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="px-5 py-5 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
