export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button' }) {
  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-white font-semibold shadow-sm shadow-accent/20 hover:shadow-md hover:shadow-accent/25',
    secondary: 'bg-surface-700 hover:bg-surface-600 text-zinc-200 font-medium',
    ghost: 'hover:bg-surface-800 text-zinc-400 hover:text-zinc-100 font-medium',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 font-medium',
  }
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-lg',
    md: 'text-sm px-4 py-2 rounded-lg',
    lg: 'text-sm px-5 py-2.5 rounded-xl',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
