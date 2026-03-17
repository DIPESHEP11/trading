import React, { useState, useEffect } from 'react';
import { planApi } from '@/api/planApi';
import type { Plan } from '@/types';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-time' },
];

type ModuleKey = 'module_crm' | 'module_products' | 'module_stock' | 'module_orders' |
  'module_warehouse' | 'module_invoices' | 'module_dispatch' | 'module_tracking' |
  'module_manufacturing' | 'module_hr' | 'module_analytics';

const MODULE_LIST: { key: ModuleKey; label: string }[] = [
  { key: 'module_crm', label: 'CRM' },
  { key: 'module_products', label: 'Products' },
  { key: 'module_stock', label: 'Stock' },
  { key: 'module_orders', label: 'Orders' },
  { key: 'module_warehouse', label: 'Warehouse' },
  { key: 'module_invoices', label: 'Invoices' },
  { key: 'module_dispatch', label: 'Dispatch' },
  { key: 'module_tracking', label: 'Tracking' },
  { key: 'module_manufacturing', label: 'Manufacturing' },
  { key: 'module_hr', label: 'HR' },
  { key: 'module_analytics', label: 'Analytics' },
];

const EMPTY_FORM = {
  name: '',
  price: '',
  billing_period: 'monthly' as Plan['billing_period'],
  description: '',
  max_users: '',
  features: [] as string[],
  module_crm: true,
  module_products: true,
  module_stock: true,
  module_orders: true,
  module_warehouse: true,
  module_invoices: true,
  module_dispatch: true,
  module_tracking: false,
  module_manufacturing: false,
  module_hr: false,
  module_analytics: true,
  is_active: true,
  display_order: 0,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [newFeature, setNewFeature] = useState('');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await planApi.list();
      const d = (res as unknown as { data: { plans: Plan[] } }).data;
      setPlans(d?.plans || []);
    } catch {
      toast.error('Failed to load plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  // ─── Open add / edit ──────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setNewFeature('');
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      billing_period: plan.billing_period,
      description: plan.description,
      max_users: plan.max_users != null ? String(plan.max_users) : '',
      features: [...plan.features],
      module_crm: plan.module_crm,
      module_products: plan.module_products,
      module_stock: plan.module_stock,
      module_orders: plan.module_orders,
      module_warehouse: plan.module_warehouse,
      module_invoices: plan.module_invoices,
      module_dispatch: plan.module_dispatch,
      module_tracking: plan.module_tracking,
      module_manufacturing: plan.module_manufacturing,
      module_hr: plan.module_hr,
      module_analytics: plan.module_analytics,
      is_active: plan.is_active,
      display_order: plan.display_order,
    });
    setNewFeature('');
    setModalOpen(true);
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Plan name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: form.price || '0',
        billing_period: form.billing_period,
        description: form.description.trim(),
        max_users: form.max_users ? Number(form.max_users) : null,
        features: form.features,
        module_crm: form.module_crm,
        module_products: form.module_products,
        module_stock: form.module_stock,
        module_orders: form.module_orders,
        module_warehouse: form.module_warehouse,
        module_invoices: form.module_invoices,
        module_dispatch: form.module_dispatch,
        module_tracking: form.module_tracking,
        module_manufacturing: form.module_manufacturing,
        module_hr: form.module_hr,
        module_analytics: form.module_analytics,
        is_active: form.is_active,
        display_order: Number(form.display_order) || 0,
      };

      if (editing) {
        await planApi.update(editing.id, payload);
        toast.success('Plan updated.');
      } else {
        await planApi.create(payload);
        toast.success('Plan created.');
      }
      setModalOpen(false);
      fetchPlans();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? Clients already on this plan will not be affected.`)) return;
    try {
      await planApi.delete(plan.id);
      toast.success('Plan deleted.');
      fetchPlans();
    } catch {
      toast.error('Failed to delete plan.');
    }
  };

  // ─── Feature list helpers ─────────────────────────────────────────────────

  const addFeature = () => {
    const f = newFeature.trim();
    if (!f) return;
    setForm(prev => ({ ...prev, features: [...prev.features, f] }));
    setNewFeature('');
  };

  const removeFeature = (idx: number) =>
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));

  const setMod = (key: ModuleKey) => (val: boolean) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const moduleCount = (plan: Plan) =>
    MODULE_LIST.filter(m => plan[m.key]).length;

  const billingLabel = (b: Plan['billing_period']) =>
    BILLING_OPTIONS.find(o => o.value === b)?.label ?? b;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Subscription Plans</h1>
            <p className="page-subtitle">Create and manage plans that clients can be assigned to.</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Create Plan</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Plans ({plans.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : plans.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No plans yet. Click "+ Create Plan" to get started.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Billing</th>
                  <th>Max Users</th>
                  <th>Modules</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <strong>{plan.name}</strong>
                      {plan.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {plan.description.length > 60 ? plan.description.substring(0, 60) + '…' : plan.description}
                        </div>
                      )}
                    </td>
                    <td><strong>₹{parseFloat(plan.price).toLocaleString()}</strong></td>
                    <td style={{ fontSize: 13 }}>{billingLabel(plan.billing_period)}</td>
                    <td style={{ fontSize: 13 }}>{plan.max_users ?? '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, background: 'var(--color-bg-secondary, #f1f5f9)',
                        padding: '2px 8px', borderRadius: 20,
                      }}>
                        {moduleCount(plan)} / {MODULE_LIST.length}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{plan.display_order}</td>
                    <td>
                      <span className={`badge ${plan.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(plan)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(plan)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add / Edit plan modal ────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 600, maxHeight: '92vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{editing ? 'Edit Plan' : 'Create Plan'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !saving && setModalOpen(false)}>Close</button>
            </div>

            <form className="card-body" onSubmit={handleSubmit}>
              {/* Basic info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Plan name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic, Pro, Enterprise" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="2499" />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing period</label>
                  <select className="form-select" value={form.billing_period} onChange={e => setForm(f => ({ ...f, billing_period: e.target.value as Plan['billing_period'] }))}>
                    {BILLING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Max users (optional)</label>
                  <input className="form-input" type="number" min="1" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: e.target.value }))} placeholder="e.g. 25 (leave blank for unlimited)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Display order</label>
                  <input className="form-input" type="number" min="0" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span className="form-label" style={{ margin: 0 }}>Active (shown to clients)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description of this plan" />
              </div>

              {/* Features list */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Features</div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  These bullet points are shown on the plan card during client registration.
                </p>
                {form.features.map((feat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 13, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                      ✓ {feat}
                    </span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeFeature(idx)}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    className="form-input"
                    value={newFeature}
                    onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                    placeholder="e.g. Up to 25 users"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addFeature}>+ Add</button>
                </div>
              </div>

              {/* Module toggles */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Default modules for this plan</div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  These modules will be pre-selected when a client chooses this plan. They can still be customised individually.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {MODULE_LIST.map(m => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={form[m.key]}
                        onChange={e => setMod(m.key)(e.target.checked)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Create plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
