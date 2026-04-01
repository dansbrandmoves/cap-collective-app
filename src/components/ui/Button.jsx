export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button' }) {
  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-black font-semibold',
    secondary: 'bg-surface-700 hover:bg-surface-600 text-zinc-100',
    ghost: 'hover:bg-surface-800 text-zinc-400 hover:text-zinc-100',
    danger: 'bg-red-900 hover:bg-red-800 text-red-200',
  }
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-md',
    md: 'text-sm px-4 py-2 rounded-lg',
    lg: 'text-base px-5 py-2.5 rounded-lg',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
