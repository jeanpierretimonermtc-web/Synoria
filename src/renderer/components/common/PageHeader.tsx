import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  count?: number
  countColor?: string
}

export default function PageHeader({ title, subtitle, action, count, countColor }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">
          {title}
          {count !== undefined && (
            <span className="page-header-count" style={countColor ? { background: countColor + '22', color: countColor } : {}}>
              {count}
            </span>
          )}
        </h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  )
}
