export function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const variants = {
    default: 'bg-surface-700 text-zinc-300',
    accent: 'bg-accent/15 text-accent border border-accent/20',
    green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    yellow: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
    purple: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    ghost: 'border border-surface-600 text-zinc-400',
  }
  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}
