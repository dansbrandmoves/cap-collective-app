import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../utils/supabase'

/**
 * Loads availability signals across ALL groups (rooms) of a project so the
 * project-level calendar can answer "when can everyone do this?".
 *
 * Two batched queries (date_requests + shared_availability) scoped to the
 * project's room ids, plus a realtime subscription. Postgres `filter:` can't
 * express IN(), so changes are filtered client-side by roomId membership.
 *
 * Returns by-room maps (what aggregateProjectDay expects) plus flat arrays.
 */
export function useProjectAvailability(production) {
  const roomIds = useMemo(
    () => (production?.rooms || []).map(r => r.id),
    [production]
  )
  // Stable key so the effect doesn't re-run on every render (rooms array is
  // a fresh reference each time the context rebuilds).
  const roomKey = roomIds.join(',')

  const [loading, setLoading] = useState(true)
  const [allDateRequests, setAllDateRequests] = useState([])
  const [allSharedAvail, setAllSharedAvail] = useState([])

  useEffect(() => {
    if (!roomIds.length) { setAllDateRequests([]); setAllSharedAvail([]); setLoading(false); return }
    let cancelled = false

    // Stale-while-revalidate: paint the project's last-known availability from cache
    // immediately, then refresh from the server. Avoids a blank/loading calendar on
    // every refresh once the data has been seen once this session.
    const cacheKey = `coordie-projavail-${roomKey}`
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null')
      if (cached) {
        setAllDateRequests(cached.dateRequests || [])
        setAllSharedAvail(cached.sharedAvailability || [])
        setLoading(false)
      } else {
        setLoading(true)
      }
    } catch { setLoading(true) }

    const latest = { dateRequests: [], sharedAvailability: [] }
    const writeCache = () => { try { sessionStorage.setItem(cacheKey, JSON.stringify(latest)) } catch { /* full */ } }

    function loadRequests() {
      return supabase.from('date_requests').select('*').in('room_id', roomIds)
        .then(({ data }) => { if (!cancelled) { latest.dateRequests = data || []; setAllDateRequests(latest.dateRequests); writeCache() } })
    }
    function loadAvail() {
      return supabase.from('shared_availability').select('*').eq('is_available', true).in('room_id', roomIds)
        .then(({ data }) => { if (!cancelled) { latest.sharedAvailability = data || []; setAllSharedAvail(latest.sharedAvailability); writeCache() } })
    }

    Promise.all([loadRequests(), loadAvail()]).then(() => { if (!cancelled) setLoading(false) })

    const channel = supabase
      .channel(`project-availability-${roomKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_requests' }, payload => {
        const rid = payload.new?.room_id || payload.old?.room_id
        if (rid && roomIds.includes(rid)) loadRequests()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_availability' }, payload => {
        const rid = payload.new?.room_id || payload.old?.room_id
        if (rid && roomIds.includes(rid)) loadAvail()
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [roomKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateRequestsByRoom = useMemo(() => {
    const map = {}
    for (const r of allDateRequests) (map[r.room_id] ||= []).push(r)
    return map
  }, [allDateRequests])

  const sharedAvailByRoom = useMemo(() => {
    const map = {}
    for (const a of allSharedAvail) (map[a.room_id] ||= []).push(a)
    return map
  }, [allSharedAvail])

  return { loading, allDateRequests, allSharedAvail, dateRequestsByRoom, sharedAvailByRoom }
}
