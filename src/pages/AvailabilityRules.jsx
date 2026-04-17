import { useApp } from '../contexts/AppContext'
import { SlotEditor } from '../components/availability/SlotEditor'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

export function AvailabilityRules() {
  const { availabilityRules, effectiveSlots, calendarEvents, connectedCalendars, prefixRules, slotStates, availabilityMode } = useApp()

  return (
    <div className="px-5 sm:px-8 lg:px-16 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Availability</h1>
        <p className="text-sm text-zinc-500">
          {availabilityMode === 'blocks'
            ? `Showing ${effectiveSlots.length} time blocks based on your business hours.`
            : 'Your calendar with custom time slots.'}
          {' '}Adjust in Settings.
        </p>
      </div>

      {/* Calendar */}
      <div className={availabilityMode === 'slots' ? 'mb-10' : ''}>
        <AvailabilityCalendar
          slots={effectiveSlots}
          calendarEvents={calendarEvents}
          connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules}
          prefixRules={prefixRules}
          isOwner={true}
          slotStates={slotStates}
        />
      </div>

      {/* Slot Editor — only in custom slots mode */}
      {availabilityMode === 'slots' && (
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Time Slots</p>
          <SlotEditor />
        </div>
      )}
    </div>
  )
}
