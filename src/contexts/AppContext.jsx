import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { SEED_DATA } from '../data/seed'

const AppContext = createContext(null)
const STORAGE_KEY = 'cap-collective-app'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted — reset */ }
  return null
}

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* full */ }
}

export function AppProvider({ children }) {
  const stored = loadFromStorage()

  const [productions, setProductions] = useState(() => stored?.productions ?? SEED_DATA.productions)
  const [slots, setSlots] = useState(() => stored?.slots ?? SEED_DATA.slots)
  const [connectedCalendars, setConnectedCalendars] = useState(() => stored?.connectedCalendars ?? SEED_DATA.connectedCalendars)
  const [calendarEvents, setCalendarEvents] = useState(() => stored?.calendarEvents ?? SEED_DATA.calendarEvents)
  const [availabilityRules, setAvailabilityRules] = useState(() => stored?.availabilityRules ?? SEED_DATA.availabilityRules)
  const [isOwner, setIsOwner] = useState(() => stored?.isOwner ?? true)
  const [googleAccessToken, setGoogleAccessToken] = useState(() => stored?.googleAccessToken ?? null)
  const [calendarSyncing, setCalendarSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(() => stored?.lastSynced ?? null)

  useEffect(() => {
    saveToStorage({ productions, slots, connectedCalendars, calendarEvents, availabilityRules, isOwner, googleAccessToken, lastSynced })
  }, [productions, slots, connectedCalendars, calendarEvents, availabilityRules, isOwner, googleAccessToken, lastSynced])

  // --- Slots ---
  const createSlot = useCallback((data) => {
    const slot = { id: `slot-${Date.now()}`, name: data.name, startTime: data.startTime, endTime: data.endTime, color: data.color || '#22c55e', defaultState: data.defaultState || 'available' }
    setSlots(prev => [...prev, slot])
    return slot.id
  }, [])

  const updateSlot = useCallback((id, updates) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  const deleteSlot = useCallback((id) => {
    setSlots(prev => prev.filter(s => s.id !== id))
  }, [])

  const reorderSlots = useCallback((newOrder) => {
    setSlots(newOrder)
  }, [])

  // --- Connected Calendars ---
  const addConnectedCalendar = useCallback((calData) => {
    const cal = { id: `gcal-${Date.now()}`, googleCalendarId: calData.googleCalendarId, name: calData.name, color: calData.color || '#6b7280', role: calData.role || 'governs' }
    setConnectedCalendars(prev => {
      // Avoid duplicates by googleCalendarId
      const exists = prev.find(c => c.googleCalendarId === cal.googleCalendarId)
      if (exists) return prev.map(c => c.googleCalendarId === cal.googleCalendarId ? { ...c, ...cal, id: c.id } : c)
      return [...prev, cal]
    })
    return cal.id
  }, [])

  const updateCalendarRole = useCallback((calId, role) => {
    setConnectedCalendars(prev => prev.map(c => c.id === calId ? { ...c, role } : c))
  }, [])

  const removeConnectedCalendar = useCallback((calId) => {
    setConnectedCalendars(prev => prev.filter(c => c.id !== calId))
    setCalendarEvents(prev => prev.filter(e => e.calendarId !== calId))
  }, [])

  const replaceCalendarEvents = useCallback((newEvents) => {
    setCalendarEvents(newEvents)
    setLastSynced(new Date().toISOString())
  }, [])

  // --- Productions ---
  const createProduction = useCallback((data) => {
    const production = { id: `prod-${Date.now()}`, name: data.name, description: data.description ?? '', startDate: data.startDate, endDate: data.endDate, ownerNotes: '', createdAt: new Date().toISOString(), groups: [] }
    setProductions(prev => [...prev, production])
    return production.id
  }, [])

  const updateProductionNotes = useCallback((productionId, notes) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, ownerNotes: notes } : p))
  }, [])

  // --- Groups ---
  const createGroup = useCallback((productionId, name) => {
    const group = { id: `grp-${Date.now()}`, productionId, name, members: [], room: { sharedNotes: `# ${name} — Shared Notes\n\nAdd shared context, decisions, and plans here.`, messages: [] } }
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, groups: [...p.groups, group] } : p))
    return group.id
  }, [])

  // --- Room ---
  const updateSharedNotes = useCallback((productionId, groupId, notes) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, sharedNotes: notes } } : g) } : p))
  }, [])

  const sendMessage = useCallback((productionId, groupId, text, senderName) => {
    const message = { id: `msg-${Date.now()}`, senderId: isOwner ? 'owner' : 'guest', senderName, text, timestamp: new Date().toISOString(), read: isOwner }
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, messages: [...g.room.messages, message] } } : g) } : p))
  }, [isOwner])

  const markRoomRead = useCallback((productionId, groupId) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, messages: g.room.messages.map(m => ({ ...m, read: true })) } } : g) } : p))
  }, [])

  // --- Helpers ---
  const getProduction = useCallback((id) => productions.find(p => p.id === id), [productions])
  const getGroup = useCallback((productionId, groupId) => { const p = productions.find(p => p.id === productionId); return p?.groups.find(g => g.id === groupId) }, [productions])
  const getUnreadCount = useCallback((productionId, groupId) => { const g = productions.find(p => p.id === productionId)?.groups.find(g => g.id === groupId); return g?.room.messages.filter(m => !m.read && m.senderId !== 'owner').length ?? 0 }, [productions])
  const getTotalUnread = useCallback((productionId) => { const p = productions.find(p => p.id === productionId); return p?.groups.reduce((sum, g) => sum + (g.room.messages.filter(m => !m.read && m.senderId !== 'owner').length), 0) ?? 0 }, [productions])
  const getRoomLink = useCallback((productionId, groupId) => `${window.location.origin}/room/${productionId}/${groupId}`, [])

  return (
    <AppContext.Provider value={{
      // State
      productions, slots, connectedCalendars, calendarEvents, availabilityRules,
      isOwner, setIsOwner,
      googleAccessToken, setGoogleAccessToken,
      calendarSyncing, setCalendarSyncing,
      lastSynced,
      // Slots
      createSlot, updateSlot, deleteSlot, reorderSlots,
      // Calendars
      addConnectedCalendar, updateCalendarRole, removeConnectedCalendar, replaceCalendarEvents,
      // Productions
      createProduction, updateProductionNotes,
      // Groups
      createGroup,
      // Room
      updateSharedNotes, sendMessage, markRoomRead,
      // Helpers
      getProduction, getGroup, getUnreadCount, getTotalUnread, getRoomLink,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
