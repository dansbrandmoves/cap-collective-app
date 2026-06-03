import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'

// Single source of truth for a project's people roster + which ones are selected
// (included) for the joint-availability calculation. Shared by the left-panel
// roster (where you pick people) and ProjectOverview (which filters the calendar
// by the same selection). The owner is always the first person ("You").

export const OWNER_LABEL = 'You'
const isActiveReq = r => r.status !== 'declined' && r.status !== 'archived'

export function useProjectPeople(production, { dateRequestsByRoom = {}, sharedAvailByRoom = {}, removeLocal } = {}) {
  const { roomMembers, addRoomMember, removePersonEverywhere, getRoomLink, sendRoomInvite } = useApp()
  const rooms = production?.rooms || []
  const primaryRoom = rooms[0] || null

  // Names excluded from the aggregate. Empty = everyone in.
  const [excluded, setExcluded] = useState(() => new Set())

  const members = useMemo(
    () => roomMembers.filter(m => primaryRoom && (m.room_id === primaryRoom.id || m.roomId === primaryRoom.id)),
    [roomMembers, primaryRoom]
  )

  // Roster: owner first, then everyone added (members) merged with anyone who
  // responded (tapped days / connected calendar), keyed by name.
  const people = useMemo(() => {
    const map = new Map() // name -> { sources:Set, memberId, inviteToken, email }
    const ensure = (name) => map.get(name) || map.set(name, { sources: new Set() }).get(name)
    for (const m of members) {
      if (!m.name) continue
      const e = ensure(m.name)
      e.memberId = m.id
      e.inviteToken = m.inviteToken || m.invite_token || null
      e.email = e.email || m.email || null
    }
    for (const arr of Object.values(dateRequestsByRoom)) {
      for (const r of (arr || []).filter(isActiveReq)) {
        if (!r.requester_name) continue
        const e = ensure(r.requester_name)
        e.sources.add('tapped')
        e.email = e.email || r.requester_email || null
      }
    }
    for (const arr of Object.values(sharedAvailByRoom)) {
      for (const a of (arr || [])) {
        if (a.is_available && a.guest_name) ensure(a.guest_name).sources.add('calendar')
      }
    }
    const guests = [...map.entries()]
      .map(([name, v]) => ({ name, sources: [...v.sources], memberId: v.memberId, inviteToken: v.inviteToken, email: v.email || null }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [{ name: OWNER_LABEL, isOwner: true, sources: [], memberId: null, inviteToken: null, email: null }, ...guests]
  }, [members, dateRequestsByRoom, sharedAvailByRoom])

  const includedOwner = !excluded.has(OWNER_LABEL)
  const totalPeople = people.length
  const includedCount = useMemo(() => people.filter(p => !excluded.has(p.name)).length, [people, excluded])

  const togglePerson = useCallback((name) => {
    setExcluded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }, [])

  // Returns the created member (with invite_token) so callers can build/send
  // that person's personal link.
  const addPerson = useCallback((name, email = '') => {
    const trimmed = (name || '').trim()
    if (!trimmed || !primaryRoom) return null
    return addRoomMember(primaryRoom.id, { name: trimmed, email: (email || '').trim() })
  }, [primaryRoom, addRoomMember])

  // Fully remove a person — their member row + all their shared availability /
  // date requests across the project's rooms, so they actually disappear.
  const removePerson = useCallback((person) => {
    const roomIds = (production?.rooms || []).map(r => r.id)
    // Optimistically clear the person from the availability signals too — the
    // roster merges roomMembers + date_requests + shared_availability, so clearing
    // only the member row (inside removePersonEverywhere) left them visible until
    // a realtime DELETE arrived. Also drop them from the excluded set for hygiene.
    removeLocal?.(person?.name)
    setExcluded(prev => { if (!prev.has(person?.name)) return prev; const n = new Set(prev); n.delete(person.name); return n })
    return removePersonEverywhere({ roomIds, name: person?.name, memberId: person?.memberId })
  }, [production, removePersonEverywhere, removeLocal])

  const inviteLink = useCallback((token) => (token ? getRoomLink(token) : null), [getRoomLink])

  // Email a person their personal invite link (needs email + invite token).
  const sendInvite = useCallback((person) => {
    if (!person?.email || !person?.inviteToken) return Promise.resolve(false)
    return sendRoomInvite({ name: person.name, email: person.email, inviteToken: person.inviteToken, productionName: production?.name })
  }, [sendRoomInvite, production])

  // The open "anyone can join" link for this project.
  const shareLink = primaryRoom?.openToken ? getRoomLink(primaryRoom.openToken) : null

  return {
    people, excluded, includedOwner, totalPeople, includedCount,
    togglePerson, addPerson, removePerson, inviteLink, sendInvite, shareLink, primaryRoom,
  }
}
