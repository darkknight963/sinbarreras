import React from 'react'
import { Shield, Settings } from 'lucide-react'

const BRAND_NAME = 'sin barreras'
const BRAND_SLOGAN = 'Convierte tu web en un lugar para todos'

interface HeaderProps {
  sticky?: boolean
}

export const Header: React.FC<HeaderProps> = ({ sticky = true }) => {
  return (
    <header className={sticky ? 'sticky top-0 z-50 px-8 py-4 flex items-center justify-between' : 'px-8 py-4 flex items-center justify-between'}>
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wide text-white">{BRAND_NAME}</h1>
          <p className="text-xs text-white/70">{BRAND_SLOGAN}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="header-badge">
          <span className="h-2 w-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
          <span>Normativa Peruana 2026</span>
        </div>
        <Settings className="h-5 w-5 text-white/60 hover:text-white cursor-pointer transition-colors" />
      </div>
    </header>
  )
}
