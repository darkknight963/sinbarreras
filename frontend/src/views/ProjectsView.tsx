import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  Globe,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

interface ProjectsViewProps {
  projects: any[];
  averageScore: number;
  projectsAtRisk: number;
  runningAnalyses: number;
  onCreateClick: () => void;
  canCreateProjects: boolean;
  canUsePaidFeatures: boolean;
  showLockedCreateProject: boolean;
  onViewPlans: () => void;
  onExportScan: (scan: any, kind: 'pdf-executive' | 'pdf-technical' | 'excel') => void;
  onProjectClick: (project: any) => void;
  onEditProject: (project: any, event: React.MouseEvent) => void;
  onDeleteProject: (project: any, event: React.MouseEvent) => void;
  showCreateProject: boolean;
  onCloseCreateProject: () => void;
  onCreateProject: (e: React.FormEvent) => void;
  newProjectName: string;
  onNewProjectNameChange: (value: string) => void;
  newProjectEntityType: string;
  onNewProjectEntityTypeChange: (value: string) => void;
  editingProject: any | null;
  onCloseEditProject: () => void;
  onUpdateProject: (e: React.FormEvent) => void;
  editProjectName: string;
  onEditProjectNameChange: (value: string) => void;
  editProjectEntityType: string;
  onEditProjectEntityTypeChange: (value: string) => void;
  getScoreMeta: (score: number | null | undefined) => { value: number; tone: string; label: string };
}
export function ProjectsView({
  projects,
  averageScore,
  projectsAtRisk,
  runningAnalyses,
  onCreateClick,
  canCreateProjects,
  showLockedCreateProject,
  onViewPlans,
  onProjectClick,
  onEditProject,
  onDeleteProject,
  showCreateProject,
  onCloseCreateProject,
  onCreateProject,
  newProjectName,
  onNewProjectNameChange,
  newProjectEntityType,
  onNewProjectEntityTypeChange,
  editingProject,
  onCloseEditProject,
  onUpdateProject,
  editProjectName,
  onEditProjectNameChange,
  editProjectEntityType,
  onEditProjectEntityTypeChange,
  getScoreMeta,
}: ProjectsViewProps) {
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'public' | 'private'>('all');
  const lawLabel = 'Ley Nro. 29973 (Perú)';
  const allScans = projects.flatMap((project) => project.scans || []);
  const latestScan = allScans
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
  const completedAnalyses = allScans.filter((scan) => scan.status === 'completed').length;
  const hasAnyScans = allScans.length > 0;
  const filteredProjects = projects.filter((project) => {
    const entityType = String(project.entityType || '').toLowerCase();
    const isPrivate = entityType.includes('privado');
    if (projectFilter === 'private') return isPrivate;
    if (projectFilter === 'public') return !isPrivate;
    return true;
  });

  const formatRelativeScanTime = (createdAt?: string) => {
    if (!createdAt) return 'Sin análisis';
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return 'Sin análisis';
    const minutes = Math.max(1, Math.round((Date.now() - created) / 60000));
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.round(hours / 24);
    return `Hace ${days} d`;
  };

  useEffect(() => {
    if (!showCreateProject) return;
    setNewProjectDescription('');
  }, [showCreateProject]);

  const closeCreateProject = () => {
    onCloseCreateProject();
  };

  return (
    <div className="report-surface project-overview-surface page-entrance">
      <div className="project-overview-header">
        <div>
          <span className="project-overview-kicker">Panel de auditoría</span>
          <h2 className="text-2xl font-bold text-white">Proyectos Digitales</h2>
          <p className="text-slate-800 text-sm">Monitorea y gestiona el cumplimiento de accesibilidad de los servicios públicos o privados.</p>
        </div>
        {canCreateProjects ? (
          <button
            onClick={onCreateClick}
            className="report-action-btn project-create-btn"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo proyecto</span>
          </button>
        ) : showLockedCreateProject ? (
          <button
            type="button"
            onClick={onViewPlans}
            className="report-action-btn project-create-btn project-create-btn-locked"
            aria-label="Nuevo proyecto bloqueado. Disponible en Pro y Enterprise"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>Nuevo proyecto</span>
            <small>Pro / Enterprise</small>
          </button>
        ) : null}
      </div>

      <section className="project-summary-grid" aria-label="Métricas globales de proyectos">
        <div className="project-summary-card">
          <div className="project-summary-icon" aria-hidden="true">
            <Globe className="h-5 w-5" />
          </div>
          <span>Total de proyectos</span>
          <strong>{projects.length}</strong>
          <small>{projects.length === 0 ? 'Sin proyectos aún' : 'Proyectos activos'}</small>
        </div>
        <div className="project-summary-card">
          <div className="project-summary-icon project-summary-icon-success" aria-hidden="true">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span>Cumplimiento global</span>
          <strong>{hasAnyScans ? `${averageScore}/100` : '—'}</strong>
          <small>{hasAnyScans ? (averageScore < 70 ? 'requiere atención' : 'en buen rango') : 'Pendiente de análisis'}</small>
          <div className="project-summary-bar">
            <div style={{ width: `${hasAnyScans ? averageScore : 0}%` }} />
          </div>
        </div>
        <div className="project-summary-card project-summary-risk">
          <div className="project-summary-icon project-summary-icon-risk" aria-hidden="true">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <span>En riesgo</span>
          <strong>{projectsAtRisk}</strong>
          <small>{projectsAtRisk === 0 ? 'sin alertas críticas' : 'errores críticos'}</small>
        </div>
        <div className="project-summary-card project-summary-running">
          <span>Completando análisis</span>
          <div className="project-summary-icon project-summary-icon-running" aria-hidden="true">
            <Clock3 className="h-5 w-5" />
          </div>
          <strong>{latestScan ? formatRelativeScanTime(latestScan.createdAt) : '—'}</strong>
          <small>{runningAnalyses > 0 ? `${runningAnalyses} en progreso` : `${completedAnalyses} completados`}</small>
        </div>
      </section>

      <div className="project-list-toolbar">
        <h3>Mis proyectos</h3>
        <div className="project-filter-tabs" role="group" aria-label="Filtros de proyectos">
          <button
            type="button"
            className={projectFilter === 'all' ? 'project-filter-active' : undefined}
            aria-pressed={projectFilter === 'all'}
            onClick={() => setProjectFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={projectFilter === 'public' ? 'project-filter-active' : undefined}
            aria-pressed={projectFilter === 'public'}
            onClick={() => setProjectFilter('public')}
          >
            Público
          </button>
          <button
            type="button"
            className={projectFilter === 'private' ? 'project-filter-active' : undefined}
            aria-pressed={projectFilter === 'private'}
            onClick={() => setProjectFilter('private')}
          >
            Privado
          </button>
        </div>
      </div>

      <div className="project-card-grid">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full report-empty-state project-empty-card">
            <span className="project-empty-icon" aria-hidden="true">
              <FolderOpen className="h-7 w-7" />
            </span>
            <h3 className="project-empty-title">
              {projects.length === 0 ? 'No hay proyectos registrados' : 'No hay proyectos en este filtro'}
            </h3>
            <p className="project-empty-description">
              {projects.length === 0
                ? 'Organiza tus auditorías, centraliza los hallazgos y consulta el avance de cada sitio desde un solo lugar.'
                : 'Cambia el filtro o crea un proyecto con otra clasificación.'}
            </p>
            {projects.length === 0 && (
              <div className="project-empty-actions">
                {canCreateProjects ? (
                  <button type="button" onClick={onCreateClick} className="report-action-btn project-create-btn project-empty-primary">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Crear primer proyecto</span>
                  </button>
                ) : showLockedCreateProject ? (
                  <button type="button" onClick={onViewPlans} className="report-action-btn project-create-btn project-empty-primary">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    <span>Crear primer proyecto</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : filteredProjects.map(p => {
          const lastScan = p.scans && p.scans.length > 0 ? p.scans[p.scans.length - 1] : null;
          const scoreMeta = getScoreMeta(lastScan?.globalScore);
          const scanCount = p.scans?.length || 0;
          const projectStatusClass = lastScan ? `project-card-${scoreMeta.tone}` : 'project-card-pending';
          return (
            <article
              key={p.id}
              className={`report-card-entity project-card-clickable ${projectStatusClass}`}
              aria-labelledby={`project-title-${p.id}`}
              role="button"
              tabIndex={0}
              onClick={() => onProjectClick(p)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onProjectClick(p);
                }
              }}
            >
              <div>
                <div className="project-card-top">
                  <div className="project-card-icon">
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
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditProject(p, event);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="report-danger-icon-btn"
                      aria-label={`Eliminar proyecto ${p.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteProject(p, event);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="project-card-main-copy">
                  <h3 id={`project-title-${p.id}`} className="font-bold text-lg text-gob-dark project-card-title group-hover:text-gob-blue transition-colors">{p.name}</h3>
                  <p className="text-slate-500 text-sm project-card-domain">
                    {scanCount > 0 ? `${scanCount} análisis guardado${scanCount === 1 ? '' : 's'}` : 'Listo para iniciar escaneos'}
                  </p>
                </div>
                <div className="project-card-meta-row">
                  <span>
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Carpeta de auditorías
                  </span>
                  <span>
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {lastScan ? formatRelativeScanTime(lastScan.createdAt) : 'Sin análisis'}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {showCreateProject && (
        <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
          <div className="report-modal create-project-modal create-project-direct" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <form onSubmit={onCreateProject} className="create-project-standard-form">
              <div className="create-project-modal-header">
                <div className="create-project-modal-header-copy">
                  <div className="create-project-modal-kicker">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Nuevo proyecto</span>
                  </div>
                  <h3 id="create-project-title">Configura tu proyecto</h3>
                  <p>Agrupa auditorías de accesibilidad bajo un nombre, entidad y ley aplicable.</p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar modal de nuevo proyecto"
                  className="report-modal-close"
                  onClick={closeCreateProject}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="create-project-modal-body">
                <div className="create-project-form-stack create-project-direct-stack">
                  <section className="create-project-section">
                    <div className="create-project-section-chip">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Información del proyecto</span>
                    </div>
                    <div className="create-project-field">
                      <label htmlFor="new-project-name">Nombre del proyecto</label>
                      <input
                        id="new-project-name"
                        type="text"
                        required
                        autoComplete="organization"
                        placeholder="Ej. Municipalidad de Lima"
                        className="create-project-control"
                        value={newProjectName}
                        onChange={e => onNewProjectNameChange(e.target.value)}
                        aria-describedby="new-project-name-help"
                      />
                      <p id="new-project-name-help" className="create-project-help">Este nombre aparecerá en todos tus reportes y exportaciones.</p>
                    </div>
                    <div className="create-project-field">
                      <div className="create-project-label-row">
                        <label htmlFor="new-project-description">Descripción</label>
                        <span>Opcional</span>
                      </div>
                      <textarea
                        id="new-project-description"
                        className="create-project-control create-project-textarea"
                        placeholder="Describe el alcance o contexto del proyecto..."
                        value={newProjectDescription}
                        onChange={e => setNewProjectDescription(e.target.value)}
                      />
                    </div>
                    <div className="create-project-grid" data-testid="project-classification-grid">
                      <div className="create-project-field">
                        <label htmlFor="new-project-entity-type">Tipo de entidad</label>
                        <div className="create-project-select-wrap">
                          <select
                            id="new-project-entity-type"
                            className="create-project-control"
                            value={newProjectEntityType}
                            onChange={e => onNewProjectEntityTypeChange(e.target.value)}
                          >
                            <option value="Sector público">Sector público</option>
                            <option value="Sector privado">Sector privado</option>
                          </select>
                          <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="create-project-field">
                        <label htmlFor="new-project-law">Ley general aplicable</label>
                        <div className="create-project-select-wrap">
                          <select id="new-project-law" className="create-project-control" value={lawLabel} onChange={() => undefined}>
                            <option>{lawLabel}</option>
                          </select>
                          <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                    <div className="create-project-info-note">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <p>El tipo de entidad y la ley aplicable determinan el nivel de cumplimiento exigido y las multas de referencia en los reportes.</p>
                    </div>
                  </section>
                </div>
              </div>
              <div className="create-project-modal-footer create-project-direct-footer">
                <div className="create-project-footer-actions">
                  <button type="button" className="report-ghost-btn create-project-cancel" onClick={closeCreateProject}>
                    Cancelar
                  </button>
                  <button type="submit" className="create-project-submit" disabled={!newProjectName.trim()}>
                    Crear proyecto
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProject && (
        <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
          <div className="report-modal create-project-modal edit-project-modal" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
            <form onSubmit={onUpdateProject} className="create-project-standard-form">
              <div className="create-project-modal-header">
                <div className="create-project-modal-header-copy">
                  <div className="create-project-modal-kicker">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar proyecto</span>
                  </div>
                  <h3 id="edit-project-title">Editar proyecto</h3>
                  <p>Actualiza el nombre y la clasificación institucional del proyecto.</p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar modal de edición de proyecto"
                  className="report-modal-close"
                  onClick={onCloseEditProject}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="create-project-modal-body">
                <section className="create-project-section edit-project-section">
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
                      autoComplete="organization"
                      className="create-project-control"
                      value={editProjectName}
                      onChange={e => onEditProjectNameChange(e.target.value)}
                    />
                  </div>
                </section>
                <section className="create-project-section create-project-section-spaced edit-project-section">
                  <div className="create-project-section-chip">
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clasificación institucional</span>
                  </div>
                  <div className="create-project-grid edit-project-grid">
                    <div className="create-project-field">
                      <label htmlFor="edit-project-entity-type">Tipo de entidad</label>
                      <div className="create-project-select-wrap">
                        <select
                          id="edit-project-entity-type"
                          className="create-project-control"
                          value={editProjectEntityType}
                          onChange={e => onEditProjectEntityTypeChange(e.target.value)}
                        >
                          <option value="Sector público">Sector público</option>
                          <option value="Sector privado">Sector privado</option>
                        </select>
                        <ChevronDown className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <div className="create-project-modal-footer">
                <div className="create-project-footer-actions">
                  <button type="button" className="report-ghost-btn create-project-cancel" onClick={onCloseEditProject}>
                    Cancelar
                  </button>
                  <button type="submit" className="create-project-submit" disabled={!editProjectName.trim()}>
                    Guardar cambios
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
