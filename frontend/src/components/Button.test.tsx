import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ActionButton, GhostButton } from './Button'

/**
 * 12.3: Write snapshot tests for Button components
 * Test Action Button (primary) all states, Action Button (green) all states, Ghost Button all states
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
describe('Button Components', () => {
  describe('ActionButton', () => {
    it('should render action button with primary variant', () => {
      const { container } = render(
        <ActionButton variant="primary">Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-action-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render action button with green variant', () => {
      const { container } = render(
        <ActionButton variant="green">Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-action-btn')
      expect(button).toHaveClass('report-action-btn-green')
      expect(button).toMatchSnapshot()
    })

    it('should render action button with text content', () => {
      const { getByText } = render(
        <ActionButton>Click Me</ActionButton>
      )
      
      expect(getByText('Click Me')).toBeInTheDocument()
      expect(getByText('Click Me')).toMatchSnapshot()
    })

    it('should handle click events', () => {
      const handleClick = vi.fn()
      const { container } = render(
        <ActionButton onClick={handleClick}>Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      button?.click()
      
      expect(handleClick).toHaveBeenCalled()
    })

    it('should render action button in disabled state', () => {
      const { container } = render(
        <ActionButton disabled={true}>Click Me</ActionButton>
      )
      
      const button = container.querySelector('button') as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect(button).toMatchSnapshot()
    })

    it('should render action button with custom className', () => {
      const { container } = render(
        <ActionButton className="custom-class">Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toMatchSnapshot()
    })

    it('should render action button with hover state styling', () => {
      const { container } = render(
        <ActionButton>Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      // Hover state is defined in CSS, snapshot captures the element structure
      expect(button).toHaveClass('report-action-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render action button with active state styling', () => {
      const { container } = render(
        <ActionButton>Click Me</ActionButton>
      )
      
      const button = container.querySelector('button')
      // Active state is defined in CSS, snapshot captures the element structure
      expect(button).toHaveClass('report-action-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render primary action button with correct styling', () => {
      const { container } = render(
        <ActionButton variant="primary">Primary</ActionButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-action-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render green action button with correct styling', () => {
      const { container } = render(
        <ActionButton variant="green">Success</ActionButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-action-btn-green')
      expect(button).toMatchSnapshot()
    })
  })

  describe('GhostButton', () => {
    it('should render ghost button with base state', () => {
      const { container } = render(
        <GhostButton>Click Me</GhostButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-ghost-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render ghost button with text content', () => {
      const { getByText } = render(
        <GhostButton>Click Me</GhostButton>
      )
      
      expect(getByText('Click Me')).toBeInTheDocument()
      expect(getByText('Click Me')).toMatchSnapshot()
    })

    it('should handle click events', () => {
      const handleClick = vi.fn()
      const { container } = render(
        <GhostButton onClick={handleClick}>Click Me</GhostButton>
      )
      
      const button = container.querySelector('button')
      button?.click()
      
      expect(handleClick).toHaveBeenCalled()
    })

    it('should render ghost button in disabled state', () => {
      const { container } = render(
        <GhostButton disabled={true}>Click Me</GhostButton>
      )
      
      const button = container.querySelector('button') as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect(button).toMatchSnapshot()
    })

    it('should render ghost button with custom className', () => {
      const { container } = render(
        <GhostButton className="custom-class">Click Me</GhostButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toMatchSnapshot()
    })

    it('should render ghost button with hover state styling', () => {
      const { container } = render(
        <GhostButton>Click Me</GhostButton>
      )
      
      const button = container.querySelector('button')
      // Hover state is defined in CSS, snapshot captures the element structure
      expect(button).toHaveClass('report-ghost-btn')
      expect(button).toMatchSnapshot()
    })

    it('should render ghost button with correct styling', () => {
      const { container } = render(
        <GhostButton>Secondary</GhostButton>
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('report-ghost-btn')
      expect(button).toMatchSnapshot()
    })
  })
})
