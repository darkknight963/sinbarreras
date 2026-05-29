import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SeverityChip, StatusBadge } from './Badge'

/**
 * 12.4: Write snapshot tests for Badge and Label components
 * Test all Severity Chips (high, medium, low), all Status Badges (approved, failed, pending)
 * Verify text, colors, and styling
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
describe('Badge Components', () => {
  describe('SeverityChip', () => {
    it('should render high severity chip', () => {
      const { container } = render(
        <SeverityChip level="high">HIGH</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-high')
      expect(chip).toMatchSnapshot()
    })

    it('should render medium severity chip', () => {
      const { container } = render(
        <SeverityChip level="medium">MEDIUM</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-medium')
      expect(chip).toMatchSnapshot()
    })

    it('should render low severity chip', () => {
      const { container } = render(
        <SeverityChip level="low">LOW</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-low')
      expect(chip).toMatchSnapshot()
    })

    it('should render high severity chip with text content', () => {
      const { getByText } = render(
        <SeverityChip level="high">HIGH SEVERITY</SeverityChip>
      )
      
      expect(getByText('HIGH SEVERITY')).toBeInTheDocument()
      expect(getByText('HIGH SEVERITY')).toMatchSnapshot()
    })

    it('should render medium severity chip with text content', () => {
      const { getByText } = render(
        <SeverityChip level="medium">MEDIUM SEVERITY</SeverityChip>
      )
      
      expect(getByText('MEDIUM SEVERITY')).toBeInTheDocument()
      expect(getByText('MEDIUM SEVERITY')).toMatchSnapshot()
    })

    it('should render low severity chip with text content', () => {
      const { getByText } = render(
        <SeverityChip level="low">LOW SEVERITY</SeverityChip>
      )
      
      expect(getByText('LOW SEVERITY')).toBeInTheDocument()
      expect(getByText('LOW SEVERITY')).toMatchSnapshot()
    })

    it('should render high severity chip with correct styling', () => {
      const { container } = render(
        <SeverityChip level="high">HIGH</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-high')
      expect(chip).toMatchSnapshot()
    })

    it('should render medium severity chip with correct styling', () => {
      const { container } = render(
        <SeverityChip level="medium">MEDIUM</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-medium')
      expect(chip).toMatchSnapshot()
    })

    it('should render low severity chip with correct styling', () => {
      const { container } = render(
        <SeverityChip level="low">LOW</SeverityChip>
      )
      
      const chip = container.querySelector('.report-severity-chip')
      expect(chip).toHaveClass('report-sev-low')
      expect(chip).toMatchSnapshot()
    })
  })

  describe('StatusBadge', () => {
    it('should render approved status badge', () => {
      const { container } = render(
        <StatusBadge status="approved">APPROVED</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-approved')
      expect(badge).toMatchSnapshot()
    })

    it('should render failed status badge', () => {
      const { container } = render(
        <StatusBadge status="failed">FAILED</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-failed')
      expect(badge).toMatchSnapshot()
    })

    it('should render pending status badge', () => {
      const { container } = render(
        <StatusBadge status="pending">PENDING</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-pending')
      expect(badge).toMatchSnapshot()
    })

    it('should render approved status badge with text content', () => {
      const { getByText } = render(
        <StatusBadge status="approved">Approved</StatusBadge>
      )
      
      expect(getByText('Approved')).toBeInTheDocument()
      expect(getByText('Approved')).toMatchSnapshot()
    })

    it('should render failed status badge with text content', () => {
      const { getByText } = render(
        <StatusBadge status="failed">Failed</StatusBadge>
      )
      
      expect(getByText('Failed')).toBeInTheDocument()
      expect(getByText('Failed')).toMatchSnapshot()
    })

    it('should render pending status badge with text content', () => {
      const { getByText } = render(
        <StatusBadge status="pending">Pending</StatusBadge>
      )
      
      expect(getByText('Pending')).toBeInTheDocument()
      expect(getByText('Pending')).toMatchSnapshot()
    })

    it('should render approved status badge with correct styling', () => {
      const { container } = render(
        <StatusBadge status="approved">Approved</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-approved')
      expect(badge).toMatchSnapshot()
    })

    it('should render failed status badge with correct styling', () => {
      const { container } = render(
        <StatusBadge status="failed">Failed</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-failed')
      expect(badge).toMatchSnapshot()
    })

    it('should render pending status badge with correct styling', () => {
      const { container } = render(
        <StatusBadge status="pending">Pending</StatusBadge>
      )
      
      const badge = container.querySelector('.report-status-badge')
      expect(badge).toHaveClass('report-status-pending')
      expect(badge).toMatchSnapshot()
    })
  })
})
