import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  KeyRound,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  UserCog,
  Users,
} from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: 'owner' | 'admin' | 'viewer';
  isActive: boolean;
  billingStatus: 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';
  billingPlan: 'monthly' | 'annual' | null;
  billingProvider?: string;
  billingCurrency?: string | null;
  billingPeriodEnd?: string | null;
  createdAt: string;
};

type Complaint = {
  id: string;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  type: 'reclamo' | 'queja';
  service: string;
  detail: string;
  request: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
};

type AuditLog = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AdminViewProps = {
  onBack: () => void;
  fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
};

const readError = async (response: Response) => {
  try {
    const body = await response.clone().json();
    return body?.message || body?.error || `HTTP ${response.status}`;
  } catch {
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  }
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export function AdminView({ onBack, fetchWithAuth }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'complaints' | 'logs'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    role: 'viewer' as 'owner' | 'admin' | 'viewer',
  });
  const [passwordForm, setPasswordForm] = useState('');

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );
  const selectedComplaint = useMemo(
    () => complaints.find((complaint) => complaint.id === selectedComplaintId) || null,
    [complaints, selectedComplaintId],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, complaintsRes, logsRes] = await Promise.all([
        fetchWithAuth('/admin/users'),
        fetchWithAuth('/complaints'),
        fetchWithAuth('/admin/logs'),
      ]);

      if (!usersRes.ok) throw new Error(await readError(usersRes));
      if (!complaintsRes.ok) throw new Error(await readError(complaintsRes));
      if (!logsRes.ok) throw new Error(await readError(logsRes));

      setUsers(await usersRes.json());
      setComplaints(await complaintsRes.json());
      setLogs(await logsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información administrativa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setUserForm({
      email: selectedUser.email,
      password: '',
      fullName: selectedUser.fullName || '',
      companyName: selectedUser.companyName || '',
      role: selectedUser.role,
    });
    setPasswordForm('');
  }, [selectedUser]);

  useEffect(() => {
    if (selectedComplaintId && !selectedComplaint) {
      setSelectedComplaintId(null);
    }
  }, [selectedComplaintId, selectedComplaint]);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingKey('create-user');
    setError(null);

    try {
      const response = await fetchWithAuth('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          fullName: userForm.fullName || undefined,
          companyName: userForm.companyName || undefined,
          role: userForm.role,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      setUserForm({
        email: '',
        password: '',
        fullName: '',
        companyName: '',
        role: 'viewer',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    setSavingKey(`update-${selectedUser.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userForm.email,
          fullName: userForm.fullName,
          companyName: userForm.companyName,
          role: userForm.role,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    setSavingKey(`reset-${selectedUser.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordForm }),
      });

      if (!response.ok) throw new Error(await readError(response));
      setPasswordForm('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resetear la contraseña');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleUserActive = async (user: AdminUser) => {
    setSavingKey(`active-${user.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/admin/users/${user.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!response.ok) throw new Error(await readError(response));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del usuario');
    } finally {
      setSavingKey(null);
    }
  };

  const updateComplaintStatus = async (complaint: Complaint, status: Complaint['status']) => {
    setSavingKey(`complaint-${complaint.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error(await readError(response));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el reclamo');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="report-surface project-overview-surface page-entrance">
      <div className="project-overview-header">
        <div>
          <span className="project-overview-kicker">Administración</span>
          <h2 className="text-2xl font-bold text-white">Panel maestro</h2>
          <p className="text-slate-300 text-sm">Usuarios, libro de reclamaciones y bitácora de acciones sensibles.</p>
        </div>
        <button type="button" className="report-ghost-btn" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span>Volver</span>
        </button>
      </div>

      <section className="project-summary-grid" aria-label="Resumen administrativo">
        <div className="project-summary-card">
          <div className="project-summary-icon" aria-hidden="true">
            <Users className="h-5 w-5" />
          </div>
          <span>Usuarios</span>
          <strong>{users.length}</strong>
          <small>activos e inactivos</small>
        </div>
        <div className="project-summary-card">
          <div className="project-summary-icon project-summary-icon-risk" aria-hidden="true">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <span>Reclamos</span>
          <strong>{complaints.length}</strong>
          <small>libro de reclamaciones</small>
        </div>
        <div className="project-summary-card">
          <div className="project-summary-icon project-summary-icon-running" aria-hidden="true">
            <Clock3 className="h-5 w-5" />
          </div>
          <span>Auditorías</span>
          <strong>{logs.length}</strong>
          <small>acciones registradas</small>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="project-list-toolbar">
        <h3>Operación</h3>
        <div className="project-filter-tabs" role="group" aria-label="Secciones de administración">
          <button type="button" className={activeTab === 'users' ? 'project-filter-active' : undefined} onClick={() => setActiveTab('users')}>
            <UserCog className="h-4 w-4" />
            Usuarios
          </button>
          <button type="button" className={activeTab === 'complaints' ? 'project-filter-active' : undefined} onClick={() => setActiveTab('complaints')}>
            <AlertTriangle className="h-4 w-4" />
            Reclamos
          </button>
          <button type="button" className={activeTab === 'logs' ? 'project-filter-active' : undefined} onClick={() => setActiveTab('logs')}>
            <ListFilter className="h-4 w-4" />
            Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="report-empty-state project-empty-card">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <p className="text-sm text-slate-400">Cargando panel administrativo...</p>
        </div>
      ) : null}

      {activeTab === 'users' && (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form className="report-card-entity" onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}>
            <div className="project-card-top">
              <div className="project-card-icon">
                <UserCog className="h-6 w-6 text-gob-blue" />
              </div>
              <div className="project-card-main-copy">
                <h3 className="font-bold text-lg text-gob-dark">Crear o editar usuario</h3>
                <p className="text-slate-500 text-sm">Correo, rol, alta/baja y reinicio de contraseña.</p>
              </div>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Correo
                <input className="create-project-control" type="email" required value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Nombre completo
                <input className="create-project-control" type="text" value={userForm.fullName} onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Empresa
                <input className="create-project-control" type="text" value={userForm.companyName} onChange={(e) => setUserForm((prev) => ({ ...prev, companyName: e.target.value }))} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Rol
                <select className="create-project-control" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as AdminUser['role'] }))}>
                  <option value="viewer">Viewer</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {!selectedUser && (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Contraseña inicial
                  <input className="create-project-control" type="password" required minLength={12} value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} />
                </label>
              )}
              {selectedUser && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Editando <strong>{selectedUser.email}</strong>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="create-project-submit" disabled={savingKey === 'create-user' || savingKey === `update-${selectedUser?.id}`}>
                  {selectedUser ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                {selectedUser && (
                  <button type="button" className="report-ghost-btn" onClick={() => { setSelectedUserId(null); setUserForm({ email: '', password: '', fullName: '', companyName: '', role: 'viewer' }); }}>
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {selectedUser && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Contraseña</p>
                    <p className="text-xs text-slate-500">El reinicio invalida sesiones activas.</p>
                  </div>
                </div>
                <form className="mt-3 grid gap-3" onSubmit={handleResetPassword}>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Nueva contraseña
                    <input className="create-project-control" type="password" required minLength={12} value={passwordForm} onChange={(e) => setPasswordForm(e.target.value)} />
                  </label>
                  <button type="submit" className="report-action-btn" disabled={savingKey === `reset-${selectedUser.id}`}>
                    <KeyRound className="h-4 w-4" />
                    Resetear contraseña
                  </button>
                </form>
              </div>
            )}
          </form>

          <div className="report-card-entity overflow-hidden">
            <div className="project-card-top">
              <div className="project-card-icon">
                <Users className="h-6 w-6 text-gob-blue" />
              </div>
              <div className="project-card-main-copy">
                <h3 className="font-bold text-lg text-gob-dark">Usuarios registrados</h3>
                <p className="text-slate-500 text-sm">Selecciona uno para editarlo.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="auth-report-preview-table">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Plan</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                        <div className="text-xs text-slate-500">{user.fullName || 'Sin nombre'}</div>
                      </td>
                      <td>{user.role}</td>
                      <td>
                        <span className={`auth-preview-pill ${user.isActive ? 'auth-preview-pill-review' : 'auth-preview-pill-error'}`}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{user.billingPlan || '—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="report-ghost-btn" onClick={() => setSelectedUserId(user.id)}>
                            Editar
                          </button>
                          <button type="button" className="report-ghost-btn" onClick={() => toggleUserActive(user)} disabled={savingKey === `active-${user.id}`}>
                            {user.isActive ? 'Dar baja' : 'Dar alta'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="report-card-entity overflow-hidden">
          <div className="project-card-top">
            <div className="project-card-icon">
              <AlertTriangle className="h-6 w-6 text-gob-blue" />
            </div>
            <div className="project-card-main-copy">
              <h3 className="font-bold text-lg text-gob-dark">Libro de reclamaciones</h3>
              <p className="text-slate-500 text-sm">Reclamos y quejas recibidos desde la web.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="auth-report-preview-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <strong>{complaint.fullName}</strong>
                      <div className="text-xs text-slate-500">{complaint.email}</div>
                    </td>
                    <td>{complaint.type}</td>
                    <td>{complaint.service}</td>
                    <td>{complaint.status}</td>
                    <td>{formatDateTime(complaint.createdAt)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="report-ghost-btn" onClick={() => setSelectedComplaintId(complaint.id)}>
                          Ver detalle
                        </button>
                        <button type="button" className="report-ghost-btn" onClick={() => updateComplaintStatus(complaint, 'in_review')} disabled={savingKey === `complaint-${complaint.id}`}>
                          En revisión
                        </button>
                        <button type="button" className="report-ghost-btn" onClick={() => updateComplaintStatus(complaint, 'resolved')} disabled={savingKey === `complaint-${complaint.id}`}>
                          Resuelto
                        </button>
                        <button type="button" className="report-ghost-btn" onClick={() => updateComplaintStatus(complaint, 'closed')} disabled={savingKey === `complaint-${complaint.id}`}>
                          Cerrado
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedComplaint && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detalle del reclamo</p>
                  <h4 className="mt-1 text-lg font-bold text-slate-900">{selectedComplaint.fullName}</h4>
                  <p className="text-sm text-slate-600">
                    {selectedComplaint.type} · {selectedComplaint.email} · {selectedComplaint.phone}
                  </p>
                </div>
                <button type="button" className="report-ghost-btn" onClick={() => setSelectedComplaintId(null)}>
                  Cerrar detalle
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Servicio</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedComplaint.service}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedComplaint.status}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detalle</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedComplaint.detail}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pedido del consumidor</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedComplaint.request}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="report-card-entity overflow-hidden">
          <div className="project-card-top">
            <div className="project-card-icon">
              <Clock3 className="h-6 w-6 text-gob-blue" />
            </div>
            <div className="project-card-main-copy">
              <h3 className="font-bold text-lg text-gob-dark">Bitácora de acciones</h3>
              <p className="text-slate-500 text-sm">Trazabilidad de cambios sensibles de usuario y reclamos.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="auth-report-preview-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Actor</th>
                  <th>Acción</th>
                  <th>Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.actorEmail}</td>
                    <td>{log.action}</td>
                    <td>{log.targetType}{log.targetId ? ` / ${log.targetId}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
