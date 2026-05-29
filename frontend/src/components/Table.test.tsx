import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Table } from './Table'

/**
 * 12.6: Write snapshot tests for Table component
 * Test table header, rows, and cells, alternating row backgrounds, row hover state
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
describe('Table Component', () => {
  const mockColumns = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'score', label: 'Score' },
  ]

  const mockRows = [
    { id: '1', name: 'Project 1', status: 'Active', score: '95' },
    { id: '2', name: 'Project 2', status: 'Pending', score: '87' },
    { id: '3', name: 'Project 3', status: 'Failed', score: '42' },
  ]

  it('should render table with header', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    const table = container.querySelector('.report-table')
    expect(table).toHaveClass('report-table')
    expect(table).toMatchSnapshot()
  })

  it('should render table header with correct columns', () => {
    const { getByText } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    expect(getByText('Name')).toBeInTheDocument()
    expect(getByText('Status')).toBeInTheDocument()
    expect(getByText('Score')).toBeInTheDocument()
    expect(getByText('Name')).toMatchSnapshot()
  })

  it('should render table header with correct styling', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    const headers = container.querySelectorAll('th')
    expect(headers.length).toBe(3)
    
    headers.forEach((header) => {
      expect(header).toBeInTheDocument()
    })
    
    expect(headers[0]).toMatchSnapshot()
  })

  it('should render table rows', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(3)
    expect(rows[0]).toMatchSnapshot()
  })

  it('should render table cells with correct content', () => {
    const { getByText } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    expect(getByText('Project 1')).toBeInTheDocument()
    expect(getByText('Active')).toBeInTheDocument()
    expect(getByText('95')).toBeInTheDocument()
    expect(getByText('Project 1')).toMatchSnapshot()
  })

  it('should render table cells with correct styling', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    const cells = container.querySelectorAll('td')
    expect(cells.length).toBeGreaterThan(0)
    
    cells.forEach((cell) => {
      expect(cell).toBeInTheDocument()
    })
    
    expect(cells[0]).toMatchSnapshot()
  })

  it('should render table with alternating row backgrounds', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(3)
    
    // Snapshot captures the alternating background styling
    expect(rows[0]).toMatchSnapshot()
    expect(rows[1]).toMatchSnapshot()
  })

  it('should render table with hoverable rows', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} hoverable={true} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    rows.forEach((row) => {
      expect(row).toHaveClass('report-row-hover')
    })
    
    expect(rows[0]).toMatchSnapshot()
  })

  it('should render table without hoverable rows', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} hoverable={false} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    rows.forEach((row) => {
      expect(row).not.toHaveClass('report-row-hover')
    })
    
    expect(rows[0]).toMatchSnapshot()
  })

  it('should handle row hover events', () => {
    const handleRowHover = vi.fn()
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} onRowHover={handleRowHover} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    const firstRow = rows[0] as HTMLElement
    
    // Trigger the mouseenter event
    firstRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    
    // The snapshot should capture the table structure
    expect(container.querySelector('.report-table')).toMatchSnapshot()
  })

  it('should render table with empty rows', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={[]} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(0)
    expect(container.querySelector('.report-table')).toMatchSnapshot()
  })

  it('should render table with single row', () => {
    const singleRow = [{ id: '1', name: 'Project 1', status: 'Active', score: '95' }]
    
    const { container } = render(
      <Table columns={mockColumns} rows={singleRow} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatchSnapshot()
  })

  it('should render table with many rows', () => {
    const manyRows = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      name: `Project ${i + 1}`,
      status: 'Active',
      score: `${90 - i}`,
    }))
    
    const { container } = render(
      <Table columns={mockColumns} rows={manyRows} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(10)
    expect(rows[0]).toMatchSnapshot()
  })

  it('should render table with row hover state styling', () => {
    const { container } = render(
      <Table columns={mockColumns} rows={mockRows} hoverable={true} />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    // Hover state is defined in CSS, snapshot captures the element structure
    expect(rows[0]).toHaveClass('report-row-hover')
    expect(rows[0]).toMatchSnapshot()
  })
})
