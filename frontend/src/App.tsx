import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Shield, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  ArrowLeft,
  Settings,
  Check,
  X,
  RefreshCw,
  Lock,
  Globe,
  FileText,
  Gauge,
  ListChecks,
  TableProperties
} from 'lucide-react';
import type { Project, Scan, UrlResult } from './types';

const API_BASE_URL = 'http://localhost:3000';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentScan, setCurrentScan] = useState<Scan | null>(null);
  const [selectedUrlResult, setSelectedUrlResult] = useState<UrlResult | null>(null);
  
  const [view, setView] = useState<'projects' | 'project' | 'scan'>('projects');
  
  // Modals / Forms
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showNewScan, setShowNewScan] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');
  const [newProjectVo, setNewProjectVo] = useState(4); // default Media
  const [newProjectEntityType, setNewProjectEntityType] = useState('Sector privado');
  
  const [newScanUrls, setNewScanUrls] = useState('');
  const [newScanMode, setNewScanMode] = useState<'rápido' | 'estándar' | 'profundo'>('estándar');
  const [newScanUx, setNewScanUx] = useState(4); // default Media
  const [preNavigationScript, setPreNavigationScript] = useState('');

  // Filters for violations
  const [filterRole, setFilterRole] = useState<string>('todos');
  const [filterLevel] = useState<string>('todos');
  const [filterSeverity, setFilterSeverity] = useState<string>('todos');
  const [expandedViolationIndex, setExpandedViolationIndex] = useState<number | null>(null);
  
  // Realtime scan progress state
  const [scanProgress, setScanProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProjects();

    // Setup Socket.io for real-time progress
    const socket = io(API_BASE_URL);
    
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
      if (currentProject) fetchProjectDetails(currentProject.id);
      fetchProjects();
    });

    return () => {
      socket.disconnect();
    };
  }, [currentProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchProjectDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}`);
      const data = await res.json();
      setCurrentProject(data);
    } catch (err) {
      console.error('Error fetching project details:', err);
    }
  };

  const fetchScanDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/scans/${id}`);
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
      console.error('Error fetching scan details:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          domain: newProjectDomain,
          vo: newProjectVo,
          entityType: newProjectEntityType
        })
      });
      if (res.ok) {
        setShowCreateProject(false);
        setNewProjectName('');
        setNewProjectDomain('');
        fetchProjects();
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleTriggerScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    // Parse URLs from text input (split by line or comma)
    const urls = newScanUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    try {
      const res = await fetch(`${API_BASE_URL}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          urls,
          scanMode: newScanMode,
          ux: newScanUx,
          preNavigationScript: preNavigationScript || undefined
        })
      });
      if (res.ok) {
        setShowNewScan(false);
        setNewScanUrls('');
        setPreNavigationScript('');
        // Refresh project details
        setTimeout(() => fetchProjectDetails(currentProject.id), 500);
      }
    } catch (err) {
      console.error('Error triggering scan:', err);
    }
  };

  const handleManualVerificationUpdate = async (verificationId: string, status: string) => {
    if (!selectedUrlResult) return;
    try {
      const res = await fetch(`${API_BASE_URL}/url-results/${selectedUrlResult.id}/manual-verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, status })
      });
      if (res.ok) {
        const updatedResult = await res.json();
        setSelectedUrlResult(updatedResult);
        // also refresh current scan to update global UI state
        if (currentScan) fetchScanDetails(currentScan.id);
      }
    } catch (err) {
      console.error('Error updating manual verification:', err);
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
        endpoint = `${API_BASE_URL}/reports/${currentScan.id}/pdf?type=executive`;
        filename = `reporte-ejecutivo-${currentScan.id}.pdf`;
      } else if (kind === 'pdf-technical') {
        endpoint = `${API_BASE_URL}/reports/${currentScan.id}/pdf?type=technical`;
        filename = `reporte-tecnico-${currentScan.id}.pdf`;
      } else {
        endpoint = `${API_BASE_URL}/reports/${currentScan.id}/excel`;
        filename = `reporte-accesibilidad-${currentScan.id}.xlsx`;
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      downloadFile(blob, filename);
    } catch (err) {
      console.error('Error exporting report:', err);
      window.alert('No se pudo exportar el reporte. Intente nuevamente.');
    }
  };

  // Helper to determine Vp category
  const getVpCategory = (vpValue: number | null) => {
    if (!vpValue) return { label: 'Bajo', color: 'bg-green-100 text-green-800 border-green-200' };
    if (vpValue >= 24) return { label: 'Prioridad Alta', color: 'bg-red-100 text-red-800 border-red-200' };
    if (vpValue >= 12) return { label: 'Prioridad Media', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'Prioridad Baja', color: 'bg-green-100 text-green-800 border-green-200' };
  };

  // Helper to determine Sello de Accesibilidad eligibility
  const checkSelloEligibility = (scan: Scan | null) => {
    if (!scan || !scan.globalScore) return { eligible: false, message: 'Falta completar el análisis' };
    
    // Sello conditions:
    // 1. WCAG compliance score >= 90
    // 2. All critical violations solved (score penalty depends on this)
    // 3. Manual validations approved (no pending status)
    const hasPendingManual = scan.urlResults?.some(ur => 
      ur.manualVerifications?.some(mv => mv.status === 'pending')
    );

    if (scan.globalScore < 90) {
      return { eligible: false, message: 'Puntaje de accesibilidad menor a 90' };
    }
    if (hasPendingManual) {
      return { eligible: false, message: 'Requiere completar las verificaciones manuales' };
    }
    
    return { eligible: true, message: '¡Cumple con las condiciones para el Sello!' };
  };

  const checklist83 = Array.from({ length: 83 }, (_, i) => {
    const n = i + 1;
    return `Criterio ${n.toString().padStart(2, '0')} — WCAG 2.2`;
  });

  return (
    <div className="min-h-screen text-slate-900 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide text-white">Plataforma de Accesibilidad Web</h1>
            <p className="text-xs text-white/70">Resolución N° 001-2025-PCM/SGTD — Estándar Oficial Perú</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="px-3 py-1 bg-white/10 backdrop-blur text-white/90 border border-white/20 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1">
            <span className="h-2 w-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
            <span>Normativa Peruana 2026</span>
          </div>
          <Settings className="h-5 w-5 text-white/60 hover:text-white cursor-pointer transition-colors" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* VIEW: PROJECTS OVERVIEW */}
        {view === 'projects' && (
          <div className="space-y-6 report-surface">
            <div className="flex justify-between items-center">
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

            {/* Grid of Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.length === 0 ? (
                <div className="col-span-full report-empty-state">
                  <Globe className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-400 font-medium mb-1">No hay proyectos registrados</p>
                  <p className="text-slate-500 text-sm">Crea tu primer proyecto para comenzar a auditar</p>
                </div>
              ) : projects.map(p => {
                const lastScan = p.scans && p.scans.length > 0 ? p.scans[p.scans.length - 1] : null;
                return (
                  <div 
                    key={p.id}
                    onClick={() => {
                      setCurrentProject(p);
                      fetchProjectDetails(p.id);
                      setView('project');
                    }}
                    className="report-card-entity"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-50 p-3 rounded-xl">
                          <Globe className="h-6 w-6 text-gob-blue" />
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
                          {p.entityType}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-gob-dark mb-1 group-hover:text-gob-blue transition-colors">{p.name}</h3>
                      <p className="text-slate-500 text-sm mb-4 break-all">{p.domain}</p>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-xs text-slate-400 uppercase block tracking-wider font-semibold">Score Promedio</span>
                        <span className="text-2xl font-black text-gob-dark">
                          {lastScan?.globalScore !== null ? `${lastScan?.globalScore}/100` : 'N/A'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Priorización (Vp)</span>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getVpCategory(lastScan?.vp || null).color}`}>
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
              <div className="fixed inset-0 bg-gob-dark/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="report-modal">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-gob-dark">Añadir Proyecto</h3>
                    <X className="h-5 w-5 cursor-pointer text-slate-400 hover:text-gob-dark transition-colors" onClick={() => setShowCreateProject(false)} />
                  </div>
                  <form onSubmit={handleCreateProject} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Nombre del Proyecto</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. Municipalidad de Lima"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark placeholder-slate-400 focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Dominio / URL Principal</label>
                      <input 
                        type="text" 
                        required
                        placeholder="https://www.munlima.gob.pe"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark placeholder-slate-400 focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                        value={newProjectDomain}
                        onChange={e => setNewProjectDomain(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Tipo de Entidad</label>
                        <select 
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
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
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Tráfico (Visitas - Vo)</label>
                        <select 
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                          value={newProjectVo}
                          onChange={e => setNewProjectVo(parseInt(e.target.value))}
                        >
                          <option value="6">Alto (Vo = 6)</option>
                          <option value="4">Medio (Vo = 4)</option>
                          <option value="2">Bajo (Vo = 2)</option>
                        </select>
                      </div>
                    </div>
<button type="submit" className="w-full report-action-btn justify-center mt-6">
                      Crear Proyecto
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: PROJECT DETAILS */}
        {view === 'project' && currentProject && (
          <div className="space-y-6 report-surface">
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
                  <span className="text-xs bg-white/10 border border-white/20 text-white/80 px-3 py-0.5 rounded-full">
                    Vo = {currentProject.vo}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">{currentProject.domain}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: project metrics */}
              <div className="report-panel report-panel-spacious space-y-8">
                <h3 className="font-bold text-md text-gob-dark border-b border-slate-200 pb-3 uppercase tracking-wider text-xs">Métricas Legales</h3>
                
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Clasificación</span>
                    <span className="text-lg font-bold text-gob-dark">{currentProject.entityType}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Norma Aplicable</span>
                    <span className="text-sm text-slate-600">Resolución N° 001-2025-PCM/SGTD</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Ley General</span>
                    <span className="text-sm text-slate-600">Ley N° 29973 (Multas hasta 12 UIT)</span>
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
              <div className="lg:col-span-2 report-panel report-panel-spacious space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-gob-dark">Historial de Análisis</h3>
                  <div className="text-xs text-slate-500">Total: {currentProject.scans?.length || 0} análisis</div>
                </div>

                <div className="space-y-6">
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
                        className={`bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between transition-all ${isRunning ? 'opacity-85 pointer-events-none' : 'hover:border-gob-blue/30 hover:shadow-md cursor-pointer'}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-sm font-semibold text-gob-dark">Análisis {scan.scanMode}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
scan.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                              scan.status === 'failed' ? 'bg-red-100 text-red-800 border-red-300' :
                              'bg-blue-100 text-blue-800 border-blue-300 animate-pulse'
                            }`}>
                              {scan.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(scan.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {isRunning ? (
                          <div className="w-1/3 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-blue-400">
                              <span>Progreso del bot...</span>
                              <span>{progress || 0}%</span>
                            </div>
<div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-gob-blue h-full transition-all duration-300" style={{ width: `${progress || 0}%` }}></div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Puntaje</span>
                              <span className="text-lg font-bold text-gob-dark">{scan.globalScore !== null ? `${scan.globalScore}/100` : 'Failed'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 uppercase block tracking-wider font-semibold">Priorización (Vp)</span>
                              <span className={`text-xs px-2 py-0.5 rounded border inline-block ${getVpCategory(scan.vp).color}`}>
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
              <div className="fixed inset-0 bg-gob-dark/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="report-modal max-w-lg w-full space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-gob-dark">Lanzar Auditoría</h3>
                    <X className="h-5 w-5 cursor-pointer text-slate-400 hover:text-gob-dark transition-colors" onClick={() => setShowNewScan(false)} />
                  </div>
                  <form onSubmit={handleTriggerScan} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">URLs a analizar (Una por línea)</label>
                      <textarea 
                        required
                        rows={4}
                        placeholder="https://www.munlima.gob.pe&#10;https://www.munlima.gob.pe/transparencia"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark placeholder-slate-400 focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                        value={newScanUrls}
                        onChange={e => setNewScanUrls(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Modo del Análisis</label>
                        <select 
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
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Impacto en Experiencia (Ux)</label>
                        <select 
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

                    <div>
                      <div className="flex items-center space-x-1.5 mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Script de Pre-Navegación</label>
                        <Lock className="h-3 w-3 text-slate-500" />
                      </div>
                      <textarea 
                        rows={3}
                        placeholder="() => { document.querySelector('#user').value = 'admin'; ... }"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-gob-dark placeholder-slate-400 font-mono text-xs focus:outline-none focus:border-gob-blue focus:ring-2 focus:ring-gob-blue/10"
                        value={preNavigationScript}
                        onChange={e => setPreNavigationScript(e.target.value)}
                      />
                    </div>

<button type="submit" className="w-full report-action-btn justify-center mt-6">
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
            <aside className="hidden lg:flex lg:w-64 lg:flex-col report-sidebar">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Navegación Informe</div>
              {[
                { anchor: 'score', label: 'Score General', Icon: Gauge },
                { anchor: 'paginas', label: 'Páginas Auditadas', Icon: FileText },
                { anchor: 'manual', label: 'Evaluación Manual', Icon: ListChecks },
                { anchor: 'violaciones', label: 'Violaciones', Icon: TableProperties },
              ].map(({ anchor, label, Icon }) => (
                <a key={anchor} href={`#${anchor}`} className="report-side-link">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </a>
              ))}
            </aside>

            <div className="flex-1 space-y-6">
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

              <section id="score" className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-2 report-panel">
                  <p className="report-kicker">Cumplimiento Global</p>
                  <p className="report-score-number">{currentScan.globalScore ?? 0}%</p>
                </div>

                <div className="xl:col-span-3 grid md:grid-cols-2 gap-4">
                  <div className="report-panel report-panel-spacious">
                    <p className="report-kicker">Fórmula de Priorización Peruana</p>
                    <p className="text-slate-700 font-semibold mt-1">(p = Vo({currentProject?.vo || 4}) + Ux({currentScan.ux})) / 16</p>
                    <p className="text-4xl font-black text-gob-blue mt-2">{currentScan.vp ?? 0}</p>
                    <span className="report-chip mt-2 inline-flex">{getVpCategory(currentScan.vp).label}</span>
                  </div>
                  <div className="report-panel report-panel-spacious">
                    <p className="report-kicker">Sello de Accesibilidad PCM</p>
                    <div className="flex items-center gap-2 mt-2">
                      {checkSelloEligibility(currentScan).eligible ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                      <strong className="text-slate-900">{checkSelloEligibility(currentScan).eligible ? 'Elegible' : 'No Elegible'}</strong>
                    </div>
                    <p className="text-slate-400 text-sm mt-2">{checkSelloEligibility(currentScan).message}</p>
                  </div>
                  <div className="report-panel md:col-span-2">
                    <p className="report-kicker">Criterios de Verificación</p>
                    <div className="grid md:grid-cols-3 gap-3 mt-3">
                      <div><p className="text-xs text-slate-500">Total Evaluados</p><p className="text-xl font-bold text-slate-900">83</p></div>
                      <div><p className="text-xs text-slate-500">Estándar Aplicado</p><p className="text-xl font-bold text-slate-900">WCAG 2.2 AA/AAA</p></div>
                      <div><p className="text-xs text-slate-500">Páginas Auditadas</p><p className="text-xl font-bold text-slate-900">{currentScan.urlResults?.length || 0}</p></div>
                    </div>
                    <details className="mt-4 report-checklist">
                      <summary>Ver checklist de 83 criterios</summary>
                      <div className="report-checklist-grid">
                        {checklist83.map((item) => (
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
                        <span className="text-slate-400">{ur.violations?.length || 0} violaciones</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {selectedUrlResult && (
                <>
                  <section id="manual" className="report-panel report-panel-spacious">
                    <h3 className="report-section-title mb-3">Evaluación Semiautomática Manual</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {selectedUrlResult.manualVerifications?.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-slate-400 text-sm">No hay verificaciones manuales pendientes</div>
                      ) : selectedUrlResult.manualVerifications?.map((mv) => (
                        <div key={mv.id} className="report-manual-card">
                          <div className="flex justify-between gap-2">
                            <p className="text-sm text-gob-dark font-bold">Criterio {mv.criterion}: {mv.name}</p>
                            <span className={`report-status-badge ${
                              mv.status === 'approved' ? 'report-status-approved' :
                              mv.status === 'failed' ? 'report-status-failed' :
                              'report-status-pending'
                            }`}>{mv.status}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">{mv.description}</p>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button onClick={() => handleManualVerificationUpdate(mv.id, 'approved')} className="report-approve-btn"><Check className="h-4 w-4" />Aprobar</button>
                            <button onClick={() => handleManualVerificationUpdate(mv.id, 'failed')} className="report-reject-btn"><X className="h-4 w-4" />Rechazar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section id="violaciones" className="report-panel report-panel-spacious">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="report-section-title">Violaciones Detectadas ({selectedUrlResult.violations?.length || 0})</h3>
                      <div className="flex gap-2">
                        <select className="report-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                          <option value="todos">Rol: Todos</option>
                          <option value="Desarrollador">Desarrollador</option>
                          <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                          <option value="Redactor UX">Redactor UX</option>
                        </select>
                        <select className="report-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                          <option value="todos">Severidad: Todas</option>
                          <option value="crítico">Alto / Crítico</option>
                          <option value="alto">Alto</option>
                          <option value="medio">Medio</option>
                          <option value="bajo">Bajo</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full report-table report-table-spacious">
                        <thead>
                          <tr>
                            <th>Criterio</th>
                            <th>Nivel</th>
                            <th>Descripción</th>
                            <th>Selector CSS</th>
                            <th>Rol</th>
                            <th>Solución sugerida</th>
                            <th>Artículo legal</th>
                            <th>Evidencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUrlResult.violations
                            ?.filter(v => (filterRole === 'todos' || v.role === filterRole || v.role === 'Compartido') &&
                              (filterLevel === 'todos' || v.level === filterLevel) &&
                              (filterSeverity === 'todos' || v.severity === filterSeverity || (filterSeverity === 'crítico' && v.severity === 'crítico')))
                            .map((violation, index) => (
                              <React.Fragment key={index}>
                                <tr className="report-row-hover">
                                  <td>{violation.criterion}</td>
                                  <td><span className={`report-severity-chip ${
                                    violation.severity === 'crítico' || violation.severity === 'alto' ? 'report-sev-high' :
                                    violation.severity === 'medio' ? 'report-sev-medium' :
                                    'report-sev-low'
                                  }`}>{violation.severity}</span></td>
                                  <td>{violation.description}</td>
                                  <td><code className="report-code">{violation.selector}</code></td>
                                  <td>{violation.role}</td>
                                  <td>{violation.suggestedFix}</td>
                                  <td>{violation.resolutionArticle}</td>
                                  <td>
                                    <button onClick={() => setExpandedViolationIndex(expandedViolationIndex === index ? null : index)} className="report-evidence-btn">
                                      {expandedViolationIndex === index ? 'Ocultar' : 'Ver'}
                                    </button>
                                  </td>
                                </tr>
                                {expandedViolationIndex === index && (
                                  <tr>
                                    <td colSpan={8} className="report-evidence-cell">
                                      <div className="grid md:grid-cols-2 gap-4">
                                        <pre className="report-html-block"><code>{violation.elementHtml}</code></pre>
                                        {violation.screenshotUrl ? (
                                          <a href={violation.screenshotUrl} target="_blank" rel="noreferrer" className="report-evidence-link">
                                            <img src={violation.screenshotUrl} alt="Evidencia visual" className="w-full rounded-lg border border-slate-200" />
                                          </a>
                                        ) : (
                                          <div className="report-no-evidence">Sin evidencia visual disponible</div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
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









