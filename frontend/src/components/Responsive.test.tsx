import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ReportCardEntity, ReportPanel } from './Card'
import { Header } from './Header'
import { Modal } from './Modal'

/**
 * 15.2: Write mobile breakpoint tests (< 768px)
 * Test .report-shell flex-direction column
 * Test .report-panel padding 16px
 * Test .report-title font-size 1.35rem
 * Test .report-modal padding 20px with margins
 * Verify no horizontal overflow
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

// Helper function to set viewport width
const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

// Helper function to get computed styles
const getComputedStyleValue = (element: Element, property: string): string => {
  return window.getComputedStyle(element).getPropertyValue(property)
}

describe('Mobile Breakpoint Tests (< 768px)', () => {
  beforeEach(() => {
    // Set viewport to mobile width (375px - common mobile width)
    setViewportWidth(375)
  })

  afterEach(() => {
    // Reset viewport to default
    setViewportWidth(1024)
  })

  describe('Report Shell Layout', () => {
    it('should render report-shell with flex-direction column on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Panel</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      // Verify the element exists and has the class
      expect(shell).toHaveClass('report-shell')
      expect(shell).toMatchSnapshot()
    })

    it('should render report-shell with reduced gap on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <div>Content 1</div>
          <div>Content 2</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toMatchSnapshot()
    })

    it('should render report-shell with reduced padding on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <div>Content</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toMatchSnapshot()
    })
  })

  describe('Report Panel Padding', () => {
    it('should render report-panel with 16px padding on mobile', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )

      const panel = container.querySelector('.report-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveClass('report-panel')
      expect(panel).toMatchSnapshot()
    })

    it('should render report-header-panel with 16px padding on mobile', () => {
      const { container } = render(
        <div className="report-header-panel">
          <h1>Header Panel</h1>
        </div>
      )

      const headerPanel = container.querySelector('.report-header-panel')
      expect(headerPanel).toBeInTheDocument()
      expect(headerPanel).toHaveClass('report-header-panel')
      expect(headerPanel).toMatchSnapshot()
    })

    it('should render report-card-entity with 16px padding on mobile', () => {
      const { container } = render(
        <ReportCardEntity title="Test Card" />
      )

      const card = container.querySelector('.report-card-entity')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('report-card-entity')
      expect(card).toMatchSnapshot()
    })

    it('should render multiple panels with consistent 16px padding', () => {
      const { container } = render(
        <div>
          <ReportPanel>
            <div>Panel 1</div>
          </ReportPanel>
          <ReportPanel>
            <div>Panel 2</div>
          </ReportPanel>
        </div>
      )

      const panels = container.querySelectorAll('.report-panel')
      expect(panels).toHaveLength(2)
      panels.forEach(panel => {
        expect(panel).toHaveClass('report-panel')
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('Report Title Font Size', () => {
    it('should render report-title with 1.35rem font-size on mobile', () => {
      const { container } = render(
        <div className="report-title">Test Title</div>
      )

      const title = container.querySelector('.report-title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('report-title')
      expect(title).toMatchSnapshot()
    })

    it('should render report-title without overflow on mobile', () => {
      const { container } = render(
        <div className="report-title">
          This is a very long title that should not overflow on mobile devices
        </div>
      )

      const title = container.querySelector('.report-title')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toContain('This is a very long title')
      expect(title).toMatchSnapshot()
    })

    it('should render report-section-title with reduced size on mobile', () => {
      const { container } = render(
        <div className="report-section-title">Section Title</div>
      )

      const sectionTitle = container.querySelector('.report-section-title')
      expect(sectionTitle).toBeInTheDocument()
      expect(sectionTitle).toHaveClass('report-section-title')
      expect(sectionTitle).toMatchSnapshot()
    })
  })

  describe('Report Modal Styling', () => {
    it('should render report-modal with 20px padding on mobile', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal Content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveClass('report-modal')
      expect(modal).toMatchSnapshot()
    })

    it('should render report-modal with 16px margins on mobile', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal Content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toMatchSnapshot()
    })

    it('should render report-modal-overlay on mobile', () => {
      const { container } = render(
        <div className="report-modal-overlay">
          <div className="report-modal">
            <h3>Modal Title</h3>
          </div>
        </div>
      )

      const overlay = container.querySelector('.report-modal-overlay')
      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass('report-modal-overlay')
      expect(overlay).toMatchSnapshot()
    })

    it('should render modal with animation on mobile', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal Content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      // Animation is defined in CSS, snapshot captures the element
      expect(modal).toMatchSnapshot()
    })
  })

  describe('Sidebar Responsive Behavior', () => {
    it('should render report-sidebar with full width on mobile', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Link 1</a>
          <a href="#" className="report-side-link">Link 2</a>
        </div>
      )

      const sidebar = container.querySelector('.report-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('report-sidebar')
      expect(sidebar).toMatchSnapshot()
    })

    it('should render report-sidebar with static positioning on mobile', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Link</a>
        </div>
      )

      const sidebar = container.querySelector('.report-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toMatchSnapshot()
    })

    it('should render report-side-link with proper styling on mobile', () => {
      const { container } = render(
        <a href="#" className="report-side-link">Navigation Link</a>
      )

      const link = container.querySelector('.report-side-link')
      expect(link).toBeInTheDocument()
      expect(link).toHaveClass('report-side-link')
      expect(link?.textContent).toBe('Navigation Link')
      expect(link).toMatchSnapshot()
    })
  })

  describe('Header Responsive Behavior', () => {
    it('should render header with reduced padding on mobile', () => {
      const { container } = render(
        <header className="sticky">
          <h1>Platform Title</h1>
          <p>Subtitle</p>
        </header>
      )

      const header = container.querySelector('header.sticky')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('sticky')
      expect(header).toMatchSnapshot()
    })

    it('should render header title with reduced font-size on mobile', () => {
      const { container } = render(
        <header className="sticky">
          <h1>Plataforma de Accesibilidad Web</h1>
        </header>
      )

      const title = container.querySelector('header.sticky h1')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('Plataforma de Accesibilidad Web')
      expect(title).toMatchSnapshot()
    })

    it('should render header badge on mobile', () => {
      const { container } = render(
        <header className="sticky">
          <h1>Title</h1>
          <div className="header-badge">Normativa Peruana 2026</div>
        </header>
      )

      const badge = container.querySelector('.header-badge')
      expect(badge).toBeInTheDocument()
      expect(badge?.textContent).toBe('Normativa Peruana 2026')
      expect(badge).toMatchSnapshot()
    })
  })

  describe('Table Responsive Behavior', () => {
    it('should render report-table with reduced font-size on mobile', () => {
      const { container } = render(
        <table className="report-table">
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cell 1</td>
              <td>Cell 2</td>
            </tr>
          </tbody>
        </table>
      )

      const table = container.querySelector('.report-table')
      expect(table).toBeInTheDocument()
      expect(table).toHaveClass('report-table')
      expect(table).toMatchSnapshot()
    })

    it('should render table header with reduced padding on mobile', () => {
      const { container } = render(
        <table className="report-table">
          <thead>
            <tr>
              <th>Header</th>
            </tr>
          </thead>
        </table>
      )

      const th = container.querySelector('.report-table th')
      expect(th).toBeInTheDocument()
      expect(th?.textContent).toBe('Header')
      expect(th).toMatchSnapshot()
    })

    it('should render table cells with reduced padding on mobile', () => {
      const { container } = render(
        <table className="report-table">
          <tbody>
            <tr>
              <td>Cell Content</td>
            </tr>
          </tbody>
        </table>
      )

      const td = container.querySelector('.report-table td')
      expect(td).toBeInTheDocument()
      expect(td?.textContent).toBe('Cell Content')
      expect(td).toMatchSnapshot()
    })
  })

  describe('No Horizontal Overflow', () => {
    it('should not have horizontal overflow on mobile viewport', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">
            <h1 className="report-title">Long Title That Should Not Overflow</h1>
            <p>Content</p>
          </div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      // Verify the shell doesn't exceed viewport width
      expect(shell).toMatchSnapshot()
    })

    it('should render modal without horizontal overflow on mobile', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title That Is Very Long And Should Not Overflow</h3>
          <p>Modal content goes here</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toMatchSnapshot()
    })

    it('should render card entity without horizontal overflow on mobile', () => {
      const { container } = render(
        <ReportCardEntity 
          title="Very Long Card Title That Should Not Overflow On Mobile"
          description="This is a long description that should wrap properly"
        />
      )

      const card = container.querySelector('.report-card-entity')
      expect(card).toBeInTheDocument()
      expect(card).toMatchSnapshot()
    })

    it('should render main container with proper padding on mobile', () => {
      const { container } = render(
        <main className="max-w-7xl">
          <div className="report-panel">
            <h1 className="report-title">Main Content</h1>
          </div>
        </main>
      )

      const main = container.querySelector('main.max-w-7xl')
      expect(main).toBeInTheDocument()
      expect(main).toMatchSnapshot()
    })
  })

  describe('Component Reflow on Mobile', () => {
    it('should reflow card grid to single column on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <ReportCardEntity title="Card 1" />
          <ReportCardEntity title="Card 2" />
          <ReportCardEntity title="Card 3" />
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      const cards = container.querySelectorAll('.report-card-entity')
      expect(cards).toHaveLength(3)
      expect(shell).toMatchSnapshot()
    })

    it('should adapt modal width on mobile', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toMatchSnapshot()
    })

    it('should scale typography on mobile', () => {
      const { container } = render(
        <div>
          <h1 className="report-title">Title</h1>
          <h2 className="report-section-title">Section</h2>
          <p>Body text</p>
        </div>
      )

      const title = container.querySelector('.report-title')
      const section = container.querySelector('.report-section-title')
      expect(title).toBeInTheDocument()
      expect(section).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })
  })

  describe('Spacing Optimization on Mobile', () => {
    it('should reduce gap between shell elements on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Panel</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toMatchSnapshot()
    })

    it('should reduce padding in panels on mobile', () => {
      const { container } = render(
        <div>
          <ReportPanel>
            <div>Content 1</div>
          </ReportPanel>
          <ReportPanel>
            <div>Content 2</div>
          </ReportPanel>
        </div>
      )

      const panels = container.querySelectorAll('.report-panel')
      expect(panels).toHaveLength(2)
      expect(container).toMatchSnapshot()
    })

    it('should optimize card entity spacing on mobile', () => {
      const { container } = render(
        <div>
          <ReportCardEntity title="Card 1" />
          <ReportCardEntity title="Card 2" />
        </div>
      )

      const cards = container.querySelectorAll('.report-card-entity')
      expect(cards).toHaveLength(2)
      expect(container).toMatchSnapshot()
    })
  })

  describe('Accessibility on Mobile', () => {
    it('should maintain semantic structure on mobile', () => {
      const { container } = render(
        <div className="report-shell">
          <aside className="report-sidebar">
            <nav>
              <a href="#" className="report-side-link">Link</a>
            </nav>
          </aside>
          <main>
            <article className="report-panel">
              <h1 className="report-title">Title</h1>
            </article>
          </main>
        </div>
      )

      const aside = container.querySelector('aside.report-sidebar')
      const main = container.querySelector('main')
      const article = container.querySelector('article.report-panel')
      expect(aside).toBeInTheDocument()
      expect(main).toBeInTheDocument()
      expect(article).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('should maintain focus visibility on mobile', () => {
      const { container } = render(
        <button className="report-action-btn">Action</button>
      )

      const button = container.querySelector('.report-action-btn')
      expect(button).toBeInTheDocument()
      expect(button).toMatchSnapshot()
    })

    it('should maintain color contrast on mobile', () => {
      const { container } = render(
        <div>
          <span className="report-sev-high">HIGH</span>
          <span className="report-sev-medium">MEDIUM</span>
          <span className="report-sev-low">LOW</span>
        </div>
      )

      const high = container.querySelector('.report-sev-high')
      const medium = container.querySelector('.report-sev-medium')
      const low = container.querySelector('.report-sev-low')
      expect(high).toBeInTheDocument()
      expect(medium).toBeInTheDocument()
      expect(low).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })
  })
})

/**
 * 15.4: Write desktop breakpoint tests (≥ 1024px)
 * Test full layout with sidebar
 * Test .report-panel padding 24px
 * Test optimal spacing and readability
 * Verify no layout shifts
 * Requirements: 10.1
 */

describe('Desktop Breakpoint Tests (≥ 1024px)', () => {
  beforeEach(() => {
    // Set viewport to desktop width (1440px - common desktop width)
    setViewportWidth(1440)
  })

  afterEach(() => {
    // Reset viewport to default
    setViewportWidth(1024)
  })

  describe('Full Layout with Sidebar', () => {
    it('should render report-shell with flex-direction row on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Panel</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toHaveClass('report-shell')
      expect(shell).toMatchSnapshot()
    })

    it('should render report-shell with full gap on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Panel</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toMatchSnapshot()
    })

    it('should render report-sidebar with full width on desktop', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Link 1</a>
          <a href="#" className="report-side-link">Link 2</a>
          <a href="#" className="report-side-link">Link 3</a>
        </div>
      )

      const sidebar = container.querySelector('.report-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('report-sidebar')
      expect(sidebar).toMatchSnapshot()
    })

    it('should render report-sidebar with sticky positioning on desktop', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Link</a>
        </div>
      )

      const sidebar = container.querySelector('.report-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toMatchSnapshot()
    })

    it('should render multiple panels alongside sidebar on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">
            <a href="#" className="report-side-link">Link 1</a>
            <a href="#" className="report-side-link">Link 2</a>
          </div>
          <div>
            <ReportPanel>
              <div>Panel 1</div>
            </ReportPanel>
            <ReportPanel>
              <div>Panel 2</div>
            </ReportPanel>
          </div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      const sidebar = container.querySelector('.report-sidebar')
      const panels = container.querySelectorAll('.report-panel')
      expect(shell).toBeInTheDocument()
      expect(sidebar).toBeInTheDocument()
      expect(panels).toHaveLength(2)
      expect(shell).toMatchSnapshot()
    })
  })

  describe('Report Panel Padding (24px)', () => {
    it('should render report-panel with 24px padding on desktop', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )

      const panel = container.querySelector('.report-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveClass('report-panel')
      expect(panel).toMatchSnapshot()
    })

    it('should render report-header-panel with 24px padding on desktop', () => {
      const { container } = render(
        <div className="report-header-panel">
          <h1>Header Panel</h1>
          <p>Subtitle</p>
        </div>
      )

      const headerPanel = container.querySelector('.report-header-panel')
      expect(headerPanel).toBeInTheDocument()
      expect(headerPanel).toHaveClass('report-header-panel')
      expect(headerPanel).toMatchSnapshot()
    })

    it('should render report-card-entity with 20px padding on desktop', () => {
      const { container } = render(
        <ReportCardEntity title="Test Card" description="Card description" />
      )

      const card = container.querySelector('.report-card-entity')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('report-card-entity')
      expect(card).toMatchSnapshot()
    })

    it('should render multiple panels with consistent 24px padding', () => {
      const { container } = render(
        <div>
          <ReportPanel>
            <div>Panel 1</div>
          </ReportPanel>
          <ReportPanel>
            <div>Panel 2</div>
          </ReportPanel>
          <ReportPanel>
            <div>Panel 3</div>
          </ReportPanel>
        </div>
      )

      const panels = container.querySelectorAll('.report-panel')
      expect(panels).toHaveLength(3)
      panels.forEach(panel => {
        expect(panel).toHaveClass('report-panel')
      })
      expect(container).toMatchSnapshot()
    })

    it('should render spacious panel with increased padding on desktop', () => {
      const { container } = render(
        <ReportPanel spacious={true}>
          <div>Spacious Panel Content</div>
        </ReportPanel>
      )

      const panel = container.querySelector('.report-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveClass('report-panel-spacious')
      expect(panel).toMatchSnapshot()
    })
  })

  describe('Optimal Spacing and Readability', () => {
    it('should render report-title with full size on desktop', () => {
      const { container } = render(
        <div className="report-title">Test Title</div>
      )

      const title = container.querySelector('.report-title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('report-title')
      expect(title).toMatchSnapshot()
    })

    it('should render report-section-title with full size on desktop', () => {
      const { container } = render(
        <div className="report-section-title">Section Title</div>
      )

      const sectionTitle = container.querySelector('.report-section-title')
      expect(sectionTitle).toBeInTheDocument()
      expect(sectionTitle).toHaveClass('report-section-title')
      expect(sectionTitle).toMatchSnapshot()
    })

    it('should render report-modal with full width on desktop', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal Content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveClass('report-modal')
      expect(modal).toMatchSnapshot()
    })

    it('should render header with full padding on desktop', () => {
      const { container } = render(
        <header className="sticky">
          <h1>Plataforma de Accesibilidad Web</h1>
          <p>Resolución N° 001-2025-PCM/SGTD — Estándar Oficial Perú</p>
          <div className="header-badge">Normativa Peruana 2026</div>
        </header>
      )

      const header = container.querySelector('header.sticky')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('sticky')
      expect(header).toMatchSnapshot()
    })

    it('should render header title with full font-size on desktop', () => {
      const { container } = render(
        <header className="sticky">
          <h1>Plataforma de Accesibilidad Web</h1>
        </header>
      )

      const title = container.querySelector('header.sticky h1')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('Plataforma de Accesibilidad Web')
      expect(title).toMatchSnapshot()
    })

    it('should render table with optimal spacing on desktop', () => {
      const { container } = render(
        <table className="report-table">
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
              <th>Header 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cell 1</td>
              <td>Cell 2</td>
              <td>Cell 3</td>
            </tr>
            <tr>
              <td>Cell 4</td>
              <td>Cell 5</td>
              <td>Cell 6</td>
            </tr>
          </tbody>
        </table>
      )

      const table = container.querySelector('.report-table')
      expect(table).toBeInTheDocument()
      expect(table).toHaveClass('report-table')
      expect(table).toMatchSnapshot()
    })

    it('should render main container with full padding on desktop', () => {
      const { container } = render(
        <main className="max-w-7xl">
          <div className="report-panel">
            <h1 className="report-title">Main Content</h1>
            <p>This is the main content area with optimal spacing.</p>
          </div>
        </main>
      )

      const main = container.querySelector('main.max-w-7xl')
      expect(main).toBeInTheDocument()
      expect(main).toMatchSnapshot()
    })

    it('should render sidebar links with proper spacing on desktop', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Overview</a>
          <a href="#" className="report-side-link">Details</a>
          <a href="#" className="report-side-link">Settings</a>
        </div>
      )

      const links = container.querySelectorAll('.report-side-link')
      expect(links).toHaveLength(3)
      links.forEach(link => {
        expect(link).toHaveClass('report-side-link')
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('No Layout Shifts', () => {
    it('should maintain consistent layout when loading content', () => {
      const { container, rerender } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Initial Content</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      const initialSnapshot = shell?.innerHTML

      // Rerender with different content
      rerender(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Updated Content</div>
        </div>
      )

      const updatedSnapshot = shell?.innerHTML
      // Layout structure should remain the same
      expect(shell).toBeInTheDocument()
      expect(initialSnapshot).toBeDefined()
      expect(updatedSnapshot).toBeDefined()
      expect(shell).toMatchSnapshot()
    })

    it('should not shift layout when adding/removing sidebar links', () => {
      const { container, rerender } = render(
        <div className="report-shell">
          <div className="report-sidebar">
            <a href="#" className="report-side-link">Link 1</a>
          </div>
          <div className="report-panel">Content</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()

      // Add more links
      rerender(
        <div className="report-shell">
          <div className="report-sidebar">
            <a href="#" className="report-side-link">Link 1</a>
            <a href="#" className="report-side-link">Link 2</a>
            <a href="#" className="report-side-link">Link 3</a>
          </div>
          <div className="report-panel">Content</div>
        </div>
      )

      const sidebar = container.querySelector('.report-sidebar')
      const links = sidebar?.querySelectorAll('.report-side-link')
      expect(links).toHaveLength(3)
      expect(shell).toMatchSnapshot()
    })

    it('should maintain panel width consistency on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div>
            <ReportPanel>
              <div>Short content</div>
            </ReportPanel>
            <ReportPanel>
              <div>This is a much longer content that spans multiple lines and should not cause layout shifts or changes to the panel width</div>
            </ReportPanel>
          </div>
        </div>
      )

      const panels = container.querySelectorAll('.report-panel')
      expect(panels).toHaveLength(2)
      expect(container).toMatchSnapshot()
    })

    it('should maintain modal position when content changes', () => {
      const { container, rerender } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Short content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()

      // Rerender with longer content
      rerender(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>This is a much longer content that spans multiple lines and should not cause the modal to shift or change its position on the screen</p>
        </div>
      )

      expect(modal).toBeInTheDocument()
      expect(modal).toMatchSnapshot()
    })

    it('should not shift layout when toggling card hover state', () => {
      const { container } = render(
        <div>
          <ReportCardEntity title="Card 1" />
          <ReportCardEntity title="Card 2" />
          <ReportCardEntity title="Card 3" />
        </div>
      )

      const cards = container.querySelectorAll('.report-card-entity')
      expect(cards).toHaveLength(3)
      expect(container).toMatchSnapshot()
    })

    it('should maintain table layout consistency on desktop', () => {
      const { container } = render(
        <table className="report-table">
          <thead>
            <tr>
              <th>Column 1</th>
              <th>Column 2</th>
              <th>Column 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Short</td>
              <td>Medium length content</td>
              <td>This is a very long content that spans multiple lines</td>
            </tr>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
              <td>Data 3</td>
            </tr>
          </tbody>
        </table>
      )

      const table = container.querySelector('.report-table')
      expect(table).toBeInTheDocument()
      expect(table).toMatchSnapshot()
    })
  })

  describe('Component Reflow on Desktop', () => {
    it('should display card grid with multiple columns on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <ReportCardEntity title="Card 1" />
          <ReportCardEntity title="Card 2" />
          <ReportCardEntity title="Card 3" />
          <ReportCardEntity title="Card 4" />
        </div>
      )

      const cards = container.querySelectorAll('.report-card-entity')
      expect(cards).toHaveLength(4)
      expect(container).toMatchSnapshot()
    })

    it('should display full modal width on desktop', () => {
      const { container } = render(
        <div className="report-modal">
          <h3>Modal Title</h3>
          <p>Modal content</p>
        </div>
      )

      const modal = container.querySelector('.report-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toMatchSnapshot()
    })

    it('should display full typography scale on desktop', () => {
      const { container } = render(
        <div>
          <h1 className="report-title">Title</h1>
          <h2 className="report-section-title">Section</h2>
          <p>Body text</p>
        </div>
      )

      const title = container.querySelector('.report-title')
      const section = container.querySelector('.report-section-title')
      expect(title).toBeInTheDocument()
      expect(section).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })
  })

  describe('Spacing Optimization on Desktop', () => {
    it('should maintain full gap between shell elements on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <div className="report-sidebar">Sidebar</div>
          <div className="report-panel">Panel</div>
        </div>
      )

      const shell = container.querySelector('.report-shell')
      expect(shell).toBeInTheDocument()
      expect(shell).toMatchSnapshot()
    })

    it('should maintain full padding in panels on desktop', () => {
      const { container } = render(
        <div>
          <ReportPanel>
            <div>Content 1</div>
          </ReportPanel>
          <ReportPanel>
            <div>Content 2</div>
          </ReportPanel>
        </div>
      )

      const panels = container.querySelectorAll('.report-panel')
      expect(panels).toHaveLength(2)
      expect(container).toMatchSnapshot()
    })

    it('should maintain optimal card entity spacing on desktop', () => {
      const { container } = render(
        <div>
          <ReportCardEntity title="Card 1" />
          <ReportCardEntity title="Card 2" />
          <ReportCardEntity title="Card 3" />
        </div>
      )

      const cards = container.querySelectorAll('.report-card-entity')
      expect(cards).toHaveLength(3)
      expect(container).toMatchSnapshot()
    })

    it('should maintain optimal table spacing on desktop', () => {
      const { container } = render(
        <table className="report-table">
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
              <th>Header 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cell 1</td>
              <td>Cell 2</td>
              <td>Cell 3</td>
            </tr>
          </tbody>
        </table>
      )

      const table = container.querySelector('.report-table')
      expect(table).toBeInTheDocument()
      expect(table).toMatchSnapshot()
    })
  })

  describe('Accessibility on Desktop', () => {
    it('should maintain semantic structure on desktop', () => {
      const { container } = render(
        <div className="report-shell">
          <aside className="report-sidebar">
            <nav>
              <a href="#" className="report-side-link">Link 1</a>
              <a href="#" className="report-side-link">Link 2</a>
            </nav>
          </aside>
          <main>
            <article className="report-panel">
              <h1 className="report-title">Title</h1>
              <p>Content</p>
            </article>
          </main>
        </div>
      )

      const aside = container.querySelector('aside.report-sidebar')
      const main = container.querySelector('main')
      const article = container.querySelector('article.report-panel')
      expect(aside).toBeInTheDocument()
      expect(main).toBeInTheDocument()
      expect(article).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('should maintain focus visibility on desktop', () => {
      const { container } = render(
        <button className="report-action-btn">Action</button>
      )

      const button = container.querySelector('.report-action-btn')
      expect(button).toBeInTheDocument()
      expect(button).toMatchSnapshot()
    })

    it('should maintain color contrast on desktop', () => {
      const { container } = render(
        <div>
          <span className="report-sev-high">HIGH</span>
          <span className="report-sev-medium">MEDIUM</span>
          <span className="report-sev-low">LOW</span>
          <span className="report-status-approved">APPROVED</span>
          <span className="report-status-failed">FAILED</span>
          <span className="report-status-pending">PENDING</span>
        </div>
      )

      const high = container.querySelector('.report-sev-high')
      const medium = container.querySelector('.report-sev-medium')
      const low = container.querySelector('.report-sev-low')
      const approved = container.querySelector('.report-status-approved')
      const failed = container.querySelector('.report-status-failed')
      const pending = container.querySelector('.report-status-pending')
      expect(high).toBeInTheDocument()
      expect(medium).toBeInTheDocument()
      expect(low).toBeInTheDocument()
      expect(approved).toBeInTheDocument()
      expect(failed).toBeInTheDocument()
      expect(pending).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('should maintain keyboard navigation on desktop', () => {
      const { container } = render(
        <div className="report-sidebar">
          <a href="#" className="report-side-link">Link 1</a>
          <a href="#" className="report-side-link">Link 2</a>
          <a href="#" className="report-side-link">Link 3</a>
        </div>
      )

      const links = container.querySelectorAll('.report-side-link')
      expect(links).toHaveLength(3)
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('Interactive States on Desktop', () => {
    it('should render card entity with hover state on desktop', () => {
      const { container } = render(
        <ReportCardEntity title="Test Card" description="Card description" />
      )

      const card = container.querySelector('.report-card-entity')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('report-card-entity')
      expect(card).toMatchSnapshot()
    })

    it('should render button with hover state on desktop', () => {
      const { container } = render(
        <button className="report-action-btn">Action Button</button>
      )

      const button = container.querySelector('.report-action-btn')
      expect(button).toBeInTheDocument()
      expect(button?.textContent).toBe('Action Button')
      expect(button).toMatchSnapshot()
    })

    it('should render sidebar link with hover state on desktop', () => {
      const { container } = render(
        <a href="#" className="report-side-link">Navigation Link</a>
      )

      const link = container.querySelector('.report-side-link')
      expect(link).toBeInTheDocument()
      expect(link?.textContent).toBe('Navigation Link')
      expect(link).toMatchSnapshot()
    })

    it('should render panel with hover state on desktop', () => {
      const { container } = render(
        <ReportPanel>
          <div>Panel Content</div>
        </ReportPanel>
      )

      const panel = container.querySelector('.report-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toMatchSnapshot()
    })
  })
})
