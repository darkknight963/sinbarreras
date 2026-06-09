import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Shield,
  Globe2,
  CheckCircle,
  X,
  ChevronDown,
  KeyRound,
  LogOut,
  UserRound,
} from 'lucide-react';
import type { Project, Scan, UrlResult } from './types';
import { API_BASE_URL, API_FALLBACK_BASE_URL, SOCKET_PATH, SOCKET_URL, CULQI_PUBLIC_KEY, PRO_PAYMENT_URL, isLocalRuntimeHost } from './config';
import { BillingView } from './BillingView';
import type { BillingCurrency, BillingPlan, BillingState, CulqiCheckoutInstance } from './billing';
import { AuthView } from './views/AuthView';
import { AdminView } from './views/AdminView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { ScanReportView } from './views/ScanReportView';

let runtimeApiBaseUrl = API_BASE_URL;
const BRAND_NAME = 'Sin Barreras';
const BRAND_SLOGAN = 'Convierte tu web en un lugar para todos';
const SESSION_STORAGE_KEY = 'sin-barreras-session-token';

type AuthMode = 'session' | 'none' | 'public';

type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: string;
  billingStatus?: string;
  billingPlan?: string | null;
  billingProvider?: string;
  billingCurrency?: string | null;
  billingPeriodEnd?: string | null;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
};

const apiUrl = (path: string) => `${runtimeApiBaseUrl}${path}`;

const getStoredAuthToken = () =>
  typeof window === 'undefined' ? '' : (window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim() || '');

const withAuthHeaders = (headers?: HeadersInit): HeadersInit => {
  const nextHeaders = new Headers(headers);
  const token = getStoredAuthToken();
  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
};

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
  const requestInit = {
    ...init,
    headers: withAuthHeaders(init?.headers),
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

const readApiJson = async <T,>(res: Response): Promise<T | null> => {
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const currentProjectRef = useRef<Project | null>(null);
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

  const [view, setView] = useState<'projects' | 'project' | 'scan' | 'billing' | 'admin'>('projects');

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
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

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
      ? message
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
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      window.localStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setCurrentUser(data.user);
      setAuthMode('session');
      setView('projects');
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
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
    setAuthEmail('administrador@gzakgroup.com');
    setAuthPassword('12345678');
    setAppError(null);
  };

  const handleLogout = async () => {
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();
    try {
      if (token) {
        await fetchWithFallback('/auth/logout', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      } catch (err) {
        console.warn('Logout request failed', err);
    } finally {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
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

  const isGuestUser = currentUser?.role === 'guest';
  const isMasterAccount = currentUser?.role === 'admin' || currentUser?.email === 'administrador@gzakgroup.com';
  const canUsePaidFeatures = Boolean(isMasterAccount || (currentUser?.billingPlan && currentUser?.billingStatus === 'active'));
  const canCreateProjects = canUsePaidFeatures;
  const currentPlanLabel = isMasterAccount || (currentUser?.billingPlan === 'annual' && currentUser.billingStatus === 'active')
    ? 'Plan Enterprise'
    : canUsePaidFeatures
      ? 'Plan Pro'
      : 'Plan Free';
  const currentUserLabel = isGuestUser
    ? 'Modo invitado'
    : currentUser?.fullName || currentUser?.companyName || currentUser?.email || 'Cuenta';
  const currentUserDetail = isGuestUser ? 'Sesion temporal sin cuenta' : currentUser?.email || '';
  const currentUserRoleLabel =
    currentUser?.role === 'guest'
      ? 'Invitado'
      : currentUser?.role === 'owner'
      ? 'Propietario'
      : currentUser?.role === 'admin'
        ? 'Administrador'
        : currentUser?.role === 'viewer'
          ? 'Lector'
          : 'Usuario';
  const currentUserInitials = currentUserLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'SB';

  const handleChangePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !nextPassword || !confirmPassword) {
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
          currentPassword,
          newPassword: nextPassword,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      setPasswordMessage('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setShowAccountMenu(false);
    } catch (err) {
      handleApiError('No se pudo cambiar la contraseña', err);
      setPasswordMessage('No se pudo cambiar la contraseña. Verifica tus datos e intenta nuevamente.');
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
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const sessionTokenFromHash = hashParams.get('session_token');
      const oauthError = hashParams.get('oauth_error');

      if (sessionTokenFromHash) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, sessionTokenFromHash);
        window.history.replaceState({}, window.document.title, `${window.location.pathname}${window.location.search}`);
      }

      if (oauthError) {
        setAppError(decodeURIComponent(oauthError));
        window.history.replaceState({}, window.document.title, `${window.location.pathname}${window.location.search}`);
      }

      const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();

      if (storedToken) {
        try {
          const res = await fetchWithFallback('/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (res.ok) {
            const user = await res.json();
            setCurrentUser(user);
            setAuthMode('session');
            return;
          }
        } catch (err) {
          console.warn('Session bootstrap failed', err);
        }

        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }

      setAuthMode('none');
    };

    bootstrapAuth().finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || authMode !== 'session') return;

    fetchProjects();

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: getStoredAuthToken() ? { token: getStoredAuthToken() } : undefined,
    });

    socket.on('scan-progress', ({ scanId, progress }) => {
      console.log(`Scan ${scanId} progress: ${progress}%`);
      setScanProgress(prev => ({ ...prev, [scanId]: progress }));
    });

    socket.on('scan-completed', ({ scanId }) => {
      console.log(`Scan ${scanId} completed!`);
      setScanProgress(prev => {
        const next = { ...prev };
        delete next[scanId];
        return next;
      });
      if (currentProjectRef.current) fetchProjectDetails(currentProjectRef.current.id);
      fetchProjects();
    });

    return () => {
      socket.disconnect();
    };
  }, [authLoading, authMode]);

  useEffect(() => {
    if (authLoading || authMode === 'none' || view !== 'billing') return;
    loadBillingData();
  }, [authLoading, authMode, view]);

  useEffect(() => {
    if (authLoading || authMode !== 'public' || view !== 'project') return;

    const runningScan = currentProject?.scans?.find(isScanInProgress);
    if (!runningScan) return;

    const refreshPublicScan = () => {
      void fetchPublicScanDetails(runningScan.id);
    };

    refreshPublicScan();
    const intervalId = window.setInterval(refreshPublicScan, 2000);

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

    const refreshManualScan = () => {
      if (view === 'scan') {
        void fetchScanDetails(awaitingScan.id);
      }
      if (view === 'project' && currentProject?.id) {
        void fetchProjectDetails(currentProject.id);
      }
      void fetchProjects();
    };

    refreshManualScan();
    const intervalId = window.setInterval(refreshManualScan, 2500);

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
      setProjects([...data].sort((a: Project, b: Project) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      handleApiError('No se pudieron cargar los proyectos', err);
    }
  };

  const fetchProjectDetails = async (id: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/projects/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readApiJson<Project>(res);
      if (!data) throw new Error('La API devolvió una respuesta vacía para el proyecto.');
      setCurrentProject(data);
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del proyecto', err);
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
          scans: [scan],
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
        const projectWithScans = { ...createdProject, scans: createdProject.scans || [] };
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
            scans: [scan],
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
          projectId: projectForScan.id,
          urls,
          scanMode,
          ux: scanUx,
          loginMode: newScanLoginMode,
        })
      });
      if (res.ok) {
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
    const confirmed = window.confirm(`¿Eliminar este análisis ${scan.scanMode} del historial?`);
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
      const plansResponse = await fetchWithFallback('/billing/plans');

      if (!plansResponse.ok) {
        throw new Error(`HTTP ${plansResponse.status}`);
      }

      const plans = await plansResponse.json();
      setBillingPlans(plans);
      if (authMode === 'session') {
        const stateResponse = await fetchWithFallback('/billing/me');
        if (!stateResponse.ok) {
          throw new Error(`HTTP ${stateResponse.status}`);
        }
        setBillingState(await stateResponse.json());
      } else {
        setBillingState(null);
      }
    } catch (err) {
      handleApiError('No se pudo cargar la información de pagos', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleBillingSubscribe = async (plan: BillingPlan) => {
    const key = `${plan.code}:${plan.currency}`;

    if (PRO_PAYMENT_URL) {
      setBillingSubmitting(key);
      setBillingNote(null);
      window.open(PRO_PAYMENT_URL, '_blank', 'noopener,noreferrer');
      setBillingNote('Completa el pago del Plan Pro en Culqi.');
      setBillingSubmitting(null);
      return;
    }

    if (authMode !== 'session') {
      setBillingNote('Crea una cuenta o inicia sesión para activar Pro.');
      return;
    }

    setBillingSubmitting(key);
    setBillingNote(null);

    try {
      const checkoutResponse = await fetchWithFallback('/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: plan.code,
          currency: plan.currency,
        }),
      });

      if (!checkoutResponse.ok) {
        const text = await checkoutResponse.text();
        throw new Error(text || `HTTP ${checkoutResponse.status}`);
      }

      const checkoutData = await checkoutResponse.json();
      const publicKey = checkoutData.publicKey || CULQI_PUBLIC_KEY;
      const amount = checkoutData.amount ?? plan.amount;

      if (!publicKey) {
        throw new Error('Falta configurar VITE_CULQI_PUBLIC_KEY para abrir Culqi Checkout');
      }

      if (!amount) {
        throw new Error(`Falta configurar el monto para ${plan.label} en ${plan.currency}`);
      }

      const CheckoutCtor = window.CulqiCheckout;
      if (!CheckoutCtor) {
        throw new Error('No se cargó el script de Culqi Checkout');
      }

      const checkout: CulqiCheckoutInstance = new CheckoutCtor(publicKey, {
        settings: {
          title: BRAND_NAME,
          currency: plan.currency,
          amount,
        },
      });

      checkout.culqi = async () => {
        try {
          if (!checkout.token?.id) {
            setBillingNote('No se generó un token de pago.');
            return;
          }

          checkout.close();

          const confirmResponse = await fetchWithFallback('/billing/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planCode: plan.code,
              currency: plan.currency,
              tokenId: checkout.token.id,
            }),
          });

          if (!confirmResponse.ok) {
            const text = await confirmResponse.text();
            throw new Error(text || `HTTP ${confirmResponse.status}`);
          }

          const state = await confirmResponse.json();
          setBillingState(state);
          setBillingNote(`Tu plan ${plan.label} ya quedó registrado.`);
          await loadBillingData();
        } catch (err) {
          handleApiError('No se pudo confirmar la suscripción', err);
        } finally {
          setBillingSubmitting(null);
        }
      };

      checkout.open();
      setBillingNote('Completa el pago en la ventana de Culqi.');
    } catch (err) {
      handleApiError('No se pudo abrir Culqi Checkout', err);
      setBillingSubmitting(null);
    }
  };

  const getVpCategory = (vpValue: number | null) => {
    if (!vpValue) return { label: 'Prioridad Baja', color: 'report-priority-badge report-priority-low' };
    if (vpValue >= 24) return { label: 'Prioridad Alta', color: 'report-priority-badge report-priority-high' };
    if (vpValue >= 12) return { label: 'Prioridad Media', color: 'report-priority-badge report-priority-medium' };
    return { label: 'Prioridad Baja', color: 'report-priority-badge report-priority-low' };
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
    const isAwaitingLogin = normalized === 'awaiting_login';
    const Icon = isCompleted ? CheckCircle : isFailed ? X : null;
    const label = isAwaitingLogin ? 'Login manual pendiente' : status;
    return (
      <span className={`report-analysis-status ${
        isCompleted ? 'report-analysis-completed' :
        isFailed ? 'report-analysis-failed' :
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
      const displayFindings = [...findings, ...(extensionReviewFindings as any[])];
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

  const checklist86 = Array.from({ length: 86 }, (_, i) => {
    const n = i + 1;
    return `Criterio ${n.toString().padStart(2, '0')} — WCAG 2.2`;
  });

  useEffect(() => {
    const section = view === 'projects' ? 'Proyectos' : view === 'project' ? 'Detalle del Proyecto' : 'Informe de Escaneo';
    document.title = `${BRAND_NAME} | ${section}`;
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
  const projectsAtRisk = latestScans.filter((scan) => (scan.globalScore ?? 0) < 50).length;
  const runningAnalyses = latestScans.filter(isScanInProgress).length;
  const parsedNewScanUrls = parseScanUrls(newScanUrls);
  const applicabilityRows = selectedUrlResult ? getApplicabilityRows(selectedUrlResult) : [];
  const filteredApplicabilityRows = applicabilityRows.filter((row) => {
    if (criterionApplicabilityFilter !== 'todos' && row.estado !== criterionApplicabilityFilter) return false;
    if (criterionResultFilter !== 'todos' && row.uiStatus !== criterionResultFilter) return false;
    if (criterionLevelFilter !== 'todos' && row.nivel !== criterionLevelFilter) return false;
    if (criterionRoleFilter !== 'todos' && !row.findings.some((finding) => finding.role === criterionRoleFilter)) return false;
    if (
      criterionSeverityFilter !== 'todos' &&
      !row.findings.some((finding) => finding.severity?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === criterionSeverityFilter)
    ) return false;
    return true;
  });
  const groupedApplicabilityRows = filteredApplicabilityRows.reduce<Array<
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
  }, []);
  const applicabilitySummary = selectedUrlResult?.applicability?.summary;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-[28px] border border-white/50 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="header-brand-mark" aria-hidden="true">
              <Shield className="h-6 w-6 text-white" />
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
        appError={appError}
        useDemoCredentials={useDemoCredentials}
        onSubmitComplaint={handleSubmitComplaint}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-900 font-sans">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <header className="sticky top-0 z-50 px-8 py-5 min-h-20 flex items-center justify-between">
        <div className="header-brand-block">
          <div className="header-brand-mark" aria-hidden="true">
            <Globe2 className="h-6 w-6 text-white" />
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
                        <span>Cambiar contraseña</span>
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
          <ProjectsView
            projects={projects}
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
        )}

        {view === 'project' && currentProject && (
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
            getVpCategory={getVpCategory}
            openInspectionUrl={openInspectionUrl}
            extensionApiBaseUrl={runtimeApiBaseUrl}
            extensionAccessToken={getStoredAuthToken()}
          />
        )}

        {view === 'scan' && currentScan && (
          <ScanReportView
            currentScan={currentScan}
            currentProject={currentProject}
            selectedUrlResult={selectedUrlResult}
            onBack={() => { if (currentProject && authMode !== 'public') fetchProjectDetails(currentProject.id); setView('project'); }}
            onUrlResultSelect={setSelectedUrlResult}
            onExport={handleExport}
            currentUser={currentUser}
            canUsePaidFeatures={canUsePaidFeatures}
            renderScoreMeter={renderScoreMeter}
            getVpCategory={getVpCategory}
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
          />
        )}

        {view === 'billing' && (
          <BillingView
            plans={billingPlans}
            billingState={billingState}
            billingCurrency={billingCurrency}
            loading={billingLoading}
            submittingKey={billingSubmitting}
            note={billingNote}
            hasExternalProPaymentLink={Boolean(PRO_PAYMENT_URL)}
            onChangeCurrency={setBillingCurrency}
            onSubscribe={handleBillingSubscribe}
            onReload={loadBillingData}
            onBack={handleBackFromBilling}
          />
        )}

        {view === 'admin' && currentUser && isMasterAccount && (
          <AdminView
            onBack={() => setView('projects')}
            fetchWithAuth={(path, init) => fetchWithFallback(path, init)}
          />
        )}
      </main>
      {showPasswordModal && currentUser && (
        <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
          <div className="report-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <form onSubmit={handleChangePasswordSubmit}>
              <div className="account-modal-header">
                <div>
                  <p className="account-modal-kicker">Cuenta</p>
                  <h2 id="change-password-title">Cambiar contraseña</h2>
                  <p>Protege el acceso de {currentUserLabel}.</p>
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
  );
}
