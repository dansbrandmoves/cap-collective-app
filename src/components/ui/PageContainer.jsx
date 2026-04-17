export function PageContainer({ children, className = '' }) {
  return (
    <div className={`max-w-4xl mx-auto px-5 sm:px-8 py-6 sm:py-10 ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-100 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  )
}
