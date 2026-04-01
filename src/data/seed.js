// Seed data — mimics a real live production so the app looks alive on first load

export const SEED_DATA = {
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
          members: ['sarah@solecollective.com', 'marcus@solecollective.com'],
          room: {
            sharedNotes: `# Brand Team — Shared Notes

## Shot List (Draft)
- Lifestyle walk on Venice Boardwalk (magic hour)
- Product flat lays at the Airbnb
- Water / beach movement shots — PCH overlook
- Interview-style testimonial with founder (optional)

## Location Confirmations
- Venice Boardwalk: ✓ confirmed, no permit needed
- PCH overlook: ✓ confirmed
- Studio backup (rain day): TBD — Christian to confirm

## Open Items
- [ ] Final mood board approval from Marcus
- [ ] Call sheet distribution by April 10
- [ ] Confirm catering for Day 2`,
            messages: [
              {
                id: 'msg-001',
                senderId: 'owner',
                senderName: 'Christian',
                text: 'Hey team — shot list draft is in the notes above. Take a look and let me know if anything needs adjusting before I lock the call sheet.',
                timestamp: '2026-04-01T09:15:00Z',
                read: true,
              },
              {
                id: 'msg-002',
                senderId: 'sarah@solecollective.com',
                senderName: 'Sarah',
                text: "Looks great. Marcus wants to add a founder testimonial — can we fit that in Day 2 afternoon? Maybe 30 min.",
                timestamp: '2026-04-01T10:32:00Z',
                read: true,
              },
              {
                id: 'msg-003',
                senderId: 'owner',
                senderName: 'Christian',
                text: "Absolutely — I'll block 3–3:30pm on Day 2. I'll note it in the call sheet as optional/weather-dependent.",
                timestamp: '2026-04-01T11:05:00Z',
                read: true,
              },
              {
                id: 'msg-004',
                senderId: 'marcus@solecollective.com',
                senderName: 'Marcus',
                text: 'Perfect. Mood board approval coming today.',
                timestamp: '2026-04-01T14:20:00Z',
                read: false,
              },
            ],
          },
        },
        {
          id: 'grp-002',
          productionId: 'prod-001',
          name: 'Vendor Partners',
          members: ['lens@studiobly.com', 'lighting@goldenhourinc.com'],
          room: {
            sharedNotes: `# Vendor Partners — Shared Notes

## Crew & Equipment
- **Photography:** Studio Bly (primary), 1 assistant
- **Lighting:** Golden Hour Inc — 2-person crew, HMI kit
- **Grip/Transport:** Christian coordinating

## Rates & Invoicing
- Studio Bly: $3,200/day × 3 days
- Golden Hour Inc: $1,800/day × 2 days (not needed Day 3)
- Invoices due Net 15 after wrap

## Load-In Schedule
- Day 1: 6:00am call at Venice parking lot B
- Day 2: 7:00am call at PCH overlook
- Day 3: 8:00am call at studio`,
            messages: [
              {
                id: 'msg-005',
                senderId: 'owner',
                senderName: 'Christian',
                text: "Hey both — rates confirmed, I'll have contracts out by April 5. Load-in schedule is in the notes above.",
                timestamp: '2026-03-28T16:00:00Z',
                read: true,
              },
              {
                id: 'msg-006',
                senderId: 'lens@studiobly.com',
                senderName: 'Studio Bly',
                text: 'Confirmed on our end. Will you need a 2nd shooter for Day 1 or just primary?',
                timestamp: '2026-03-29T09:45:00Z',
                read: true,
              },
              {
                id: 'msg-007',
                senderId: 'owner',
                senderName: 'Christian',
                text: 'Primary only for Day 1. Might bring in 2nd for Day 2 — will confirm by April 7.',
                timestamp: '2026-03-29T11:10:00Z',
                read: true,
              },
            ],
          },
        },
        {
          id: 'grp-003',
          productionId: 'prod-001',
          name: 'Crew',
          members: ['alex@freelance.io', 'priya@gmx.com'],
          room: {
            sharedNotes: `# Crew — Shared Notes

## Assignments
- **Alex:** BTS content, stills, behind-camera social capture
- **Priya:** PA / talent liaison, logistics on ground

## Day-of Contacts
- Christian mobile: shared in group text
- Location parking: Venice Lot B ($25/day, Christian covers)

## Reminders
- Dress code: neutral/dark clothing, no logos
- Bring your own water — craft services on set from 8am`,
            messages: [
              {
                id: 'msg-008',
                senderId: 'owner',
                senderName: 'Christian',
                text: "Alex, Priya — you're confirmed for all 3 days. Notes above have the rundown. Lmk if any conflicts come up before the 14th.",
                timestamp: '2026-03-30T13:00:00Z',
                read: true,
              },
              {
                id: 'msg-009',
                senderId: 'priya@gmx.com',
                senderName: 'Priya',
                text: "All good on my end! Do you need me earlier than 6am on Day 1 for location setup?",
                timestamp: '2026-03-31T08:20:00Z',
                read: false,
              },
            ],
          },
        },
      ],
    },
    {
      id: 'prod-002',
      name: 'Meridian Hotel — Brand Identity Shoot',
      description: 'Property photography and lifestyle campaign for Meridian\'s LA rebrand.',
      startDate: '2026-04-28',
      endDate: '2026-04-29',
      ownerNotes: 'Hotel GM is very hands-on — loop him on everything. Budget is flexible but document all expenses. No drone permit yet — checking with the city.',
      createdAt: '2026-03-25T14:00:00Z',
      groups: [
        {
          id: 'grp-004',
          productionId: 'prod-002',
          name: 'Hotel Team',
          members: ['gm@meridianla.com'],
          room: {
            sharedNotes: `# Hotel Team — Shared Notes

## Shoot Areas Confirmed
- Lobby + bar area (Day 1 morning)
- Rooftop pool (Day 1 afternoon, post-checkout)
- Suite 812 — hero room (Day 2)

## Access Notes
- Loading dock access: 6am–8pm only
- Guest areas: coordinate with front desk 24hrs ahead
- No flash photography in occupied dining room`,
            messages: [
              {
                id: 'msg-010',
                senderId: 'owner',
                senderName: 'Christian',
                text: "Hi James — areas are confirmed and in the notes above. I'll send the full crew manifest by April 20 for your security team.",
                timestamp: '2026-03-26T10:00:00Z',
                read: true,
              },
            ],
          },
        },
      ],
    },
  ],

  // Stubbed calendar data — mimics what Google Calendar returns
  calendarEvents: [
    { id: 'cal-001', title: 'CAP A — Solé Campaign', start: '2026-04-14', end: '2026-04-17', tier: 'booked', color: '#f59e0b' },
    { id: 'cal-002', title: 'CAP A — Meridian Hotel', start: '2026-04-28', end: '2026-04-30', tier: 'booked', color: '#f59e0b' },
    { id: 'cal-003', title: 'CAP B — Hold: possible Nike inquiry', start: '2026-04-21', end: '2026-04-23', tier: 'hold', color: '#6366f1' },
    { id: 'cal-004', title: 'Personal — unavailable', start: '2026-04-10', end: '2026-04-12', tier: 'blocked', color: '#ef4444' },
    { id: 'cal-005', title: 'CAP A — Available', start: '2026-04-07', end: '2026-04-10', tier: 'available', color: '#22c55e' },
    { id: 'cal-006', title: 'CAP A — Available', start: '2026-04-17', end: '2026-04-21', tier: 'available', color: '#22c55e' },
  ],

  availabilityRules: [
    { id: 'rule-001', productionId: 'prod-001', label: 'Available — early morning preferred', date: '2026-04-07', tier: 'available', privateNote: 'Prefer 6–10am shoots this week, energy is good early.' },
    { id: 'rule-002', productionId: 'prod-001', label: 'Hold — possible conflict', date: '2026-04-09', tier: 'hold', privateNote: 'Nike inquiry still open, do not confirm anything.' },
  ],
}
