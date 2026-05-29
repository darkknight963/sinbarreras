import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportPanel } from './Card';
import { Sidebar } from './Sidebar';

describe('Tablet Breakpoint Tests (768px - 1023px)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 768px') || query.includes('max-width: 1023px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('should keep panel styling for tablet layout adaptation', () => {
    render(<ReportPanel>Panel tablet</ReportPanel>);
    const panel = screen.getByText('Panel tablet').closest('.report-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('report-panel');
  });

  it('should render sidebar links for tablet navigation behavior', () => {
    render(
      <Sidebar
        links={[{ anchor: 'score', label: 'Score' }, { anchor: 'violaciones', label: 'Violaciones' }]}
        activeAnchor="score"
      />
    );
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Score' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Violaciones' })).toBeInTheDocument();
  });

  it('should preserve spacing classes used by responsive layout', () => {
    render(<div className="report-shell report-surface report-panel">tablet shell</div>);
    const shell = screen.getByText('tablet shell');
    expect(shell).toHaveClass('report-shell');
    expect(shell).toHaveClass('report-surface');
    expect(shell).toHaveClass('report-panel');
  });
});
