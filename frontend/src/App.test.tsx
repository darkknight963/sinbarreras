import { render, screen, waitFor, within } from '@testing-library/react'
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
    entityType: 'AdministraciÃ³n PÃºblica Peruana',
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
const projectsViewSource = readFileSync(join(process.cwd(), 'src', 'views', 'ProjectsView.tsx'), 'utf8')
const scanReportViewSource = readFileSync(join(process.cwd(), 'src', 'views', 'ScanReportView.tsx'), 'utf8')

describe('App project creation experience', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('sin-barreras-session-token', 'test-session-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/guest')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token: 'guest-session-token',
              user: {
                id: 'guest-user-1',
                email: 'guest@sinbarreras.local',
                fullName: 'Invitado',
                companyName: 'Sin Barreras',
                role: 'guest',
                billingStatus: 'inactive',
                billingPlan: null,
                billingProvider: 'culqi',
                billingCurrency: null,
                billingPeriodEnd: null,
                billingCustomerId: null,
                billingSubscriptionId: null,
              },
            }),
          }
        }
        if (url.includes('/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
              email: 'admin@example.com',
              fullName: 'Admin',
              companyName: 'Sin Barreras',
              role: 'owner',
              billingStatus: 'active',
              billingPlan: 'monthly',
              billingProvider: 'culqi',
              billingCurrency: 'PEN',
              billingPeriodEnd: '2026-06-30T00:00:00.000Z',
              billingCustomerId: 'cus_test_123',
              billingSubscriptionId: 'sxn_test_123',
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => (url.includes('/projects/project-1') ? projectsResponse[0] : projectsResponse),
        }
      }),
    )
  })

  it('renders a more editorial unauthenticated login experience', async () => {
    window.localStorage.clear()

    render(<App />)

    await screen.findByText('Portal de Servicios')
    expect(screen.getByText(/modo invitado activo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ver planes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeInTheDocument()
  })

  it('opens a direct project form without classification or prioritization steps', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))

    const dialog = screen.getByRole('dialog', { name: /configura tu proyecto/i })

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /2clasificacion/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /3priorizacion/i })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/descripcion/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/el tipo de entidad y la ley aplicable/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /crear proyecto/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar modal de nuevo proyecto/i })).toBeInTheDocument()
  })

  it('creates a project without opening the new analysis flow automatically', async () => {
    const user = userEvent.setup()
    const createdProject = {
      id: 'project-2',
      name: 'Portal Municipal',
      domain: null,
      entityType: 'Sector público',
      vo: 4,
      createdAt: '2026-06-06T12:00:00.000Z',
      scans: [],
    }
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-1',
            email: 'admin@example.com',
            fullName: 'Admin',
            companyName: 'Sin Barreras',
            role: 'owner',
            billingStatus: 'active',
            billingPlan: 'monthly',
            billingProvider: 'culqi',
            billingCurrency: 'PEN',
            billingPeriodEnd: '2026-06-30T00:00:00.000Z',
            billingCustomerId: 'cus_test_123',
            billingSubscriptionId: 'sxn_test_123',
          }),
        }
      }

      if (url.endsWith('/projects') && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => createdProject,
        }
      }

      if (url.endsWith('/projects')) {
        return {
          ok: true,
          status: 200,
          json: async () => [createdProject, ...projectsResponse],
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
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))

    const dialog = screen.getByRole('dialog', { name: /configura tu proyecto/i })
    await user.type(within(dialog).getByLabelText(/nombre del proyecto/i), createdProject.name)
    await user.click(within(dialog).getByRole('button', { name: /crear proyecto/i }))

    await screen.findByText('Portal Municipal')

    expect(screen.queryByRole('dialog', { name: /lanzar auditor/i })).not.toBeInTheDocument()
    expect(screen.getByText('Mis proyectos')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(
      ([input, init]) => String(input).endsWith('/scans') && init?.method === 'POST',
    )).toBe(false)
  })

  it('closes the project modal with the accessible close button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))
    await user.click(screen.getByRole('button', { name: /cerrar modal de nuevo proyecto/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /configura tu proyecto/i })).not.toBeInTheDocument()
    })
  })

  it('keeps entity and law controls on the direct project form', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }))

    const entityType = screen.getByLabelText(/tipo de entidad/i)
    const law = screen.getByLabelText(/ley general aplicable/i)
    const group = entityType.closest('[data-testid="project-classification-grid"]')

    expect(group).toBeInTheDocument()
    expect(group).toContainElement(entityType)
    expect(group).toContainElement(law)
    expect(group).toHaveClass('create-project-grid')

    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/trafico/i)).not.toBeInTheDocument()
  })

  it('uses dark readable text for entity and priority labels on light project cards', async () => {
    render(<App />)

    const entityLabel = await screen.findByText('AdministraciÃ³n PÃºblica Peruana', { selector: '.report-entity-badge' })
    const priorityLabel = screen.getByText('Prioridad Media')

    expect(entityLabel).toHaveClass('report-entity-badge')
    expect(priorityLabel).toHaveClass('report-priority-badge', 'report-priority-medium')

    expect(entityLabel).not.toHaveClass('text-slate-600')
    expect(priorityLabel).not.toHaveClass('text-yellow-800')
  })

  it('renders legal metrics inside each project card and removes the separate project metrics section', async () => {
    render(<App />)

    await screen.findByText('Portal de Servicios')

    expect(screen.getByText('ClasificaciÃ³n')).toBeInTheDocument()
    expect(screen.getByText('AdministraciÃ³n PÃºblica Peruana', { selector: '.legal-metric-value' })).toBeInTheDocument()
    expect(screen.getByText('Ley NÂ° 29973 (Multas hasta 12 UIT)')).toBeInTheDocument()
    expect(appSource).not.toContain('Norma Aplicable')
    expect(appSource).not.toContain('MÃ©tricas Legales')
    expect(projectsViewSource).toContain('project-card-legal')
  })

  it('renders visual score meters and global project metrics', async () => {
    render(<App />)

    await screen.findByText('Portal de Servicios')

    expect(screen.getByText('Total de proyectos')).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento global')).toBeInTheDocument()
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
    expect(screen.getByText('Completando anÃ¡lisis')).toBeInTheDocument()
    expect(screen.getAllByText('82/100').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Cumplimiento bueno')).toBeInTheDocument()
  })

  it('shows the authenticated user name in the header and exposes password change actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Portal de Servicios')
    expect(screen.getByRole('button', { name: /cuenta de admin/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cuenta de admin/i }))

    expect(screen.getByRole('menu', { name: /opciones de cuenta/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /cambiar contraseÃ±a/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /salir/i })).toBeInTheDocument()
  })

  it('declares higher-specificity dark text rules for light surfaces nested in dark report surfaces', () => {
    expect(cssSource).toContain('.report-surface :is(.report-panel, .report-header-panel, .report-card-entity, .report-modal, .report-url-card, .report-manual-card)')
    expect(cssSource).toContain('.report-surface .text-slate-400')
    expect(cssSource).toContain('box-sizing: border-box')
    expect(cssSource).toContain('max-width: 100%')
    expect(cssSource).toContain('min-width: 0')
  })

  it('declares border-box sizing for controls so borders stay inside containers', () => {
    expect(cssSource).toContain('box-sizing: border-box;')
    expect(cssSource).toContain('input, textarea, select, button')
    expect(cssSource).toContain('max-width: 100%;')
    expect(cssSource).toContain('min-width: 0;')
  })

  it('keeps WCAG table filters inside the header row', () => {
    expect(scanReportViewSource).not.toContain('report-table-filter-row')
    expect(scanReportViewSource).toContain('report-table-header-cell')
    expect(scanReportViewSource).toContain('report-table-filter-label')
  })

  it('offers a WCAG criteria view grouped by principle', () => {
    expect(appSource).toContain("useState<'normal' | 'principles'>('normal')")
    expect(appSource).toContain('Perceptible')
    expect(appSource).toContain('Operable')
    expect(appSource).toContain('Comprensible')
    expect(appSource).toContain('Robusto')
    expect(appSource).toContain('Alternativas textuales')
    expect(appSource).toContain('Navegable')
    expect(appSource).toContain('Asistencia en la entrada')
    expect(appSource).toContain('Compatible')
    expect(scanReportViewSource).toContain('Por principios')
    expect(scanReportViewSource).toContain('report-principle-row')
    expect(scanReportViewSource).toContain('Pauta ${item.key}')
    expect(scanReportViewSource).toContain('report-guideline-row')
  })

  it('uses accessible labels and responsive controls in the new scan modal', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /ver detalles del proyecto portal de servicios/i }))
    await screen.findByRole('heading', { name: /portal de servicios/i })
    await user.click(screen.getByRole('button', { name: /nuevo an.lisis/i }))

    expect(screen.getByRole('dialog', { name: /lanzar auditor.a/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver a proyectos/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/urls a analizar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modo del an.lisis/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/impacto en experiencia/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/script de pre-navegaci.n/i)).not.toBeInTheDocument()
    expect(screen.getByText(/scripts personalizados est.n deshabilitados/i)).toBeInTheDocument()

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

      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-1',
            email: 'admin@example.com',
            fullName: 'Admin',
            companyName: 'Sin Barreras',
            role: 'owner',
            billingStatus: 'active',
            billingPlan: 'monthly',
            billingProvider: 'culqi',
            billingCurrency: 'PEN',
            billingPeriodEnd: '2026-06-30T00:00:00.000Z',
            billingCustomerId: 'cus_test_123',
            billingSubscriptionId: 'sxn_test_123',
          }),
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
    await user.click(screen.getByRole('button', { name: /nuevo anÃ¡lisis/i }))

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
      scanMode: 'estÃ¡ndar',
      ux: 4,
    })
  })

  it('renders billing plans and opens Culqi Checkout for the selected plan', async () => {
    const user = userEvent.setup()
    const checkoutOpen = vi.fn()
    const checkoutClose = vi.fn()

    vi.stubGlobal(
      'CulqiCheckout',
      class {
        token: { id: string } | null = null
        order = null
        error = null
        culqi: null | (() => void | Promise<void>) = null
        constructor(_publicKey: string, _config: Record<string, unknown>) {}
        open = () => {
          checkoutOpen()
          this.token = { id: 'tok_test_123' }
          void this.culqi?.()
        }
        close = checkoutClose
      },
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
              email: 'admin@example.com',
              fullName: 'Admin',
              companyName: 'Sin Barreras',
              role: 'owner',
              billingStatus: 'inactive',
              billingPlan: null,
              billingProvider: 'culqi',
              billingCurrency: null,
              billingPeriodEnd: null,
              billingCustomerId: null,
              billingSubscriptionId: null,
            }),
          }
        }

        if (url.includes('/projects') && !url.includes('/billing')) {
          return {
            ok: true,
            status: 200,
            json: async () => projectsResponse,
          }
        }

        if (url.includes('/billing/plans')) {
          return {
            ok: true,
            status: 200,
            json: async () => ([
              { code: 'monthly', currency: 'PEN', label: 'Mensual', description: 'Plan mensual', provider: 'culqi', providerPlanId: 'pln_pen_monthly', available: true, amount: 4900 },
              { code: 'annual', currency: 'PEN', label: 'Anual', description: 'Plan anual', provider: 'culqi', providerPlanId: 'pln_pen_annual', available: true, amount: 49000 },
            ]),
          }
        }

        if (url.includes('/billing/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'inactive',
              plan: null,
              provider: 'culqi',
              currency: null,
              currentPeriodEnd: null,
              customerId: null,
              subscriptionId: null,
            }),
          }
        }

        if (url.includes('/billing/checkout') && init?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              publicKey: 'pk_test_123',
              amount: 4900,
            }),
          }
        }

        if (url.includes('/billing/confirm') && init?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'active',
              plan: 'monthly',
              provider: 'culqi',
              currency: 'PEN',
              currentPeriodEnd: '2026-06-30T00:00:00.000Z',
              customerId: 'cus_test_123',
              subscriptionId: 'sxn_test_123',
            }),
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        }
      }),
    )

    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /planes/i }))
    await screen.findByRole('heading', { name: /simple y transparente/i })
    expect(screen.getByRole('button', { name: /volver al sistema/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /empezar gratis/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contactar ventas/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /empezar con pro/i }))

    expect(checkoutOpen).toHaveBeenCalled()
    expect(checkoutClose).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText(/tu plan mensual ya qued.{1,4} registrado/i)).toBeInTheDocument()
    })
  })

  it('lets users return from billing to the main system', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
              email: 'admin@example.com',
              fullName: 'Admin',
              companyName: 'Sin Barreras',
              role: 'owner',
              billingStatus: 'active',
              billingPlan: 'monthly',
              billingProvider: 'culqi',
              billingCurrency: 'PEN',
              billingPeriodEnd: '2026-06-30T00:00:00.000Z',
              billingCustomerId: 'cus_test_123',
              billingSubscriptionId: 'sxn_test_123',
            }),
          }
        }

        if (url.includes('/billing/plans')) {
          return {
            ok: true,
            status: 200,
            json: async () => ([
              { code: 'monthly', currency: 'PEN', label: 'Mensual', description: 'Plan mensual', provider: 'culqi', providerPlanId: 'pln_pen_monthly', available: true, amount: 4900 },
            ]),
          }
        }

        if (url.includes('/billing/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'active',
              plan: 'monthly',
              provider: 'culqi',
              currency: 'PEN',
              currentPeriodEnd: '2026-06-30T00:00:00.000Z',
              customerId: 'cus_test_123',
              subscriptionId: 'sxn_test_123',
            }),
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => (url.includes('/projects/project-1') ? projectsResponse[0] : projectsResponse),
        }
      }),
    )

    render(<App />)

    await screen.findByText('Portal de Servicios')
    await user.click(screen.getByRole('button', { name: /plan pro/i }))
    await screen.findByRole('heading', { name: /simple y transparente/i })

    await user.click(screen.getByRole('button', { name: /volver al sistema/i }))

    expect(await screen.findByText('Portal de Servicios')).toBeInTheDocument()
  })

  it('treats loopback hosts as local runtimes for API fallback', () => {
    expect(isLocalRuntimeHost('localhost')).toBe(true)
    expect(isLocalRuntimeHost('127.0.0.1')).toBe(true)
    expect(isLocalRuntimeHost('[::1]')).toBe(true)
    expect(isLocalRuntimeHost('example.com')).toBe(false)
    expect(resolveApiBaseUrl(undefined, false, 'localhost')).toBe(API_FALLBACK_BASE_URL)
    expect(resolveApiBaseUrl(undefined, false, '127.0.0.1')).toBe(API_FALLBACK_BASE_URL)
    expect(resolveApiBaseUrl(undefined, false, 'example.com')).toBe('/api')
    expect(resolveApiBaseUrl('/api', false, 'localhost')).toBe(API_FALLBACK_BASE_URL)
    expect(resolveApiBaseUrl('https://api.example.com', false, 'localhost')).toBe('https://api.example.com')
  })
})
