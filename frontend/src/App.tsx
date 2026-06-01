import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Shield, 
  Plus, 
  CheckCircle, 
  Clock, 
  Download, 
  ArrowLeft,
  Settings,
  X,
  RefreshCw,
  Globe,
  FileText,
  Gauge,
  TableProperties,
  Building2,
  Pencil,
  Trash2
} from 'lucide-react';
import type { Project, Scan, UrlResult } from './types';
import { API_AUTH_TOKEN, API_BASE_URL, API_FALLBACK_BASE_URL, SOCKET_PATH, SOCKET_URL, isLocalRuntimeHost } from './config';

let runtimeApiBaseUrl = API_BASE_URL;
const BRAND_NAME = 'sin barreras';
const BRAND_SLOGAN = 'Convierte tu web en un lugar para todos';

const apiUrl = (path: string) => `${runtimeApiBaseUrl}${path}`;

const withAuthHeaders = (headers?: HeadersInit): HeadersInit => {
  const nextHeaders = new Headers(headers);
  if (API_AUTH_TOKEN) {
    nextHeaders.set('Authorization', `Bearer ${API_AUTH_TOKEN}`);
  }
  return nextHeaders;
};

const parseScanUrls = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean);

const fetchWithFallback = async (path: string, init?: RequestInit) => {
  const requestInit = {
    ...init,
    headers: withAuthHeaders(init?.headers),
  };
  const first = await fetch(apiUrl(path), requestInit);

  // If /api is unavailable in current runtime (common on plain localhost),
  // switch once to the direct backend URL and retry.
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

function EvidencePreview({ url }: { url: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let generatedUrl: string | null = null;

    const loadEvidence = async () => {
      try {
        const response = await fetch(url, {
          headers: withAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Evidence fetch failed: ${response.status}`);
        }

        const blob = await response.blob();
        generatedUrl = URL.createObjectURL(blob);

        if (active) {
          setObjectUrl(generatedUrl);
        }
      } catch {
        if (active) {
          setObjectUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setObjectUrl(null);
    loadEvidence();

    return () => {
      active = false;
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [url]);

  if (loading) {
    return <div className="report-no-evidence">Cargando evidencia visual...</div>;
  }

  if (!objectUrl) {
    return <div className="report-no-evidence">Sin evidencia visual disponible</div>;
  }

  return (
    <a href={objectUrl} target="_blank" rel="noreferrer" className="report-evidence-link">
      <img src={objectUrl} alt="Evidencia visual" className="w-full rounded-lg border border-slate-200" />
    </a>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const currentProjectRef = useRef<Project | null>(null);
  const [currentScan, setCurrentScan] = useState<Scan | null>(null);
  const [selectedUrlResult, setSelectedUrlResult] = useState<UrlResult | null>(null);
  
  const [view, setView] = useState<'projects' | 'project' | 'scan'>('projects');
  
  // Modals / Forms
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showNewScan, setShowNewScan] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectVo, setNewProjectVo] = useState(4); // default Media
  const [newProjectEntityType, setNewProjectEntityType] = useState('Sector privado');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectVo, setEditProjectVo] = useState(4);
  const [editProjectEntityType, setEditProjectEntityType] = useState('Sector privado');
  
  const [newScanUrls, setNewScanUrls] = useState('');
  const [newScanMode, setNewScanMode] = useState<'rápido' | 'estándar' | 'profundo'>('estándar');
  const [newScanUx, setNewScanUx] = useState(4); // default Media

  // Filters for the unified WCAG criteria table
  const [criterionApplicabilityFilter, setCriterionApplicabilityFilter] = useState<string>('todos');
  const [criterionResultFilter, setCriterionResultFilter] = useState<string>('todos');
  const [criterionLevelFilter, setCriterionLevelFilter] = useState<string>('todos');
  const [criterionRoleFilter, setCriterionRoleFilter] = useState<string>('todos');
  const [criterionSeverityFilter, setCriterionSeverityFilter] = useState<string>('todos');
  const [criterionViewMode, setCriterionViewMode] = useState<'normal' | 'principles'>('normal');
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);
  const [updatingCriterionId, setUpdatingCriterionId] = useState<string | null>(null);
  
  // Realtime scan progress state
  const [scanProgress, setScanProgress] = useState<Record<string, number>>({});
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  const handleApiError = (context: string, err: unknown) => {
    console.error(context, err);
    setAppError(`${context}. Verifique la conexión con la API e intente nuevamente.`);
  };

  useEffect(() => {
    fetchProjects();

    // Setup Socket.io for real-time progress
    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: API_AUTH_TOKEN ? { token: API_AUTH_TOKEN } : undefined,
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
      // Refresh current project or scan if active
      if (currentProjectRef.current) fetchProjectDetails(currentProjectRef.current.id);
      fetchProjects();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCurrentProject(data);
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del proyecto', err);
    }
  };

  const fetchScanDetails = async (id: string) => {
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/scans/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCurrentScan(data);
      if (data.urlResults && data.urlResults.length > 0) {
        setSelectedUrlResult((prev) => {
          if (!prev) return data.urlResults[0];
          const same = data.urlResults.find((ur: UrlResult) => ur.id === prev.id);
          return same || data.urlResults[0];
        });
      }
    } catch (err) {
      handleApiError('No se pudo cargar el detalle del escaneo', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAppError(null);
      const res = await fetchWithFallback('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          domain: null,
          vo: newProjectVo,
          entityType: newProjectEntityType
        })
      });
      if (res.ok) {
        setShowCreateProject(false);
        setNewProjectName('');
        fetchProjects();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      handleApiError('No se pudo crear el proyecto', err);
    }
  };

  const handleTriggerScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    const urls = parseScanUrls(newScanUrls);
    if (urls.length === 0) {
      setAppError('Ingresa al menos una URL válida para iniciar el escaneo.');
      return;
    }

    try {
      setAppError(null);
      const res = await fetchWithFallback('/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          urls,
          scanMode: newScanMode,
          ux: newScanUx
        })
      });
      if (res.ok) {
        setShowNewScan(false);
        setNewScanUrls('');
        // Refresh project details
        setTimeout(() => fetchProjectDetails(currentProject.id), 500);
      } else {
        throw new Error(`HTTP ${res.status}`);
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
    setEditProjectVo(project.vo);
    setEditProjectEntityType(project.entityType);
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
          vo: editProjectVo,
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

  const handleManualVerificationUpdate = async (verificationId: string, status: 'pending' | 'approved' | 'failed' | 'not_applicable') => {
    if (!selectedUrlResult) return;
    try {
      setAppError(null);
      const res = await fetchWithFallback(`/url-results/${selectedUrlResult.id}/manual-verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, status })
      });
      if (res.ok) {
        const updatedResult = await res.json();
        setSelectedUrlResult(updatedResult);
        // also refresh current scan to update global UI state
        if (currentScan) fetchScanDetails(currentScan.id);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      handleApiError('No se pudo actualizar la verificación manual', err);
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

  const handleExport = async (kind: 'pdf-executive' | 'pdf-technical' | 'excel') => {
    if (!currentScan?.id) return;
    try {
      let endpoint = '';
      let filename = '';

      if (kind === 'pdf-executive') {
        endpoint = `${runtimeApiBaseUrl}/reports/${currentScan.id}/pdf?type=executive`;
        filename = `reporte-ejecutivo-${currentScan.id}.pdf`;
      } else if (kind === 'pdf-technical') {
        endpoint = `${runtimeApiBaseUrl}/reports/${currentScan.id}/pdf?type=technical`;
        filename = `reporte-tecnico-${currentScan.id}.pdf`;
      } else {
        endpoint = `${runtimeApiBaseUrl}/reports/${currentScan.id}/excel`;
        filename = `reporte-accesibilidad-${currentScan.id}.xlsx`;
      }

      const res = await fetch(endpoint, { headers: withAuthHeaders() });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      downloadFile(blob, filename);
    } catch (err) {
      handleApiError('No se pudo exportar el reporte', err);
      window.alert('No se pudo exportar el reporte. Intente nuevamente.');
    }
  };

  // Helper to determine Vp category
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
        <div className="report-score-track" aria-label={`${label}: ${meta.value} de 100`}>
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
    const Icon = isCompleted ? CheckCircle : isFailed ? X : null;
    return (
      <span className={`report-analysis-status ${
        isCompleted ? 'report-analysis-completed' :
        isFailed ? 'report-analysis-failed' :
        'report-analysis-running'
      }`}>
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="report-spinner" aria-hidden="true" />}
        {status}
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
    if (status === 'confirmed') return 'report-status-approved';
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
      const confirmedFindings = findings.filter((v) => (v.findingStatus || v.status || 'confirmed') === 'confirmed');
      const manualVerifications = manualByCriterion.get(criterion.id) || [];
      const hasManualFailure = manualVerifications.some((verification) => verification.status === 'failed');
      const hasManualNotApplicable = manualVerifications.some((verification) => verification.status === 'not_applicable');
      return {
        ...criterion,
        findings,
        manualVerifications,
        primaryFinding: confirmedFindings[0] || findings[0],
        uiStatus: criterion.estado === 'no_aplica' || hasManualNotApplicable ? 'na' : confirmedFindings.length > 0 || hasManualFailure ? 'falla' : 'cumple',
      };
    });
  };

  const getManualStatusLabel = (status: string) => {
    if (status === 'approved') return 'Cumple';
    if (status === 'failed') return 'No cumple';
    if (status === 'not_applicable') return 'No aplica';
    return 'Pendiente';
  };

  const getApplicabilityStatusLabel = (status: string) => {
    if (status === 'cumple') return 'Cumple';
    if (status === 'falla') return 'Falla';
    if (status === 'na') return 'N/A';
    return 'Sin hallazgos';
  };

  const getApplicabilityStatusClass = (status: string) => {
    if (status === 'cumple') return 'report-status-approved';
    if (status === 'falla') return 'report-status-failed';
    return 'report-status-pending';
  };

  const getWcagPrinciple = (criterionId: string) => {
    const principle = criterionId?.split('.')[0];
    if (principle === '1') return { id: '1', title: 'Perceptible', description: 'Información y componentes presentados de forma que puedan percibirse.' };
    if (principle === '2') return { id: '2', title: 'Operable', description: 'Interfaz y navegación utilizables por teclado, tiempo y mecanismos previsibles.' };
    if (principle === '3') return { id: '3', title: 'Comprensible', description: 'Contenido e interacción entendibles para las personas usuarias.' };
    if (principle === '4') return { id: '4', title: 'Robusto', description: 'Contenido compatible con tecnologías de asistencia y agentes de usuario.' };
    return { id: 'otros', title: 'Otros criterios', description: 'Validaciones complementarias o referencias fuera de los cuatro principios WCAG.' };
  };

  const getWcagGuideline = (criterionId: string) => {
    const guidelineId = criterionId?.split('.').slice(0, 2).join('.');
    const guidelines: Record<string, { title: string; description: string }> = {
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
    const guideline = guidelines[guidelineId];
    return guideline
      ? { id: guidelineId, ...guideline }
      : { id: 'otros', title: 'Pauta no clasificada', description: 'Criterios complementarios sin pauta WCAG específica.' };
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
  const runningAnalyses = latestScans.filter((scan) => scan.status === 'running' || scan.status === 'pending').length;
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
      const principle = getWcagPrinciple(row.id);
      const guideline = getWcagGuideline(row.id);
      const currentPrinciple = items.find((item) => item.kind === 'principle' && item.key === principle.id);
      if (currentPrinciple && currentPrinciple.kind === 'principle') {
        currentPrinciple.count += 1;
      } else {
        items.push({ kind: 'principle', key: principle.id, title: principle.title, description: principle.description, count: 1 });
      }
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

  return (
    <div className="min-h-screen text-slate-900 font-sans">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 px-8 py-4 min-h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide text-white">{BRAND_NAME}</h1>
            <p className="text-xs text-white/70">{BRAND_SLOGAN}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="header-badge">
            <span className="h-2 w-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
            <span>Normativa Peruana 2026</span>
          </div>
          <div className="header-avatar" aria-label="Usuario administrador">AU</div>
          <button type="button" aria-label="Abrir configuración" className="report-icon-btn">
            <Settings className="h-5 w-5 text-white/70 hover:text-white transition-colors" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main
        id="main-content"
        className={`app-main-content ${view === 'scan' ? 'report-page-main' : view === 'projects' ? 'projects-page-main' : view === 'project' ? 'project-detail-page-main' : 'max-w-7xl'} mx-auto p-6`}
        tabIndex={-1}
      >
        <p className="visually-hidden" aria-live="polite">
          Vista actual: {view === 'projects' ? 'Proyectos' : view === 'project' ? 'Detalle de proyecto' : 'Informe de escaneo'}
        </p>
        {appError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {appError}
          </div>
        )}
        {/* VIEW: PROJECTS OVERVIEW */}
        {view === 'projects' && (
          <div className="report-surface project-overview-surface">
            <div className="project-overview-header flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Proyectos Digitales</h2>
                <p className="text-slate-300 text-sm">Monitorea y gestiona el cumplimiento de accesibilidad de los servicios públicos o privados.</p>
              </div>
              <button 
                onClick={() => setShowCreateProject(true)}
                className="report-action-btn"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Proyecto</span>
              </button>
            </div>

            <section className="project-summary-grid" aria-label="Métricas globales de proyectos">
              <div className="project-summary-card">
                <span>Total de proyectos</span>
                <strong>{projects.length}</strong>
              </div>
              <div className="project-summary-card">
                <span>Cumplimiento global</span>
                <strong>{averageScore}/100</strong>
                <div className="project-summary-bar">
                  <div style={{ width: `${averageScore}%` }} />
                </div>
              </div>
              <div className="project-summary-card project-summary-risk">
                <span>En riesgo</span>
                <strong>{projectsAtRisk}</strong>
              </div>
              <div className="project-summary-card project-summary-running">
                <span>Completando análisis</span>
                <strong>{runningAnalyses}</strong>
              </div>
            </section>

            {/* Grid of Projects */}
            <div className="project-card-grid">
              {projects.length === 0 ? (
                <div className="col-span-full report-empty-state">
                  <Globe className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-400 font-medium mb-1">No hay proyectos registrados</p>
                  <p className="text-slate-500 text-sm">Crea tu primer proyecto para comenzar a auditar</p>
                </div>
              ) : projects.map(p => {
                const lastScan = p.scans && p.scans.length > 0 ? p.scans[p.scans.length - 1] : null;
                const scoreMeta = getScoreMeta(lastScan?.globalScore);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setCurrentProject(p);
                      fetchProjectDetails(p.id);
                      setView('project');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setCurrentProject(p);
                        fetchProjectDetails(p.id);
                        setView('project');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="report-card-entity"
                    aria-label={`Ver detalles del proyecto ${p.name}`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-50 p-3 rounded-xl">
                          <Globe className="h-6 w-6 text-gob-blue" />
                        </div>
                        <div className="project-card-actions">
                          <span className="report-entity-badge">
                            {p.entityType}
                          </span>
                          <button
                            type="button"
                            className="report-neutral-icon-btn"
                            aria-label={`Editar proyecto ${p.name}`}
                            onClick={(event) => openEditProject(p, event)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="report-danger-icon-btn"
                            aria-label={`Eliminar proyecto ${p.name}`}
                            onClick={(event) => handleDeleteProject(p, event)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-gob-dark project-card-title group-hover:text-gob-blue transition-colors">{p.name}</h3>
                      <p className="text-slate-500 text-sm project-card-domain break-all">{p.domain || 'Sin URL principal'}</p>
                    </div>

                    <div className="project-card-meter border-t border-slate-100">
                      {renderScoreMeter(lastScan?.globalScore, 'Score promedio', 'compact', false)}

                      <div className="project-card-badges">
                        <span className={`project-compliance-badge project-compliance-${scoreMeta.tone}`}>
                          {scoreMeta.label}
                        </span>
                        <span className="project-vp-badge">Priorización (Vp)</span>
                        <span className={getVpCategory(lastScan?.vp || null).color}>
                          {getVpCategory(lastScan?.vp || null).label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Create Project */}
            {showCreateProject && (
              <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
                <div className="report-modal create-project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
                  <form onSubmit={handleCreateProject}>
                    <div className="create-project-modal-header">
                      <div>
                        <h3 id="create-project-title">Nuevo proyecto</h3>
                        <p>Agrupa auditorías de accesibilidad bajo una entidad, dominio y criterio de priorización.</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Cerrar modal de nuevo proyecto"
                        className="report-modal-close"
                        onClick={() => setShowCreateProject(false)}
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="create-project-modal-body">
                      <section className="create-project-section">
                        <div className="create-project-section-chip">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Datos básicos</span>
                        </div>
                        <div className="create-project-field">
                          <label htmlFor="new-project-name">Nombre del proyecto</label>
                          <input
                            id="new-project-name"
                            type="text"
                            required
                            placeholder="Ej. Municipalidad de Lima"
                            className="create-project-control"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                          />
                        </div>
                      </section>
                      <section className="create-project-section create-project-section-spaced">
                        <div className="create-project-section-chip">
                          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Clasificación institucional</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="project-classification-grid">
                          <div className="create-project-field">
                            <label htmlFor="new-project-entity-type">Tipo de entidad</label>
                            <div className="create-project-select-wrap">
                              <select
                                id="new-project-entity-type"
                                className="create-project-control"
                                value={newProjectEntityType}
                                onChange={e => setNewProjectEntityType(e.target.value)}
                              >
                                <option>Administración Pública Peruana</option>
                                <option>Gobierno Regional</option>
                                <option>Gobierno Local</option>
                                <option>Empresa pública FONAFE</option>
                                <option>Sector privado</option>
                              </select>
                            </div>
                            <p className="create-project-help">Define el contexto institucional usado para clasificar el proyecto.</p>
                          </div>
                          <div className="create-project-field">
                            <label htmlFor="new-project-vo">Tráfico (Visitas - Vo)</label>
                            <div className="create-project-select-wrap">
                              <select
                                id="new-project-vo"
                                className="create-project-control"
                                value={newProjectVo}
                                onChange={e => setNewProjectVo(parseInt(e.target.value))}
                              >
                                <option value="6">Alto (Vo = 6)</option>
                                <option value="4">Medio (Vo = 4)</option>
                                <option value="2">Bajo (Vo = 2)</option>
                              </select>
                            </div>
                            <p className="create-project-help">Este valor alimenta la priorización peruana del proyecto.</p>
                          </div>
                        </div>
                      </section>
                    </div>
                    <div className="create-project-modal-footer">
                      <button type="submit" className="create-project-submit">
                        Crear proyecto
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editingProject && (
              <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
                <div className="report-modal create-project-modal" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
                  <form onSubmit={handleUpdateProject}>
                    <div className="create-project-modal-header">
                      <div>
                        <h3 id="edit-project-title">Editar proyecto</h3>
                        <p>Actualiza los datos de clasificación y priorización del proyecto.</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Cerrar modal de edición de proyecto"
                        className="report-modal-close"
                        onClick={() => setEditingProject(null)}
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="create-project-modal-body">
                      <section className="create-project-section">
                        <div className="create-project-section-chip">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Datos básicos</span>
                        </div>
                        <div className="create-project-field">
                          <label htmlFor="edit-project-name">Nombre del proyecto</label>
                          <input
                            id="edit-project-name"
                            type="text"
                            required
                            className="create-project-control"
                            value={editProjectName}
                            onChange={e => setEditProjectName(e.target.value)}
                          />
                        </div>
                      </section>
                      <section className="create-project-section create-project-section-spaced">
                        <div className="create-project-section-chip">
                          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Clasificación institucional</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="create-project-field">
                            <label htmlFor="edit-project-entity-type">Tipo de entidad</label>
                            <div className="create-project-select-wrap">
                              <select
                                id="edit-project-entity-type"
                                className="create-project-control"
                                value={editProjectEntityType}
                                onChange={e => setEditProjectEntityType(e.target.value)}
                              >
                                <option>Administración Pública Peruana</option>
                                <option>Gobierno Regional</option>
                                <option>Gobierno Local</option>
                                <option>Empresa pública FONAFE</option>
                                <option>Sector privado</option>
                              </select>
                            </div>
                          </div>
                          <div className="create-project-field">
                            <label htmlFor="edit-project-vo">Tráfico (Visitas - Vo)</label>
                            <div className="create-project-select-wrap">
                              <select
                                id="edit-project-vo"
                                className="create-project-control"
                                value={editProjectVo}
                                onChange={e => setEditProjectVo(parseInt(e.target.value))}
                              >
                                <option value="6">Alto (Vo = 6)</option>
                                <option value="4">Medio (Vo = 4)</option>
                                <option value="2">Bajo (Vo = 2)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                    <div className="create-project-modal-footer">
                      <button type="submit" className="create-project-submit">
                        Guardar cambios
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: PROJECT DETAILS */}
        {view === 'project' && currentProject && (
          <div className="project-detail-surface report-surface">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setView('projects')}
                className="bg-white/10 hover:bg-white/20 border border-white/20 p-2.5 rounded-xl text-white/70 hover:text-white transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
<h2 className="text-2xl font-bold text-white">{currentProject.name}</h2>
                    <span className="report-project-vo-badge">
                    Vo = {currentProject.vo}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">{currentProject.domain || 'Sin URL principal registrada'}</p>
              </div>
            </div>

            <div className="project-detail-layout">
              {/* Left column: project metrics */}
              <div className="report-panel report-panel-spacious space-y-8">
                <h3 className="font-bold text-md text-gob-dark border-b border-slate-200 pb-3 uppercase tracking-wider text-xs">Métricas Legales</h3>
                
                <div className="legal-metrics-list">
                  <div className="legal-metric-item">
                    <span className="legal-metric-label">Clasificación</span>
                    <span className="legal-metric-value">{currentProject.entityType}</span>
                  </div>
                  <div className="legal-metric-item">
                    <span className="legal-metric-label">Norma Aplicable</span>
                    <span className="legal-metric-value">Resolución N° 001-2025-PCM/SGTD</span>
                  </div>
                  <div className="legal-metric-item">
                    <span className="legal-metric-label">Ley General</span>
                    <span className="legal-metric-value">Ley N° 29973 (Multas hasta 12 UIT)</span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowNewScan(true)}
                    className="w-full bg-gob-blue hover:bg-[#003a94] text-white font-medium py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-gob-blue/30"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Nuevo Análisis</span>
                </button>
              </div>

              {/* Right column: list of scans */}
              <div className="report-panel report-panel-spacious space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-gob-dark">Historial de Análisis</h3>
                  <div className="text-xs text-slate-500">Total: {currentProject.scans?.length || 0} análisis</div>
                </div>

                <div className="space-y-4">
                  {currentProject.scans?.map(scan => {
                    const progress = scanProgress[scan.id];
                    const isRunning = scan.status === 'running' || scan.status === 'pending';
                    
                    return (
                      <div 
                        key={scan.id}
                        onClick={() => {
                          if (!isRunning) {
                            fetchScanDetails(scan.id);
                            setView('scan');
                          }
                        }}
                        className={`scan-history-item ${isRunning ? 'scan-history-running pointer-events-none' : 'hover:border-gob-blue/30 hover:shadow-md cursor-pointer'}`}
                      >
                        <div className="space-y-1">
                          <div className="scan-history-title-row">
                            <div className="flex items-center space-x-2.5">
                              <span className="text-sm font-semibold text-gob-dark">Análisis {scan.scanMode}</span>
                              {renderStatusBadge(scan.status)}
                            </div>
                            {!isRunning && (
                              <button
                                type="button"
                                className="report-danger-icon-btn"
                                aria-label={`Eliminar análisis ${scan.scanMode}`}
                                onClick={(event) => handleDeleteScan(scan, event)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(scan.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {isRunning ? (
                          <div className="w-full max-w-xs space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-blue-900">
                              <span>Progreso del bot...</span>
                              <span>{progress || 0}%</span>
                            </div>
                            <div className="scan-progress-track">
                              <div className="scan-progress-fill" style={{ width: `${progress || 0}%` }}></div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-6">
                            {renderScoreMeter(scan.globalScore, 'Puntaje')}
                            <div className="text-right">
                              <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Priorización (Vp)</span>
                              <span className={getVpCategory(scan.vp).color}>
                                {getVpCategory(scan.vp).label} ({scan.vp})
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Trigger New Scan */}
            {showNewScan && (
              <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
                <div className="report-modal max-w-lg w-full space-y-6" role="dialog" aria-modal="true" aria-labelledby="new-scan-title">
                  <div className="flex justify-between items-center mb-2">
                    <h3 id="new-scan-title" className="text-xl font-bold text-gob-dark">Lanzar Auditoría</h3>
                    <button
                      type="button"
                      aria-label="Cerrar modal de nueva auditoría"
                      className="report-modal-close"
                      onClick={() => setShowNewScan(false)}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <form onSubmit={handleTriggerScan} className="space-y-4">
                    <div>
                      <label htmlFor="new-scan-urls" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">URLs a analizar (Una por línea o separadas por coma)</label>
                      <textarea 
                        id="new-scan-urls"
                        required
                        rows={4}
                        placeholder="https://www.munlima.gob.pe&#10;https://www.munlima.gob.pe/transparencia"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark placeholder-slate-400 focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                        value={newScanUrls}
                        onChange={e => setNewScanUrls(e.target.value)}
                      />
                      {parsedNewScanUrls.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-slate-500">
                            Abrir URL permite inspeccionar modales, términos o bloqueos. Las acciones en esa pestaña no se transfieren al navegador Playwright del escaneo.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {parsedNewScanUrls.map((url) => (
                              <button
                                key={url}
                                type="button"
                                className="report-ghost-btn text-xs"
                                onClick={() => openInspectionUrl(url)}
                              >
                                Abrir URL
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="new-scan-mode" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Modo del Análisis</label>
                        <select 
                          id="new-scan-mode"
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                          value={newScanMode}
                          onChange={e => setNewScanMode(e.target.value as any)}
                        >
                          <option value="estándar">Estándar (Desktop)</option>
                          <option value="profundo">Profundo (Desktop/Tablet/Mobile)</option>
                          <option value="rápido">Rápido (Simple viewport)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="new-scan-ux" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Impacto en Experiencia (Ux)</label>
                        <select 
                          id="new-scan-ux"
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                          value={newScanUx}
                          onChange={e => setNewScanUx(parseInt(e.target.value))}
                        >
                          <option value="6">Alta (Ux = 6)</option>
                          <option value="4">Media (Ux = 4)</option>
                          <option value="2">Baja (Ux = 2)</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      La preparación automática del sitio usa cierres seguros de modales comunes. Los scripts personalizados están deshabilitados para proteger el entorno de escaneo.
                    </div>

                    <button
                      type="submit"
                      className="w-full report-action-btn justify-center mt-6"
                      disabled={parsedNewScanUrls.length === 0}
                    >
                      Iniciar Escaneo
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

                {/* VIEW: SCAN ANALYSIS REPORT */}
        {view === 'scan' && currentScan && (
          <div className="report-shell">
            <aside className="report-sidebar">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Navegación Informe</div>
              {[
                { anchor: 'score', label: 'Score General', Icon: Gauge },
                { anchor: 'paginas', label: 'Páginas Auditadas', Icon: FileText },
                { anchor: 'criterios', label: 'Criterios y Hallazgos', Icon: TableProperties },
              ].map(({ anchor, label, Icon }) => (
                <a key={anchor} href={`#${anchor}`} className="report-side-link">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </a>
              ))}
            </aside>

            <div className="report-main-content report-section-stack">
              <section className="report-header-panel">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => {
                        if (currentProject) fetchProjectDetails(currentProject.id);
                        setView('project');
                      }}
                      className="report-ghost-btn"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                      <h2 className="report-title">Informe Técnico: {currentProject?.name}</h2>
                      <p className="report-subtitle">Auditoría realizada: {new Date(currentScan.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-8">
                    <button onClick={() => handleExport('pdf-executive')} className="report-action-btn"><Download className="h-4 w-4" />PDF Ejecutivo</button>
                    <button onClick={() => handleExport('pdf-technical')} className="report-action-btn"><Download className="h-4 w-4" />PDF Técnico</button>
                    <button onClick={() => handleExport('excel')} className="report-action-btn report-action-btn-green"><Download className="h-4 w-4" />Exportar Excel</button>
                  </div>
                </div>
                <div className="report-peru-badge">Resolución N° 001-2025-PCM/SGTD · Estándar Oficial Perú</div>
              </section>

              <section id="score" className="report-score-overview grid grid-cols-1 xl:grid-cols-5">
                <div className="xl:col-span-2 report-panel">
                  <p className="report-kicker">Cumplimiento Global</p>
                  {renderScoreMeter(currentScan.globalScore, 'Score técnico', 'large')}
                </div>

                <div className="xl:col-span-3 report-score-detail-grid grid md:grid-cols-2">
                  <div className="report-panel report-panel-spacious">
                    <p className="report-kicker">Fórmula de Priorización Peruana</p>
                    <p className="text-slate-700 font-semibold mt-1">(p = Vo({currentProject?.vo || 4}) + Ux({currentScan.ux})) / 16</p>
                    <p className="text-4xl font-black text-gob-blue mt-2">{currentScan.vp ?? 0}</p>
                    <span className={`${getVpCategory(currentScan.vp).color} mt-2`}>{getVpCategory(currentScan.vp).label}</span>
                  </div>
                  <div className="report-panel report-panel-spacious">
                    <p className="report-kicker">Criterios de Verificación</p>
                    <div className="grid md:grid-cols-3 gap-3 mt-3">
                      <div><p className="text-xs text-slate-500">Total de criterios</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.totalCriteria ?? 86}</p></div>
                      <div><p className="text-xs text-slate-500">Aplican al sitio</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.applicableCount ?? '-'}</p></div>
                      <div><p className="text-xs text-slate-500">Páginas Auditadas</p><p className="text-xl font-bold text-slate-900">{currentScan.urlResults?.length || 0}</p></div>
                    </div>
                    <details className="mt-4 report-checklist">
                      <summary>Ver checklist de 86 criterios</summary>
                      <div className="report-checklist-grid">
                        {(applicabilityRows.length > 0 ? applicabilityRows.map((row) => `${row.id} — ${row.nombre}`) : checklist86).map((item) => (
                          <span key={item} className="report-check-item">{item}</span>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </section>

              <section id="paginas" className="report-panel report-panel-spacious">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="report-section-title">Páginas Auditadas</h3>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {currentScan.urlResults?.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-slate-400 text-sm">No hay páginas auditadas</div>
                  ) : currentScan.urlResults?.map((ur) => (
                    <button key={ur.id} onClick={() => setSelectedUrlResult(ur)} className={`report-url-card ${selectedUrlResult?.id === ur.id ? 'report-url-card-active' : ''}`}>
                      <p className="font-mono text-xs text-slate-500 truncate text-left">{ur.url}</p>
                      <div className="mt-3 flex justify-between text-xs">
                        <span className="report-chip">Score {ur.score}</span>
                        <span className="text-slate-400">{ur.violations?.length || 0} hallazgos</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {selectedUrlResult && (
                <>
                  <section id="criterios" className="report-panel report-panel-spacious">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="report-section-title">Criterios WCAG y Hallazgos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {applicabilitySummary
                            ? `Aplican ${applicabilitySummary.applicableCount} de ${applicabilitySummary.totalCriteria} criterios a este sitio. Cumple ${applicabilitySummary.passedCount}.`
                            : 'Sin matriz de aplicabilidad para este resultado.'}
                        </p>
                      </div>
                      <label className="report-view-mode-control">
                        <span>Vista</span>
                        <select
                          aria-label="Cambiar vista de criterios WCAG"
                          className="report-table-filter"
                          value={criterionViewMode}
                          onChange={e => setCriterionViewMode(e.target.value as 'normal' | 'principles')}
                        >
                          <option value="normal">Orden normal</option>
                          <option value="principles">Por principios</option>
                        </select>
                      </label>
                    </div>

                    <div className="report-applicability-summary-row">
                      <div className="report-applicability-card">
                        <span>Total</span>
                        <strong>{applicabilitySummary?.totalCriteria ?? 86}</strong>
                      </div>
                      <div className="report-applicability-card">
                        <span>Aplican</span>
                        <strong>{applicabilitySummary?.applicableCount ?? 0}</strong>
                      </div>
                      <div className="report-applicability-card">
                        <span>Cumplen</span>
                        <strong>{applicabilitySummary?.passedCount ?? 0}</strong>
                      </div>
                      <div className="report-applicability-card">
                        <span>Fallan</span>
                        <strong>{applicabilitySummary?.failedCount ?? 0}</strong>
                      </div>
                      <div className="report-applicability-card">
                        <span>No aplican</span>
                        <strong>{applicabilitySummary?.notApplicableCount ?? 0}</strong>
                      </div>
                    </div>

                    <div className="report-table-scroll overflow-x-auto">
                      <table className="w-full report-table report-table-spacious" aria-label="Tabla unificada de criterios WCAG y hallazgos">
                        <thead>
                          <tr>
                            <th>Criterio</th>
                            <th>
                              <div className="report-table-header-cell">
                                <span className="report-table-filter-label">Nivel WCAG</span>
                                <select aria-label="Filtrar por nivel WCAG" className="report-table-filter" value={criterionLevelFilter} onChange={e => setCriterionLevelFilter(e.target.value)}>
                                  <option value="todos">Todos</option>
                                  <option value="A">A</option>
                                  <option value="AA">AA</option>
                                  <option value="AAA">AAA</option>
                                </select>
                              </div>
                            </th>
                            <th>
                              <div className="report-table-header-cell">
                                <span className="report-table-filter-label">Aplicabilidad</span>
                                <select aria-label="Filtrar por aplicabilidad" className="report-table-filter" value={criterionApplicabilityFilter} onChange={e => setCriterionApplicabilityFilter(e.target.value)}>
                                  <option value="todos">Todos</option>
                                  <option value="aplica">Aplica</option>
                                  <option value="no_aplica">No aplica</option>
                                </select>
                              </div>
                            </th>
                            <th>
                              <div className="report-table-header-cell">
                                <span className="report-table-filter-label">Resultado</span>
                                <select aria-label="Filtrar por resultado" className="report-table-filter" value={criterionResultFilter} onChange={e => setCriterionResultFilter(e.target.value)}>
                                  <option value="todos">Todos</option>
                                  <option value="cumple">Cumple</option>
                                  <option value="falla">Falla</option>
                                  <option value="na">N/A</option>
                                </select>
                              </div>
                            </th>
                            <th>Nombre</th>
                            <th>Razón</th>
                            <th>Hallazgos</th>
                            <th>
                              <div className="report-table-header-cell">
                                <span className="report-table-filter-label">Severidad</span>
                                <select aria-label="Filtrar por severidad" className="report-table-filter" value={criterionSeverityFilter} onChange={e => setCriterionSeverityFilter(e.target.value)}>
                                  <option value="todos">Todas</option>
                                  <option value="critico">Crítico</option>
                                  <option value="alto">Alto</option>
                                  <option value="medio">Medio</option>
                                  <option value="bajo">Bajo</option>
                                </select>
                              </div>
                            </th>
                            <th>Estado hallazgo</th>
                            <th>Evaluación manual</th>
                            <th>Vista evaluada</th>
                            <th>Descripción</th>
                            <th>Selector CSS</th>
                            <th>
                              <div className="report-table-header-cell">
                                <span className="report-table-filter-label">Rol</span>
                                <select aria-label="Filtrar por rol" className="report-table-filter" value={criterionRoleFilter} onChange={e => setCriterionRoleFilter(e.target.value)}>
                                  <option value="todos">Todos</option>
                                  <option value="Desarrollador">Desarrollador</option>
                                  <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                                  <option value="Redactor UX">Redactor UX</option>
                                  <option value="Compartido">Compartido</option>
                                </select>
                              </div>
                            </th>
                            <th>Solución sugerida</th>
                            <th>Evidencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredApplicabilityRows.length === 0 ? (
                            <tr>
                              <td colSpan={16} className="text-center text-slate-500">No hay criterios para el filtro seleccionado.</td>
                            </tr>
                          ) : groupedApplicabilityRows.map((item) => {
                            if (item.kind === 'principle') {
                              return (
                                <tr key={`principle-${item.key}`} className="report-principle-row">
                                  <td colSpan={16}>
                                    <div className="report-principle-row-content">
                                      <strong>{item.key === 'otros' ? item.title : `${item.key}. ${item.title}`}</strong>
                                      <span>{item.description}</span>
                                      <em>{item.count} criterio(s)</em>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            if (item.kind === 'guideline') {
                              return (
                                <tr key={`guideline-${item.key}`} className="report-guideline-row">
                                  <td colSpan={17}>
                                    <div className="report-guideline-row-content">
                                      <strong>{item.key === 'otros' ? item.title : `Pauta ${item.key}. ${item.title}`}</strong>
                                      <span>{item.description}</span>
                                      <em>{item.count} criterio(s)</em>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            const row = item.row;
                            const finding = row.primaryFinding;
                            return (
                              <React.Fragment key={item.key}>
                                <tr className="report-row-hover">
                                  <td>{row.id}</td>
                                  <td>{row.nivel}</td>
                                  <td>
                                    <select
                                      aria-label={`Editar aplicabilidad del criterio ${row.id}`}
                                      className="report-table-filter report-applicability-edit"
                                      value={row.estado}
                                      disabled={updatingCriterionId === row.id}
                                      onChange={e => handleApplicabilityUpdate(row.id, e.target.value as 'aplica' | 'no_aplica')}
                                    >
                                      <option value="aplica">Aplica</option>
                                      <option value="no_aplica">No aplica</option>
                                    </select>
                                  </td>
                                  <td>{row.estado === 'no_aplica' ? '' : <span className={`report-status-badge ${getApplicabilityStatusClass(row.uiStatus)}`}>{getApplicabilityStatusLabel(row.uiStatus)}</span>}</td>
                                  <td>{row.nombre}</td>
                                  <td>{row.razon}</td>
                                  <td>
                                    {row.estado === 'aplica' && row.findings.length > 0 ? `${row.findings.length} hallazgo(s)` : ''}
                                    {row.manualVerifications.length > 0 ? `${row.findings.length > 0 ? ' + ' : ''}${row.manualVerifications.length} manual` : ''}
                                  </td>
                                  <td>{finding ? <span className={`report-severity-chip ${
                                    finding.severity === 'crítico' || finding.severity === 'critico' || finding.severity === 'alto' ? 'report-sev-high' :
                                    finding.severity === 'medio' ? 'report-sev-medium' :
                                    'report-sev-low'
                                  }`}>{finding.severity}</span> : ''}</td>
                                  <td>{finding ? <span className={`report-status-badge ${getFindingStatusClass(finding)}`}>{getFindingStatusLabel(finding)}</span> : ''}</td>
                                  <td>
                                    {row.manualVerifications.length > 0 ? (
                                      <div className="report-manual-inline">
                                        {row.manualVerifications.map((manual) => (
                                          <label key={manual.id} className="report-manual-inline-item">
                                            <span>{manual.name}</span>
                                            <select
                                              className="report-table-filter"
                                              value={manual.status}
                                              onChange={(event) => handleManualVerificationUpdate(manual.id, event.target.value as 'pending' | 'approved' | 'failed' | 'not_applicable')}
                                            >
                                              <option value="pending">Pendiente</option>
                                              <option value="approved">Cumple</option>
                                              <option value="failed">No cumple</option>
                                              <option value="not_applicable">No aplica</option>
                                            </select>
                                            <small>{getManualStatusLabel(manual.status)}</small>
                                          </label>
                                        ))}
                                      </div>
                                    ) : ''}
                                  </td>
                                  <td>{finding ? finding.pageStateLabel || (finding.pageState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales') : ''}</td>
                                  <td>{finding?.description || row.manualVerifications.map((manual) => manual.description).join(' | ')}</td>
                                  <td>{finding ? <code className="report-code">{finding.selector}</code> : ''}</td>
                                  <td>{finding?.role || ''}</td>
                                  <td>{finding?.suggestedFix || ''}</td>
                                  <td>
                                    {row.findings.length > 0 ? (
                                      <button onClick={() => setExpandedCriterionId(expandedCriterionId === row.id ? null : row.id)} className="report-evidence-btn">
                                        {expandedCriterionId === row.id ? 'Ocultar' : 'Ver'}
                                      </button>
                                    ) : ''}
                                  </td>
                                </tr>
                                {expandedCriterionId === row.id && row.findings.length > 0 && (
                                  <tr>
                                      <td colSpan={16} className="report-evidence-cell">
                                      <div className="space-y-4">
                                        {row.findings.map((item, itemIndex) => (
                                          <div key={`${row.id}-${itemIndex}`} className="grid md:grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-xs font-bold text-slate-500 mb-2">{item.pageStateLabel || (item.pageState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales')} · {getFindingStatusLabel(item)}</p>
                                              <pre className="report-html-block"><code>{item.elementHtml}</code></pre>
                                            </div>
                                            {item.screenshotUrl ? (
                                              <EvidencePreview url={item.screenshotUrl} />
                                            ) : (
                                              <div className="report-no-evidence">Sin evidencia visual disponible</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
                )}
      </main>
    </div>
  );
}













