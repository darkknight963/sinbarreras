import React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  title: string
  children: React.ReactNode
  onClose?: () => void
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4">
      <div className="report-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gob-dark">{title}</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-gob-dark transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
