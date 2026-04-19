import { useApp } from '../contexts/AppContext'
import { SlotEditor } from '../components/availability/SlotEditor'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

export function AvailabilityRules() {
  const { availabilityRules, effectiveSlots, calendarEvents, connectedCalendars, prefixRules, slotStates, availabilityMode, businessHours } = useApp()

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="mb-10 sm:mb-12">
        <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15] mb-2">Availability</h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed">
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
          businessHours={businessHours}
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
