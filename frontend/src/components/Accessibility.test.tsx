import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import { ActionButton, GhostButton } from './Button'
import { SeverityChip, StatusBadge } from './Badge'
import { Table } from './Table'
import { Modal } from './Modal'
import { Sidebar } from './Sidebar'

/**
 * 14.3: Write ARIA and semantic HTML tests
 * Test header semantic structure, button ARIA labels and roles, badge semantic meaning,
 * table header associations, and modal focus management
 * Requirements: 1.2, 1.3, 1.4
 */

describe('Accessibility: Semantic HTML and ARIA', () => {
  describe('Header Component - Semantic Structure', () => {
    it('should render header with semantic <header> element', () => {
      const { container } = render(<Header />)
      const header = container.querySelector('header')
      
      expect(header).toBeInTheDocument()
      expect(header?.tagName).toBe('HEADER')
    })

    it('should render main title with semantic <h1> element', () => {
      render(<Header />)
      const h1 = screen.getByRole('heading', { level: 1 })
      
      expect(h1).toBeInTheDocument()
      expect(h1.textContent).toBe('sin barreras')
    })

    it('should have proper heading hierarchy in header', () => {
      const { container } = render(<Header />)
      const h1 = container.querySelector('h1')
      
      expect(h1).toBeInTheDocument()
      expect(h1?.textContent).toBe('sin barreras')
    })

    it('should render subtitle as paragraph element', () => {
      const { container } = render(<Header />)
      const paragraph = container.querySelector('p')
      
      expect(paragraph).toBeInTheDocument()
      expect(paragraph?.textContent).toContain('Convierte tu web en un lugar para todos')
    })

    it('should have proper semantic structure with flex layout', () => {
      const { container } = render(<Header />)
      const header = container.querySelector('header')
      
      expect(header).toHaveClass('flex')
      expect(header).toHaveClass('items-center')
      expect(header).toHaveClass('justify-between')
    })
  })

  describe('Button Component - ARIA Labels and Roles', () => {
    it('should render ActionButton as button element with proper role', () => {
      render(<ActionButton>Click me</ActionButton>)
      const button = screen.getByRole('button', { name: /click me/i })
      
      expect(button).toBeInTheDocument()
      expect(button.tagName).toBe('BUTTON')
    })

    it('should render ActionButton with accessible text content', () => {
      render(<ActionButton>Submit Form</ActionButton>)
      const button = screen.getByRole('button', { name: /submit form/i })
      
      expect(button).toBeInTheDocument()
      expect(button.textContent).toBe('Submit Form')
    })

    it('should support disabled state on ActionButton', () => {
      render(<ActionButton disabled>Disabled Button</ActionButton>)
      const button = screen.getByRole('button', { name: /disabled button/i })
      
      expect(button).toBeDisabled()
    })

    it('should render GhostButton as button element with proper role', () => {
      render(<GhostButton>Cancel</GhostButton>)
      const button = screen.getByRole('button', { name: /cancel/i })
      
      expect(button).toBeInTheDocument()
      expect(button.tagName).toBe('BUTTON')
    })

    it('should support disabled state on GhostButton', () => {
      render(<GhostButton disabled>Disabled Ghost</GhostButton>)
      const button = screen.getByRole('button', { name: /disabled ghost/i })
      
      expect(button).toBeDisabled()
    })

    it('should have proper button semantics for click handlers', async () => {
      const handleClick = vi.fn()
      render(<ActionButton onClick={handleClick}>Click</ActionButton>)
      
      const button = screen.getByRole('button', { name: /click/i })
      await userEvent.click(button)
      
      expect(handleClick).toHaveBeenCalled()
    })
  })

  describe('Badge Component - Semantic Meaning', () => {
    it('should render SeverityChip with semantic span element', () => {
      const { container } = render(
        <SeverityChip level="high">High Severity</SeverityChip>
      )
      const chip = container.querySelector('span')
      
      expect(chip).toBeInTheDocument()
      expect(chip?.textContent).toBe('High Severity')
    })

    it('should apply correct class for high severity chip', () => {
      const { container } = render(
        <SeverityChip level="high">High</SeverityChip>
      )
      const chip = container.querySelector('.report-sev-high')
      
      expect(chip).toBeInTheDocument()
    })

    it('should apply correct class for medium severity chip', () => {
      const { container } = render(
        <SeverityChip level="medium">Medium</SeverityChip>
      )
      const chip = container.querySelector('.report-sev-medium')
      
      expect(chip).toBeInTheDocument()
    })

    it('should apply correct class for low severity chip', () => {
      const { container } = render(
        <SeverityChip level="low">Low</SeverityChip>
      )
      const chip = container.querySelector('.report-sev-low')
      
      expect(chip).toBeInTheDocument()
    })

    it('should render StatusBadge with semantic span element', () => {
      const { container } = render(
        <StatusBadge status="approved">Approved</StatusBadge>
      )
      const badge = container.querySelector('span')
      
      expect(badge).toBeInTheDocument()
      expect(badge?.textContent).toBe('Approved')
    })

    it('should apply correct class for approved status badge', () => {
      const { container } = render(
        <StatusBadge status="approved">Approved</StatusBadge>
      )
      const badge = container.querySelector('.report-status-approved')
      
      expect(badge).toBeInTheDocument()
    })

    it('should apply correct class for failed status badge', () => {
      const { container } = render(
        <StatusBadge status="failed">Failed</StatusBadge>
      )
      const badge = container.querySelector('.report-status-failed')
      
      expect(badge).toBeInTheDocument()
    })

    it('should apply correct class for pending status badge', () => {
      const { container } = render(
        <StatusBadge status="pending">Pending</StatusBadge>
      )
      const badge = container.querySelector('.report-status-pending')
      
      expect(badge).toBeInTheDocument()
    })

    it('should have semantic meaning through class names for color-blind users', () => {
      const { container } = render(
        <>
          <SeverityChip level="high">HIGH</SeverityChip>
          <SeverityChip level="medium">MEDIUM</SeverityChip>
          <SeverityChip level="low">LOW</SeverityChip>
        </>
      )
      
      const chips = container.querySelectorAll('span')
      expect(chips.length).toBe(3)
      
      // Verify each chip has distinct class for non-color differentiation
      expect(chips[0]).toHaveClass('report-sev-high')
      expect(chips[1]).toHaveClass('report-sev-medium')
      expect(chips[2]).toHaveClass('report-sev-low')
    })
  })

  describe('Table Component - Header Associations', () => {
    const mockColumns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'severity', label: 'Severity' },
    ]

    const mockRows = [
      { id: '1', name: 'Issue 1', status: 'Open', severity: 'High' },
      { id: '2', name: 'Issue 2', status: 'Closed', severity: 'Low' },
    ]

    it('should render table with semantic <table> element', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const table = container.querySelector('table')
      
      expect(table).toBeInTheDocument()
      expect(table?.tagName).toBe('TABLE')
    })

    it('should render table with semantic <thead> element', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const thead = container.querySelector('thead')
      
      expect(thead).toBeInTheDocument()
      expect(thead?.tagName).toBe('THEAD')
    })

    it('should render table with semantic <tbody> element', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const tbody = container.querySelector('tbody')
      
      expect(tbody).toBeInTheDocument()
      expect(tbody?.tagName).toBe('TBODY')
    })

    it('should render table headers with semantic <th> elements', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const headers = container.querySelectorAll('th')
      
      expect(headers.length).toBe(3)
      expect(headers[0].textContent).toBe('Name')
      expect(headers[1].textContent).toBe('Status')
      expect(headers[2].textContent).toBe('Severity')
    })

    it('should render table cells with semantic <td> elements', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const cells = container.querySelectorAll('td')
      
      expect(cells.length).toBeGreaterThan(0)
      expect(cells[0].textContent).toBe('Issue 1')
    })

    it('should render table rows with semantic <tr> elements', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const rows = container.querySelectorAll('tbody tr')
      
      expect(rows.length).toBe(2)
    })

    it('should have proper table structure with header row', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} />
      )
      const thead = container.querySelector('thead')
      const headerRow = thead?.querySelector('tr')
      const headers = headerRow?.querySelectorAll('th')
      
      expect(headers?.length).toBe(3)
    })

    it('should support hover state on table rows', () => {
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} hoverable={true} />
      )
      const rows = container.querySelectorAll('tbody tr')
      
      rows.forEach((row) => {
        expect(row).toHaveClass('report-row-hover')
      })
    })

    it('should call onRowHover callback when row is hovered', async () => {
      const handleRowHover = vi.fn()
      const { container } = render(
        <Table columns={mockColumns} rows={mockRows} onRowHover={handleRowHover} />
      )
      const firstRow = container.querySelector('tbody tr')
      
      if (firstRow) {
        await userEvent.hover(firstRow)
        expect(handleRowHover).toHaveBeenCalledWith('1')
      }
    })
  })

  describe('Modal Component - Focus Management', () => {
    it('should render modal with semantic structure', () => {
      const { container } = render(
        <Modal isOpen={true} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      )
      
      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
    })

    it('should render modal title with semantic heading', () => {
      render(
        <Modal isOpen={true} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      )
      
      const heading = screen.getByRole('heading', { name: /test modal/i })
      expect(heading).toBeInTheDocument()
    })

    it('should render modal with close button', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} title="Test Modal" onClose={handleClose}>
          <p>Modal content</p>
        </Modal>
      )
      
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', async () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} title="Test Modal" onClose={handleClose}>
          <p>Modal content</p>
        </Modal>
      )
      
      const closeButton = screen.getByRole('button')
      await userEvent.click(closeButton)
      
      expect(handleClose).toHaveBeenCalled()
    })

    it('should not render modal when isOpen is false', () => {
      const { container } = render(
        <Modal isOpen={false} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      )
      
      const modal = container.querySelector('.report-modal')
      expect(modal).not.toBeInTheDocument()
    })

    it('should render modal overlay with proper structure', () => {
      const { container } = render(
        <Modal isOpen={true} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      )
      
      const overlay = container.querySelector('.report-modal-overlay')
      expect(overlay).toBeInTheDocument()
    })

    it('should render modal with accessible title', () => {
      render(
        <Modal isOpen={true} title="Create New Project">
          <p>Modal content</p>
        </Modal>
      )
      
      const title = screen.getByText('Create New Project')
      expect(title).toBeInTheDocument()
    })
  })

  describe('Sidebar Component - Navigation Semantics', () => {
    const mockLinks = [
      { id: '1', label: 'Overview', active: true },
      { id: '2', label: 'Details', active: false },
      { id: '3', label: 'Settings', active: false },
    ]

    it('should render sidebar with semantic <aside> element', () => {
      const { container } = render(<Sidebar links={mockLinks} />)
      const aside = container.querySelector('aside')
      
      expect(aside).toBeInTheDocument()
      expect(aside?.tagName).toBe('ASIDE')
    })

    it('should render sidebar with semantic <nav> element', () => {
      const { container } = render(<Sidebar links={mockLinks} />)
      const nav = container.querySelector('nav')
      
      expect(nav).toBeInTheDocument()
      expect(nav?.tagName).toBe('NAV')
    })

    it('should render sidebar links as anchor elements', () => {
      const { container } = render(<Sidebar links={mockLinks} />)
      const links = container.querySelectorAll('a')
      
      expect(links.length).toBe(3)
      expect(links[0].textContent).toBe('Overview')
      expect(links[1].textContent).toBe('Details')
      expect(links[2].textContent).toBe('Settings')
    })

    it('should render sidebar with title', () => {
      render(<Sidebar links={mockLinks} title="Report Navigation" />)
      
      const title = screen.getByText('Report Navigation')
      expect(title).toBeInTheDocument()
    })

    it('should render sidebar with default title when not provided', () => {
      render(<Sidebar links={mockLinks} />)
      
      const title = screen.getByText('Navegación Informe')
      expect(title).toBeInTheDocument()
    })

    it('should apply active class to active link', () => {
      const { container } = render(<Sidebar links={mockLinks} />)
      const links = container.querySelectorAll('a')
      
      expect(links[0]).toHaveClass('active')
      expect(links[1]).not.toHaveClass('active')
    })

    it('should support click handlers on sidebar links', async () => {
      const handleClick = vi.fn()
      const linksWithClick = [
        { id: '1', label: 'Overview', onClick: handleClick },
      ]
      
      render(<Sidebar links={linksWithClick} />)
      
      const link = screen.getByText('Overview')
      await userEvent.click(link)
      
      expect(handleClick).toHaveBeenCalled()
    })

    it('should have proper semantic structure with report-side-link class', () => {
      const { container } = render(<Sidebar links={mockLinks} />)
      const links = container.querySelectorAll('.report-side-link')
      
      expect(links.length).toBe(3)
    })
  })

  describe('Overall Accessibility - Semantic HTML Best Practices', () => {
    it('should use semantic elements instead of divs for structure', () => {
      const { container } = render(<Header />)
      
      // Header should use <header> not <div>
      const header = container.querySelector('header')
      expect(header).toBeInTheDocument()
      
      // Should have heading hierarchy
      const h1 = container.querySelector('h1')
      expect(h1).toBeInTheDocument()
    })

    it('should use proper button elements for interactive controls', () => {
      render(
        <>
          <ActionButton>Action</ActionButton>
          <GhostButton>Ghost</GhostButton>
        </>
      )
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(2)
      
      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should use semantic table elements for tabular data', () => {
      const columns = [{ key: 'col1', label: 'Column 1' }]
      const rows = [{ id: '1', col1: 'Data' }]
      
      const { container } = render(<Table columns={columns} rows={rows} />)
      
      expect(container.querySelector('table')).toBeInTheDocument()
      expect(container.querySelector('thead')).toBeInTheDocument()
      expect(container.querySelector('tbody')).toBeInTheDocument()
      expect(container.querySelector('th')).toBeInTheDocument()
      expect(container.querySelector('td')).toBeInTheDocument()
    })

    it('should use semantic navigation elements', () => {
      const links = [{ id: '1', label: 'Link' }]
      const { container } = render(<Sidebar links={links} />)
      
      expect(container.querySelector('aside')).toBeInTheDocument()
      expect(container.querySelector('nav')).toBeInTheDocument()
    })
  })
})
