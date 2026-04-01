import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { SEED_DATA } from '../data/seed'
import { supabase } from '../utils/supabase'

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

function buildProductions(prods, grps, notes, msgs) {
  return (prods || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.start_date,
    endDate: p.end_date,
    ownerNotes: p.owner_notes,
    createdAt: p.created_at,
    groups: (grps || [])
      .filter(g => g.production_id === p.id)
      .map(g => ({
        id: g.id,
        productionId: g.production_id,
        name: g.name,
        accessMode: g.access_mode || 'open_link',
        openToken: g.open_token || null,
        members: [],
        room: {
          sharedNotes: (notes || []).find(n => n.group_id === g.id)?.content
            ?? `# ${g.name} — Shared Notes\n\nAdd shared context, decisions, and plans here.`,
          messages: (msgs || [])
            .filter(m => m.group_id === g.id)
            .map(m => ({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.sender_name,
              text: m.text,
              timestamp: m.timestamp,
              read: m.read,
            })),
        },
      })),
  }))
}

async function seedSupabase() {
  for (const p of SEED_DATA.productions) {
    await supabase.from('productions').upsert({
      id: p.id, name: p.name, description: p.description,
      start_date: p.startDate, end_date: p.endDate,
      owner_notes: p.ownerNotes, created_at: p.createdAt,
    })
    for (const g of p.groups) {
      await supabase.from('groups').upsert({
        id: g.id, production_id: p.id, name: g.name,
        access_mode: g.accessMode || 'open_link',
        open_token: g.openToken || nanoid(8),
      })
      await supabase.from('shared_notes').upsert({ group_id: g.id, content: g.room.sharedNotes })
      for (const m of g.room.messages) {
        await supabase.from('messages').upsert({
          id: m.id, group_id: g.id, sender_id: m.senderId,
          sender_name: m.senderName, text: m.text,
          timestamp: m.timestamp, read: m.read,
        })
      }
    }
  }
}

async function fetchAll() {
  const [{ data: prods }, { data: grps }, { data: notes }, { data: msgs }, { data: members }] = await Promise.all([
    supabase.from('productions').select('*').order('created_at'),
    supabase.from('groups').select('*'),
    supabase.from('shared_notes').select('*'),
    supabase.from('messages').select('*').order('timestamp'),
    supabase.from('group_members').select('*'),
  ])
  return { prods, grps, notes, msgs, members }
}

export function AppProvider({ children }) {
  const stored = loadFromStorage()

  // Supabase-backed
  const [productions, setProductions] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // localStorage-backed
  const [slots, setSlots] = useState(() => stored?.slots ?? SEED_DATA.slots)
  const [connectedCalendars, setConnectedCalendars] = useState(() => stored?.connectedCalendars ?? SEED_DATA.connectedCalendars)
  const [calendarEvents, setCalendarEvents] = useState(() => stored?.calendarEvents ?? SEED_DATA.calendarEvents)
  const [availabilityRules, setAvailabilityRules] = useState(() => stored?.availabilityRules ?? SEED_DATA.availabilityRules)
  const [prefixRules, setPrefixRules] = useState(() => stored?.prefixRules ?? SEED_DATA.prefixRules)
  const [isOwner, setIsOwner] = useState(() => stored?.isOwner ?? false)
  const [googleAccessToken, setGoogleAccessToken] = useState(() => stored?.googleAccessToken ?? null)
  const [calendarSyncing, setCalendarSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(() => stored?.lastSynced ?? null)

  useEffect(() => {
    fetchAll()
      .then(async ({ prods, grps, notes, msgs, members }) => {
        if (!prods?.length) {
          await seedSupabase()
          const fresh = await fetchAll()
          setProductions(buildProductions(fresh.prods, fresh.grps, fresh.notes, fresh.msgs))
          setGroupMembers(fresh.members || [])
        } else {
          // Backfill any groups missing an open_token
          const missing = (grps || []).filter(g => !g.open_token)
          if (missing.length) {
            await Promise.all(missing.map(g => {
              const token = nanoid(8)
              g.open_token = token
              return supabase.from('groups').update({ open_token: token }).eq('id', g.id)
            }))
          }
          setProductions(buildProductions(prods, grps, notes, msgs))
          setGroupMembers(members || [])
        }
      })
      .catch(err => {
        console.error('Supabase load failed, using localStorage:', err)
        setProductions(stored?.productions ?? SEED_DATA.productions)
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveToStorage({ slots, connectedCalendars, calendarEvents, availabilityRules, prefixRules, isOwner, googleAccessToken, lastSynced })
  }, [slots, connectedCalendars, calendarEvents, availabilityRules, prefixRules, isOwner, googleAccessToken, lastSynced])

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

  // --- Prefix Rules ---
  const createPrefixRule = useCallback((data) => {
    const rule = { id: `pr-${Date.now()}`, prefix: data.prefix, state: data.state, description: data.description ?? '' }
    setPrefixRules(prev => [...prev, rule])
  }, [])

  const updatePrefixRule = useCallback((id, updates) => {
    setPrefixRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }, [])

  const deletePrefixRule = useCallback((id) => {
    setPrefixRules(prev => prev.filter(r => r.id !== id))
  }, [])

  // --- Connected Calendars ---
  const addConnectedCalendar = useCallback((calData) => {
    setConnectedCalendars(prev => {
      const id = `gcal-${Date.now()}-${prev.length}`
      const cal = { id, googleCalendarId: calData.googleCalendarId, name: calData.name, color: calData.color || '#6b7280', role: calData.role || 'governs' }
      const exists = prev.find(c => c.googleCalendarId === cal.googleCalendarId)
      if (exists) return prev.map(c => c.googleCalendarId === cal.googleCalendarId ? { ...c, ...cal, id: c.id } : c)
      return [...prev, cal]
    })
  }, [])

  const updateCalendarRole = useCallback((googleCalId, role) => {
    setConnectedCalendars(prev => prev.map(c => c.googleCalendarId === googleCalId ? { ...c, role } : c))
  }, [])

  const updateCalendarDefaultState = useCallback((googleCalId, defaultState) => {
    setConnectedCalendars(prev => prev.map(c => c.googleCalendarId === googleCalId ? { ...c, defaultState } : c))
  }, [])

  const removeConnectedCalendar = useCallback((googleCalId) => {
    setConnectedCalendars(prev => prev.filter(c => c.googleCalendarId !== googleCalId))
    setCalendarEvents(prev => prev.filter(ev => ev.calendarId !== googleCalId))
  }, [])

  const replaceCalendarEvents = useCallback((newEvents) => {
    setCalendarEvents(newEvents)
    setLastSynced(new Date().toISOString())
  }, [])

  // --- Productions ---
  const createProduction = useCallback(async (data) => {
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
    supabase.from('productions').insert({
      id: production.id, name: production.name, description: production.description,
      start_date: production.startDate, end_date: production.endDate,
      owner_notes: production.ownerNotes, created_at: production.createdAt,
    }).then(({ error }) => { if (error) console.error('createProduction:', error) })
    return production.id
  }, [])

  const updateProductionNotes = useCallback((productionId, notes) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, ownerNotes: notes } : p))
    supabase.from('productions').update({ owner_notes: notes }).eq('id', productionId)
      .then(({ error }) => { if (error) console.error('updateProductionNotes:', error) })
  }, [])

  // --- Groups ---
  const createGroup = useCallback((productionId, name) => {
    const token = nanoid(8)
    const group = {
      id: `grp-${Date.now()}`,
      productionId,
      name,
      accessMode: 'open_link',
      openToken: token,
      members: [],
      room: {
        sharedNotes: `# ${name} — Shared Notes\n\nAdd shared context, decisions, and plans here.`,
        messages: [],
      },
    }
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, groups: [...p.groups, group] } : p))
    supabase.from('groups').insert({ id: group.id, production_id: productionId, name, access_mode: 'open_link', open_token: token })
      .then(({ error }) => { if (error) console.error('createGroup:', error) })
    supabase.from('shared_notes').insert({ group_id: group.id, content: group.room.sharedNotes })
      .then(({ error }) => { if (error) console.error('createGroup notes:', error) })
    return group.id
  }, [])

  const updateGroupAccessMode = useCallback((groupId, mode) => {
    setProductions(prev => prev.map(p => ({
      ...p,
      groups: p.groups.map(g => g.id === groupId ? { ...g, accessMode: mode } : g),
    })))
    supabase.from('groups').update({ access_mode: mode }).eq('id', groupId)
      .then(({ error }) => { if (error) console.error('updateGroupAccessMode:', error) })
  }, [])

  // --- Group Members ---
  const addGroupMember = useCallback((groupId, { name, email }) => {
    const member = {
      id: `mem-${Date.now()}`,
      groupId,
      group_id: groupId,
      name,
      email: email || '',
      inviteToken: nanoid(8),
      invite_token: nanoid(8), // kept in sync below
    }
    // Use one consistent token
    const token = nanoid(8)
    const finalMember = { id: member.id, groupId, group_id: groupId, name, email: email || '', inviteToken: token, invite_token: token }
    setGroupMembers(prev => [...prev, finalMember])
    supabase.from('group_members').insert({ id: finalMember.id, group_id: groupId, name, email: email || '', invite_token: token })
      .then(({ error }) => { if (error) console.error('addGroupMember:', error) })
    return finalMember
  }, [])

  const removeGroupMember = useCallback((memberId) => {
    setGroupMembers(prev => prev.filter(m => m.id !== memberId))
    supabase.from('group_members').delete().eq('id', memberId)
      .then(({ error }) => { if (error) console.error('removeGroupMember:', error) })
  }, [])

  // Resolve a token to { productionId, groupId, mode, memberName }
  const resolveToken = useCallback(async (token) => {
    const [{ data: groupRow }, { data: memberRow }] = await Promise.all([
      supabase.from('groups').select('id, production_id, access_mode').eq('open_token', token).single(),
      supabase.from('group_members').select('id, group_id, name').eq('invite_token', token).single(),
    ])
    if (groupRow) {
      return { productionId: groupRow.production_id, groupId: groupRow.id, mode: 'open_link', memberName: null }
    }
    if (memberRow) {
      // Need the production_id from the group
      const { data: grp } = await supabase.from('groups').select('production_id').eq('id', memberRow.group_id).single()
      return { productionId: grp?.production_id, groupId: memberRow.group_id, mode: 'invite_only', memberName: memberRow.name }
    }
    return null
  }, [])

  // --- Room ---
  const updateSharedNotes = useCallback((productionId, groupId, notes) => {
    setProductions(prev => prev.map(p => p.id === productionId
      ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, sharedNotes: notes } } : g) }
      : p))
    supabase.from('shared_notes').upsert({ group_id: groupId, content: notes })
      .then(({ error }) => { if (error) console.error('updateSharedNotes:', error) })
  }, [])

  const sendMessage = useCallback((productionId, groupId, text, senderName) => {
    const message = {
      id: `msg-${Date.now()}`,
      senderId: isOwner ? 'owner' : 'guest',
      senderName,
      text,
      timestamp: new Date().toISOString(),
      read: isOwner,
    }
    setProductions(prev => prev.map(p => p.id === productionId
      ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, messages: [...g.room.messages, message] } } : g) }
      : p))
    supabase.from('messages').insert({
      id: message.id, group_id: groupId, sender_id: message.senderId,
      sender_name: message.senderName, text: message.text,
      timestamp: message.timestamp, read: message.read,
    }).then(({ error }) => { if (error) console.error('sendMessage:', error) })
  }, [isOwner])

  const markRoomRead = useCallback((productionId, groupId) => {
    setProductions(prev => prev.map(p => p.id === productionId
      ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, room: { ...g.room, messages: g.room.messages.map(m => ({ ...m, read: true })) } } : g) }
      : p))
    supabase.from('messages').update({ read: true }).eq('group_id', groupId).neq('sender_id', 'owner')
      .then(({ error }) => { if (error) console.error('markRoomRead:', error) })
  }, [])

  const refreshRoom = useCallback(async (productionId, groupId) => {
    const [{ data: msgs }, { data: note }] = await Promise.all([
      supabase.from('messages').select('*').eq('group_id', groupId).order('timestamp'),
      supabase.from('shared_notes').select('*').eq('group_id', groupId).single(),
    ])
    setProductions(prev => prev.map(p => p.id === productionId
      ? {
          ...p,
          groups: p.groups.map(g => g.id === groupId
            ? {
                ...g,
                room: {
                  sharedNotes: note?.content ?? g.room.sharedNotes,
                  messages: (msgs || []).map(m => ({
                    id: m.id, senderId: m.sender_id, senderName: m.sender_name,
                    text: m.text, timestamp: m.timestamp, read: m.read,
                  })),
                },
              }
            : g),
        }
      : p))
  }, [])

  // --- Helpers ---
  const getProduction = useCallback((id) => productions.find(p => p.id === id), [productions])
  const getGroup = useCallback((productionId, groupId) => { const p = productions.find(p => p.id === productionId); return p?.groups.find(g => g.id === groupId) }, [productions])
  const getGroupByToken = useCallback((token) => {
    for (const p of productions) {
      const g = p.groups.find(g => g.openToken === token)
      if (g) return { production: p, group: g }
    }
    return null
  }, [productions])
  const getUnreadCount = useCallback((productionId, groupId) => { const g = productions.find(p => p.id === productionId)?.groups.find(g => g.id === groupId); return g?.room.messages.filter(m => !m.read && m.senderId !== 'owner').length ?? 0 }, [productions])
  const getTotalUnread = useCallback((productionId) => { const p = productions.find(p => p.id === productionId); return p?.groups.reduce((sum, g) => sum + (g.room.messages.filter(m => !m.read && m.senderId !== 'owner').length), 0) ?? 0 }, [productions])
  const getRoomLink = useCallback((token) => `${window.location.origin}/room/${token}`, [])
  const getMembersForGroup = useCallback((groupId) => groupMembers.filter(m => m.group_id === groupId || m.groupId === groupId), [groupMembers])

  return (
    <AppContext.Provider value={{
      // State
      productions, slots, connectedCalendars, calendarEvents, availabilityRules, prefixRules,
      isOwner, setIsOwner,
      googleAccessToken, setGoogleAccessToken,
      calendarSyncing, setCalendarSyncing,
      lastSynced,
      loading,
      groupMembers,
      // Slots
      createSlot, updateSlot, deleteSlot, reorderSlots,
      // Prefix Rules
      createPrefixRule, updatePrefixRule, deletePrefixRule,
      // Calendars
      addConnectedCalendar, updateCalendarRole, updateCalendarDefaultState, removeConnectedCalendar, replaceCalendarEvents,
      // Productions
      createProduction, updateProductionNotes,
      // Groups
      createGroup, updateGroupAccessMode,
      // Group Members
      addGroupMember, removeGroupMember,
      // Room
      updateSharedNotes, sendMessage, markRoomRead, refreshRoom,
      // Helpers
      getProduction, getGroup, getGroupByToken, getUnreadCount, getTotalUnread, getRoomLink, getMembersForGroup, resolveToken,
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
