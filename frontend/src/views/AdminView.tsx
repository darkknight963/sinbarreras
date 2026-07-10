import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  CreditCard,
  KeyRound,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: 'free' | 'admin' | 'superadmin' | 'guest';
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

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

const formatRole = (role: AdminUser['role']) => {
  if (role === 'superadmin') return 'Superadministrador';
  if (role === 'admin') return 'Administrador de cuenta';
  if (role === 'guest') return 'Invitado';
  return 'Usuario';
};

const formatComplaintStatus = (status: Complaint['status']) => {
  if (status === 'in_review') return 'En revision';
  if (status === 'resolved') return 'Resuelto';
  if (status === 'closed') return 'Cerrado';
  return 'Abierto';
};

const dangerButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60';

const softButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

const actionButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60';

export function AdminView({ onBack, fetchWithAuth }: AdminViewProps) {
  const { confirm, ConfirmDialogElement } = useConfirm();
  const pageSize = 10;
  const [activeTab, setActiveTab] = useState<'users' | 'complaints' | 'logs'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [complaintsTotal, setComplaintsTotal] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [complaintsTotalPages, setComplaintsTotalPages] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    role: 'free' as AdminUser['role'],
  });
  const [passwordForm, setPasswordForm] = useState('');
  const [billingForm, setBillingForm] = useState({
    plan: 'monthly' as 'monthly' | 'annual',
    currency: 'PEN' as 'PEN' | 'USD',
    periodEndDate: '',
  });

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedComplaint = useMemo(
    () => complaints.find((complaint) => complaint.id === selectedComplaintId) || null,
    [complaints, selectedComplaintId],
  );

  const loadData = async (pages?: { users?: number; complaints?: number; logs?: number }) => {
    const targetUsersPage = pages?.users ?? usersPage;
    const targetComplaintsPage = pages?.complaints ?? complaintsPage;
    const targetLogsPage = pages?.logs ?? logsPage;

    setLoading(true);
    setError(null);

    try {
      const [usersRes, complaintsRes, logsRes] = await Promise.all([
        fetchWithAuth(`/admin/users?page=${targetUsersPage}&pageSize=${pageSize}`),
        fetchWithAuth(`/complaints?page=${targetComplaintsPage}&pageSize=${pageSize}`),
        fetchWithAuth(`/admin/logs?page=${targetLogsPage}&pageSize=${pageSize}`),
      ]);

      if (!usersRes.ok) throw new Error(await readError(usersRes));
      if (!complaintsRes.ok) throw new Error(await readError(complaintsRes));
      if (!logsRes.ok) throw new Error(await readError(logsRes));

      const usersPayload = (await usersRes.json()) as PaginatedResponse<AdminUser>;
      const complaintsPayload = (await complaintsRes.json()) as PaginatedResponse<Complaint>;
      const logsPayload = (await logsRes.json()) as PaginatedResponse<AuditLog>;

      setUsers(usersPayload.items);
      setUsersPage(usersPayload.page);
      setUsersTotal(usersPayload.total);
      setUsersTotalPages(usersPayload.totalPages);

      setComplaints(complaintsPayload.items);
      setComplaintsPage(complaintsPayload.page);
      setComplaintsTotal(complaintsPayload.total);
      setComplaintsTotalPages(complaintsPayload.totalPages);

      setLogs(logsPayload.items);
      setLogsPage(logsPayload.page);
      setLogsTotal(logsPayload.total);
      setLogsTotalPages(logsPayload.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la informacion administrativa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const resetUserEditor = () => {
    setSelectedUserId(null);
    setShowCreateForm(false);
    setUserForm({
      email: '',
      password: '',
      fullName: '',
      companyName: '',
      role: 'free',
    });
    setPasswordForm('');
    setBillingForm({ plan: 'monthly', currency: 'PEN', periodEndDate: '' });
  };

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
      resetUserEditor();
      await loadData({ users: 1, complaints: complaintsPage, logs: logsPage });
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

  const handleResetPassword = async () => {
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
      setError(err instanceof Error ? err.message : 'No se pudo resetear la contrasena');
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

  const handleManualBilling = async () => {
    if (!selectedUser) return;
    setSavingKey(`billing-${selectedUser.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/admin/users/${selectedUser.id}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingForm),
      });

      if (!response.ok) throw new Error(await readError(response));
      setBillingForm({ plan: 'monthly', currency: 'PEN', periodEndDate: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el plan');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = await confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar al usuario ${user.email}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setSavingKey(`delete-user-${user.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error(await readError(response));

      if (selectedUserId === user.id) {
        resetUserEditor();
      }

      const nextUsersPage = users.length === 1 && usersPage > 1 ? usersPage - 1 : usersPage;
      await loadData({ users: nextUsersPage, complaints: complaintsPage, logs: logsPage });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
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

  const handleDeleteComplaint = async (complaint: Complaint) => {
    const confirmed = await confirm({
      title: 'Eliminar reclamo',
      message: `¿Eliminar el reclamo de ${complaint.fullName}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setSavingKey(`delete-complaint-${complaint.id}`);
    setError(null);

    try {
      const response = await fetchWithAuth(`/complaints/${complaint.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error(await readError(response));

      if (selectedComplaintId === complaint.id) {
        setSelectedComplaintId(null);
      }

      const nextComplaintsPage = complaints.length === 1 && complaintsPage > 1 ? complaintsPage - 1 : complaintsPage;
      await loadData({ users: usersPage, complaints: nextComplaintsPage, logs: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el reclamo');
    } finally {
      setSavingKey(null);
    }
  };

  const renderPagination = (
    label: string,
    page: number,
    totalPages: number,
    total: number,
    onPageChange: (page: number) => void,
  ) => {
    if (total <= 0) return null;

    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500">
          Pagina {page} de {totalPages} · {total} registros
        </p>
        <div className="flex flex-wrap gap-2" aria-label={`Paginacion de ${label}`}>
          <button
            type="button"
            className={softButtonClass}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            Anterior
          </button>
          <button
            type="button"
            className={softButtonClass}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="report-surface project-overview-surface page-entrance">
      <div className="project-overview-header">
        <div>
          <span className="project-overview-kicker">Administración</span>
          <h2 className="text-2xl font-bold text-white">Panel maestro</h2>
          <p className="text-slate-800 text-sm">Usuarios, libro de reclamaciones y bitácora de acciones sensibles.</p>
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
          <strong>{usersTotal}</strong>
          <small>cuentas registradas</small>
        </div>
        <div className="project-summary-card">
          <div className="project-summary-icon project-summary-icon-risk" aria-hidden="true">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <span>Reclamos</span>
          <strong>{complaintsTotal}</strong>
          <small>libro de reclamaciones</small>
        </div>
        <div className="project-summary-card">
          <div className="project-summary-icon project-summary-icon-running" aria-hidden="true">
            <Clock3 className="h-5 w-5" />
          </div>
          <span>Auditorias</span>
          <strong>{logsTotal}</strong>
          <small>acciones registradas</small>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="project-list-toolbar admin-toolbar-stack">
        <div className="min-w-0 admin-toolbar-copy-block">
          <h3>Operación</h3>
          <p className="admin-toolbar-copy">Los roles administrativos son internos de plataforma o de cuenta; no equivalen al plan Pro del cliente.</p>
        </div>
        <div className="project-filter-tabs" role="group" aria-label="Secciones de administracion">
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
          <p className="text-sm text-slate-800">Cargando panel administrativo...</p>
        </div>
      ) : null}

      {activeTab === 'users' && (
        <div className={`grid gap-4 ${selectedUser ? 'xl:grid-cols-[minmax(0,1.5fr)_380px]' : ''}`}>
          <section className="report-card-entity overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="project-card-top">
                <div className="project-card-icon">
                  <Users className="h-6 w-6 text-gob-blue" />
                </div>
                <div className="project-card-main-copy">
                  <h3 className="font-bold text-lg text-gob-dark">Usuarios registrados</h3>
                  <p className="text-slate-500 text-sm">Administra las cuentas de la plataforma: rol, estado y plan de cada usuario.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{usersTotal} cuentas</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  {users.filter((user) => user.isActive).length} activas en esta pagina
                </span>
                <button
                  type="button"
                  className={showCreateForm && !selectedUser ? actionButtonClass : softButtonClass}
                  onClick={() => { resetUserEditor(); setShowCreateForm(true); }}
                >
                  + Nuevo usuario
                </button>
              </div>
            </div>

            {showCreateForm && !selectedUser && (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <form className="grid gap-3" onSubmit={handleCreateUser}>
                  <p className="text-sm font-bold text-slate-900">Crear nuevo usuario</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Correo
                      <input className="create-project-control" type="email" autoComplete="email" required value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Nombre completo
                      <input className="create-project-control" type="text" autoComplete="name" value={userForm.fullName} onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Empresa
                      <input className="create-project-control" type="text" autoComplete="organization" value={userForm.companyName} onChange={(e) => setUserForm((prev) => ({ ...prev, companyName: e.target.value }))} />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Rol
                      <select className="create-project-control" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as AdminUser['role'] }))}>
                        <option value="free">Usuario (Free/Pro segun plan)</option>
                        <option value="admin">Administrador de cuenta</option>
                        <option value="superadmin">Superadministrador</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                      Contrasena inicial
                      <input className="create-project-control" type="password" autoComplete="new-password" required minLength={12} value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="create-project-submit" disabled={savingKey === 'create-user'}>
                      {savingKey === 'create-user' ? 'Creando...' : 'Crear usuario'}
                    </button>
                    <button type="button" className={softButtonClass} onClick={resetUserEditor}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
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
                    <tr
                      key={user.id}
                      style={selectedUserId === user.id ? { background: '#eff6ff', outline: '2px solid #bfdbfe', outlineOffset: '-1px' } : undefined}
                    >
                      <td>
                        <strong>{user.email}</strong>
                        <div className="text-xs text-slate-500">{user.fullName || 'Sin nombre'}</div>
                      </td>
                      <td>{formatRole(user.role)}</td>
                      <td>
                        <span className={`auth-preview-pill ${user.isActive ? 'auth-preview-pill-review' : 'auth-preview-pill-error'}`}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {user.billingStatus === 'active' && user.billingPlan ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            {user.billingPlan === 'monthly' ? 'Mensual' : 'Anual'}
                          </span>
                        ) : user.billingStatus === 'past_due' ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Vencido</span>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin plan</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={actionButtonClass} onClick={() => setSelectedUserId(user.id)}>
                            Editar
                          </button>
                          <button type="button" className={softButtonClass} onClick={() => toggleUserActive(user)} disabled={savingKey === `active-${user.id}`}>
                            {user.isActive ? 'Dar baja' : 'Dar alta'}
                          </button>
                          <button type="button" className={dangerButtonClass} onClick={() => handleDeleteUser(user)} disabled={savingKey === `delete-user-${user.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {renderPagination('usuarios', usersPage, usersTotalPages, usersTotal, (page) => {
              void loadData({ users: page, complaints: complaintsPage, logs: logsPage });
            })}
          </section>

          {selectedUser && (
          <section className="grid gap-4 content-start">
            {/* Card: datos del usuario */}
            <div className="report-card-entity">
              <form className="grid gap-4" onSubmit={handleUpdateUser}>
                <div className="flex items-center gap-3 pb-3 border-b border-blue-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                    <UserCog className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Editar usuario</p>
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>
                </div>

                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Correo
                  <input className="create-project-control" type="email" autoComplete="email" required value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Nombre completo
                  <input className="create-project-control" type="text" autoComplete="name" value={userForm.fullName} onChange={(event) => setUserForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Empresa
                  <input className="create-project-control" type="text" autoComplete="organization" value={userForm.companyName} onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))} />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Rol
                  <select className="create-project-control" autoComplete="off" value={userForm.role} onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value as AdminUser['role'] }))}>
                    <option value="free">Usuario (Free/Pro segun plan)</option>
                    <option value="admin">Administrador de cuenta</option>
                    <option value="superadmin">Superadministrador</option>
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="create-project-submit" disabled={savingKey === `update-${selectedUser.id}`}>
                    Guardar cambios
                  </button>
                  <button type="button" className={softButtonClass} onClick={resetUserEditor}>
                    Cerrar
                  </button>
                </div>
              </form>
            </div>

            {/* Card: resetear contraseña */}
            <div className="report-card-entity">
              <div className="flex items-center gap-3 pb-3 border-b border-amber-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Resetear contrasena</p>
                  <p className="text-xs text-slate-500">Invalida todas las sesiones activas del usuario.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Nueva contrasena
                  <input className="create-project-control" type="password" autoComplete="new-password" minLength={12} value={passwordForm} onChange={(event) => setPasswordForm(event.target.value)} />
                </label>
                <button
                  type="button"
                  className="report-action-btn"
                  disabled={!passwordForm || savingKey === `reset-${selectedUser.id}`}
                  onClick={() => void handleResetPassword()}
                >
                  <KeyRound className="h-4 w-4" />
                  {savingKey === `reset-${selectedUser.id}` ? 'Reseteando...' : 'Resetear contrasena'}
                </button>
              </div>
            </div>

            {/* Card: activación manual de plan */}
            <div className="report-card-entity" style={{ borderColor: '#bbf7d0' }}>
                <div className="flex items-center gap-3 pb-3 border-b border-emerald-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Activar plan Pro</p>
                    <p className="text-xs text-slate-500">Para pagos en efectivo, transferencia u otro medio externo.</p>
                  </div>
                </div>

                {selectedUser.billingStatus === 'active' && selectedUser.billingPeriodEnd && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Plan activo: <strong>{selectedUser.billingPlan === 'monthly' ? 'Mensual' : 'Anual'}</strong> · {selectedUser.billingCurrency} · vence{' '}
                    <strong>{new Date(selectedUser.billingPeriodEnd).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                )}

                <div className="mt-4 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Plan
                      <select className="create-project-control" value={billingForm.plan} onChange={(e) => setBillingForm((prev) => ({ ...prev, plan: e.target.value as 'monthly' | 'annual' }))}>
                        <option value="monthly">Mensual</option>
                        <option value="annual">Anual</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Moneda
                      <select className="create-project-control" value={billingForm.currency} onChange={(e) => setBillingForm((prev) => ({ ...prev, currency: e.target.value as 'PEN' | 'USD' }))}>
                        <option value="PEN">PEN (soles)</option>
                        <option value="USD">USD (dolares)</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Acceso hasta
                    <input
                      className="create-project-control"
                      type="date"
                      value={billingForm.periodEndDate}
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, periodEndDate: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    style={{ background: '#16a34a', borderColor: '#15803d', color: '#fff' }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!billingForm.periodEndDate || savingKey === `billing-${selectedUser.id}`}
                    onClick={() => void handleManualBilling()}
                  >
                    <CreditCard className="h-4 w-4" />
                    {savingKey === `billing-${selectedUser.id}` ? 'Activando...' : 'Activar plan Pro'}
                  </button>
                </div>
            </div>
          </section>
          )}
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="report-card-entity overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="project-card-top">
              <div className="project-card-icon">
                <AlertTriangle className="h-6 w-6 text-gob-blue" />
              </div>
              <div className="project-card-main-copy">
                <h3 className="font-bold text-lg text-gob-dark">Libro de reclamaciones</h3>
                <p className="text-slate-500 text-sm">Gestiona los reclamos y quejas registrados por los usuarios de la plataforma.</p>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {complaintsTotal} casos
            </div>
          </div>

          {complaints.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="font-semibold text-slate-600">Sin reclamos registrados</p>
              <p className="text-sm text-slate-500">Cuando un usuario registre un reclamo o queja en el Libro de Reclamaciones, aparecerá aquí.</p>
            </div>
          ) : (
          <div className="mt-4 overflow-x-auto">
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
                    <td>
                      <span className="auth-preview-pill auth-preview-pill-review">{formatComplaintStatus(complaint.status)}</span>
                    </td>
                    <td>{formatDateTime(complaint.createdAt)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={actionButtonClass} onClick={() => setSelectedComplaintId(complaint.id)}>
                          Ver detalle
                        </button>
                        <button type="button" className={softButtonClass} onClick={() => updateComplaintStatus(complaint, 'in_review')} disabled={savingKey === `complaint-${complaint.id}`}>
                          En revision
                        </button>
                        <button type="button" className={softButtonClass} onClick={() => updateComplaintStatus(complaint, 'resolved')} disabled={savingKey === `complaint-${complaint.id}`}>
                          Resuelto
                        </button>
                        <button type="button" className={softButtonClass} onClick={() => updateComplaintStatus(complaint, 'closed')} disabled={savingKey === `complaint-${complaint.id}`}>
                          Cerrado
                        </button>
                        <button type="button" className={dangerButtonClass} onClick={() => handleDeleteComplaint(complaint)} disabled={savingKey === `delete-complaint-${complaint.id}`}>
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {complaints.length > 0 && renderPagination('reclamos', complaintsPage, complaintsTotalPages, complaintsTotal, (page) => {
            void loadData({ users: usersPage, complaints: page, logs: logsPage });
          })}

          {selectedComplaint && (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detalle del reclamo</p>
                  <h4 className="mt-1 text-lg font-bold text-slate-900">{selectedComplaint.fullName}</h4>
                  <p className="text-sm text-slate-600">
                    {selectedComplaint.type} · {selectedComplaint.email} · {selectedComplaint.phone}
                  </p>
                </div>
                <button type="button" className={softButtonClass} onClick={() => setSelectedComplaintId(null)}>
                  Cerrar detalle
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Servicio</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedComplaint.service}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatComplaintStatus(selectedComplaint.status)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detalle</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedComplaint.detail}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
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
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="project-card-top">
              <div className="project-card-icon">
                <Clock3 className="h-6 w-6 text-gob-blue" />
              </div>
              <div className="project-card-main-copy">
                <h3 className="font-bold text-lg text-gob-dark">Bitácora de acciones</h3>
                <p className="text-slate-500 text-sm">Registro de las acciones administrativas sensibles: quién hizo qué y cuándo.</p>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {logsTotal} eventos
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="auth-report-preview-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Actor</th>
                  <th>Accion</th>
                  <th>Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.actorEmail}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.targetType}
                      {log.targetId ? ` / ${log.targetId}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {renderPagination('logs', logsPage, logsTotalPages, logsTotal, (page) => {
            void loadData({ users: usersPage, complaints: complaintsPage, logs: page });
          })}
        </div>
      )}
      {ConfirmDialogElement}
    </div>
  );
}
