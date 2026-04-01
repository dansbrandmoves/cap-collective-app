import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { SEED_DATA } from '../data/seed'

const AppContext = createContext(null)

const STORAGE_KEY = 'cap-collective-app'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted storage — reset
  }
  return null
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable
  }
}

export function AppProvider({ children }) {
  const [productions, setProductions] = useState(() => {
    const stored = loadFromStorage()
    return stored?.productions ?? SEED_DATA.productions
  })

  const [calendarEvents] = useState(SEED_DATA.calendarEvents)
  const [availabilityRules, setAvailabilityRules] = useState(() => {
    const stored = loadFromStorage()
    return stored?.availabilityRules ?? SEED_DATA.availabilityRules
  })

  // Owner mode — in prototype, persisted in localStorage
  const [isOwner, setIsOwner] = useState(() => {
    const stored = loadFromStorage()
    return stored?.isOwner ?? true // default to owner for now
  })

  // Sync state to localStorage on every change
  useEffect(() => {
    saveToStorage({ productions, availabilityRules, isOwner })
  }, [productions, availabilityRules, isOwner])

  // --- Productions ---
  const createProduction = useCallback((data) => {
    const production = {
      id: `prod-${Date.now()}`,
      name: data.name,
      description: data.description ?? '',
      startDate: data.startDate,
      endDate: data.endDate,
      ownerNotes: '',
      createdAt: new Date().toISOString(),
      groups: [],
    }
    setProductions(prev => [...prev, production])
    return production.id
  }, [])

  const updateProductionNotes = useCallback((productionId, notes) => {
    setProductions(prev =>
      prev.map(p => p.id === productionId ? { ...p, ownerNotes: notes } : p)
    )
  }, [])

  // --- Groups ---
  const createGroup = useCallback((productionId, name) => {
    const group = {
      id: `grp-${Date.now()}`,
      productionId,
      name,
      members: [],
      room: {
        sharedNotes: `# ${name} — Shared Notes\n\nAdd shared context, decisions, and plans here.`,
        messages: [],
      },
    }
    setProductions(prev =>
      prev.map(p =>
        p.id === productionId
          ? { ...p, groups: [...p.groups, group] }
          : p
      )
    )
    return group.id
  }, [])

  // --- Room ---
  const updateSharedNotes = useCallback((productionId, groupId, notes) => {
    setProductions(prev =>
      prev.map(p =>
        p.id === productionId
          ? {
              ...p,
              groups: p.groups.map(g =>
                g.id === groupId
                  ? { ...g, room: { ...g.room, sharedNotes: notes } }
                  : g
              ),
            }
          : p
      )
    )
  }, [])

  const sendMessage = useCallback((productionId, groupId, text, senderName) => {
    const message = {
      id: `msg-${Date.now()}`,
      senderId: isOwner ? 'owner' : 'guest',
      senderName,
      text,
      timestamp: new Date().toISOString(),
      read: isOwner, // owner messages are immediately "read" by owner
    }
    setProductions(prev =>
      prev.map(p =>
        p.id === productionId
          ? {
              ...p,
              groups: p.groups.map(g =>
                g.id === groupId
                  ? { ...g, room: { ...g.room, messages: [...g.room.messages, message] } }
                  : g
              ),
            }
          : p
      )
    )
  }, [isOwner])

  const markRoomRead = useCallback((productionId, groupId) => {
    setProductions(prev =>
      prev.map(p =>
        p.id === productionId
          ? {
              ...p,
              groups: p.groups.map(g =>
                g.id === groupId
                  ? {
                      ...g,
                      room: {
                        ...g.room,
                        messages: g.room.messages.map(m => ({ ...m, read: true })),
                      },
                    }
                  : g
              ),
            }
          : p
      )
    )
  }, [])

  // --- Helpers ---
  const getProduction = useCallback((id) => productions.find(p => p.id === id), [productions])

  const getGroup = useCallback((productionId, groupId) => {
    const production = productions.find(p => p.id === productionId)
    return production?.groups.find(g => g.id === groupId)
  }, [productions])

  const getUnreadCount = useCallback((productionId, groupId) => {
    const group = getGroup(productionId, groupId)
    if (!group) return 0
    return group.room.messages.filter(m => !m.read && m.senderId !== 'owner').length
  }, [getGroup])

  const getTotalUnread = useCallback((productionId) => {
    const production = getProduction(productionId)
    if (!production) return 0
    return production.groups.reduce((sum, g) => sum + getUnreadCount(productionId, g.id), 0)
  }, [getProduction, getUnreadCount])

  const getRoomLink = useCallback((productionId, groupId) => {
    return `${window.location.origin}/room/${productionId}/${groupId}`
  }, [])

  return (
    <AppContext.Provider value={{
      productions,
      calendarEvents,
      availabilityRules,
      isOwner,
      setIsOwner,
      createProduction,
      updateProductionNotes,
      createGroup,
      updateSharedNotes,
      sendMessage,
      markRoomRead,
      getProduction,
      getGroup,
      getUnreadCount,
      getTotalUnread,
      getRoomLink,
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
