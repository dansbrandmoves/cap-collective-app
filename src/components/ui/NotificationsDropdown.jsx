import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { Bell } from 'lucide-react'

function timeAgo(iso) {
  const diff = Math.round((Date.now() - new Date(iso)) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationsDropdown() {
  const { recentNotifications, unreadNotificationCount, markNotificationsSeen, notificationsLastSeen } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    setOpen(prev => {
      if (!prev) markNotificationsSeen()
      return !prev
    })
  }

  function handleNotifClick(notif) {
    setOpen(false)
    if (notif.openToken) {
      navigate(`/room/${notif.openToken}`)
    } else if (notif.productionId && notif.groupId) {
      navigate(`/project/${notif.productionId}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-[60] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
            <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
            {recentNotifications.length > 0 && (
              <button
                onClick={() => { markNotificationsSeen(); setOpen(false) }}
                className="text-xs text-zinc-500 hover:text-accent transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={20} strokeWidth={1.5} className="text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No messages yet.</p>
              </div>
            ) : (
              recentNotifications.map(notif => {
                const isUnread = notificationsLastSeen
                  ? new Date(notif.timestamp) > new Date(notificationsLastSeen)
                  : true
                const canNavigate = !!(notif.openToken || notif.productionId)
                return (
                  <button
                    key={notif.id}
                    onClick={() => canNavigate && handleNotifClick(notif)}
                    disabled={!canNavigate}
                    className="w-full text-left px-4 py-3 hover:bg-surface-800 transition-colors border-b border-surface-800 last:border-0 flex gap-3 items-start disabled:cursor-default"
                  >
                    <div className="flex-shrink-0 pt-1.5">
                      <div className={`w-2 h-2 rounded-full ${isUnread ? 'bg-accent' : 'bg-transparent'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-zinc-100 truncate">{notif.senderName}</span>
                        <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(notif.timestamp)}</span>
                      </div>
                      <p className="text-sm text-zinc-400 truncate">{notif.text}</p>
                      <p className="text-xs text-zinc-600 mt-0.5 truncate">{notif.productionName} &rsaquo; {notif.groupName}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
