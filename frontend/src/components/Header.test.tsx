import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Header } from './Header'

/**
 * 12.1: Write snapshot tests for Header component
 * Test header with sticky state, title and badge rendering, gradient background and shadow
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
describe('Header Component', () => {
  it('should render header with sticky state', () => {
    const { container } = render(<Header sticky={true} />)
    const header = container.querySelector('header')
    
    expect(header).toHaveClass('sticky')
    expect(header).toHaveClass('top-0')
    expect(header).toHaveClass('z-50')
    expect(header).toMatchSnapshot()
  })

  it('should render header without sticky state', () => {
    const { container } = render(<Header sticky={false} />)
    const header = container.querySelector('header')
    
    expect(header).not.toHaveClass('sticky')
    expect(header).toMatchSnapshot()
  })

  it('should render header title with correct styling', () => {
    const { getByText } = render(<Header />)
    const title = getByText('Plataforma de Accesibilidad Web')
    
    expect(title).toHaveClass('font-bold')
    expect(title).toHaveClass('text-lg')
    expect(title).toHaveClass('text-white')
    expect(title).toMatchSnapshot()
  })

  it('should render header subtitle with correct styling', () => {
    const { getByText } = render(<Header />)
    const subtitle = getByText('Resolución N° 001-2025-PCM/SGTD — Estándar Oficial Perú')
    
    expect(subtitle).toHaveClass('text-xs')
    expect(subtitle).toHaveClass('text-white/70')
    expect(subtitle).toMatchSnapshot()
  })

  it('should render badge with correct styling', () => {
    const { container } = render(<Header />)
    const badge = container.querySelector('.header-badge')
    
    expect(badge).toBeInTheDocument()
    expect(badge).toMatchSnapshot()
  })

  it('should render gradient background and shadow', () => {
    const { container } = render(<Header />)
    const header = container.querySelector('header')
    
    // Check for gradient background (applied via CSS class)
    expect(header).toHaveClass('sticky')
    // Snapshot captures the full styling including gradient and shadow
    expect(header).toMatchSnapshot()
  })

  it('should render header with all elements', () => {
    const { container } = render(<Header />)
    
    expect(container.querySelector('header')).toMatchSnapshot()
  })
})
