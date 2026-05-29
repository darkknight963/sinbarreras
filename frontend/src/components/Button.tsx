import React from 'react'

interface ActionButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'green'
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  className = '',
}) => {
  const baseClass = 'report-action-btn'
  const variantClass = variant === 'green' ? 'report-action-btn-green' : ''
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

interface GhostButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const GhostButton: React.FC<GhostButtonProps> = ({
  children,
  onClick,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      className={`report-ghost-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
