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

  // Empty — users connect their own Google Calendar via OAuth
  connectedCalendars: [],

  // Empty — populated when user syncs their Google Calendar
  calendarEvents: [],

  // Seed group members (for invite-only demo, empty by default)
  groupMembers: [],

  // Empty — users create their own projects
  productions: [],

  prefixRules: [
    { id: 'pr-1', prefix: '*', state: 'blocked', description: 'Not Available — confirmed booking, hard block' },
    { id: 'pr-2', prefix: '^', state: 'hold', description: 'Penciled — soft hold, potentially available' },
  ],

  availabilityRules: [
    { id: 'rule-001', productionId: 'prod-001', label: 'Available — early morning preferred', date: '2026-04-07', tier: 'available', privateNote: 'Prefer 6–10am shoots this week, energy is good early.' },
    { id: 'rule-002', productionId: 'prod-001', label: 'Hold — possible conflict', date: '2026-04-09', tier: 'hold', privateNote: 'Nike inquiry still open, do not confirm anything.' },
  ],
}
