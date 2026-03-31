import { useState, useEffect, useCallback } from 'react';
import { hrApi } from '@/api/hrApi';
import type { EmployeePermSummary, Role, PermFlags } from '@/api/hrApi';
import { configApi } from '@/api/businessApi';
import toast from 'react-hot-toast';

// ─── Module Definitions ───────────────────────────────────────────────────────

interface ModuleDef {
  key: string;
  label: string;
  desc: string;
  configKey: string;   // matches TenantModules key
}

const ALL_MODULES: ModuleDef[] = [
  { key: 'crm',           label: 'CRM',           desc: 'Leads & customers',             configKey: 'crm'           },
  { key: 'products',      label: 'Products',       desc: 'Catalogue & categories',        configKey: 'products'      },
  { key: 'stock',         label: 'Stock',          desc: 'Inventory levels & adjustments',configKey: 'stock'         },
  { key: 'orders',        label: 'Orders',         desc: 'Order processing & approvals',  configKey: 'orders'        },
  { key: 'invoices',      label: 'Invoices',       desc: 'Billing & invoices',            configKey: 'invoices'      },
  { key: 'dispatch',      label: 'Dispatch',       desc: 'Shipping & courier tracking',   configKey: 'dispatch'      },
  { key: 'hr',            label: 'HR',             desc: 'Employees & documents',         configKey: 'hr'            },
  { key: 'warehouse',     label: 'Warehouse',      desc: 'Multi-warehouse management',    configKey: 'warehouse'     },
  { key: 'analytics',     label: 'Analytics',      desc: 'Reports & dashboard insights',  configKey: 'analytics'     },
  { key: 'tracking',      label: 'Tracking',       desc: 'Real-time courier tracking',    configKey: 'tracking'      },
  { key: 'manufacturing', label: 'Manufacturing',  desc: 'Production & bill of materials',configKey: 'manufacturing' },
];

const PERM_COLS: { key: keyof PermFlags; label: string }[] = [
  { key: 'can_view',   label: 'View'   },
  { key: 'can_create', label: 'Create' },
  { key: 'can_edit',   label: 'Edit'   },
  { key: 'can_delete', label: 'Delete' },
];

type PermMatrix = Record<string, PermFlags>;

const EMPTY_FLAGS: PermFlags = { can_view: false, can_create: false, can_edit: false, can_delete: false };

function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') return (err as Error)?.message || fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === 'string') return d.detail;
  if (typeof d.message === 'string') return d.message;
  const parts: string[] = [];
  for (const v of Object.values(d)) {
    if (Array.isArray(v)) parts.push(...v.map(String));
    else if (typeof v === 'string') parts.push(v);
  }
  return parts.length ? parts.join(', ') : fallback;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [activeTab, setActiveTab]         = useState<'employee' | 'role'>('employee');
  const [employees, setEmployees]         = useState<EmployeePermSummary[]>([]);
  const [search, setSearch]               = useState('');
  const [selectedEmp, setSelectedEmp]     = useState<EmployeePermSummary | null>(null);
  const [permMatrix, setPermMatrix]       = useState<PermMatrix>({});
  const [enabledModules, setEnabledMods]  = useState<Record<string, boolean>>({});
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);

  // By Role tab
  const [roles, setRoles]                 = useState<Role[]>([]);
  const [selectedRole, setSelectedRole]   = useState<Role | null>(null);
  const [rolePermMatrix, setRolePermMatrix] = useState<PermMatrix>({});
  const [roleForm, setRoleForm]           = useState({ name: '', description: '' });
  const [rolesLoading, setRolesLoading]   = useState(false);
  const [roleSaving, setRoleSaving]       = useState(false);

  // Load tenant config once to know which modules are active
  useEffect(() => {
    configApi.get()
      .then((res: unknown) => {
        const data = (res as { data?: { modules?: Record<string, boolean> } })?.data ?? (res as { modules?: Record<string, boolean> });
        const mods = data?.modules ?? {};
        setEnabledMods(mods);
      })
      .catch(() => { /* show all if config fails */ });
  }, []);

  // Load roles when By Role tab is active
  useEffect(() => {
    if (activeTab !== 'role') return;
    setRolesLoading(true);
    hrApi.roles.list()
      .then(res => {
        const d = (res as { data?: { roles?: Role[] } })?.data;
        setRoles(d?.roles ?? []);
      })
      .catch(() => toast.error('Failed to load roles.'))
      .finally(() => setRolesLoading(false));
  }, [activeTab]);

  // Load employee list
  useEffect(() => {
    setLoading(true);
    hrApi.permissions.listEmployees()
      .then(res => {
        const list = (res as { data?: EmployeePermSummary[] })?.data ?? (res as unknown as EmployeePermSummary[]);
        setEmployees(Array.isArray(list) ? list : []);
      })
      .catch(() => toast.error('Failed to load employees.'))
      .finally(() => setLoading(false));
  }, []);

  // Load permissions when employee is selected
  // API returns role_defaults (from employee's role) + permissions (employee-specific overrides)
  // Effective = merge: employee override wins per module, else role default
  const loadPermissions = useCallback((emp: EmployeePermSummary) => {
    setSelectedEmp(emp);
    setPermMatrix({});
    hrApi.permissions.get(emp.id)
      .then(res => {
        const d = (res as { data?: { role_defaults?: Record<string, PermFlags>; permissions?: Record<string, PermFlags> } })?.data;
        const roleDefaults = d?.role_defaults ?? {};
        const employeePerms = d?.permissions ?? {};
        // Merge: employee override wins; else use role default
        const matrix: PermMatrix = {};
        ALL_MODULES.forEach(m => {
          matrix[m.key] = employeePerms[m.key]
            ? { ...EMPTY_FLAGS, ...employeePerms[m.key] }
            : (roleDefaults[m.key] ? { ...EMPTY_FLAGS, ...roleDefaults[m.key] } : { ...EMPTY_FLAGS });
        });
        setPermMatrix(matrix);
      })
      .catch(() => toast.error('Failed to load permissions.'));
  }, []);

  const handleToggle = (moduleKey: string, permKey: keyof PermFlags, value: boolean) => {
    setPermMatrix(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? EMPTY_FLAGS), [permKey]: value },
    }));
  };

  // Toggle entire row (View also gets toggled when any perm changes)
  const handleRowToggle = (moduleKey: string, checked: boolean) => {
    setPermMatrix(prev => ({
      ...prev,
      [moduleKey]: checked
        ? { can_view: true, can_create: true, can_edit: true, can_delete: true }
        : { can_view: false, can_create: false, can_edit: false, can_delete: false },
    }));
  };

  const handleSave = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await hrApi.permissions.save(selectedEmp.id, permMatrix);
      toast.success('Permissions saved successfully.');
    } catch {
      toast.error('Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  // ─── By Role handlers ───
  const loadRole = useCallback((role: Role) => {
    setSelectedRole(role);
    setRoleForm({ name: role.name, description: role.description || '' });
    const matrix: PermMatrix = {};
    ALL_MODULES.forEach(m => {
      matrix[m.key] = role.default_permissions?.[m.key]
        ? { ...EMPTY_FLAGS, ...role.default_permissions[m.key] }
        : { ...EMPTY_FLAGS };
    });
    setRolePermMatrix(matrix);
  }, []);

  const handleRoleToggle = (moduleKey: string, permKey: keyof PermFlags, value: boolean) => {
    setRolePermMatrix(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? EMPTY_FLAGS), [permKey]: value },
    }));
  };

  const handleRoleRowToggle = (moduleKey: string, checked: boolean) => {
    setRolePermMatrix(prev => ({
      ...prev,
      [moduleKey]: checked
        ? { can_view: true, can_create: true, can_edit: true, can_delete: true }
        : { can_view: false, can_create: false, can_edit: false, can_delete: false },
    }));
  };

  const handleRoleSave = async () => {
    if (!selectedRole) return;
    const name = roleForm.name.trim() || selectedRole.name;
    if (!name) {
      toast.error('Role name is required.');
      return;
    }
    setRoleSaving(true);
    try {
      await hrApi.roles.update(selectedRole.id, {
        name,
        description: roleForm.description.trim(),
        default_permissions: rolePermMatrix,
      });
      toast.success('Role permissions saved.');
      const res = await hrApi.roles.list();
      const d = (res as { data?: { roles?: Role[] } })?.data;
      setRoles(d?.roles ?? []);
      const updated = (d?.roles ?? []).find((r: Role) => r.id === selectedRole.id);
      if (updated) {
        setSelectedRole(updated);
        setRoleForm({ name: updated.name, description: updated.description || '' });
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let msg = 'Failed to save role.';
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (typeof d.detail === 'string') msg = d.detail;
        else if (typeof d.message === 'string') msg = d.message;
        else if (typeof d.detail === 'object') msg = String(d.detail);
        else {
          const parts = Object.entries(d).flatMap(([k, v]) =>
            Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
          );
          if (parts.length) msg = parts.join(', ');
        }
      } else if (err instanceof Error) msg = err.message;
      toast.error(msg);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Role name is required.');
      return;
    }
    setRoleSaving(true);
    try {
      const res = await hrApi.roles.create({
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        default_permissions: {},
      });
      const newRole = (res as { data?: Role })?.data;
      if (newRole) {
        setRoles(prev => [...prev, newRole]);
        loadRole(newRole);
        setRoleForm({ name: '', description: '' });
        toast.success('Role created.');
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to create role.'));
    } finally {
      setRoleSaving(false);
    }
  };

  const visibleModules = ALL_MODULES.filter(m =>
    Object.keys(enabledModules).length === 0 || enabledModules[m.configKey]
  );

  const filteredEmployees = employees.filter(e =>
    !search ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Permissions</h2>
          <div style={{ display: 'flex', gap: 4, border: '1px solid #e2e8f0', borderRadius: 8, padding: 4, background: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setActiveTab('employee')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'employee' ? '#fff' : 'transparent',
                color: activeTab === 'employee' ? '#1e293b' : '#64748b',
                fontWeight: activeTab === 'employee' ? 600 : 500,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeTab === 'employee' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              By Employee
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('role')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'role' ? '#fff' : 'transparent',
                color: activeTab === 'role' ? '#1e293b' : '#64748b',
                fontWeight: activeTab === 'role' ? 600 : 500,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeTab === 'role' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              By Role
            </button>
          </div>
        </div>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          {activeTab === 'employee'
            ? 'Assign module-level access rights to your employees. Employee permissions override role defaults.'
            : 'Create roles and set default permissions. Employees with a role inherit these; add per-employee overrides in By Employee.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left panel: Employee List (or Roles List) ── */}
        <div className="card" style={{ width: 280, flexShrink: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 10 }}>
              {activeTab === 'employee' ? 'Employees' : 'Roles'}
            </div>
            {activeTab === 'employee' ? (
              <input
                className="form-input"
                placeholder="Search employees…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ margin: 0 }}
              />
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSelectedRole(null); setRoleForm({ name: '', description: '' }); }}
                style={{ width: '100%', margin: 0 }}
              >
                + New Role
              </button>
            )}
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {activeTab === 'employee' ? (
              <>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            )}
            {!loading && filteredEmployees.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No employees found.
              </div>
            )}
            {filteredEmployees.map(emp => {
              const isActive = selectedEmp?.id === emp.id;
              return (
                <div
                  key={emp.id}
                  onClick={() => loadPermissions(emp)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    background: isActive ? '#eff6ff' : 'transparent',
                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? '#1d4ed8' : '#1e293b' }}>
                    {emp.full_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {emp.employee_id}
                    {emp.designation ? ` · ${emp.designation}` : ''}
                  </div>
                  {emp.department && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{emp.department}</div>
                  )}
                </div>
              );
            })}
              </>
            ) : (
              <>
                {rolesLoading && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
                )}
                {!rolesLoading && roles.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No roles yet. Create one.
                  </div>
                )}
                {roles.map(r => {
                  const isActive = selectedRole?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => loadRole(r)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        background: isActive ? '#eff6ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? '#1d4ed8' : '#1e293b' }}>{r.name}</div>
                      {r.description && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.description}</div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ── Right panel: Permission Matrix or Role Editor ── */}
        <div style={{ flex: 1 }}>
          {activeTab === 'employee' ? (
            !selectedEmp ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Select an employee</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Choose an employee from the left to manage their module permissions.</div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#3b82f6',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, flexShrink: 0,
                  }}>
                    {selectedEmp.full_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{selectedEmp.full_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {selectedEmp.email}
                      {selectedEmp.designation ? ` · ${selectedEmp.designation}` : ''}
                      {selectedEmp.department ? ` · ${selectedEmp.department}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>Module</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: 60 }}>All</th>
                        {PERM_COLS.map(col => (
                          <th key={col.key} style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleModules.map((mod, idx) => {
                        const flags = permMatrix[mod.key] ?? EMPTY_FLAGS;
                        const allOn = flags.can_view && flags.can_create && flags.can_edit && flags.can_delete;
                        return (
                          <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '12px 20px' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{mod.label}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{mod.desc}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <input type="checkbox" checked={allOn} onChange={e => handleRowToggle(mod.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }} title="Toggle all" />
                            </td>
                            {PERM_COLS.map(col => (
                              <td key={col.key} style={{ textAlign: 'center', padding: '12px 8px' }}>
                                <input type="checkbox" checked={flags[col.key]} onChange={e => handleToggle(mod.key, col.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
                  <button className="btn btn-secondary" onClick={() => loadPermissions(selectedEmp)}>Reset</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Permissions'}</button>
                </div>
              </div>
            )
          ) : (
            !selectedRole ? (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Create a new role</div>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Add a role and set default permissions. Employees assigned this role will inherit these permissions.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                  <div>
                    <label className="form-label">Role name *</label>
                    <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sales Manager" />
                  </div>
                  <div>
                    <label className="form-label">Description</label>
                    <input className="form-input" value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
                  </div>
                  <button className="btn btn-primary" onClick={handleCreateRole} disabled={roleSaving || !roleForm.name.trim()}>
                    {roleSaving ? 'Creating…' : 'Create Role'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label className="form-label">Role name</label>
                      <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="Role name" />
                    </div>
                    <div>
                      <label className="form-label">Description</label>
                      <input className="form-input" value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>Module</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: 60 }}>All</th>
                        {PERM_COLS.map(col => (
                          <th key={col.key} style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleModules.map((mod, idx) => {
                        const flags = rolePermMatrix[mod.key] ?? EMPTY_FLAGS;
                        const allOn = flags.can_view && flags.can_create && flags.can_edit && flags.can_delete;
                        return (
                          <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '12px 20px' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{mod.label}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{mod.desc}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <input type="checkbox" checked={allOn} onChange={e => handleRoleRowToggle(mod.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }} title="Toggle all" />
                            </td>
                            {PERM_COLS.map(col => (
                              <td key={col.key} style={{ textAlign: 'center', padding: '12px 8px' }}>
                                <input type="checkbox" checked={flags[col.key]} onChange={e => handleRoleToggle(mod.key, col.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
                  <button className="btn btn-secondary" onClick={() => selectedRole && loadRole(selectedRole)}>Reset</button>
                  <button className="btn btn-primary" onClick={handleRoleSave} disabled={roleSaving}>{roleSaving ? 'Saving…' : 'Save Role Permissions'}</button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
