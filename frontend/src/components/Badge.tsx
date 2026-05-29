import React from 'react'

type SeverityLevel = 'high' | 'medium' | 'low'
type StatusType = 'approved' | 'failed' | 'pending'

interface SeverityChipProps {
  level: SeverityLevel
  children: React.ReactNode
}

export const SeverityChip: React.FC<SeverityChipProps> = ({ level, children }) => {
  const classMap = {
    high: 'report-sev-high',
    medium: 'report-sev-medium',
    low: 'report-sev-low',
  }
  
  return (
    <span className={`report-severity-chip ${classMap[level]}`}>
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: StatusType
  children: React.ReactNode
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  const classMap = {
    approved: 'report-status-approved',
    failed: 'report-status-failed',
    pending: 'report-status-pending',
  }
  
  return (
    <span className={`report-status-badge ${classMap[status]}`}>
      {children}
    </span>
  )
}
