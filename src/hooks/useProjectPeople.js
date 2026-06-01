import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'

// Single source of truth for a project's people roster + which ones are selected
// (included) for the joint-availability calculation. Shared by the left-panel
// roster (where you pick people) and ProjectOverview (which filters the calendar
// by the same selection). The owner is always the first person ("You").

export const OWNER_LABEL = 'You'
const isActiveReq = r => r.status !== 'declined' && r.status !== 'archived'

export function useProjectPeople(production, { dateRequestsByRoom = {}, sharedAvailByRoom = {} } = {}) {
  const { roomMembers, addRoomMember, removePersonEverywhere, getRoomLink } = useApp()
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
    const map = new Map() // name -> { sources:Set, memberId, inviteToken }
    const ensure = (name) => map.get(name) || map.set(name, { sources: new Set() }).get(name)
    for (const m of members) {
      if (!m.name) continue
      const e = ensure(m.name)
      e.memberId = m.id
      e.inviteToken = m.inviteToken || m.invite_token || null
    }
    for (const arr of Object.values(dateRequestsByRoom)) {
      for (const r of (arr || []).filter(isActiveReq)) {
        if (r.requester_name) ensure(r.requester_name).sources.add('tapped')
      }
    }
    for (const arr of Object.values(sharedAvailByRoom)) {
      for (const a of (arr || [])) {
        if (a.is_available && a.guest_name) ensure(a.guest_name).sources.add('calendar')
      }
    }
    const guests = [...map.entries()]
      .map(([name, v]) => ({ name, sources: [...v.sources], memberId: v.memberId, inviteToken: v.inviteToken }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [{ name: OWNER_LABEL, isOwner: true, sources: [], memberId: null, inviteToken: null }, ...guests]
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
    return removePersonEverywhere({ roomIds, name: person?.name, memberId: person?.memberId })
  }, [production, removePersonEverywhere])

  const inviteLink = useCallback((token) => (token ? getRoomLink(token) : null), [getRoomLink])

  // The open "anyone can join" link for this project.
  const shareLink = primaryRoom?.openToken ? getRoomLink(primaryRoom.openToken) : null

  return {
    people, excluded, includedOwner, totalPeople, includedCount,
    togglePerson, addPerson, removePerson, inviteLink, shareLink, primaryRoom,
  }
}
