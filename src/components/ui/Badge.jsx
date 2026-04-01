export function Badge({ children, variant = 'default', size = 'sm' }) {
  const variants = {
    default: 'bg-surface-700 text-zinc-300',
    accent: 'bg-accent text-black',
    green: 'bg-emerald-900 text-emerald-400',
    yellow: 'bg-amber-900 text-amber-400',
    red: 'bg-red-900 text-red-400',
    purple: 'bg-indigo-900 text-indigo-400',
    ghost: 'border border-surface-600 text-zinc-400',
  }
  const sizes = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
  }
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}
