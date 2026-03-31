import { useState, useEffect } from 'react';
import { ordersApi } from '@/api/businessApi';
import toast from 'react-hot-toast';

interface OStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }
interface FlowAction { id: number; status_key: string; status_label: string; target_module: string; action: string; is_active: boolean; description: string }

type Tab = 'statuses' | 'flow';

const MODULE_OPTIONS = [
  { value: 'none',      label: 'Stay in Orders only' },
  { value: 'warehouse', label: 'Warehouse / Inventory' },
  { value: 'invoices',  label: 'Invoices' },
  { value: 'dispatch',  label: 'Dispatch' },
  { value: 'crm',       label: 'CRM' },
];

const ACTION_OPTIONS: Record<string, { value: string; label: string }[]> = {
  none:      [{ value: 'notify_only', label: 'Notify Only' }],
  warehouse: [{ value: 'send_to_warehouse', label: 'Send to Warehouse' }],
  invoices:  [{ value: 'create_invoice', label: 'Create Invoice' }],
  dispatch:  [{ value: 'mark_dispatch', label: 'Mark for Dispatch' }],
  crm:       [{ value: 'notify_only', label: 'Notify Only' }],
};

const COLOR_OPTIONS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#64748b', '#1d4ed8', '#dc2626',
];

export default function OrderSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('statuses');

  // ── Custom Statuses ──
  const [statuses, setStatuses] = useState<OStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({ key: '', label: '', color: '#3b82f6' });
  const [editStatusId, setEditStatusId] = useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Status Flow ──
  const [flowActions, setFlowActions] = useState<FlowAction[]>([]);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowForm, setFlowForm] = useState({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
  const [editFlowId, setEditFlowId] = useState<number | null>(null);
  const [flowSaving, setFlowSaving] = useState(false);

  useEffect(() => {
    loadStatuses();
    loadFlowActions();
  }, []);

  const loadStatuses = () => {
    setStatusLoading(true);
    ordersApi.statuses.list()
      .then((r) => setStatuses(r.data?.statuses || []))
      .catch(() => toast.error('Failed to load order statuses.'))
      .finally(() => setStatusLoading(false));
  };
  const loadFlowActions = () => {
    setFlowLoading(true);
    ordersApi.flowActions.list()
      .then((r) => setFlowActions(r.data?.flow_actions || []))
      .catch(() => toast.error('Failed to load flow actions.'))
      .finally(() => setFlowLoading(false));
  };

  // ── Status helpers ──
  const resetStatusForm = () => { setStatusForm({ key: '', label: '', color: '#3b82f6' }); setEditStatusId(null); };
  const handleSaveStatus = async () => {
    if (!statusForm.label.trim()) { toast.error('Label is required.'); return; }
    const key = statusForm.key.trim() || statusForm.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setStatusSaving(true);
    try {
      if (editStatusId) {
        await ordersApi.statuses.update(editStatusId, { ...statusForm, key });
        toast.success('Status updated.');
      } else {
        await ordersApi.statuses.create({ ...statusForm, key, order: statuses.length });
        toast.success('Status created.');
      }
      resetStatusForm();
      loadStatuses();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; key?: string[] } } };
      toast.error(ex?.response?.data?.key?.[0] || ex?.response?.data?.message || 'Failed to save status.');
    } finally { setStatusSaving(false); }
  };
  const handleDeleteStatus = async (id: number) => {
    if (!confirm('Delete this status?')) return;
    try { await ordersApi.statuses.delete(id); loadStatuses(); toast.success('Status deleted.'); }
    catch { toast.error('Failed to delete status.'); }
  };

  // ── Flow action helpers ──
  const resetFlowForm = () => { setFlowForm({ status_key: '', target_module: 'none', action: 'notify_only', description: '' }); setEditFlowId(null); };
  const handleSaveFlow = async () => {
    if (!flowForm.status_key) { toast.error('Select a status.'); return; }
    setFlowSaving(true);
    try {
      if (editFlowId) {
        await ordersApi.flowActions.update(editFlowId, flowForm);
        toast.success('Flow action updated.');
      } else {
        await ordersApi.flowActions.create(flowForm);
        toast.success('Flow action created.');
      }
      resetFlowForm();
      loadFlowActions();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; status_key?: string[] } } };
      toast.error(ex?.response?.data?.status_key?.[0] || ex?.response?.data?.message || 'Failed to save flow action.');
    } finally { setFlowSaving(false); }
  };
  const handleDeleteFlow = async (id: number) => {
    if (!confirm('Delete this flow action?')) return;
    try { await ordersApi.flowActions.delete(id); loadFlowActions(); toast.success('Flow action deleted.'); }
    catch { toast.error('Failed to delete flow action.'); }
  };

  const configuredStatusKeys = new Set(flowActions.map((f) => f.status_key));
  const unconfiguredStatuses = statuses.filter((s) => !configuredStatusKeys.has(s.key));

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'statuses', label: 'Order Statuses', icon: '🏷️' },
    { key: 'flow', label: 'Status Flow', icon: '🔀' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Order Settings</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Configure order statuses and status flow actions for your business.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--color-primary)' : '#e2e8f0'}`,
                background: active ? 'var(--color-primary)' : '#fff',
                color: active ? '#fff' : '#475569',
              }}>
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: Order Statuses ═══ */}
      {activeTab === 'statuses' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Order Statuses</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Create custom statuses for your order pipeline. These appear in order filters and status dropdowns.
            </p>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Label *</label>
                <input className="form-input" placeholder="e.g. Quality Check" value={statusForm.label}
                  onChange={(e) => setStatusForm((p) => ({ ...p, label: e.target.value }))}
                  style={{ width: 160, margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Key (slug)</label>
                <input className="form-input" placeholder="auto-generated" value={statusForm.key}
                  onChange={(e) => setStatusForm((p) => ({ ...p, key: e.target.value }))}
                  style={{ width: 140, margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Color</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <div key={c} onClick={() => setStatusForm((p) => ({ ...p, color: c }))}
                      style={{
                        width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                        border: statusForm.color === c ? '2px solid #1e293b' : '2px solid transparent',
                      }} />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={statusSaving}>
                {statusSaving ? 'Saving…' : editStatusId ? 'Update' : '+ Add Status'}
              </button>
              {editStatusId && (
                <button className="btn btn-secondary btn-sm" onClick={resetStatusForm}>Cancel</button>
              )}
            </div>

            {statusLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : statuses.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                <div style={{ fontSize: 14 }}>No custom statuses yet. Add your first status above.</div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {statuses.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < statuses.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: editStatusId === s.id ? '#eff6ff' : '#fff',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{s.key}</span>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditStatusId(s.id); setStatusForm({ key: s.key, label: s.label, color: s.color }); }}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStatus(s.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Status Flow ═══ */}
      {activeTab === 'flow' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Status Flow Actions</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Configure what happens when an order's status changes. For each status, choose which module it flows to and what action is taken. If no flow is set, the status only changes within Orders. Rejected orders revert to the previous module with a reason.
            </p>
          </div>
          <div className="card-body">
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
                {editFlowId ? 'Edit Flow Action' : 'Add Flow Action'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Status *</label>
                  <select className="form-select" value={flowForm.status_key}
                    onChange={(e) => setFlowForm((p) => ({ ...p, status_key: e.target.value }))}
                    style={{ width: 180, margin: 0 }}>
                    <option value="">Select status…</option>
                    {(editFlowId ? statuses : unconfiguredStatuses).map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Target Module</label>
                  <select className="form-select" value={flowForm.target_module}
                    onChange={(e) => {
                      const mod = e.target.value;
                      const actions = ACTION_OPTIONS[mod] || [];
                      setFlowForm((p) => ({ ...p, target_module: mod, action: actions[0]?.value || 'notify_only' }));
                    }}
                    style={{ width: 200, margin: 0 }}>
                    {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Action</label>
                  <select className="form-select" value={flowForm.action}
                    onChange={(e) => setFlowForm((p) => ({ ...p, action: e.target.value }))}
                    style={{ width: 180, margin: 0 }}>
                    {(ACTION_OPTIONS[flowForm.target_module] || []).map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Description</label>
                  <input className="form-input" placeholder="Optional note" value={flowForm.description}
                    onChange={(e) => setFlowForm((p) => ({ ...p, description: e.target.value }))}
                    style={{ margin: 0 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFlow} disabled={flowSaving}>
                  {flowSaving ? 'Saving…' : editFlowId ? 'Update' : '+ Add Flow'}
                </button>
                {editFlowId && (
                  <button className="btn btn-secondary btn-sm" onClick={resetFlowForm}>Cancel</button>
                )}
              </div>
            </div>

            {flowLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : flowActions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
                <div style={{ fontSize: 14 }}>No flow actions configured yet.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Statuses without a flow will only change within Orders — no cross-module action.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Status</div>
                  <div>Target Module</div>
                  <div>Action</div>
                  <div>Description</div>
                  <div>Actions</div>
                </div>
                {flowActions.map((f, i) => {
                  const statusObj = statuses.find((s) => s.key === f.status_key);
                  const modLabel = MODULE_OPTIONS.find((m) => m.value === f.target_module)?.label || f.target_module;
                  const actLabel = (ACTION_OPTIONS[f.target_module] || []).find((a) => a.value === f.action)?.label || f.action;
                  return (
                    <div key={f.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8,
                      padding: '10px 14px', alignItems: 'center',
                      borderBottom: i < flowActions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: editFlowId === f.id ? '#eff6ff' : '#fff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: statusObj?.color || '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.status_label}</span>
                      </div>
                      <div>
                        {f.target_module === 'none' ? (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Orders only</span>
                        ) : (
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#3b82f6', fontWeight: 500 }}>
                            → {modLabel}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{actLabel}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.description || '—'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditFlowId(f.id);
                          setFlowForm({ status_key: f.status_key, target_module: f.target_module, action: f.action, description: f.description });
                        }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFlow(f.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {unconfiguredStatuses.length > 0 && flowActions.length > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                <strong>Statuses without flow:</strong>{' '}
                {unconfiguredStatuses.map((s) => s.label).join(', ')}
                {' '}— these will only change the status within Orders.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
