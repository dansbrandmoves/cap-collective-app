import { useApp } from '../contexts/AppContext'
import { SlotEditor } from '../components/availability/SlotEditor'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

export function AvailabilityRules() {
  const { availabilityRules, slots, calendarEvents, connectedCalendars, prefixRules, slotStates } = useApp()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Availability</h1>
        <p className="text-sm text-zinc-500">
          Your calendar at a glance. Manage time slots below.
        </p>
      </div>

      {/* Calendar */}
      <div className="mb-10">
        <AvailabilityCalendar
          slots={slots}
          calendarEvents={calendarEvents}
          connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules}
          prefixRules={prefixRules}
          isOwner={true}
          slotStates={slotStates}
        />
      </div>

      {/* Slot Editor */}
      <div>
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Time Slots</p>
        <SlotEditor />
      </div>
    </div>
  )
}
