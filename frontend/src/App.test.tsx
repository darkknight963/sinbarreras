import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import './index.css'
import App from './App'
import { API_FALLBACK_BASE_URL, isLocalRuntimeHost, resolveApiBaseUrl } from './config'

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

const projectsResponse = [
  {
    id: 'project-1',
    name: 'Portal de Servicios',
    domain: 'https://www.gob.pe',
    entityType: 'Administración Pública Peruana',
    vo: 4,
    scans: [
      {
        id: 'scan-1',
        status: 'completed',
        globalScore: 82,
        vp: 12,
        ux: 4,
        createdAt: '2026-05-29T12:00:00.000Z',
        urlResults: [],
      },
    ],
  },
]

const cssSource = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')

describe('App project creation experience', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)
        return {
          ok: true,
          status: 200,
          json: async () => (url.includes('/projects/project-1') ? projectsResponse[0] : projectsResponse),
        }
      }),
    )
  })

  it('opens a guided single-step project modal with contextual help', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))

    expect(screen.getByRole('dialog', { name: /nuevo proyecto/i })).toBeInTheDocument()
    expect(screen.getByText(/agrupa auditor.as de accesibilidad/i)).toBeInTheDocument()
    expect(screen.getByText(/define el contexto institucional/i)).toBeInTheDocument()
    expect(screen.getByText(/alimenta la priorizaci.n peruana/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar modal de nuevo proyecto/i })).toBeInTheDocument()
  })

  it('closes the project modal with the accessible close button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))
    await user.click(screen.getByRole('button', { name: /cerrar modal de nuevo proyecto/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /nuevo proyecto/i })).not.toBeInTheDocument()
    })
  })

  it('keeps entity type and traffic controls in a responsive classification group', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))

    const entityType = screen.getByLabelText(/tipo de entidad/i)
    const traffic = screen.getByLabelText(/tr.fico/i)
    const group = entityType.closest('[data-testid="project-classification-grid"]')

    expect(group).toBeInTheDocument()
    expect(group).toContainElement(entityType)
    expect(group).toContainElement(traffic)
    expect(group).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('uses dark readable text for entity and priority labels on light project cards', async () => {
    render(<App />)

    const entityLabel = await screen.findByText('Administración Pública Peruana')
    const priorityLabel = screen.getByText('Prioridad Media')

    expect(entityLabel).toHaveClass('report-entity-badge')
    expect(priorityLabel).toHaveClass('report-priority-badge', 'report-priority-medium')

    expect(entityLabel).not.toHaveClass('text-slate-600')
    expect(priorityLabel).not.toHaveClass('text-yellow-800')
  })

  it('renders visual score meters and global project metrics', async () => {
    render(<App />)

    await screen.findByText('Portal de Servicios')

    expect(screen.getByText('Total de proyectos')).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento global')).toBeInTheDocument()
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
    expect(screen.getByText('Completando análisis')).toBeInTheDocument()
    expect(screen.getAllByText('82/100').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Cumplimiento bueno')).toBeInTheDocument()
  })

  it('declares higher-specificity dark text rules for light surfaces nested in dark report surfaces', () => {
    expect(cssSource).toContain('.report-surface .report-panel span')
    expect(cssSource).toContain('.report-surface .report-modal span')
    expect(cssSource).toContain('.report-surface .report-card-entity span')
    expect(cssSource).toContain('.report-priority-medium')
    expect(cssSource).toContain('color: #0C447C;')
  })

  it('declares border-box sizing for controls so borders stay inside containers', () => {
    expect(cssSource).toContain('box-sizing: border-box;')
    expect(cssSource).toContain('input,\ntextarea,\nselect,\nbutton')
    expect(cssSource).toContain('max-width: 100%;')
    expect(cssSource).toContain('min-width: 0;')
  })

  it('keeps WCAG table filters inside the header row', () => {
    expect(appSource).not.toContain('report-table-filter-row')
    expect(appSource).toContain('report-table-header-cell')
    expect(appSource).toContain('report-table-filter-label')
  })

  it('offers a WCAG criteria view grouped by principle', () => {
    expect(appSource).toContain("useState<'normal' | 'principles'>('normal')")
    expect(appSource).toContain('Por principios')
    expect(appSource).toContain('Perceptible')
    expect(appSource).toContain('Operable')
    expect(appSource).toContain('Comprensible')
    expect(appSource).toContain('Robusto')
    expect(appSource).toContain('report-principle-row')
    expect(appSource).toContain('getWcagGuideline')
    expect(appSource).toContain('Pauta ${item.key}')
    expect(appSource).toContain('Alternativas textuales')
    expect(appSource).toContain('Navegable')
    expect(appSource).toContain('Asistencia en la entrada')
    expect(appSource).toContain('Compatible')
    expect(appSource).toContain('report-guideline-row')
  })

  it('uses accessible labels and responsive controls in the new scan modal', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /ver detalles del proyecto portal de servicios/i }))
    await screen.findByRole('heading', { name: /portal de servicios/i })
    await user.click(screen.getByRole('button', { name: /nuevo análisis/i }))

    expect(screen.getByRole('dialog', { name: /lanzar auditoría/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar modal de nueva auditoría/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/urls a analizar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modo del análisis/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/impacto en experiencia/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/script de pre-navegación/i)).not.toBeInTheDocument()
    expect(screen.getByText(/scripts personalizados están deshabilitados/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/urls a analizar/i), 'example.com')
    expect(screen.getByText(/no se transfieren al navegador playwright/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /abrir url/i }))
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')

    openSpy.mockRestore()
  })

  it('parses scan URLs separated by commas or line breaks before submitting', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/projects')) {
        return {
          ok: true,
          status: 200,
          json: async () => projectsResponse,
        }
      }

      if (url.endsWith('/projects/project-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => projectsResponse[0],
        }
      }

      if (url.endsWith('/scans') && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 'scan-new' }),
        }
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /ver detalles del proyecto portal de servicios/i }))
    await screen.findByRole('heading', { name: /portal de servicios/i })
    await user.click(screen.getByRole('button', { name: /nuevo análisis/i }))

    await user.type(
      screen.getByLabelText(/urls a analizar/i),
      'https://a.example, https://b.example\nhttps://c.example',
    )

    await user.click(screen.getByRole('button', { name: /iniciar escaneo/i }))

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/scans') && init?.method === 'POST',
    )

    expect(postCall).toBeTruthy()
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      projectId: 'project-1',
      urls: ['https://a.example', 'https://b.example', 'https://c.example'],
      scanMode: 'estándar',
      ux: 4,
    })
  })

  it('treats loopback hosts as local runtimes for API fallback', () => {
    expect(isLocalRuntimeHost('localhost')).toBe(true)
    expect(isLocalRuntimeHost('127.0.0.1')).toBe(true)
    expect(isLocalRuntimeHost('[::1]')).toBe(true)
    expect(isLocalRuntimeHost('example.com')).toBe(false)
    expect(resolveApiBaseUrl(undefined, false, 'localhost')).toBe(API_FALLBACK_BASE_URL)
    expect(resolveApiBaseUrl(undefined, false, '127.0.0.1')).toBe(API_FALLBACK_BASE_URL)
    expect(resolveApiBaseUrl(undefined, false, 'example.com')).toBe('/api')
    expect(resolveApiBaseUrl('https://api.example.com', false, 'localhost')).toBe('https://api.example.com')
  })
})
