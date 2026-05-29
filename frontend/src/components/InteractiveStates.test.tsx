import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionButton, GhostButton } from './Button'
import { ReportCardEntity, ReportPanel } from './Card'
import { Sidebar } from './Sidebar'
import { Table } from './Table'

describe('Interactive States - Visual Regression Tests', () => {
  it('should apply primary and green action button classes', () => {
    const { container: primary } = render(<ActionButton>Primary</ActionButton>)
    const { container: green } = render(<ActionButton variant="green">Green</ActionButton>)

    expect(primary.querySelector('button')).toHaveClass('report-action-btn')
    expect(green.querySelector('button')).toHaveClass('report-action-btn', 'report-action-btn-green')
  })

  it('should keep disabled state for action and ghost buttons', () => {
    const { container: a } = render(<ActionButton disabled>Primary</ActionButton>)
    const { container: g } = render(<GhostButton disabled>Ghost</GhostButton>)

    expect(a.querySelector('button')).toBeDisabled()
    expect(g.querySelector('button')).toBeDisabled()
  })

  it('should trigger click handlers for interactive controls', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onGhost = vi.fn()

    const { container } = render(
      <div>
        <ActionButton onClick={onAction}>Action</ActionButton>
        <GhostButton onClick={onGhost}>Ghost</GhostButton>
      </div>
    )

    const buttons = container.querySelectorAll('button')
    await user.click(buttons[0])
    await user.click(buttons[1])
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onGhost).toHaveBeenCalledTimes(1)
  })

  it('should render card and panel interactive class hooks', () => {
    const { container } = render(
      <div>
        <ReportCardEntity title="Project" description="Desc" />
        <ReportPanel>Panel</ReportPanel>
      </div>
    )

    expect(container.querySelector('.report-card-entity')).toBeInTheDocument()
    expect(container.querySelector('.report-panel')).toBeInTheDocument()
  })

  it('should render sidebar active link class and click behavior', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(
      <Sidebar
        links={[
          { id: 'a', label: 'Score', active: true, onClick },
          { id: 'b', label: 'Violaciones' },
        ]}
      />
    )

    const active = container.querySelector('.report-side-link.active')
    expect(active).toBeInTheDocument()
    await user.click(active as Element)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should render table row hover hooks and fire onRowHover', async () => {
    const user = userEvent.setup()
    const onRowHover = vi.fn()
    const { container } = render(
      <Table
        columns={[{ key: 'name', label: 'Name' }]}
        rows={[
          { id: '1', name: 'One' },
          { id: '2', name: 'Two' },
        ]}
        hoverable={true}
        onRowHover={onRowHover}
      />
    )

    const row = container.querySelector('tbody tr') as HTMLElement
    expect(row).toHaveClass('report-row-hover')
    await user.hover(row)
    expect(onRowHover).toHaveBeenCalledWith('1')
  })
})
