import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { Bell, CalendarCheck, MessageCircle, ArrowUpRight } from 'lucide-react'

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
    if (notif.type === 'booking') {
      navigate('/booking-pages')
    } else if (notif.openToken) {
      navigate(`/room/${notif.openToken}`)
    } else if (notif.productionId && notif.roomId) {
      navigate(`/project/${notif.productionId}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadNotificationCount > 0 && (
          <span className="absolute top-1 right-1 bg-accent text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-[0_2px_8px_-2px_rgb(139_92_246/0.6)]">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[480px] bg-surface-900/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-lift z-[60] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <h3 className="text-[14px] font-semibold text-zinc-100 tracking-tight">Activity</h3>
            {recentNotifications.length > 0 && (
              <button
                onClick={() => { markNotificationsSeen(); setOpen(false) }}
                className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mx-auto mb-3">
                  <Bell size={16} strokeWidth={1.5} className="text-zinc-500" />
                </div>
                <p className="text-[13px] text-zinc-400">Nothing new yet.</p>
                <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px] mx-auto leading-relaxed">
                  New bookings and room messages will show up here.
                </p>
              </div>
            ) : (
              recentNotifications.map(notif => {
                const isUnread = notificationsLastSeen
                  ? new Date(notif.timestamp) > new Date(notificationsLastSeen)
                  : true
                const canNavigate = notif.type === 'booking' || !!notif.openToken || !!notif.productionId
                const isBooking = notif.type === 'booking'
                return (
                  <button
                    key={notif.id}
                    onClick={() => canNavigate && handleNotifClick(notif)}
                    disabled={!canNavigate}
                    className="w-full text-left px-5 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0 flex gap-3 items-start disabled:cursor-default"
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isBooking
                          ? 'bg-accent/15 border border-accent/25 text-accent'
                          : 'bg-white/[0.05] border border-white/5 text-zinc-400'
                      }`}>
                        {isBooking
                          ? <CalendarCheck size={14} strokeWidth={1.75} />
                          : <MessageCircle size={14} strokeWidth={1.75} />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold text-zinc-100 truncate tracking-tight">{notif.senderName}</span>
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                        <span className="text-[11px] text-zinc-600 flex-shrink-0 ml-auto">{timeAgo(notif.timestamp)}</span>
                      </div>
                      <p className="text-[13px] text-zinc-400 truncate leading-snug">{notif.text}</p>
                      {(notif.productionName || notif.roomName) && (
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                          {notif.productionName}
                          {notif.roomName && <> &middot; {notif.roomName}</>}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer link to Inbox — not in primary nav, but discoverable here */}
          <button
            onClick={() => { setOpen(false); navigate('/inbox') }}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-100 border-t border-white/[0.05] hover:bg-white/[0.02] transition-colors"
          >
            View shared availability
            <ArrowUpRight size={12} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  )
}
