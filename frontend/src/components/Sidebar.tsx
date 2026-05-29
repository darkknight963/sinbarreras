import React from 'react'

interface SidebarLink {
  id: string
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}

interface SidebarProps {
  links: SidebarLink[]
  title?: string
}

export const Sidebar: React.FC<SidebarProps> = ({ links, title = 'Navegación Informe' }) => {
  return (
    <aside className="report-sidebar">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">{title}</div>
      <nav className="space-y-1">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href || '#'}
            onClick={(e) => {
              if (link.onClick) {
                e.preventDefault()
                link.onClick()
              }
            }}
            className={`report-side-link ${link.active ? 'active' : ''}`}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}
