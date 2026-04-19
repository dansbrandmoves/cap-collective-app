// Shared loading state — same logo-fade the booking page uses.
// Use for any top-level page loading instead of "Loading..." text.

export function PageLoader({ full = false, label }) {
  return (
    <div className={`${full ? 'min-h-screen' : 'min-h-[60vh]'} flex flex-col items-center justify-center gap-3`}>
      <img
        src="/coordie-logo.svg"
        alt="Coordie"
        className="h-5 animate-pulse"
        style={{ filter: 'invert(1)' }}
      />
      {label && <p className="text-[12px] text-zinc-600">{label}</p>}
    </div>
  )
}
