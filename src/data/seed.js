// Seed data — default configuration for new users

export const SEED_DATA = {
  // Default slot configuration — customize these in Settings
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

  // Empty — users add their own group members
  groupMembers: [],

  // Empty — users create their own projects
  productions: [],

  prefixRules: [
    { id: 'pr-1', prefix: '*', state: 'blocked', description: 'Not Available — confirmed booking, hard block' },
    { id: 'pr-2', prefix: '^', state: 'hold', description: 'Penciled — soft hold, potentially available' },
  ],

  // Empty — no demo availability rules for new users
  availabilityRules: [],
}
