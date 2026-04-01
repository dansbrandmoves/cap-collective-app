// Seed data — mimics a real live production so the app looks alive on first load

export const SEED_DATA = {
  // Default slot configuration — Christian can customize per production
  slots: [
    {
      id: 'slot-am',
      name: 'Morning',
      startTime: '08:00',
      endTime: '12:00',
      color: '#22c55e',
      defaultState: 'available',
    },
    {
      id: 'slot-pm',
      name: 'Afternoon',
      startTime: '13:00',
      endTime: '17:00',
      color: '#22c55e',
      defaultState: 'available',
    },
  ],

  // Connected calendars — stubbed until OAuth is wired
  connectedCalendars: [
    { id: 'gcal-001', googleCalendarId: 'primary',   name: 'CAP A — Production', color: '#f59e0b', role: 'governs',       defaultState: 'booked' },
    { id: 'gcal-002', googleCalendarId: 'holds',     name: 'CAP B — Holds',      color: '#6366f1', role: 'governs',       defaultState: 'hold' },
    { id: 'gcal-003', googleCalendarId: 'personal',  name: 'Personal',           color: '#ef4444', role: 'informational', defaultState: 'booked' },
    { id: 'gcal-004', googleCalendarId: 'xschedule', name: 'X Schedule',         color: '#6b7280', role: 'ignored',       defaultState: 'booked' },
  ],

  // Calendar events — structured to exercise all derivation rules:
  // * prefix = veto (highest priority, always blocks)
  // ^ prefix = soft hold (tentative/orange)
  // no prefix on governing calendar = regular block
  // events on ignored/informational calendars = no effect on slot state
  calendarEvents: [
    // Regular booked days — governing calendar, no prefix
    {
      id: 'cal-001',
      calendarId: 'primary',
      title: 'Solé Campaign — Day 1',
      start: '2026-04-14T08:00:00',
      end: '2026-04-14T17:00:00',
      isAllDay: false,
    },
    {
      id: 'cal-002',
      calendarId: 'primary',
      title: 'Solé Campaign — Day 2',
      start: '2026-04-15T08:00:00',
      end: '2026-04-15T17:00:00',
      isAllDay: false,
    },
    {
      id: 'cal-003',
      calendarId: 'primary',
      title: 'Solé Campaign — Day 3',
      start: '2026-04-16T08:00:00',
      end: '2026-04-16T17:00:00',
      isAllDay: false,
    },
    // Soft hold — ^ prefix on governing calendar
    {
      id: 'cal-004',
      calendarId: 'holds',
      title: '^ Possible Nike inquiry',
      start: '2026-04-21',
      end: '2026-04-23', // all-day exclusive end (Google convention: subtract 1 day)
      isAllDay: true,
    },
    // Veto — * prefix, cannot be overridden
    {
      id: 'cal-005',
      calendarId: 'primary',
      title: '* Hard block — personal commitment',
      start: '2026-04-10',
      end: '2026-04-12', // all-day exclusive end
      isAllDay: true,
    },
    // Available window
    {
      id: 'cal-006',
      calendarId: 'primary',
      title: 'Available — open for bookings',
      start: '2026-04-07T08:00:00',
      end: '2026-04-09T17:00:00',
      isAllDay: false,
    },
    // Meridian Hotel shoot
    {
      id: 'cal-007',
      calendarId: 'primary',
      title: 'Meridian Hotel — Day 1',
      start: '2026-04-28T08:00:00',
      end: '2026-04-28T17:00:00',
      isAllDay: false,
    },
    {
      id: 'cal-008',
      calendarId: 'primary',
      title: 'Meridian Hotel — Day 2',
      start: '2026-04-29T08:00:00',
      end: '2026-04-29T17:00:00',
      isAllDay: false,
    },
    // Personal event — informational only, no effect on slot state
    {
      id: 'cal-009',
      calendarId: 'personal',
      title: 'Doctor appointment',
      start: '2026-04-17T10:00:00',
      end: '2026-04-17T11:00:00',
      isAllDay: false,
    },
    // Morning-only block — partial day
    {
      id: 'cal-010',
      calendarId: 'primary',
      title: 'Morning prep call',
      start: '2026-04-22T08:00:00',
      end: '2026-04-22T11:00:00',
      isAllDay: false,
    },
    // Soft hold on a specific afternoon
    {
      id: 'cal-011',
      calendarId: 'holds',
      title: '^ Weather hold — PCH shoot',
      start: '2026-04-24T13:00:00',
      end: '2026-04-24T17:00:00',
      isAllDay: false,
    },
  ],

  // Seed group members (for invite-only demo, empty by default)
  groupMembers: [],

  productions: [
    {
      id: 'prod-001',
      name: 'Pacific Coast Lifestyle Campaign',
      description: 'Three-day brand shoot across Malibu and Venice Beach for Solé Collective.',
      startDate: '2026-04-14',
      endDate: '2026-04-16',
      ownerNotes: 'Client is detail-oriented — respond same day. Vendor pricing still TBD, hold off confirming crew until brand confirms selects from the mood board. Prefer mornings at PCH, light is perfect before 10am.',
      createdAt: '2026-03-20T10:00:00Z',
      groups: [
        {
          id: 'grp-001',
          productionId: 'prod-001',
          name: 'Brand Team',
          accessMode: 'open_link',
          openToken: 'Xk8mN2pQ',
          members: ['sarah@solecollective.com', 'marcus@solecollective.com'],
          room: {
            sharedNotes: `# Brand Team — Shared Notes\n\n## Shot List (Draft)\n- Lifestyle walk on Venice Boardwalk (magic hour)\n- Product flat lays at the Airbnb\n- Water / beach movement shots — PCH overlook\n- Interview-style testimonial with founder (optional)\n\n## Location Confirmations\n- Venice Boardwalk: ✓ confirmed, no permit needed\n- PCH overlook: ✓ confirmed\n- Studio backup (rain day): TBD — Christian to confirm\n\n## Open Items\n- [ ] Final mood board approval from Marcus\n- [ ] Call sheet distribution by April 10\n- [ ] Confirm catering for Day 2`,
            messages: [
              { id: 'msg-001', senderId: 'owner', senderName: 'Christian', text: 'Hey team — shot list draft is in the notes above. Take a look and let me know if anything needs adjusting before I lock the call sheet.', timestamp: '2026-04-01T09:15:00Z', read: true },
              { id: 'msg-002', senderId: 'sarah@solecollective.com', senderName: 'Sarah', text: "Looks great. Marcus wants to add a founder testimonial — can we fit that in Day 2 afternoon? Maybe 30 min.", timestamp: '2026-04-01T10:32:00Z', read: true },
              { id: 'msg-003', senderId: 'owner', senderName: 'Christian', text: "Absolutely — I'll block 3–3:30pm on Day 2. I'll note it in the call sheet as optional/weather-dependent.", timestamp: '2026-04-01T11:05:00Z', read: true },
              { id: 'msg-004', senderId: 'marcus@solecollective.com', senderName: 'Marcus', text: 'Perfect. Mood board approval coming today.', timestamp: '2026-04-01T14:20:00Z', read: false },
            ],
          },
        },
        {
          id: 'grp-002',
          productionId: 'prod-001',
          name: 'Vendor Partners',
          accessMode: 'open_link',
          openToken: 'Yt3bR7wL',
          members: ['lens@studiobly.com', 'lighting@goldenhourinc.com'],
          room: {
            sharedNotes: `# Vendor Partners — Shared Notes\n\n## Crew & Equipment\n- **Photography:** Studio Bly (primary), 1 assistant\n- **Lighting:** Golden Hour Inc — 2-person crew, HMI kit\n\n## Rates & Invoicing\n- Studio Bly: $3,200/day × 3 days\n- Golden Hour Inc: $1,800/day × 2 days\n- Invoices due Net 15 after wrap`,
            messages: [
              { id: 'msg-005', senderId: 'owner', senderName: 'Christian', text: "Hey both — rates confirmed, I'll have contracts out by April 5.", timestamp: '2026-03-28T16:00:00Z', read: true },
              { id: 'msg-006', senderId: 'lens@studiobly.com', senderName: 'Studio Bly', text: 'Confirmed on our end. Will you need a 2nd shooter for Day 1 or just primary?', timestamp: '2026-03-29T09:45:00Z', read: true },
              { id: 'msg-007', senderId: 'owner', senderName: 'Christian', text: 'Primary only for Day 1. Might bring in 2nd for Day 2 — will confirm by April 7.', timestamp: '2026-03-29T11:10:00Z', read: true },
            ],
          },
        },
        {
          id: 'grp-003',
          productionId: 'prod-001',
          name: 'Crew',
          accessMode: 'open_link',
          openToken: 'Zm4dS9vK',
          members: ['alex@freelance.io', 'priya@gmx.com'],
          room: {
            sharedNotes: `# Crew — Shared Notes\n\n## Assignments\n- **Alex:** BTS content, stills, behind-camera social capture\n- **Priya:** PA / talent liaison, logistics on ground\n\n## Reminders\n- Dress code: neutral/dark clothing, no logos\n- Bring your own water — craft services on set from 8am`,
            messages: [
              { id: 'msg-008', senderId: 'owner', senderName: 'Christian', text: "Alex, Priya — you're confirmed for all 3 days. Notes above have the rundown.", timestamp: '2026-03-30T13:00:00Z', read: true },
              { id: 'msg-009', senderId: 'priya@gmx.com', senderName: 'Priya', text: "All good on my end! Do you need me earlier than 6am on Day 1 for location setup?", timestamp: '2026-03-31T08:20:00Z', read: false },
            ],
          },
        },
      ],
    },
    {
      id: 'prod-002',
      name: 'Meridian Hotel — Brand Identity Shoot',
      description: "Property photography and lifestyle campaign for Meridian's LA rebrand.",
      startDate: '2026-04-28',
      endDate: '2026-04-29',
      ownerNotes: 'Hotel GM is very hands-on — loop him on everything. Budget is flexible but document all expenses. No drone permit yet — checking with the city.',
      createdAt: '2026-03-25T14:00:00Z',
      groups: [
        {
          id: 'grp-004',
          productionId: 'prod-002',
          name: 'Hotel Team',
          accessMode: 'open_link',
          openToken: 'An6eT1xJ',
          members: ['gm@meridianla.com'],
          room: {
            sharedNotes: `# Hotel Team — Shared Notes\n\n## Shoot Areas Confirmed\n- Lobby + bar area (Day 1 morning)\n- Rooftop pool (Day 1 afternoon, post-checkout)\n- Suite 812 — hero room (Day 2)\n\n## Access Notes\n- Loading dock access: 6am–8pm only\n- No flash photography in occupied dining room`,
            messages: [
              { id: 'msg-010', senderId: 'owner', senderName: 'Christian', text: "Hi James — areas are confirmed and in the notes above. I'll send the full crew manifest by April 20 for your security team.", timestamp: '2026-03-26T10:00:00Z', read: true },
            ],
          },
        },
      ],
    },
  ],

  prefixRules: [
    { id: 'pr-1', prefix: '*', state: 'blocked', description: 'Not Available — confirmed booking, hard block' },
    { id: 'pr-2', prefix: '^', state: 'hold', description: 'Penciled — soft hold, potentially available' },
  ],

  availabilityRules: [
    { id: 'rule-001', productionId: 'prod-001', label: 'Available — early morning preferred', date: '2026-04-07', tier: 'available', privateNote: 'Prefer 6–10am shoots this week, energy is good early.' },
    { id: 'rule-002', productionId: 'prod-001', label: 'Hold — possible conflict', date: '2026-04-09', tier: 'hold', privateNote: 'Nike inquiry still open, do not confirm anything.' },
  ],
}
