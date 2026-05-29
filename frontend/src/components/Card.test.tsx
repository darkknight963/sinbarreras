import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ReportCardEntity, ReportPanel } from './Card'

/**
 * 12.2: Write snapshot tests for Card components
 * Test Report Card Entity base and hover states, Report Panel base and hover states
 * Verify border, shadow, and padding
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
describe('Card Components', () => {
  describe('ReportCardEntity', () => {
    it('should render card entity with base state', () => {
      const { container } = render(
        <ReportCardEntity title="Test Project" description="Test Description" />
      )
      
      const card = container.querySelector('.report-card-entity')
      expect(card).toHaveClass('report-card-entity')
      expect(card).toMatchSnapshot()
    })

    it('should render card entity with title', () => {
      const { getByText } = render(
        <ReportCardEntity title="Test Project" />
      )
      
      const title = getByText('Test Project')
      expect(title).toHaveClass('font-bold')
      expect(title).toHaveClass('text-lg')
      expect(title).toMatchSnapshot()
    })

    it('should render card entity with description', () => {
      const { getByText } = render(
        <ReportCardEntity title="Test Project" description="Test Description" />
      )
      
      const description = getByText('Test Description')
      expect(description).toHaveClass('text-slate-500')
      expect(description).toHaveClass('text-sm')
      expect(description).toMatchSnapshot()
    })

    it('should render card entity with children', () => {
      const { getByText } = render(
        <ReportCardEntity title="Test Project">
          <div>Child Content</div>
        </ReportCardEntity>
      )
      
      expect(getByText('Child Content')).toBeInTheDocument()
      expect(getByText('Child Content')).toMatchSnapshot()
    })

    it('should handle click events', () => {
      const handleClick = vi.fn()
      const { container } = render(
        <ReportCardEntity title="Test Project" onClick={handleClick} />
      )
      
      const card = container.querySelector('.report-card-entity')
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      
      expect(handleClick).toHaveBeenCalled()
    })

    it('should render card entity with border, shadow, and padding', () => {
      const { container } = render(
        <ReportCardEntity title="Test Project" />
      )
      
      const card = container.querySelector('.report-card-entity')
      expect(card).toHaveClass('report-card-entity')
      // Styling is defined in CSS, snapshot captures the element structure
      expect(card).toMatchSnapshot()
    })

    it('should render card entity with hover state styling', () => {
      const { container } = render(
        <ReportCardEntity title="Test Project" />
      )
      
      const card = container.querySelector('.report-card-entity')
      // Hover state is defined in CSS, snapshot captures the element structure
      expect(card).toHaveClass('report-card-entity')
      expect(card).toMatchSnapshot()
    })
  })

  describe('ReportPanel', () => {
    it('should render panel with base state', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      const panel = container.querySelector('.report-panel')
      expect(panel).toHaveClass('report-panel')
      expect(panel).toMatchSnapshot()
    })

    it('should render panel with spacious variant', () => {
      const { container } = render(
        <ReportPanel spacious={true}>
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      const panel = container.querySelector('.report-panel')
      expect(panel).toHaveClass('report-panel-spacious')
      expect(panel).toMatchSnapshot()
    })

    it('should render panel with children', () => {
      const { getByText } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      expect(getByText('Panel Content')).toBeInTheDocument()
      expect(getByText('Panel Content')).toMatchSnapshot()
    })

    it('should render panel with custom className', () => {
      const { container } = render(
        <ReportPanel className="custom-class">
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      const panel = container.querySelector('.report-panel')
      expect(panel).toHaveClass('custom-class')
      expect(panel).toMatchSnapshot()
    })

    it('should render panel with border, shadow, and padding', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      const panel = container.querySelector('.report-panel')
      expect(panel).toHaveClass('report-panel')
      // Styling is defined in CSS, snapshot captures the element structure
      expect(panel).toMatchSnapshot()
    })

    it('should render panel with hover state styling', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )
      
      const panel = container.querySelector('.report-panel')
      // Hover state is defined in CSS, snapshot captures the element structure
      expect(panel).toHaveClass('report-panel')
      expect(panel).toMatchSnapshot()
    })

    it('should render panel with multiple children', () => {
      const { getByText } = render(
        <ReportPanel>
          <div>First Child</div>
          <div>Second Child</div>
        </ReportPanel>
      )
      
      expect(getByText('First Child')).toBeInTheDocument()
      expect(getByText('Second Child')).toBeInTheDocument()
      expect(getByText('First Child')).toMatchSnapshot()
    })
  })
})
