import React from 'react'

interface ReportCardEntityProps {
  title: string
  description?: string
  children?: React.ReactNode
  onClick?: () => void
}

export const ReportCardEntity: React.FC<ReportCardEntityProps> = ({
  title,
  description,
  children,
  onClick,
}) => {
  return (
    <div className="report-card-entity" onClick={onClick}>
      <div>
        <h3 className="font-bold text-lg text-gob-dark mb-1">{title}</h3>
        {description && <p className="text-slate-500 text-sm mb-4">{description}</p>}
      </div>
      {children}
    </div>
  )
}

interface ReportPanelProps {
  children: React.ReactNode
  spacious?: boolean
  className?: string
}

export const ReportPanel: React.FC<ReportPanelProps> = ({
  children,
  spacious = false,
  className = '',
}) => {
  return (
    <div className={`report-panel ${spacious ? 'report-panel-spacious' : ''} ${className}`}>
      {children}
    </div>
  )
}
