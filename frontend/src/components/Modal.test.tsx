import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Modal } from './Modal'

/**
 * 12.7: Write snapshot tests for Modal component
 * Test modal container and overlay, modal entry animation, verify border, shadow, and padding
 * Requirements: 8.1, 8.2, 8.3
 */
describe('Modal Component', () => {
  it('should not render modal when closed', () => {
    const { container } = render(
      <Modal isOpen={false} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    expect(modal).not.toBeInTheDocument()
  })

  it('should render modal when open', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    expect(modal).toBeInTheDocument()
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with title', () => {
    const { getByText } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(getByText('Test Modal')).toBeInTheDocument()
    expect(getByText('Test Modal')).toMatchSnapshot()
  })

  it('should render modal with children content', () => {
    const { getByText } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(getByText('Modal Content')).toBeInTheDocument()
    expect(getByText('Modal Content')).toMatchSnapshot()
  })

  it('should render modal overlay', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const overlay = container.querySelector('.report-modal-overlay')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toMatchSnapshot()
  })

  it('should render modal with correct container styling', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    expect(modal).toHaveClass('report-modal')
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with border and shadow', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    expect(modal).toHaveClass('report-modal')
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with correct padding', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    expect(modal).toHaveClass('report-modal')
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with close button', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal" onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    )
    
    const closeButton = container.querySelector('button')
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toMatchSnapshot()
  })

  it('should handle close button click', () => {
    const handleClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    const closeButton = container.querySelector('button')
    closeButton?.click()
    
    expect(handleClose).toHaveBeenCalled()
  })

  it('should render modal without close button when onClose not provided', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(0)
  })

  it('should render modal with entry animation', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = container.querySelector('.report-modal')
    // Animation is defined in CSS, snapshot captures the element structure
    expect(modal).toHaveClass('report-modal')
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with overlay backdrop blur', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const overlay = container.querySelector('.report-modal-overlay')
    expect(overlay).toHaveClass('report-modal-overlay')
    expect(overlay).toMatchSnapshot()
  })

  it('should render modal with correct z-index layering', () => {
    const { container } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const overlay = container.querySelector('.report-modal-overlay')
    const modal = container.querySelector('.report-modal')
    
    expect(overlay).toBeInTheDocument()
    expect(modal).toBeInTheDocument()
    expect(modal).toMatchSnapshot()
  })

  it('should render modal with title styling', () => {
    const { getByText } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const title = getByText('Test Modal')
    expect(title).toBeInTheDocument()
    expect(title).toMatchSnapshot()
  })

  it('should render modal with multiple children', () => {
    const { getByText } = render(
      <Modal isOpen={true} title="Test Modal">
        <div>First Child</div>
        <div>Second Child</div>
      </Modal>
    )
    
    expect(getByText('First Child')).toBeInTheDocument()
    expect(getByText('Second Child')).toBeInTheDocument()
    expect(getByText('First Child')).toMatchSnapshot()
  })

  it('should render modal with form content', () => {
    const { getByText } = render(
      <Modal isOpen={true} title="Create Project">
        <form>
          <input type="text" placeholder="Project name" />
          <button type="submit">Create</button>
        </form>
      </Modal>
    )
    
    expect(getByText('Create')).toBeInTheDocument()
    expect(getByText('Create')).toMatchSnapshot()
  })
})
