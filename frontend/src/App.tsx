import React, { useState, useEffect, useRef, useMemo, lazy, Suspense, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  CheckCircle,
  X,
  ChevronDown,
  KeyRound,
  LogOut,
  UserRound,
} from 'lucide-react';
import type { Project, Scan, UrlResult } from './types';
import { API_BASE_URL, API_FALLBACK_BASE_URL, isLocalRuntimeHost, CHROME_EXTENSION_ID } from './config';
import type { BillingCurrency, BillingPlan, BillingState } from './billing';
import { AuthView } from './views/AuthView';
import { CulqiCheckoutModal } from './CulqiCheckoutModal';
const BillingView = lazy(() => import('./BillingView').then(m => ({ default: m.BillingView })));
const ProjectsView = lazy(() => import('./views/ProjectsView').then(m => ({ default: m.ProjectsView })));
const ProjectDetailView = lazy(() => import('./views/ProjectDetailView').then(m => ({ default: m.ProjectDetailView })));
const ScanReportView = lazy(() => import('./views/ScanReportView').then(m => ({ default: m.ScanReportView })));
const AdminView = lazy(() => import('./views/AdminView').then(m => ({ default: m.AdminView })));

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Error inesperado' };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 32 }}>
          <p style={{ fontWeight: 600, fontSize: 18 }}>Algo salió mal</p>
          <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>{this.state.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

let runtimeApiBaseUrl = API_BASE_URL;
const BRAND_NAME = 'Sin Barreras';
const BRAND_SLOGAN = 'Convierte tu web en un lugar para todos';

type AuthMode = 'session' | 'none' | 'public';
type AppView = 'projects' | 'project' | 'scan' | 'billing' | 'admin';

type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: string;
  hasPassword?: boolean;
  billingStatus?: string;
  billingPlan?: string | null;
  billingProvider?: string;
  billingCurrency?: string | null;
  billingPeriodEnd?: string | null;
};

const apiUrl = (path: string) => `${runtimeApiBaseUrl}${path}`;

// La sesión viaja en una cookie httpOnly establecida por el servidor.
// El navegador la envía automáticamente con credentials: 'include' — el frontend
// nunca lee ni escribe el token directamente.
const withAuthHeaders = (headers?: HeadersInit): HeadersInit => new Headers(headers);

const parseScanUrls = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean);

const canonicalizePlanUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const isScanInProgress = (scan: Scan) => scan.status === 'pending' || scan.status === 'awaiting_login' || scan.status === 'running';

const getProjectReservedFreeUrl = (project: Project | null) => {
  if (!project) return null;
  if (project.domain) return project.domain;

  for (const scan of project.scans || []) {
    for (const result of scan.urlResults || []) {
      if (result.url) return result.url;
    }
  }

  return null;
};

const fetchWithFallback = async (path: string, init?: RequestInit) => {
  const requestInit: RequestInit = {
    ...init,
    headers: withAuthHeaders(init?.headers),
    credentials: 'include', // envía la cookie httpOnly sb_session automáticamente
  };
  const first = await fetch(apiUrl(path), requestInit);

  if (
    first.status === 404 &&
    runtimeApiBaseUrl === '/api' &&
    isLocalRuntimeHost(window.location.hostname)
  ) {
    runtimeApiBaseUrl = API_FALLBACK_BASE_URL;
    return fetch(apiUrl(path), requestInit);
  }

  return first;
};

const readApiErrorMessage = async (res: Response) => {
  const fallback = `HTTP ${res.status}`;

  try {
    const body = await res.clone().json();
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return message || body?.error || body?.detail || fallback;
  } catch {
    const text = await res.text();
    return text || fallback;
  }
};

const normalizeApiErrorDetail = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return '';

  try {
    const body = JSON.parse(trimmed) as {
      message?: string | string[];
      error?: string;
      detail?: string;
      remainingAttempts?: number;
      retryAfterMs?: number;
    };
    const primaryMessage = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    const detail = primaryMessage || body?.error || body?.detail || trimmed;
    const metadata: string[] = [];

    if (typeof body?.remainingAttempts === 'number') {
      metadata.push(`Intentos restantes: ${body.remainingAttempts}.`);
    }

    if (typeof body?.retryAfterMs === 'number' && body.retryAfterMs > 0) {
      const retryAfterMinutes = Math.ceil(body.retryAfterMs / 60000);
      metadata.push(`Reintenta en ${retryAfterMinutes} min.`);
    }

    return [detail, ...metadata].join(' ').trim();
  } catch {
    return trimmed;
  }
};

const readApiJson = async <T,>(res: Response): Promise<T | null> => {
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
};



export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentScan, setCurrentScan] = useState<Scan | null>(null);
  const [selectedUrlResult, setSelectedUrlResult] = useState<UrlResult | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authFormMode, setAuthFormMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authCompanyName, setAuthCompanyName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [postLoginAction, setPostLoginAction] = useState<'billing' | null>(null);

  const [view, setView] = useState<AppView>('projects');

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showNewScan, setShowNewScan] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectEntityType, setNewProjectEntityType] = useState('Sector privado');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectEntityType, setEditProjectEntityType] = useState('Sector privado');

  const [newScanUrls, setNewScanUrls] = useState('');
  const [newScanMode, setNewScanMode] = useState<'rápido' | 'estándar' | 'profundo' | ''>('estándar');
  const [newScanUx, setNewScanUx] = useState(4);
  const [newScanEntityType, setNewScanEntityType] = useState('Sector privado');
  const [newScanLoginMode, setNewScanLoginMode] = useState<'none' | 'manual_assisted'>('none');
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('PEN');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSubmitting, setBillingSubmitting] = useState<string | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const [culqiModalPlan, setCulqiModalPlan] = useState<BillingPlan | null>(null);

  const [criterionApplicabilityFilter, setCriterionApplicabilityFilter] = useState<string>('todos');
  const [criterionResultFilter, setCriterionResultFilter] = useState<string>('todos');
  const [criterionLevelFilter, setCriterionLevelFilter] = useState<string>('todos');
  const [criterionRoleFilter, setCriterionRoleFilter] = useState<string>('todos');
  const [criterionSeverityFilter, setCriterionSeverityFilter] = useState<string>('todos');
  const [criterionViewMode, setCriterionViewMode] = useState<'normal' | 'principles'>('normal');
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);
  const [updatingCriterionId, setUpdatingCriterionId] = useState<string | null>(null);
  const [updatingFindingKey, setUpdatingFindingKey] = useState<string | null>(null);

  const [scanProgress, setScanProgress] = useState<Record<string, number>>({});
  const scanStartRef = useRef<Record<string, number>>({});
  const [hasMoreScans, setHasMoreScans] = useState(false);
  const [loadingMoreScans, setLoadingMoreScans] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAccountMenu(false);
      }
    };

    window.document.addEventListener('mousedown', handlePointerDown);
    window.document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.document.removeEventListener('mousedown', handlePointerDown);
      window.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAccountMenu]);

  const handleApiError = (context: string, err: unknown) => {
    console.error(context, err);
    const message = err instanceof Error ? err.message.trim() : '';
    const detail = message && !/^HTTP\s+\d+$/i.test(message)
      ? normalizeApiErrorDetail(message)
      : 'Verifique la conexión con la API e intente nuevamente.';
    setAppError(`${context}. ${detail}`);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    setAppError(null);

    try {
      const endpoint = authFormMode === 'register' ? '/auth/register' : '/auth/login';
      const payload =
        authFormMode === 'register'
          ? {
              email: authEmail,
              password: authPassword,
              fullName: authFullName || undefined,
              companyName: authCompanyName || undefined,
            }
          : {
              email: authEmail,
              password: authPassword,
            };

      const res = await fetchWithFallback(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const data = await res.json();
      setCurrentUser(data.user);
      setAuthMode('session');
      if (postLoginAction === 'billing') {
        setView('billing');
        setPostLoginAction(null);
      } else {
        setView('projects');
      }
    } catch (err) {
      handleApiError('No se pudo iniciar sesión', err);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleStartGuest = async () => {
    setGuestSubmitting(true);
    setAppError(null);

    try {
      setCurrentUser(null);
      setAuthMode('public');
      setCurrentProject({
        id: 'public-draft',
        name: 'Análisis gratuito',
        domain: '',
        vo: 4,
        entityType: 'Sector privado',
        createdAt: new Date().toISOString(),
        scans: [],
      });
      setCurrentScan(null);
      setSelectedUrlResult(null);
      setNewScanUrls('');
      setNewScanEntityType('Sector privado');
      setNewScanMode('estándar');
      setNewScanUx(4);
      setNewScanLoginMode('none');
      setShowNewScan(true);
      setView('project');
    } catch (err) {
      handleApiError('No se pudo preparar el escaneo gratuito', err);
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleViewPlansFromLanding = async () => {
    setGuestSubmitting(true);
    setAppError(null);

    try {
      setCurrentUser(null);
      setAuthMode('public');
      setCurrentProject(null);
      setCurrentScan(null);
      setSelectedUrlResult(null);
      setShowNewScan(false);
      setView('billing');
    } catch (err) {
      handleApiError('No se pudo abrir los planes', err);
    } finally {
      setGuestSubmitting(false);
    }
  };

  const useDemoCredentials = () => {
    setAuthFormMode('login');
    setAppError(null);
  };

  const handleLogout = async () => {
    try {
      await fetchWithFallback('/auth/logout', { method: 'DELETE' });
    } catch (err) {
      console.warn('Logout request failed', err);
    } finally {
      setCurrentUser(null);
      setView('projects');
      setCurrentProject(null);
      setCurrentScan(null);
      setSelectedUrlResult(null);
      setProjects([]);
      setBillingPlans([]);
      setBillingState(null);
      setBillingCurrency('PEN');
      setBillingNote(null);
      setBillingSubmitting(null);
      setBillingLoading(false);
      setShowAccountMenu(false);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setPasswordMessage(null);
      setAppError(null);
      setAuthEmail('');
      setAuthPassword('');
      setAuthFullName('');
      setAuthCompanyName('');
      setAuthFormMode('login');
      setAuthMode('none');
    }
  };

  const handleBackFromBilling = () => {
    if (authMode === 'public') {
      setAuthMode('none');
      setCurrentProject(null);
      setCurrentScan(null);
      setSelectedUrlResult(null);
      setBillingNote(null);
      setBillingSubmitting(null);
      return;
    }

    setView('projects');
  };

  const userRole = currentUser?.role?.toLowerCase() || 'free';
  const isGuestUser = userRole === 'guest';
  const isMasterAccount = userRole === 'superadmin';
  const isAdminAccount = userRole === 'admin';
  const isProSubscriptionActive = Boolean(currentUser?.billingPlan && currentUser?.billingStatus === 'active');
  const isEnterprisePlanActive = Boolean(currentUser?.billingPlan === 'annual' && currentUser?.billingStatus === 'active');
  const canUsePaidFeatures = Boolean(
    isMasterAccount ||
      isAdminAccount ||
      isProSubscriptionActive
  );
  const canCreateProjects = Boolean(isAdminAccount || canUsePaidFeatures);
  const currentPlanLabel = isMasterAccount || isEnterprisePlanActive
    ? 'Enterprise activo'
    : isAdminAccount
      ? 'Cuenta admin'
      : isProSubscriptionActive
        ? 'Pro activo'
        : 'Free';
  const currentUserLabel = isGuestUser
    ? 'Modo invitado'
    : currentUser?.fullName || currentUser?.companyName || currentUser?.email || 'Cuenta';
  const currentUserDetail = isGuestUser ? 'Sesion temporal sin cuenta' : currentUser?.email || '';
  const currentUserRoleLabel =
    userRole === 'guest'
      ? 'Invitado'
      : userRole === 'superadmin'
      ? 'Superadministrador'
      : userRole === 'admin'
      ? 'Administrador de cuenta'
        : 'Usuario';
  const currentUserInitials = currentUserLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'SB';

  // Cuentas creadas vía Google/OAuth no tienen contraseña propia: pueden crearla
  // sin ingresar la actual (la sesión activa ya acredita al titular).
  const needsPasswordSetup = currentUser?.hasPassword === false;

  const handleChangePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);

    if ((!needsPasswordSetup && !currentPassword) || !nextPassword || !confirmPassword) {
      setPasswordMessage('Completa todos los campos.');
      return;
    }

    if (nextPassword !== confirmPassword) {
      setPasswordMessage('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setPasswordSubmitting(true);

    try {
      const res = await fetchWithFallback('/auth/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(needsPasswordSetup ? {} : { currentPassword }),
          newPassword: nextPassword,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      setPasswordMessage(needsPasswordSetup
        ? 'Contraseña creada correctamente. Ya puedes iniciar sesión con tu correo y contraseña.'
        : 'Contraseña actualizada correctamente.');
      setCurrentUser((prev) => (prev ? { ...prev, hasPassword: true } : prev));
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setShowAccountMenu(false);
    } catch (err) {
      handleApiError('No se pudo guardar la contraseña', err);
      setPasswordMessage('No se pudo guardar la contraseña. Verifica tus datos e intenta nuevamente.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleSubmitComplaint = async (payload: {
    fullName: string;
    document: string;
    email: string;
    phone: string;
    type: 'reclamo' | 'queja';
    service: string;
    detail: string;
    request: string;
  }) => {
    const response = await fetchWithFallback('/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response));
    }
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      // OAuth: el backend ya setea la cookie httpOnly antes de redirigir.
      // Solo limpiamos el hash por si quedó un parámetro de proveedor o error.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const oauthError = hashParams.get('oauth_error');

      if (hashParams.toString()) {
        window.history.replaceState({}, window.document.title, `${window.location.pathname}${window.location.search}`);
      }

      if (oauthError) {
        setAppError(decodeURIComponent(oauthError));
        setAuthMode('none');
        setAuthLoading(false);
        return;
      }

      // La cookie sb_session se envía automáticamente con credentials: 'include'.
      // Si el servidor devuelve 200 con datos de usuario, la sesión es válida.
      try {
        const res = await fetchWithFallback('/auth/me');

        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user);
          setAuthMode('session');
          return;
        }
      } catch (err) {
        console.warn('Session bootstrap failed', err);
      }

      setAuthMode('none');
    };

    bootstrapAuth().finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || authMode !== 'session') return;
    fetchProjects();
  }, [authLoading, authMode]);


  // Client-side animated progress — replaces the realtime WebSocket feed so the backend
  // runs no 24/7 Redis poller. The percentage is simulated locally (no network calls)
  // using a time-based ease-out curve: it moves quickly at first then decelerates,
  // always creeping forward so the bar never looks frozen, capped at ~96%. It only
  // jumps to 100 when the status poll reports the scan as completed.
  useEffect(() => {
    if (authLoading) return;

    const animatedIds = new Set<string>();
    const scanCreatedAt = new Map<string, string | undefined>();
    (currentProject?.scans || []).forEach((scan) => {
      if (scan.status === 'running' || scan.status === 'pending') {
        animatedIds.add(scan.id);
        scanCreatedAt.set(scan.id, scan.createdAt);
      }
    });
    if (currentScan && (currentScan.status === 'running' || currentScan.status === 'pending')) {
      animatedIds.add(currentScan.id);
      if (!scanCreatedAt.has(currentScan.id)) scanCreatedAt.set(currentScan.id, currentScan.createdAt);
    }

    // Drop start timestamps for scans that are no longer in progress.
    for (const id of Object.keys(scanStartRef.current)) {
      if (!animatedIds.has(id)) delete scanStartRef.current[id];
    }

    if (animatedIds.size === 0) {
      setScanProgress((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }

    const now = Date.now();
    for (const id of animatedIds) {
      if (!scanStartRef.current[id]) {
        // Sembrar con el createdAt REAL del scan: así la barra sobrevive a un
        // refresh de página sin "reiniciarse" (el escaneo backend nunca se
        // reinicia — esto solo alinea la animación con el tiempo transcurrido).
        const created = Date.parse(scanCreatedAt.get(id) || '');
        scanStartRef.current[id] = Number.isFinite(created) && created <= now ? created : now;
      }
    }

    const tick = () => {
      const t = Date.now();
      setScanProgress((prev) => {
        const next: Record<string, number> = {};
        for (const id of animatedIds) {
          const start = scanStartRef.current[id] ?? t;
          const elapsedSeconds = (t - start) / 1000;
          // Ease-out toward 96%; ~60% at 60s, ~85% at 140s, ~93% at 220s. Never reverses.
          const target = 96 * (1 - Math.exp(-elapsedSeconds / 70));
          next[id] = Math.max(prev[id] ?? 0, Math.min(96, target));
        }
        return next;
      });
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [
    authLoading,
    currentScan?.id,
    currentScan?.status,
    currentProject?.id,
    currentProject?.scans?.map((scan) => `${scan.id}:${scan.status}`).join('|'),
  ]);

  useEffect(() => {
    if (authLoading || authMode !== 'session' || view !== 'project') return;
    if (!currentProject) return;

    const inProgressScans = (currentProject.scans || []).filter(isScanInProgress);
    if (inProgressScans.length === 0) return;

    // Poll cada 30s mientras haya scans activos en el proyecto
    const refreshProject = () => { void fetchProjectDetails(currentProject.id); };
    refreshProject();
    const intervalId = window.setInterval(refreshProject, 30000);
    return () => window.clearInterval(intervalId);
  }, [
    authLoading,
    authMode,
    view,
    currentProject?.id,
    currentProject?.scans?.map((scan) => `${scan.id}:${scan.status}`).join('|'),
  ]);

  useEffect(() => {
    if (authLoading || view !== 'scan') return;
    if (!currentScan || !isScanInProgress(currentScan)) return;

    // Poll cada 30s mientras el scan esté activo
    const refreshScan = () => {
      if (authMode === 'public') {
        void fetchPublicScanDetails(currentScan.id);
      } else {
        void fetchScanDetails(currentScan.id);
      }
    };
    refreshScan();
    const intervalId = window.setInterval(refreshScan, 30000);
    return () => window.clearInterval(intervalId);
  }, [authLoading, authMode, view, currentScan?.id, currentScan?.status]);

  useEffect(() => {
    if (authLoading || authMode === 'none' || view !== 'billing') return;
    loadBillingData();
  }, [authLoading, authMode, view]);


  useEffect(() => {
    if (authLoading || authMode !== 'public' || view !== 'project') return;

    const runningScan = currentProject?.scans?.find(isScanInProgress);
    if (!runningScan) return;

    // Scans públicos: poll cada 15s mientras estén activos
    const refreshPublicScan = () => { void fetchPublicScanDetails(runningScan.id); };
    refreshPublicScan();
    const intervalId = window.setInterval(refreshPublicScan, 15000);
    return () => window.clearInterval(intervalId);
  }, [
    authLoading,
    authMode,
    view,
    currentProject?.id,
    currentProject?.scans?.map((scan) => `${scan.id}:${scan.status}`).join('|'),
  ]);

  useEffect(() => {
    if (authLoading || authMode !== 'session') return;

    const awaitingScan =
      view === 'scan' && currentScan?.status === 'awaiting_login'
        ? currentScan
        : view === 'project'
          ? currentProject?.scans?.find((scan) => scan.status === 'awaiting_login')
          : null;

    if (!awaitingScan) return;

    // El estado awaiting_login solo cambia cuando la extensión envía resultados;
    // pollear a 2.5s con 3 requests (~72 req/min) era el mayor consumidor de
    // Redis/Postgres del frontend. 10s con un solo request es imperceptible.
    const refreshManualScan = () => {
      if (view === 'scan') {
        void fetchScanDetails(awaitingScan.id);
      }
      if (view === 'project' && currentProject?.id) {
        void fetchProjectDetails(currentProject.id);
      }
    };

    refreshManualScan();
    const intervalId = window.setInterval(refreshManualScan, 10000);

    return () => window.clearInterval(intervalId);
  }, [
    authLoading,
    authMode,
    view,
    currentScan?.id,
    currentScan?.status,
    currentProject?.id,
    currentProject?.scans?.map((scan) => `${scan.id}:${scan.status}`).join('|'),
  ]);

  const fetchProjects = async () => {
    try {
      setAppError(null);
      const res = await fetchWithFallback('/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(
        [...data]
          .map((project: Project) => ({
            ...project,
            scans: dedupeScansById(project.scans || []),
          }))
          .sort((a: Project, b: Project) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (err) {
      handleApiError('No se pudieron cargar los proyectos', err);
    }
  };

  const fetchProjectDetails = async (id: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/projects/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readApiJson<Project & { hasMoreScans?: boolean }>(res);
      if (!data) throw new Error('La API devolvió una respuesta vacía para el proyecto.');
      setCurrentProject({
        ...data,
        scans: dedupeScansById(data.scans || []),
      });
      setHasMoreScans(data.hasMoreScans ?? false);
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del proyecto', err);
    }
  };

  const loadMoreScans = async () => {
    if (!currentProject || loadingMoreScans) return;
    const scans = currentProject.scans || [];
    if (scans.length === 0) return;
    const oldest = scans[scans.length - 1];
    const before = oldest.createdAt;
    setLoadingMoreScans(true);
    try {
      const params = new URLSearchParams({ limit: '20', before, projectId: currentProject.id });
      const res = await fetchWithFallback(`/scans?${params.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readApiJson<{ scans: Scan[]; hasMore: boolean }>(res);
      if (!data) return;
      setCurrentProject((prev) => prev ? {
        ...prev,
        scans: dedupeScansById([...(prev.scans || []), ...(data.scans || [])]),
      } : prev);
      setHasMoreScans(data.hasMore);
    } catch (err) {
      handleApiError('No se pudo cargar más escaneos', err);
    } finally {
      setLoadingMoreScans(false);
    }
  };

  const fetchScanDetails = async (id: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/scans/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readApiJson<Scan>(res);
      if (!data) throw new Error('La API devolvió una respuesta vacía para el escaneo.');
      setCurrentScan(data);
      const urlResults = data.urlResults ?? [];
      if (urlResults.length > 0) {
        setSelectedUrlResult((prev) => {
          if (!prev) return urlResults[0];
          const same = urlResults.find((ur: UrlResult) => ur.id === prev.id);
          return same || urlResults[0];
        });
      }
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del escaneo', err);
    }
  };

  const fetchPublicScanDetails = async (id: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/scans/public/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const scan = await readApiJson<Scan>(res);
      if (!scan) throw new Error('La API devolvió una respuesta vacía para el escaneo.');
      if (typeof scan.progress === 'number') {
        setScanProgress(prev => ({ ...prev, [scan.id]: scan.progress ?? 0 }));
      }
      setCurrentScan(scan);
      if (scan.project) {
        setCurrentProject({
          ...scan.project,
          scans: dedupeScansById([scan]),
        });
      }
      if (scan.urlResults && scan.urlResults.length > 0) {
        setSelectedUrlResult((prev) => {
          if (!prev) return scan.urlResults![0];
          const same = scan.urlResults!.find((ur: UrlResult) => ur.id === prev.id);
          return same || scan.urlResults![0];
        });
      }
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del escaneo', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowNewScan(false);
    if (!canCreateProjects) {
      setAppError('La creacion de proyectos esta disponible en Pro y Enterprise.');
      return;
    }

    try {
      setAppError(null);
      const res = await fetchWithFallback('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          domain: null,
          vo: 4,
          entityType: newProjectEntityType
        })
      });
      if (res.ok) {
        const createdProject = await res.json() as Project;
        const projectWithScans = { ...createdProject, scans: dedupeScansById(createdProject.scans || []) };
        setShowCreateProject(false);
        setNewProjectName('');
        setCurrentProject(projectWithScans);
        setCurrentScan(null);
        setSelectedUrlResult(null);
        setNewScanUrls('');
        setNewScanEntityType(projectWithScans.entityType?.toLowerCase().includes('privado') ? 'Sector privado' : 'Sector público');
        setNewScanMode('estándar');
        setNewScanUx(4);
        setShowNewScan(false);
        setView('projects');
        fetchProjects();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      handleApiError('No se pudo crear el proyecto', err);
    }
  };

  const handleOpenCreateProject = () => {
    if (!canCreateProjects) {
      setAppError('La creación de proyectos está disponible en Pro y Enterprise.');
      return;
    }

    setAppError(null);
    setEditingProject(null);
    setCurrentScan(null);
    setSelectedUrlResult(null);
    setShowNewScan(false);
    setView('projects');
    setShowCreateProject(true);
  };

  const handleCloseCreateProject = () => {
    setShowCreateProject(false);
    setShowNewScan(false);
  };

  const handleTriggerScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const scanId = formData.get('scanId') as string;

    const urls = parseScanUrls(newScanUrls);
    if (urls.length === 0) {
      setAppError('Ingresa al menos una URL válida para iniciar el escaneo.');
      return;
    }
    if (urls.length > 1) {
      setAppError('Solo se puede escanear una URL por análisis. Para otra URL, crea un nuevo escaneo.');
      return;
    }
    const scanEntityType = newScanEntityType || (currentProject.entityType?.toLowerCase().includes('privado') ? 'Sector privado' : 'Sector público');
    const scanMode = newScanMode || 'estándar';
    const scanUx = newScanUx || 4;

    if (!canUsePaidFeatures && newScanLoginMode === 'manual_assisted') {
      setNewScanLoginMode('none');
      setAppError('El login manual asistido se habilita con suscripción. Puedes continuar con escaneo público.');
      return;
    }

    const reservedFreeUrl = getProjectReservedFreeUrl(currentProject);
    if (
      !canCreateProjects &&
      reservedFreeUrl &&
      canonicalizePlanUrl(urls[0]) !== canonicalizePlanUrl(reservedFreeUrl)
    ) {
      setAppError('Tu plan Free incluye una URL guardada. Puedes reescanear esa misma URL; sube a Pro para auditar más sitios o páginas.');
      return;
    }

    try {
      setAppError(null);
      if (authMode === 'public') {
        const res = await fetchWithFallback('/scans/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls,
            scanMode,
            ux: scanUx,
            entityType: scanEntityType,
          }),
        });

        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res));
        }

        const scan = await res.json() as Scan;
        setShowNewScan(false);
        setNewScanUrls('');
        setCurrentScan(scan);
        if (scan.project) {
          setCurrentProject({
            ...scan.project,
            scans: dedupeScansById([scan]),
          });
        }
        setSelectedUrlResult(null);
        setView('project');
        window.setTimeout(() => fetchPublicScanDetails(scan.id), 1200);
        return;
      }

      const projectForScan = currentProject;

      const res = await fetchWithFallback('/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scanId || undefined,
          projectId: projectForScan.id,
          urls,
          scanMode,
          ux: scanUx,
          loginMode: newScanLoginMode,
        })
      });
      if (res.ok) {
        const createdScan = await res.json() as Scan;
        if (newScanLoginMode === 'manual_assisted') {
          try {
            // Solicitar un token efímero de un solo uso al backend para pasárselo a la extensión.
            // La extensión no puede acceder a cookies httpOnly, por lo que necesita un bearer
            // token de corta duración exclusivo para este flujo de auditoría manual.
            const extTokenRes = await fetchWithFallback('/auth/extension-token', { method: 'POST' });
            const extToken = extTokenRes.ok ? (await extTokenRes.json() as { token: string }).token : '';
            if (extToken && typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.sendMessage) {
              (window as any).chrome.runtime.sendMessage(CHROME_EXTENSION_ID, {
                type: 'SET_SCAN_DATA',
                token: extToken,
                scanId: createdScan.id,
              }, (response: any) => {
                console.log('Mensaje enviado a la extensión', response);
              });
              alert('¡Listo! Los datos se enviaron automáticamente a la extensión. Ve a la pestaña destino, abre la extensión y dale a Analizar.');
            }
          } catch (error) {
            console.error('Error comunicándose con la extensión:', error);
          }
        }

        setShowNewScan(false);
        setNewScanUrls('');
        setNewScanLoginMode('none');
        setTimeout(() => fetchProjectDetails(projectForScan.id), 500);
        fetchProjects();
      } else {
        throw new Error(await readApiErrorMessage(res));
      }
    } catch (err) {
      handleApiError('No se pudo iniciar el escaneo', err);
    }
  };

  const handleDeleteProject = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const confirmed = window.confirm(`¿Eliminar el proyecto "${project.name}" y todos sus análisis?`);
    if (!confirmed) return;

    try {
      setAppError(null);
      const res = await fetchWithFallback(`/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (currentProject?.id === project.id) {
        setCurrentProject(null);
        setCurrentScan(null);
        setSelectedUrlResult(null);
        setView('projects');
      }
      fetchProjects();
    } catch (err) {
      handleApiError('No se pudo eliminar el proyecto', err);
    }
  };

  const openEditProject = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectEntityType(project.entityType?.toLowerCase().includes('privado') ? 'Sector privado' : 'Sector público');
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      setAppError(null);
      const res = await fetchWithFallback(`/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectName,
          vo: editingProject.vo ?? 4,
          entityType: editProjectEntityType,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const updated = await res.json();
      setEditingProject(null);
      if (currentProject?.id === updated.id) {
        setCurrentProject(updated);
      }
      fetchProjects();
    } catch (err) {
      handleApiError('No se pudo actualizar el proyecto', err);
    }
  };

  const handleDeleteScan = async (scan: Scan, event: React.MouseEvent) => {
    event.stopPropagation();
    const scanModeLabel =
      scan.scanMode === 'rápido'
        ? 'análisis rápido de accesibilidad'
        : scan.scanMode === 'profundo'
          ? 'análisis profundo de accesibilidad'
          : 'Escaneando sitio: Verificando estándares de accesibilidad...';
    const confirmed = window.confirm(`¿Eliminar este ${scanModeLabel} del historial?`);
    if (!confirmed) return;

    try {
      setAppError(null);
      const res = await fetchWithFallback(`/scans/${scan.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (currentScan?.id === scan.id) {
        setCurrentScan(null);
        setSelectedUrlResult(null);
      }
      if (currentProject) fetchProjectDetails(currentProject.id);
      fetchProjects();
    } catch (err) {
      handleApiError('No se pudo eliminar el análisis', err);
    }
  };

  const handleCancelScan = async (scanId: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/scans/${scanId}/cancel`, { method: 'PATCH' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      if (currentProject) fetchProjectDetails(currentProject.id);
      fetchProjects();
    } catch (err) {
      handleApiError('No se pudo cancelar el análisis', err);
      throw err;
    }
  };

  const handleApplicabilityUpdate = async (criterionId: string, estado: 'aplica' | 'no_aplica') => {
    if (!selectedUrlResult) return;

    try {
      setAppError(null);
      setUpdatingCriterionId(criterionId);
      const res = await fetchWithFallback(`/url-results/${selectedUrlResult.id}/applicability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterionId, estado }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const updatedResult = await res.json();
      setSelectedUrlResult(updatedResult);
      if (currentScan) fetchScanDetails(currentScan.id);
    } catch (err) {
      handleApiError('No se pudo actualizar la aplicabilidad del criterio', err);
    } finally {
      setUpdatingCriterionId(null);
    }
  };

  const getFindingReviewKey = (finding: any) =>
    [
      finding?.criterion || '',
      finding?.ruleId || '',
      finding?.selector || '',
      finding?.pageState || '',
    ].join('|');

  const handleFindingStatusUpdate = async (
    finding: any,
    status: 'confirmed' | 'needs_review' | 'not_applicable',
  ) => {
    if (!selectedUrlResult || !finding) return;

    const findingKey = getFindingReviewKey(finding);

    try {
      setAppError(null);
      setUpdatingFindingKey(findingKey);
      const res = await fetchWithFallback(`/url-results/${selectedUrlResult.id}/finding-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criterion: finding.criterion,
          ruleId: finding.ruleId,
          selector: finding.selector,
          pageState: finding.pageState,
          status,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const updatedResult = await res.json();
      setSelectedUrlResult(updatedResult);
      if (currentScan) fetchScanDetails(currentScan.id);
    } catch (err) {
      handleApiError('No se pudo guardar la revisión del hallazgo', err);
    } finally {
      setUpdatingFindingKey(null);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (kind: 'pdf-executive' | 'pdf-technical' | 'excel', scanOverride?: any) => {
    const scanToExport = scanOverride || currentScan;
    if (!scanToExport?.id) return;
    if (!canUsePaidFeatures) {
      setAppError('Los reportes exportables están disponibles en Pro.');
      return;
    }
    try {
      let endpoint = '';
      let filename = '';

      if (kind === 'pdf-executive') {
        endpoint = `/reports/${scanToExport.id}/pdf?type=executive`;
        filename = `reporte-ejecutivo-${scanToExport.id}.pdf`;
      } else if (kind === 'pdf-technical') {
        endpoint = `/reports/${scanToExport.id}/pdf?type=technical`;
        filename = `reporte-tecnico-${scanToExport.id}.pdf`;
      } else {
        endpoint = `/reports/${scanToExport.id}/excel`;
        filename = `reporte-accesibilidad-${scanToExport.id}.xlsx`;
      }

      const res = await fetchWithFallback(endpoint);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      downloadFile(blob, filename);
    } catch (err) {
      handleApiError('No se pudo exportar el reporte', err);
      window.alert('No se pudo exportar el reporte. Intente nuevamente.');
    }
  };

  const loadBillingData = async () => {
    try {
      setBillingLoading(true);
      if (authMode === 'session') {
        const [plansResponse, stateResponse, userResponse] = await Promise.all([
          fetchWithFallback('/billing/plans'),
          fetchWithFallback('/billing/me'),
          fetchWithFallback('/auth/me'),
        ]);
        if (!plansResponse.ok) throw new Error(`HTTP ${plansResponse.status}`);
        if (!stateResponse.ok) throw new Error(`HTTP ${stateResponse.status}`);
        if (!userResponse.ok) throw new Error(`HTTP ${userResponse.status}`);
        const [plans, state, user] = await Promise.all([
          plansResponse.json(),
          stateResponse.json(),
          userResponse.json(),
        ]);
        setBillingPlans(plans);
        setBillingState(state);
        setCurrentUser(user);
      } else {
        const plansResponse = await fetchWithFallback('/billing/plans');
        if (!plansResponse.ok) throw new Error(`HTTP ${plansResponse.status}`);
        setBillingPlans(await plansResponse.json());
        setBillingState(null);
      }
    } catch (err) {
      handleApiError('No se pudo cargar la información de pagos', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const dedupeScansById = (scans: Scan[] = []) => {
    const uniqueScans = new Map<string, Scan>();
    for (const scan of scans) {
      if (!uniqueScans.has(scan.id)) {
        uniqueScans.set(scan.id, scan);
      }
    }
    return [...uniqueScans.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const handleBillingCancel = async () => {
    if (!window.confirm('¿Seguro que deseas cancelar tu suscripción? Mantendrás el acceso hasta el final del período actual.')) return;
    try {
      const res = await fetchWithFallback('/billing/cancel', { method: 'POST' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await loadBillingData();
    } catch (err) {
      setBillingNote(`Error al cancelar: ${err instanceof Error ? err.message : 'Intenta de nuevo.'}`);
    }
  };

  const handleBillingSubscribe = (plan: BillingPlan) => {
    if (authMode !== 'session') {
      setPostLoginAction('billing');
      setAuthMode('none');
      setAuthFormMode('register');
      return;
    }
    setBillingNote(null);
    setCulqiModalPlan(plan);
  };

  const handleCulqiToken = async (token: string) => {
    if (!culqiModalPlan) return;
    const key = `${culqiModalPlan.code}:${culqiModalPlan.currency}`;
    setBillingSubmitting(key);

    try {
      const res = await fetchWithFallback('/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: culqiModalPlan.code,
          currency: culqiModalPlan.currency,
          culqiToken: token,
        }),
      });

      if (res.status === 401) {
        setCurrentUser(null);
        setAuthMode('none');
        setAuthFormMode('login');
        setCulqiModalPlan(null);
        setAppError('Tu sesión venció. Inicia sesión nuevamente.');
        return;
      }

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const state = await res.json() as BillingState;
      setBillingState(state);
      await loadBillingData();
      const userRes = await fetchWithFallback('/auth/me');
      if (userRes.ok) setCurrentUser(await userRes.json());

      setCulqiModalPlan(null);
      setBillingNote('¡Suscripción activada! Tu plan Pro ya está activo.');
    } catch (err) {
      throw err;
    } finally {
      setBillingSubmitting(null);
    }
  };


  const getScoreMeta = (score: number | null | undefined) => {
    const value = Math.max(0, Math.min(100, score ?? 0));
    if (value >= 80) return { value, tone: 'good', label: 'Cumplimiento bueno' };
    if (value >= 50) return { value, tone: 'warning', label: 'Cumplimiento medio' };
    return { value, tone: 'danger', label: 'Cumplimiento en riesgo' };
  };

  const renderScoreMeter = (
    score: number | null | undefined,
    label = 'Score',
    size: 'compact' | 'large' = 'compact',
    showCaption = true,
  ) => {
    const meta = getScoreMeta(score);
    return (
      <div className={`report-score-meter report-score-${meta.tone} report-score-${size}`}>
        <div className="report-score-meter-head">
          <span className="report-score-meter-label">{label}</span>
          <strong>{meta.value}/100</strong>
        </div>
        <div
          className="report-score-track"
          role="meter"
          aria-label={`${label}: ${meta.value} de 100`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meta.value}
        >
          <div className="report-score-fill" style={{ width: `${meta.value}%` }} />
        </div>
        {showCaption && <span className="report-score-caption">{meta.label}</span>}
      </div>
    );
  };

  const openInspectionUrl = (url: string) => {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(normalized, '_blank', 'noopener,noreferrer');
  };

  const renderStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    const isCompleted = normalized === 'completed';
    const isFailed = normalized === 'failed';
    const isCancelled = normalized === 'cancelled';
    const isAwaitingLogin = normalized === 'awaiting_login';
    const Icon = isCompleted ? CheckCircle : isFailed || isCancelled ? X : null;
    const label = isAwaitingLogin ? 'Login manual pendiente' : isCancelled ? 'Cancelado' : status;
    return (
      <span className={`report-analysis-status ${
        isCompleted ? 'report-analysis-completed' :
        isFailed || isCancelled ? 'report-analysis-failed' :
        'report-analysis-running'
      }`}>
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="report-spinner" aria-hidden="true" />}
        {label}
      </span>
    );
  };

  const getFindingStatusLabel = (violation: UrlResult['violations'][number]) => {
    const status = violation.findingStatus || violation.status || 'confirmed';
    if (violation.statusLabel) return violation.statusLabel;
    if (status === 'not_evaluated') return 'No evaluado';
    if (status === 'not_applicable') return 'No aplicable';
    if (status === 'needs_review') return 'Requiere revisión';
    return 'Confirmado';
  };

  const getFindingStatusClass = (violation: UrlResult['violations'][number]) => {
    const status = violation.findingStatus || violation.status || 'confirmed';
    if (status === 'confirmed') return 'report-status-confirmed';
    if (status === 'not_evaluated') return 'report-status-pending';
    if (status === 'not_applicable') return 'report-status-pending';
    return 'report-status-pending';
  };

  const getApplicabilityRows = (urlResult: UrlResult) => {
    const violationsByCriterion = new Map<string, UrlResult['violations']>();
    for (const violation of urlResult.violations || []) {
      const current = violationsByCriterion.get(violation.criterion) || [];
      current.push(violation);
      violationsByCriterion.set(violation.criterion, current);
    }

    const manualByCriterion = new Map<string, UrlResult['manualVerifications']>();
    for (const verification of urlResult.manualVerifications || []) {
      const current = manualByCriterion.get(verification.criterion) || [];
      current.push(verification);
      manualByCriterion.set(verification.criterion, current);
    }

    return (urlResult.applicability?.criteria || []).map((criterion) => {
      const findings = violationsByCriterion.get(criterion.id) || [];
      const manualVerifications = manualByCriterion.get(criterion.id) || [];
      const extensionReviewFindings = manualVerifications.filter((verification: any) => {
        return Boolean(
          verification.ruleId ||
          verification.selector ||
          verification.findingStatus ||
          verification.sourceCategory,
        );
      });
      const checklistManualVerifications = manualVerifications.filter((verification: any) => !extensionReviewFindings.includes(verification));

      // Fusionar findings con mismo ruleId+selector detectados en vistas distintas
      // (Desktop/Tablet/Mobile o initial/interactive). Se conserva el finding de mayor
      // severidad y se acumulan los pageStateLabel de todas las vistas como array.
      const mergeByRuleAndSelector = (rawFindings: any[]): any[] => {
        const mergeMap = new Map<string, any>();
        for (const f of rawFindings) {
          const key = `${f.ruleId || f.normalizedRuleId || ''}::${(f.selector || f.affectedElements?.[0] || '').slice(0, 120)}`;
          const existing = mergeMap.get(key);
          if (!existing) {
            mergeMap.set(key, {
              ...f,
              pageStateLabels: f.pageStateLabel ? [f.pageStateLabel] : [],
            });
          } else {
            const label = f.pageStateLabel;
            if (label && !existing.pageStateLabels.includes(label)) {
              existing.pageStateLabels.push(label);
            }
            // Conservar el finding de mayor severidad o estado confirmado
            const severityRank: Record<string, number> = { critico: 4, alto: 3, medio: 2, bajo: 1 };
            const existingRank = severityRank[(existing.severity || '').normalize('NFD').replace(/[̀-ͯ]/g, '')] || 0;
            const currentRank = severityRank[(f.severity || '').normalize('NFD').replace(/[̀-ͯ]/g, '')] || 0;
            const currentConfirmed = (f.findingStatus === 'confirmed' || f.status === 'confirmed') ? 1 : 0;
            const existingConfirmed = (existing.findingStatus === 'confirmed' || existing.status === 'confirmed') ? 1 : 0;
            if (currentConfirmed > existingConfirmed || (currentConfirmed === existingConfirmed && currentRank > existingRank)) {
              mergeMap.set(key, { ...f, pageStateLabels: existing.pageStateLabels });
            }
            // Acumular elementos afectados únicos
            const extraSelectors = (f.affectedElements || []).filter((s: string) => !(existing.affectedElements || []).includes(s));
            const extraHtmls = (f.affectedHtmlSamples || []).filter((s: string) => !(existing.affectedHtmlSamples || []).includes(s));
            if (extraSelectors.length) existing.affectedElements = [...(existing.affectedElements || []), ...extraSelectors];
            if (extraHtmls.length) existing.affectedHtmlSamples = [...(existing.affectedHtmlSamples || []), ...extraHtmls];
          }
        }
        return Array.from(mergeMap.values());
      };

      const displayFindings = mergeByRuleAndSelector([...findings, ...(extensionReviewFindings as any[])]);
      const confirmedFindings = displayFindings.filter((v: any) => {
        const status = v.findingStatus || v.status || 'confirmed';
        return status === 'confirmed' || status === 'failed';
      });
      const reviewFindings = displayFindings.filter((v: any) => {
        const status = v.findingStatus || v.status || (v.sourceCategory === 'manual_check' ? 'needs_review' : 'confirmed');
        return status === 'needs_review' || status === 'not_evaluated';
      });
      const affectedFindingCount = displayFindings.reduce((total, finding) => {
        const affectedElements = Array.isArray(finding.affectedElements) ? finding.affectedElements.length : 0;
        const htmlSamples = Array.isArray(finding.affectedHtmlSamples) ? finding.affectedHtmlSamples.length : 0;
        return total + Math.max(1, affectedElements, htmlSamples);
      }, 0);
      const hasManualFailure = checklistManualVerifications.some((verification) => verification.status === 'failed');
      const hasManualNotApplicable = manualVerifications.some((verification: any) => verification.status === 'not_applicable' || verification.findingStatus === 'not_applicable');
      return {
        ...criterion,
        findings: displayFindings,
        confirmedFindings,
        reviewFindings,
        affectedFindingCount,
        manualVerifications: checklistManualVerifications,
        primaryFinding: confirmedFindings[0] || displayFindings[0],
        uiStatus: criterion.estado === 'no_aplica' || hasManualNotApplicable ? 'na' : confirmedFindings.length > 0 || hasManualFailure ? 'falla' : reviewFindings.length > 0 ? 'revision' : 'cumple',
      };
    });
  };

  const getApplicabilityStatusLabel = (status: string) => {
    if (status === 'cumple') return 'Cumple';
    if (status === 'falla') return 'Falla';
    if (status === 'revision') return 'Requiere revisión';
    if (status === 'na') return 'N/A';
    return 'Sin hallazgos';
  };

  const getApplicabilityStatusClass = (status: string) => {
    if (status === 'cumple') return 'report-status-approved';
    if (status === 'falla') return 'report-status-failed';
    return 'report-status-pending';
  };

  const checklist86 = useMemo(() => Array.from({ length: 86 }, (_, i) => {
    const n = i + 1;
    return `Criterio ${n.toString().padStart(2, '0')} — WCAG 2.2`;
  }), []);

  useEffect(() => {
    const section = view === 'projects' ? 'Proyectos' : view === 'project' ? 'Detalle del Proyecto' : 'Informe de Escaneo';
    document.title = `${BRAND_NAME} | ${section}`;
    return () => {
      document.title = `${BRAND_NAME} | Convierte tu web en un lugar para todos`;
    };
  }, [view]);

  const latestScans = projects
    .map((project) => project.scans && project.scans.length > 0 ? project.scans[project.scans.length - 1] : null)
    .filter((scan): scan is Scan => Boolean(scan));
  const completedScores = latestScans
    .map((scan) => scan.globalScore)
    .filter((score): score is number => typeof score === 'number');
  const averageScore = completedScores.length > 0
    ? Math.round(completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length)
    : 0;
  // Solo scans con score real: cancelados/fallidos/pendientes tienen globalScore
  // null y no deben contarse como riesgo critico.
  const projectsAtRisk = latestScans.filter((scan) => typeof scan.globalScore === 'number' && scan.globalScore < 50).length;
  const runningAnalyses = latestScans.filter(isScanInProgress).length;
  const parsedNewScanUrls = parseScanUrls(newScanUrls);
  const applicabilityRows = useMemo(
    () => selectedUrlResult ? getApplicabilityRows(selectedUrlResult) : [],
    [selectedUrlResult],
  );
  const filteredApplicabilityRows = useMemo(() => applicabilityRows.filter((row) => {
    if (criterionApplicabilityFilter !== 'todos' && row.estado !== criterionApplicabilityFilter) return false;
    if (criterionResultFilter !== 'todos' && row.uiStatus !== criterionResultFilter) return false;
    if (criterionLevelFilter !== 'todos' && row.nivel !== criterionLevelFilter) return false;
    if (criterionRoleFilter !== 'todos' && !row.findings.some((finding) => finding.role === criterionRoleFilter)) return false;
    if (
      criterionSeverityFilter !== 'todos' &&
      !row.findings.some((finding) => finding.severity?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === criterionSeverityFilter)
    ) return false;
    return true;
  }), [applicabilityRows, criterionApplicabilityFilter, criterionResultFilter, criterionLevelFilter, criterionRoleFilter, criterionSeverityFilter]);
  const groupedApplicabilityRows = useMemo(() => filteredApplicabilityRows.reduce<Array<
    | { kind: 'principle'; key: string; title: string; description: string; count: number }
    | { kind: 'guideline'; key: string; title: string; description: string; count: number }
    | { kind: 'row'; key: string; row: (typeof filteredApplicabilityRows)[number] }
  >>((items, row) => {
    if (criterionViewMode === 'principles') {
      const principleId = row.id?.split('.')[0];
      const principleMap: Record<string, { title: string; description: string }> = {
        '1': { title: 'Perceptible', description: 'Información y componentes presentados de forma que puedan percibirse.' },
        '2': { title: 'Operable', description: 'Interfaz y navegación utilizables por teclado, tiempo y mecanismos previsibles.' },
        '3': { title: 'Comprensible', description: 'Contenido e interacción entendibles para las personas usuarias.' },
        '4': { title: 'Robusto', description: 'Contenido compatible con tecnologías de asistencia y agentes de usuario.' },
      };
      const principle = principleId && principleMap[principleId]
        ? { id: principleId, ...principleMap[principleId] }
        : { id: 'otros', title: 'Otros criterios', description: 'Validaciones complementarias o referencias fuera de los cuatro principios WCAG.' };
      const currentPrinciple = items.find((item) => item.kind === 'principle' && item.key === principle.id);
      if (currentPrinciple && currentPrinciple.kind === 'principle') {
        currentPrinciple.count += 1;
      } else {
        items.push({ kind: 'principle', key: principle.id, title: principle.title, description: principle.description, count: 1 });
      }
      const guidelineId = row.id?.split('.').slice(0, 2).join('.');
      const guidelineMap: Record<string, { title: string; description: string }> = {
        '1.1': { title: 'Alternativas textuales', description: 'Alternativas para contenido no textual.' },
        '1.2': { title: 'Medios temporales', description: 'Alternativas, subtítulos y descripciones para audio y video.' },
        '1.3': { title: 'Adaptable', description: 'Contenido presentable de distintas formas sin perder información.' },
        '1.4': { title: 'Distinguible', description: 'Separación visual y auditiva suficiente para percibir el contenido.' },
        '2.1': { title: 'Accesible por teclado', description: 'Funcionalidad disponible desde teclado sin bloqueos.' },
        '2.2': { title: 'Tiempo suficiente', description: 'Tiempo adecuado para leer, operar y completar tareas.' },
        '2.3': { title: 'Convulsiones y reacciones físicas', description: 'Prevención de destellos y animaciones que causen reacciones.' },
        '2.4': { title: 'Navegable', description: 'Mecanismos para encontrar contenido, ubicarse y navegar.' },
        '2.5': { title: 'Modalidades de entrada', description: 'Interacción accesible por puntero, gestos, movimiento y otros mecanismos.' },
        '3.1': { title: 'Legible', description: 'Texto comprensible, idioma identificado y apoyo para lectura.' },
        '3.2': { title: 'Predecible', description: 'Comportamientos consistentes y cambios de contexto controlados.' },
        '3.3': { title: 'Asistencia en la entrada', description: 'Ayuda para prevenir, identificar y corregir errores.' },
        '4.1': { title: 'Compatible', description: 'Compatibilidad con tecnologías de asistencia y agentes de usuario.' },
      };
      const guideline = guidelineId && guidelineMap[guidelineId]
        ? { id: guidelineId, ...guidelineMap[guidelineId] }
        : { id: 'otros', title: 'Pauta no clasificada', description: 'Criterios complementarios sin pauta WCAG específica.' };
      const currentGuideline = items.find((item) => item.kind === 'guideline' && item.key === guideline.id);
      if (currentGuideline && currentGuideline.kind === 'guideline') {
        currentGuideline.count += 1;
      } else {
        items.push({ kind: 'guideline', key: guideline.id, title: guideline.title, description: guideline.description, count: 1 });
      }
    }
    items.push({ kind: 'row', key: row.id, row });
    return items;
  }, []), [filteredApplicabilityRows, criterionViewMode]);
  const applicabilitySummary = selectedUrlResult?.applicability?.summary;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-[28px] border border-white/50 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="header-brand-mark" aria-hidden="true">
              <img src="/sin-barreras-icon.png" alt="" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="header-kicker mb-2">Acceso seguro</p>
              <p className="header-brand-name">Sin Barreras</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600 leading-6">
            Estamos preparando tu sesión. Si el acceso no se valida, te mostraremos el portal de ingreso.
          </p>
        </div>
      </div>
    );
  }

  if (authMode === 'none') {
    return (
      <AuthView
        authFormMode={authFormMode}
        onToggleMode={() => setAuthFormMode(authFormMode === 'register' ? 'login' : 'register')}
        onSetMode={setAuthFormMode}
        authEmail={authEmail}
        onEmailChange={setAuthEmail}
        authPassword={authPassword}
        onPasswordChange={setAuthPassword}
        authFullName={authFullName}
        onFullNameChange={setAuthFullName}
        authCompanyName={authCompanyName}
        onCompanyNameChange={setAuthCompanyName}
        authSubmitting={authSubmitting}
        guestSubmitting={guestSubmitting}
        onSubmit={handleAuthSubmit}
        onStartGuest={handleStartGuest}
        onViewPlans={handleViewPlansFromLanding}
        onGoogleLogin={() => { window.location.href = apiUrl('/auth/google'); }}
        appError={appError}
        useDemoCredentials={useDemoCredentials}
        onSubmitComplaint={handleSubmitComplaint}
        forceOpenAccessPanel={postLoginAction !== null}
      />
    );
  }

  return (
    <AppErrorBoundary>
    <div className="min-h-screen text-slate-900 font-sans">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <header className="sticky top-0 z-50 px-8 py-5 min-h-20 flex items-center justify-between">
        <div className="header-brand-block">
          <div className="header-brand-mark" aria-hidden="true">
            <img src="/sin-barreras-icon.png" alt="" className="h-8 w-8 object-contain" />
          </div>
          <div className="header-brand-copy">
            <span className="header-kicker">Auditoría web</span>
            <p className="header-brand-name">{BRAND_NAME}</p>
            <p className="header-brand-slogan">{BRAND_SLOGAN}</p>
          </div>
        </div>

        <nav className="header-actions" aria-label="Navegación principal">
          <div className="header-badge">
            <span className="header-badge-dot" aria-hidden="true" />
            <span>Accesibilidad Digital</span>
          </div>
          {(authMode === 'session' || authMode === 'public') && (
            <button
              type="button"
              onClick={() => setView('billing')}
              className="header-plan-button"
            >
              {currentPlanLabel}
            </button>
          )}
          {currentUser && (
            <div className="header-user-menu-wrap" ref={accountMenuRef}>
              <button
                type="button"
                className="header-user-trigger"
                onClick={() => setShowAccountMenu((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={showAccountMenu}
              >
                <span className="header-avatar header-avatar-premium" aria-hidden="true">{currentUserInitials}</span>
                <span className="header-user-copy hidden md:flex flex-col items-end leading-tight">
                  <span className="text-sm font-semibold text-white">{currentUserLabel}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/65">{currentUserRoleLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" aria-hidden="true" />
              </button>
              {showAccountMenu && (
                <div className="header-user-menu">
                  <div className="header-user-menu-header">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    <div>
                      <strong>{currentUserLabel}</strong>
                      <p>{currentUserDetail}</p>
                    </div>
                  </div>
                  <div className="header-user-menu-items" role="menu" aria-label="Opciones de cuenta">
                    {!isGuestUser && (
                      <button
                        type="button"
                        className="header-user-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setShowAccountMenu(false);
                          setPasswordMessage(null);
                          setShowPasswordModal(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                        <span>{needsPasswordSetup ? 'Crear contraseña' : 'Cambiar contraseña'}</span>
                      </button>
                    )}
                    {isMasterAccount && (
                      <button
                        type="button"
                        className="header-user-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setShowAccountMenu(false);
                          setView('admin');
                        }}
                      >
                        <UserRound className="h-4 w-4" aria-hidden="true" />
                        <span>Panel admin</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="header-user-menu-item"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>Salir</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      <main
        id="main-content"
        className={`app-main-content ${view === 'scan' ? 'report-page-main' : view === 'projects' ? 'projects-page-main' : view === 'project' ? 'project-detail-page-main' : view === 'admin' ? 'billing-page-main' : 'billing-page-main'} mx-auto p-6`}
        tabIndex={-1}
      >
        <p className="visually-hidden" aria-live="polite">
          Vista actual: {view === 'projects' ? 'Proyectos' : view === 'project' ? 'Detalle de proyecto' : view === 'scan' ? 'Informe de escaneo' : view === 'admin' ? 'Administración' : 'Planes y pagos'}
        </p>
        {appError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {appError}
          </div>
        )}

        {isGuestUser && view !== 'billing' && (
          <div className="guest-upgrade-banner mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="block text-sm">Modo invitado activo</strong>
              <span className="text-blue-900/80">Puedes escanear tu sitio ahora. Pro y Enterprise desbloquean proyectos, exportes y remediación avanzada.</span>
            </div>
            <button type="button" className="report-action-btn" onClick={() => setView('billing')}>
              Ver planes
            </button>
          </div>
        )}

        {view === 'projects' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando proyectos...</div>}>
          <ProjectsView
            projects={projects}
            viewerRole={currentUser?.role ?? null}
            averageScore={averageScore}
            projectsAtRisk={projectsAtRisk}
            runningAnalyses={runningAnalyses}
            onCreateClick={handleOpenCreateProject}
            canCreateProjects={canCreateProjects}
            canUsePaidFeatures={canUsePaidFeatures}
            showLockedCreateProject={!isGuestUser && !canCreateProjects}
            onViewPlans={() => setView('billing')}
            onExportScan={(scan, kind) => handleExport(kind, scan)}
            onProjectClick={(p) => { setCurrentProject(p); fetchProjectDetails(p.id); setView('project'); }}
            onEditProject={openEditProject}
            onDeleteProject={handleDeleteProject}
            showCreateProject={showCreateProject}
            onCloseCreateProject={handleCloseCreateProject}
            onCreateProject={handleCreateProject}
            newProjectName={newProjectName}
            onNewProjectNameChange={setNewProjectName}
            newProjectEntityType={newProjectEntityType}
            onNewProjectEntityTypeChange={setNewProjectEntityType}
            editingProject={editingProject}
            onCloseEditProject={() => setEditingProject(null)}
            onUpdateProject={handleUpdateProject}
            editProjectName={editProjectName}
            onEditProjectNameChange={setEditProjectName}
            editProjectEntityType={editProjectEntityType}
            onEditProjectEntityTypeChange={setEditProjectEntityType}
            getScoreMeta={getScoreMeta}
          />
          </Suspense>
        )}

        {view === 'project' && currentProject && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando proyecto...</div>}>
          <ProjectDetailView
            currentProject={currentProject}
            backLabel={authMode === 'public' ? 'Volver' : 'Volver a proyectos'}
            onBack={() => {
              if (authMode === 'public') {
                setAuthMode('none');
                setCurrentProject(null);
                setCurrentScan(null);
                setSelectedUrlResult(null);
                setView('projects');
                return;
              }
              if (currentProject) fetchProjectDetails(currentProject.id);
              setView('projects');
            }}
            onNewScanClick={() => setShowNewScan(true)}
            onScanClick={(scan) => { authMode === 'public' ? fetchPublicScanDetails(scan.id) : fetchScanDetails(scan.id); setView('scan'); }}
            onDeleteScan={handleDeleteScan}
            onCancelScan={handleCancelScan}
            showNewScan={showNewScan}
            onCloseNewScan={() => setShowNewScan(false)}
            onTriggerScan={handleTriggerScan}
            newScanUrls={newScanUrls}
            onNewScanUrlsChange={setNewScanUrls}
            parsedNewScanUrls={parsedNewScanUrls}
            newScanLoginMode={newScanLoginMode}
            onNewScanLoginModeChange={setNewScanLoginMode}
            canUseManualLogin={canUsePaidFeatures}
            canScanMultipleUrls={canCreateProjects}
            freeReservedUrl={getProjectReservedFreeUrl(currentProject)}
            scanProgress={scanProgress}
            renderScoreMeter={renderScoreMeter}
            renderStatusBadge={renderStatusBadge}
            openInspectionUrl={openInspectionUrl}
            hasMoreScans={hasMoreScans}
            loadingMoreScans={loadingMoreScans}
            onLoadMoreScans={loadMoreScans}
          />
          </Suspense>
        )}

        {view === 'scan' && currentScan && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando informe...</div>}>
          <ScanReportView
            currentScan={currentScan}
            currentProject={currentProject}
            selectedUrlResult={selectedUrlResult}
            onBack={() => { if (currentProject && authMode !== 'public') fetchProjectDetails(currentProject.id); setView('project'); }}
            onUrlResultSelect={setSelectedUrlResult}
            onExport={handleExport}
            canUsePaidFeatures={canUsePaidFeatures}
            renderScoreMeter={renderScoreMeter}
            applicabilityRows={applicabilityRows}
            filteredApplicabilityRows={filteredApplicabilityRows}
            groupedApplicabilityRows={groupedApplicabilityRows}
            applicabilitySummary={applicabilitySummary}
            criterionViewMode={criterionViewMode}
            onCriterionViewModeChange={setCriterionViewMode}
            criterionLevelFilter={criterionLevelFilter}
            onCriterionLevelFilterChange={setCriterionLevelFilter}
            criterionApplicabilityFilter={criterionApplicabilityFilter}
            onCriterionApplicabilityFilterChange={setCriterionApplicabilityFilter}
            criterionResultFilter={criterionResultFilter}
            onCriterionResultFilterChange={setCriterionResultFilter}
            criterionSeverityFilter={criterionSeverityFilter}
            onCriterionSeverityFilterChange={setCriterionSeverityFilter}
            criterionRoleFilter={criterionRoleFilter}
            onCriterionRoleFilterChange={setCriterionRoleFilter}
            onApplicabilityUpdate={handleApplicabilityUpdate}
            updatingCriterionId={updatingCriterionId}
            updatingFindingKey={updatingFindingKey}
            expandedCriterionId={expandedCriterionId}
            onToggleExpandedCriterion={setExpandedCriterionId}
            onFindingStatusUpdate={handleFindingStatusUpdate}
            checklist86={checklist86}
            getApplicabilityStatusLabel={getApplicabilityStatusLabel}
            getApplicabilityStatusClass={getApplicabilityStatusClass}
            getFindingStatusLabel={getFindingStatusLabel}
            getFindingStatusClass={getFindingStatusClass}
            onViewPlans={() => {
              if (authMode === 'public') {
                setAuthMode('none');
              } else {
                setView('billing');
              }
            }}
          />
          </Suspense>
        )}

        {view === 'billing' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando planes...</div>}>
          <BillingView
            plans={billingPlans}
            billingState={billingState}
            billingCurrency={billingCurrency}
            loading={billingLoading}
            submittingKey={billingSubmitting}
            note={billingNote}
            hasExternalProPaymentLink={false}
            onChangeCurrency={setBillingCurrency}
            onSubscribe={handleBillingSubscribe}
            onCancel={handleBillingCancel}
            onReload={loadBillingData}
            onBack={handleBackFromBilling}
          />
          </Suspense>
        )}

        {view === 'admin' && currentUser && isMasterAccount && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando panel...</div>}>
            <AdminView
              onBack={() => setView('projects')}
              fetchWithAuth={(path, init) => fetchWithFallback(path, init)}
            />
          </Suspense>
        )}
      </main>
      {culqiModalPlan && currentUser && (
        <CulqiCheckoutModal
          plan={culqiModalPlan}
          userEmail={currentUser.email}
          onToken={handleCulqiToken}
          onClose={() => setCulqiModalPlan(null)}
        />
      )}
      {showPasswordModal && currentUser && (
        <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
          <div className="report-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <form onSubmit={handleChangePasswordSubmit}>
              <div className="account-modal-header">
                <div>
                  <p className="account-modal-kicker">Cuenta</p>
                  <h2 id="change-password-title">{needsPasswordSetup ? 'Crear contraseña' : 'Cambiar contraseña'}</h2>
                  <p>
                    {needsPasswordSetup
                      ? `Tu cuenta ingresa con Google. Crea una contraseña para también poder entrar con tu correo.`
                      : `Protege el acceso de ${currentUserLabel}.`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar cambio de contraseña"
                  className="report-modal-close"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordMessage(null);
                    setCurrentPassword('');
                    setNextPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="account-modal-body">
                {!needsPasswordSetup && (
                  <label className="account-modal-field">
                    <span>Contraseña actual</span>
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="current-password"
                      className="create-project-control"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </label>
                )}
                <label className="account-modal-field">
                  <span>Nueva contraseña</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="create-project-control"
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                  />
                </label>
                <label className="account-modal-field">
                  <span>Confirmar contraseña</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="create-project-control"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
                {passwordMessage && (
                  <div className="account-modal-message" role="status" aria-live="polite">
                    {passwordMessage}
                  </div>
                )}
              </div>
              <div className="account-modal-footer">
                <button
                  type="button"
                  className="report-ghost-btn"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordMessage(null);
                    setCurrentPassword('');
                    setNextPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="create-project-submit" disabled={passwordSubmitting}>
                  {passwordSubmitting ? 'Actualizando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AppErrorBoundary>
  );
}
