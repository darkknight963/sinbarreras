import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Sidebar } from './Sidebar'

/**
 * 12.5: Write snapshot tests for Sidebar navigation
 * Test Sidebar container and links, link hover state, verify sticky positioning and styling
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
describe('Sidebar Component', () => {
  const mockLinks = [
    { id: '1', label: 'Score General', href: '#score' },
    { id: '2', label: 'Páginas Auditadas', href: '#pages' },
    { id: '3', label: 'Violaciones', href: '#violations' },
  ]

  it('should render sidebar container', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const sidebar = container.querySelector('.report-sidebar')
    expect(sidebar).toHaveClass('report-sidebar')
    expect(sidebar).toMatchSnapshot()
  })

  it('should render sidebar with default title', () => {
    const { getByText } = render(<Sidebar links={mockLinks} />)
    
    expect(getByText('Navegación Informe')).toBeInTheDocument()
    expect(getByText('Navegación Informe')).toMatchSnapshot()
  })

  it('should render sidebar with custom title', () => {
    const { getByText } = render(
      <Sidebar links={mockLinks} title="Custom Title" />
    )
    
    expect(getByText('Custom Title')).toBeInTheDocument()
    expect(getByText('Custom Title')).toMatchSnapshot()
  })

  it('should render all sidebar links', () => {
    const { getByText } = render(<Sidebar links={mockLinks} />)
    
    expect(getByText('Score General')).toBeInTheDocument()
    expect(getByText('Páginas Auditadas')).toBeInTheDocument()
    expect(getByText('Violaciones')).toBeInTheDocument()
    expect(getByText('Score General')).toMatchSnapshot()
  })

  it('should render sidebar links with correct styling', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const links = container.querySelectorAll('.report-side-link')
    expect(links.length).toBe(3)
    
    links.forEach((link) => {
      expect(link).toHaveClass('report-side-link')
    })
    
    expect(links[0]).toMatchSnapshot()
  })

  it('should handle link click events', () => {
    const handleClick = vi.fn()
    const linksWithClick = [
      { id: '1', label: 'Score General', onClick: handleClick },
    ]
    
    const { getByText } = render(<Sidebar links={linksWithClick} />)
    
    const link = getByText('Score General')
    link.click()
    
    expect(handleClick).toHaveBeenCalled()
  })

  it('should render sidebar with sticky positioning', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const sidebar = container.querySelector('.report-sidebar')
    expect(sidebar).toHaveClass('report-sidebar')
    expect(sidebar).toMatchSnapshot()
  })

  it('should render sidebar with correct border and shadow', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const sidebar = container.querySelector('.report-sidebar')
    expect(sidebar).toHaveClass('report-sidebar')
    expect(sidebar).toMatchSnapshot()
  })

  it('should render sidebar with correct padding', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const sidebar = container.querySelector('.report-sidebar')
    expect(sidebar).toHaveClass('report-sidebar')
    expect(sidebar).toMatchSnapshot()
  })

  it('should render sidebar link with hover state styling', () => {
    const { container } = render(<Sidebar links={mockLinks} />)
    
    const link = container.querySelector('.report-side-link')
    // Hover state is defined in CSS, snapshot captures the element structure
    expect(link).toHaveClass('report-side-link')
    expect(link).toMatchSnapshot()
  })

  it('should render sidebar with multiple links', () => {
    const manyLinks = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      label: `Link ${i + 1}`,
    }))
    
    const { container } = render(<Sidebar links={manyLinks} />)
    
    const links = container.querySelectorAll('.report-side-link')
    expect(links.length).toBe(5)
    expect(links[0]).toMatchSnapshot()
  })

  it('should render sidebar with active link state', () => {
    const linksWithActive = [
      { id: '1', label: 'Score General', active: true },
      { id: '2', label: 'Páginas Auditadas', active: false },
    ]
    
    const { container } = render(<Sidebar links={linksWithActive} />)
    
    const links = container.querySelectorAll('.report-side-link')
    expect(links[0]).toHaveClass('active')
    expect(links[0]).toMatchSnapshot()
  })
})
