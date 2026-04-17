import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { nanoid } from 'nanoid'
import { SEED_DATA } from '../data/seed'
import { supabase } from '../utils/supabase'
import { buildSlotStates } from '../utils/availability'

const AppContext = createContext(null)
const STORAGE_KEY = 'coordie-app'

function resizeImage(file, maxW, maxH) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxW) { h = (h * maxW) / w; w = maxW }
      if (h > maxH) { w = (w * maxH) / h; h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      // Sample brightness from pixel data
      const data = ctx.getImageData(0, 0, w, h).data
      let totalBrightness = 0, opaquePixels = 0
      for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
        const a = data[i + 3]
        if (a < 50) continue // skip transparent
        totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        opaquePixels++
      }
      const avgBrightness = opaquePixels > 0 ? totalBrightness / opaquePixels : 128
      const isDark = avgBrightness < 128
      canvas.toBlob(blob => resolve({ blob, isDark }), 'image/webp', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

function loadFromStorage() {
  try {
    // Migrate from old key
    const oldRaw = localStorage.getItem('cap-collective-app')
    const newRaw = localStorage.getItem(STORAGE_KEY)
    if (oldRaw && !newRaw) {
      localStorage.setItem(STORAGE_KEY, oldRaw)
      localStorage.removeItem('cap-collective-app')
      return JSON.parse(oldRaw)
    }
    if (newRaw) return JSON.parse(newRaw)
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
    ownerId: p.owner_id,
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

async function seedSupabase(ownerId) {
  for (const p of SEED_DATA.productions) {
    await supabase.from('productions').upsert({
      id: p.id, name: p.name, description: p.description,
      start_date: p.startDate, end_date: p.endDate,
      owner_notes: p.ownerNotes, created_at: p.createdAt,
      owner_id: ownerId,
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

async function fetchAll(ownerId) {
  console.log('[Coordie] fetchAll for owner:', ownerId)
  const prodQuery = ownerId
    ? supabase.from('productions').select('*').eq('owner_id', ownerId).order('created_at')
    : supabase.from('productions').select('*').order('created_at')

  const [{ data: prods }, { data: grps }, { data: notes }, { data: msgs }, { data: members }] = await Promise.all([
    prodQuery,
    supabase.from('groups').select('*'),
    supabase.from('shared_notes').select('*'),
    supabase.from('messages').select('*').order('timestamp'),
    supabase.from('group_members').select('*'),
  ])
  return { prods, grps, notes, msgs, members }
}

export function AppProvider({ children }) {
  const stored = loadFromStorage()

  // --- Auth ---
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [plan, setPlan] = useState('free') // 'free' | 'pro'
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoIsDark, setLogoIsDark] = useState(true)

  const FREE_PROJECT_LIMIT = 1
  const FREE_GROUP_LIMIT = 2
  const FREE_BOOKING_PAGE_LIMIT = 1

  async function fetchPlan(userId) {
    if (!userId) { setPlan('free'); setLogoUrl(null); return }
    const { data } = await supabase.from('profiles').select('plan, logo_url, logo_is_dark').eq('id', userId).single()
    setPlan(data?.plan ?? 'free')
    setLogoUrl(data?.logo_url ?? null)
    setLogoIsDark(data?.logo_is_dark ?? true)
  }

  const uploadLogo = useCallback(async (file) => {
    if (!user?.id) return null
    const { blob, isDark } = await resizeImage(file, 400, 120)
    const path = `${user.id}/logo.webp`
    const { error: uploadErr } = await supabase.storage.from('logos').upload(path, blob, {
      contentType: 'image/webp', upsert: true,
    })
    if (uploadErr) { console.error('Logo upload failed:', uploadErr); return null }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    const url = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ logo_url: url, logo_is_dark: isDark }).eq('id', user.id)
    setLogoUrl(url)
    setLogoIsDark(isDark)
    return url
  }, [user])

  const removeLogo = useCallback(async () => {
    if (!user?.id) return
    await supabase.storage.from('logos').remove([`${user.id}/logo.webp`])
    await supabase.from('profiles').update({ logo_url: null }).eq('id', user.id)
    setLogoUrl(null)
  }, [user])

  useEffect(() => {
    let initialLoad = true
    // Safety timeout — 2s is plenty for auth
    const timeout = setTimeout(() => {
      if (initialLoad) {
        console.warn('Auth timed out — clearing stale session')
        localStorage.removeItem('sb-xwuekcysigkujhyucugi-auth-token')
        setUser(null)
        setAuthLoading(false)
        initialLoad = false
      }
    }, 2000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Set user FIRST, then resolve authLoading — prevents race where
      // data fetch sees authLoading=false but user is still null
      setUser(session?.user ?? null)
      fetchPlan(session?.user?.id ?? null)
      if (initialLoad) { initialLoad = false; clearTimeout(timeout); setAuthLoading(false) }
      // Send welcome email on sign-in (fire-and-forget)
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user
        supabase.functions.invoke('send-welcome-email', {
          body: { email: u.email, name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'there' },
        }).catch(err => console.error('Welcome email failed:', err))
      }
    })
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  const isOwner = !!user
  const isProPlan = plan === 'pro'

  const signOut = useCallback(() => {
    setUser(null) // clear immediately so UI redirects right away
    setPlan('free')
    supabase.auth.signOut().catch(err => console.error('signOut error:', err))
  }, [])

  // Supabase-backed
  const [productions, setProductions] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [bookingPages, setBookingPages] = useState([])

  const canAddProject = useCallback(() => {
    if (isProPlan) return true
    return productions.length < FREE_PROJECT_LIMIT
  }, [isProPlan, productions])

  const canAddGroup = useCallback((productionId) => {
    if (isProPlan) return true
    const prod = productions.find(p => p.id === productionId)
    if (!prod) return true
    return prod.groups.length < FREE_GROUP_LIMIT
  }, [isProPlan, productions])

  const canAddBookingPage = useCallback(() => {
    if (isProPlan) return true
    return bookingPages.length < FREE_BOOKING_PAGE_LIMIT
  }, [isProPlan, bookingPages])
  const [loading, setLoading] = useState(true)

  // localStorage-backed
  const [slots, setSlots] = useState(() => stored?.slots ?? SEED_DATA.slots)
  const [connectedCalendars, setConnectedCalendars] = useState(() => stored?.connectedCalendars ?? SEED_DATA.connectedCalendars)
  const [calendarEvents, setCalendarEvents] = useState(() => stored?.calendarEvents ?? SEED_DATA.calendarEvents)
  const [availabilityRules, setAvailabilityRules] = useState(() => stored?.availabilityRules ?? SEED_DATA.availabilityRules)
  const [prefixRules, setPrefixRules] = useState(() => stored?.prefixRules ?? SEED_DATA.prefixRules)
  const [googleAccessToken, setGoogleAccessToken] = useState(() => stored?.googleAccessToken ?? null)
  const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState(() => stored?.googleTokenExpiresAt ?? null)
  const [calendarSyncing, setCalendarSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(() => stored?.lastSynced ?? null)
  const [theme, setTheme] = useState(() => stored?.theme ?? 'dark')
  const [slotStateCustomizations, setSlotStateCustomizations] = useState(() => stored?.slotStateCustomizations ?? {})
  const [businessHours, setBusinessHours] = useState(() => {
    const saved = stored?.businessHours
    // Migrate old flat format → per-day schedule
    if (saved && !saved.schedule) {
      const schedule = {}
      for (let d = 0; d < 7; d++) {
        schedule[d] = (saved.days || [1,2,3,4,5]).includes(d)
          ? { start: saved.start || '09:00', end: saved.end || '17:00' }
          : null
      }
      return { schedule }
    }
    return saved ?? {
      schedule: {
        0: null,
        1: { start: '09:00', end: '17:00' },
        2: { start: '09:00', end: '17:00' },
        3: { start: '09:00', end: '17:00' },
        4: { start: '09:00', end: '17:00' },
        5: { start: '09:00', end: '17:00' },
        6: null,
      }
    }
  })
  const [guestCalendarEnabled, setGuestCalendarEnabled] = useState(() => stored?.guestCalendarEnabled ?? false)
  const [availabilityMode, setAvailabilityMode] = useState(() => stored?.availabilityMode ?? 'blocks')
  const [blockDuration, setBlockDuration] = useState(() => stored?.blockDuration ?? 30)

  // Effective slots: auto-generated from business hours (blocks mode) or user-defined (slots mode)
  const effectiveSlots = useMemo(() => {
    if (availabilityMode === 'slots') return slots
    const schedule = businessHours.schedule || {}
    let earliest = '23:59', latest = '00:00'
    for (const day of Object.values(schedule)) {
      if (!day) continue
      if (day.start < earliest) earliest = day.start
      if (day.end > latest) latest = day.end
    }
    if (earliest >= latest) return slots // fallback
    const generated = []
    let [h, m] = earliest.split(':').map(Number)
    const [eh, em] = latest.split(':').map(Number)
    const endMins = eh * 60 + em
    while (h * 60 + m + blockDuration <= endMins) {
      const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const totalEnd = h * 60 + m + blockDuration
      const end = `${String(Math.floor(totalEnd / 60)).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}`
      const period = h >= 12 ? 'PM' : 'AM'
      generated.push({
        id: `block-${start}`,
        name: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`,
        startTime: start, endTime: end,
        color: '#22c55e', defaultState: 'available',
      })
      m += blockDuration
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
    }
    return generated
  }, [availabilityMode, slots, businessHours, blockDuration])

  // Derived: customized slot states
  const slotStates = useMemo(() => buildSlotStates(slotStateCustomizations), [slotStateCustomizations])

  // --- Notifications (messages across all rooms) ---
  const NOTIF_LAST_SEEN_KEY = 'coordie-notifications-last-seen'
  const [notificationsLastSeen, setNotificationsLastSeen] = useState(() => {
    try { return localStorage.getItem(NOTIF_LAST_SEEN_KEY) || null } catch { return null }
  })

  const markNotificationsSeen = useCallback(() => {
    const now = new Date().toISOString()
    setNotificationsLastSeen(now)
    try { localStorage.setItem(NOTIF_LAST_SEEN_KEY, now) } catch { /* full */ }
  }, [])

  const recentNotifications = useMemo(() => {
    return productions
      .flatMap(p => p.groups.flatMap(g =>
        g.room.messages.map(m => ({
          ...m,
          productionName: p.name,
          groupName: g.name,
          openToken: g.openToken,
          productionId: p.id,
          groupId: g.id,
        }))
      ))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30)
  }, [productions])

  const unreadNotificationCount = useMemo(() => {
    if (!notificationsLastSeen) return recentNotifications.length
    return recentNotifications.filter(n => new Date(n.timestamp) > new Date(notificationsLastSeen)).length
  }, [recentNotifications, notificationsLastSeen])

  // Pending request counts per group (for notifications)
  const [pendingRequestCounts, setPendingRequestCounts] = useState({}) // { groupId: count }

  // Fetch pending counts once productions are loaded
  useEffect(() => {
    if (!productions.length) return
    const allGroupIds = productions.flatMap(p => p.groups.map(g => g.id))
    if (!allGroupIds.length) return
    supabase
      .from('date_requests')
      .select('group_id')
      .eq('status', 'pending')
      .in('group_id', allGroupIds)
      .then(({ data }) => {
        const counts = {}
        ;(data || []).forEach(r => { counts[r.group_id] = (counts[r.group_id] || 0) + 1 })
        setPendingRequestCounts(counts)
      })
  }, [productions])

  // Real-time subscription for new date requests
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('date-requests-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'date_requests' }, (payload) => {
        const groupId = payload.new.group_id
        setPendingRequestCounts(prev => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'date_requests' }, (payload) => {
        if (payload.old.status === 'pending' && payload.new.status !== 'pending') {
          const groupId = payload.new.group_id
          setPendingRequestCounts(prev => ({ ...prev, [groupId]: Math.max(0, (prev[groupId] || 0) - 1) }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Real-time subscription for new messages (notifications)
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('messages-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new
        setProductions(prev => prev.map(p => ({
          ...p,
          groups: p.groups.map(g =>
            g.id === msg.group_id
              ? { ...g, room: { ...g.room, messages: [...g.room.messages, { id: msg.id, senderId: msg.sender_id, senderName: msg.sender_name, text: msg.text, timestamp: msg.timestamp, read: msg.read }] } }
              : g
          ),
        })))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const getPendingRequestCount = useCallback((productionId) => {
    const prod = productions.find(p => p.id === productionId)
    if (!prod) return 0
    return prod.groups.reduce((sum, g) => sum + (pendingRequestCounts[g.id] || 0), 0)
  }, [productions, pendingRequestCounts])

  const getTotalPendingRequests = useCallback(() => {
    return Object.values(pendingRequestCounts).reduce((sum, c) => sum + c, 0)
  }, [pendingRequestCounts])

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])

  // Fetch productions once auth is resolved
  useEffect(() => {
    if (authLoading) return
    const ownerId = user?.id ?? null
    setLoading(true)

    console.log('[Coordie] Loading data for:', ownerId || 'guest')

    // Safety timeout — never stay stuck on loading
    const loadTimeout = setTimeout(() => {
      console.warn('[Coordie] Data load timed out — proceeding with empty state')
      setLoading(false)
    }, 6000)

    // Fetch everything in parallel (productions + booking pages)
    const dataPromise = fetchAll(ownerId)
    const bookingPromise = ownerId
      ? supabase.from('booking_pages').select('*').eq('owner_id', ownerId).order('created_at')
      : Promise.resolve({ data: [] })

    Promise.all([dataPromise, bookingPromise])
      .then(async ([{ prods, grps, notes, msgs, members }, { data: bPages }]) => {
        console.log('[Coordie] Fetched:', { prods: prods?.length || 0, grps: grps?.length || 0, bookingPages: bPages?.length || 0 })
        setBookingPages(bPages || [])
        if (!prods?.length && ownerId) {
          // Only seed if this is a brand new user — check if any productions exist at all
          const { count } = await supabase.from('productions').select('id', { count: 'exact', head: true })
          if (count === 0) {
            await seedSupabase(ownerId)
            const fresh = await fetchAll(ownerId)
            setProductions(buildProductions(fresh.prods, fresh.grps, fresh.notes, fresh.msgs))
            setGroupMembers(fresh.members || [])
          } else {
            // User just has no productions yet — that's fine, show empty state
            setProductions([])
            setGroupMembers(members || [])
          }
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
      .finally(() => { clearTimeout(loadTimeout); setLoading(false) })
  }, [authLoading, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveToStorage({
      slots, connectedCalendars, calendarEvents, availabilityRules, prefixRules,
      googleAccessToken, googleTokenExpiresAt, lastSynced,
      theme, slotStateCustomizations, businessHours, guestCalendarEnabled,
      availabilityMode, blockDuration,
    })
  }, [slots, connectedCalendars, calendarEvents, availabilityRules, prefixRules,
      googleAccessToken, googleTokenExpiresAt, lastSynced, theme, slotStateCustomizations,
      businessHours, guestCalendarEnabled, availabilityMode, blockDuration])

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

  // --- Slot State Customization ---
  const updateSlotStateCustomization = useCallback((stateKey, updates) => {
    setSlotStateCustomizations(prev => ({ ...prev, [stateKey]: { ...(prev[stateKey] || {}), ...updates } }))
  }, [])

  const resetSlotStateCustomizations = useCallback(() => {
    setSlotStateCustomizations({})
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

  const replaceCalendarEvents = useCallback(async (newEvents) => {
    setCalendarEvents(newEvents)
    setLastSynced(new Date().toISOString())

    // Also store in Supabase so booking pages can read owner availability
    if (user?.id) {
      try {
        await supabase.from('owner_calendar_events').delete().eq('owner_id', user.id)
        if (newEvents.length > 0) {
          await supabase.from('owner_calendar_events').insert(
            newEvents.map(e => ({
              owner_id: user.id,
              calendar_id: e.calendarId,
              title: e.title,
              start: e.start,
              end_at: e.end,
              is_all_day: e.isAllDay || false,
            }))
          )
        }
      } catch (err) {
        console.error('Failed to sync calendar events to Supabase:', err)
      }
    }
  }, [user])

  // --- Productions ---
  const createProduction = useCallback(async (data) => {
    const ownerId = user?.id ?? null
    const production = {
      id: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + nanoid(6),
      name: data.name,
      description: data.description ?? '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      ownerNotes: '',
      ownerId,
      createdAt: new Date().toISOString(),
      groups: [],
    }
    setProductions(prev => [...prev, production])
    const { error } = await supabase.from('productions').insert({
      id: production.id, name: production.name, description: production.description,
      start_date: production.startDate, end_date: production.endDate,
      owner_notes: production.ownerNotes, created_at: production.createdAt,
      owner_id: ownerId,
    })
    if (error) {
      console.error('createProduction failed:', error)
      // Remove from local state if DB insert failed
      setProductions(prev => prev.filter(p => p.id !== production.id))
    }
    return production.id
  }, [user?.id])

  const updateProduction = useCallback(async (productionId, updates) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, ...updates } : p))
    const dbUpdates = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
    if (updates.ownerNotes !== undefined) dbUpdates.owner_notes = updates.ownerNotes
    if (updates.availability_config !== undefined) dbUpdates.availability_config = updates.availability_config
    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from('productions').update(dbUpdates).eq('id', productionId)
      if (error) console.error('updateProduction:', error)
    }
  }, [])

  const updateProductionNotes = useCallback((productionId, notes) => {
    setProductions(prev => prev.map(p => p.id === productionId ? { ...p, ownerNotes: notes } : p))
    supabase.from('productions').update({ owner_notes: notes }).eq('id', productionId)
      .then(({ error }) => { if (error) console.error('updateProductionNotes:', error) })
  }, [])

  const deleteProduction = useCallback(async (productionId) => {
    const prod = productions.find(p => p.id === productionId)
    if (!prod) return
    // Delete child data first
    for (const g of prod.groups) {
      await supabase.from('date_requests').delete().eq('group_id', g.id)
      await supabase.from('messages').delete().eq('group_id', g.id)
      await supabase.from('shared_notes').delete().eq('group_id', g.id)
      await supabase.from('group_members').delete().eq('group_id', g.id)
    }
    const groupIds = prod.groups.map(g => g.id)
    if (groupIds.length) await supabase.from('groups').delete().in('id', groupIds)
    const { error } = await supabase.from('productions').delete().eq('id', productionId)
    if (error) { console.error('deleteProduction:', error); return }
    setProductions(prev => prev.filter(p => p.id !== productionId))
  }, [productions])

  // --- Groups ---
  const createGroup = useCallback(async (productionId, name) => {
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
    const { error: grpErr } = await supabase.from('groups').insert({ id: group.id, production_id: productionId, name, access_mode: 'open_link', open_token: token })
    if (grpErr) console.error('createGroup failed:', grpErr)
    const { error: noteErr } = await supabase.from('shared_notes').insert({ group_id: group.id, content: group.room.sharedNotes })
    if (noteErr) console.error('createGroup notes failed:', noteErr)
    return group.id
  }, [])

  const updateGroupName = useCallback(async (productionId, groupId, name) => {
    setProductions(prev => prev.map(p => p.id === productionId
      ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, name } : g) }
      : p))
    const { error } = await supabase.from('groups').update({ name }).eq('id', groupId)
    if (error) console.error('updateGroupName:', error)
  }, [])

  const deleteGroup = useCallback(async (productionId, groupId) => {
    await supabase.from('date_requests').delete().eq('group_id', groupId)
    await supabase.from('messages').delete().eq('group_id', groupId)
    await supabase.from('shared_notes').delete().eq('group_id', groupId)
    await supabase.from('group_members').delete().eq('group_id', groupId)
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) { console.error('deleteGroup:', error); return }
    setProductions(prev => prev.map(p => p.id === productionId
      ? { ...p, groups: p.groups.filter(g => g.id !== groupId) }
      : p))
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
    const token = nanoid(8)
    const finalMember = { id: `mem-${Date.now()}`, groupId, group_id: groupId, name, email: email || '', inviteToken: token, invite_token: token }
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
    const [{ data: groupRows }, { data: memberRows }] = await Promise.all([
      supabase.from('groups').select('id, production_id, access_mode').eq('open_token', token).limit(1),
      supabase.from('group_members').select('id, group_id, name').eq('invite_token', token).limit(1),
    ])
    const groupRow = groupRows?.[0] ?? null
    const memberRow = memberRows?.[0] ?? null
    if (groupRow) {
      return { productionId: groupRow.production_id, groupId: groupRow.id, mode: 'open_link', memberName: null }
    }
    if (memberRow) {
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

  // --- Booking Pages ---
  function toSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + nanoid(4)
  }

  const createBookingPage = useCallback(async ({ name, description, durationMinutes, availableHours, availableDays, requiredFields }) => {
    const page = {
      id: `bp-${Date.now()}`,
      owner_id: user?.id,
      name,
      slug: toSlug(name),
      description: description || '',
      duration_minutes: durationMinutes || 30,
      available_hours: availableHours || { start: '09:00', end: '17:00' },
      available_days: availableDays || [1, 2, 3, 4, 5],
      required_fields: requiredFields || { name: true, email: true, message: false },
      is_active: true,
      created_at: new Date().toISOString(),
    }
    setBookingPages(prev => [...prev, page])
    const { error } = await supabase.from('booking_pages').insert(page)
    if (error) {
      console.error('createBookingPage:', error)
      setBookingPages(prev => prev.filter(p => p.id !== page.id))
      return null
    }
    return page.id
  }, [user?.id])

  const updateBookingPage = useCallback(async (id, updates) => {
    setBookingPages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    const { error } = await supabase.from('booking_pages').update(updates).eq('id', id)
    if (error) console.error('updateBookingPage:', error)
    return !error
  }, [])

  const deleteBookingPage = useCallback(async (id) => {
    setBookingPages(prev => prev.filter(p => p.id !== id))
    const { error } = await supabase.from('booking_pages').delete().eq('id', id)
    if (error) console.error('deleteBookingPage:', error)
    return !error
  }, [])

  const resolveBookingSlug = useCallback(async (slug) => {
    const { data } = await supabase.from('booking_pages').select('*').eq('slug', slug).eq('is_active', true).limit(1)
    return data?.[0] ?? null
  }, [])

  const fetchBookingsForPage = useCallback(async (bookingPageId) => {
    const { data, error } = await supabase
      .from('bookings').select('*')
      .eq('booking_page_id', bookingPageId)
      .order('date', { ascending: false })
    if (error) { console.error('fetchBookingsForPage:', error); return [] }
    return data || []
  }, [])

  const createBooking = useCallback(async ({ bookingPageId, guestName, guestEmail, guestMessage, date, startTime, endTime }) => {
    const booking = {
      id: `bk-${Date.now()}`,
      booking_page_id: bookingPageId,
      guest_name: guestName,
      guest_email: guestEmail || '',
      message: guestMessage || '',
      date,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
    }
    const { error } = await supabase.from('bookings').insert(booking)
    if (error) { console.error('createBooking:', error); return false }
    return true
  }, [])

  const updateBookingStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) console.error('updateBookingStatus:', error)
    return !error
  }, [])

  const deleteBooking = useCallback(async (id) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) console.error('deleteBooking:', error)
    return !error
  }, [])

  // --- Date Requests ---
  const createDateRequest = useCallback(async (groupId, { requesterName, requesterEmail, dates, message }) => {
    const request = {
      id: `dr-${Date.now()}`,
      group_id: groupId,
      requester_name: requesterName,
      requester_email: requesterEmail || '',
      dates: dates,
      message: message || '',
      status: 'pending',
    }
    const { error } = await supabase.from('date_requests').insert(request)
    if (error) { console.error('createDateRequest:', error); return false }

    // Find group + production names for the notification email
    let groupName = '', productionName = ''
    for (const p of productions) {
      const g = p.groups.find(g => g.id === groupId)
      if (g) { groupName = g.name; productionName = p.name; break }
    }

    // Notify the owner via email (fire-and-forget — don't block on failure)
    supabase.functions.invoke('notify-date-request', {
      body: {
        requesterName,
        requesterEmail: requesterEmail || '',
        dates,
        message: message || '',
        groupName,
        productionName,
        ownerEmail: user?.email ?? null,
      },
    }).catch(err => console.warn('Date request email notification failed:', err))

    return true
  }, [productions, user?.email])

  const fetchDateRequests = useCallback(async (groupId) => {
    const { data, error } = await supabase
      .from('date_requests')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    if (error) { console.error('fetchDateRequests:', error); return [] }
    return data || []
  }, [])

  const updateDateRequestStatus = useCallback(async (requestId, status) => {
    const { error } = await supabase.from('date_requests').update({ status }).eq('id', requestId)
    if (error) console.error('updateDateRequestStatus:', error)
    return !error
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
  const getRoomLink = useCallback((token) => `${window.location.origin}/room/${token}`, [])
  const getMembersForGroup = useCallback((groupId) => groupMembers.filter(m => m.group_id === groupId || m.groupId === groupId), [groupMembers])

  return (
    <AppContext.Provider value={{
      // Auth
      user, authLoading, isOwner, signOut,
      // Plan
      plan, isProPlan, canAddProject, canAddGroup, canAddBookingPage,
      FREE_PROJECT_LIMIT, FREE_GROUP_LIMIT, FREE_BOOKING_PAGE_LIMIT,
      // State
      productions, slots, effectiveSlots, connectedCalendars, calendarEvents, availabilityRules, prefixRules,
      googleAccessToken, setGoogleAccessToken,
      googleTokenExpiresAt, setGoogleTokenExpiresAt,
      calendarSyncing, setCalendarSyncing,
      lastSynced,
      loading,
      groupMembers,
      // Theme
      theme, toggleTheme,
      // Slot States (customizable)
      slotStates, slotStateCustomizations,
      updateSlotStateCustomization, resetSlotStateCustomizations,
      // Slots
      createSlot, updateSlot, deleteSlot, reorderSlots,
      // Prefix Rules
      createPrefixRule, updatePrefixRule, deletePrefixRule,
      // Calendars
      addConnectedCalendar, updateCalendarRole, updateCalendarDefaultState, removeConnectedCalendar, replaceCalendarEvents,
      // Productions
      createProduction, updateProduction, updateProductionNotes, deleteProduction,
      // Groups
      createGroup, updateGroupName, deleteGroup, updateGroupAccessMode,
      // Group Members
      addGroupMember, removeGroupMember,
      // Room
      updateSharedNotes, refreshRoom,
      // Booking Pages
      bookingPages, createBookingPage, updateBookingPage, deleteBookingPage,
      resolveBookingSlug, fetchBookingsForPage, createBooking, updateBookingStatus, deleteBooking,
      // Date Requests
      createDateRequest, fetchDateRequests, updateDateRequestStatus,
      // Notifications
      pendingRequestCounts, getPendingRequestCount, getTotalPendingRequests,
      recentNotifications, unreadNotificationCount, markNotificationsSeen, notificationsLastSeen,
      // Business Hours & Guest Calendar
      businessHours, setBusinessHours,
      guestCalendarEnabled, setGuestCalendarEnabled,
      // Availability Mode
      availabilityMode, setAvailabilityMode, blockDuration, setBlockDuration,
      // Branding
      logoUrl, logoIsDark, uploadLogo, removeLogo,
      // Helpers
      getProduction, getGroup, getGroupByToken, getRoomLink, getMembersForGroup, resolveToken,
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
