import React, { useState, useEffect, useCallback } from 'react';
import { hrApi } from '@/api/hrApi';
import type { EmployeePermSummary, ModulePermission, PermFlags } from '@/api/hrApi';
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [employees, setEmployees]         = useState<EmployeePermSummary[]>([]);
  const [search, setSearch]               = useState('');
  const [selectedEmp, setSelectedEmp]     = useState<EmployeePermSummary | null>(null);
  const [permMatrix, setPermMatrix]       = useState<PermMatrix>({});
  const [enabledModules, setEnabledMods]  = useState<Record<string, boolean>>({});
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);

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
  const loadPermissions = useCallback((emp: EmployeePermSummary) => {
    setSelectedEmp(emp);
    setPermMatrix({});
    hrApi.permissions.get(emp.id)
      .then(res => {
        const permsArray: ModulePermission[] = (res as { data?: { permissions: ModulePermission[] } })?.data?.permissions ?? [];
        const matrix: PermMatrix = {};
        permsArray.forEach(p => {
          matrix[p.module] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete };
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
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Permissions</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Assign module-level access rights to your employees.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left panel: Employee List ── */}
        <div className="card" style={{ width: 280, flexShrink: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 10 }}>Employees</div>
            <input
              className="form-input"
              placeholder="Search employees…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
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
          </div>
        </div>

        {/* ── Right panel: Permission Matrix ── */}
        <div style={{ flex: 1 }}>
          {!selectedEmp ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Select an employee</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose an employee from the left to manage their module permissions.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Employee header */}
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

              {/* Permission table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>
                        Module
                      </th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: 60 }}>
                        All
                      </th>
                      {PERM_COLS.map(col => (
                        <th key={col.key} style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {col.label}
                        </th>
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
                          {/* All toggle */}
                          <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                            <input
                              type="checkbox"
                              checked={allOn}
                              onChange={e => handleRowToggle(mod.key, e.target.checked)}
                              style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                              title="Toggle all"
                            />
                          </td>
                          {PERM_COLS.map(col => (
                            <td key={col.key} style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <input
                                type="checkbox"
                                checked={flags[col.key]}
                                onChange={e => handleToggle(mod.key, col.key, e.target.checked)}
                                style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => loadPermissions(selectedEmp)}
                >
                  Reset
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
