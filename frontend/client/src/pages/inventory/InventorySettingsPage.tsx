import { useState, useEffect, useCallback } from 'react';
import { stockApi, productsApi, configApi } from '@/api/businessApi';
import { restrictTo10Digits } from '@/utils/phone';
import type { Warehouse, WarehouseCustomField, Product, TenantConfig } from '@/types';
import toast from 'react-hot-toast';

interface InvStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean; }
interface InvFlowAction { id: number; status_key: string; status_label: string; target_module: string; action: string; is_active: boolean; description: string; }
interface StockAlert {
  id: number; product_id: number; product_name: string; product_sku: string;
  alert_type: string; year_month: string; message: string; is_read: boolean;
  email_sent_at: string | null; created_at: string;
}

// ─── Feature overview data ────────────────────────────────────────────────────
const FEATURES = [
  {
    section: 'Core Tracking', icon: '🏗️', color: '#10b981',
    items: [
      { icon: '📦', title: 'Real-Time Stock Visibility', desc: 'Instant stock levels, locations, and statuses.', status: 'live' },
      { icon: '↕️', title: 'Audit Trail (Movements)', desc: 'Complete history — who, what, when and why.', status: 'live' },
      { icon: '🏭', title: 'Multi-Location Warehouses', desc: 'Track stock across multiple warehouses.', status: 'live' },
      { icon: '🔀', title: 'Stock Transfers', desc: 'Move inventory between warehouses with full trail.', status: 'live' },
      { icon: '⚖️', title: 'Stock Adjustments', desc: 'Cycle count corrections — set absolute stock levels.', status: 'live' },
    ],
  },
  {
    section: 'Manufacturing', icon: '🏭', color: '#8b5cf6',
    items: [
      { icon: '📋', title: 'Bill of Materials (BOM)', desc: 'Raw materials and components needed per product.', status: 'coming_soon' },
      { icon: '🔧', title: 'Work-in-Progress (WIP)', desc: 'Track items on the production floor.', status: 'coming_soon' },
      { icon: '📐', title: 'Unit-of-Measure Conversion', desc: 'Buy in bulk, consume in smaller units.', status: 'coming_soon' },
      { icon: '📊', title: 'Raw Material Planning (MRP)', desc: 'Auto ordering based on production schedule.', status: 'coming_soon' },
    ],
  },
  {
    section: 'Retail / Sellers', icon: '🛒', color: '#3b82f6',
    items: [
      { icon: '🔄', title: 'Cycle Counting', desc: 'Count small stock subsets daily without full shutdowns.', status: 'coming_soon' },
      { icon: '↩️', title: 'Returns Management', desc: 'Inspect returns and move to sellable/damaged stock.', status: 'coming_soon' },
      { icon: '💳', title: 'POS Integration', desc: 'Real-time sync: every sale deducts from inventory.', status: 'coming_soon' },
    ],
  },
  {
    section: 'Wholesale / Logistics', icon: '🚚', color: '#f59e0b',
    items: [
      { icon: '🏷️', title: 'Lot & Batch Tracking', desc: 'Track expiry dates and manage product recalls.', status: 'coming_soon' },
      { icon: '📦', title: 'Kitting & Bundling', desc: 'Combine items into a single SKU bundle.', status: 'coming_soon' },
      { icon: '💰', title: 'Tiered Pricing / B2B', desc: 'Different price lists and bulk discounts per customer.', status: 'coming_soon' },
    ],
  },
];

// ─── Warehouse form type ──────────────────────────────────────────────────────
type WhForm = {
  name: string; code: string; phone: string; email: string;
  city: string; address: string;
  custom_data: WarehouseCustomField[];
};
const EMPTY_FORM: WhForm = {
  name: '', code: '', phone: '', email: '', city: '', address: '', custom_data: [],
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function InventorySettingsPage() {
  void FEATURES;
  const [tab, setTab] = useState<'warehouses' | 'limits' | 'statuses' | 'flow'>('warehouses');

  // ── Warehouse state ──────────────────────────────────────────────────────
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch]           = useState('');

  const [modalOpen, setModalOpen]     = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [form, setForm]               = useState<WhForm>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [confirmId, setConfirmId]     = useState<number | null>(null);

  // ── Buffer stock state ────────────────────────────────────────────────────
  const [allProducts, setAllProducts]       = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [thresholds, setThresholds]         = useState<Record<number, number>>({});
  const [limitSaving, setLimitSaving]       = useState(false);
  const [limitSearch, setLimitSearch]       = useState('');
  const [bufferConfig, setBufferConfig]     = useState<Pick<TenantConfig, 'buffer_stock_default' | 'buffer_stock_auto_enabled' | 'fast_moving_alert_enabled'>>({ buffer_stock_default: null, buffer_stock_auto_enabled: false, fast_moving_alert_enabled: true });
  const [configLoading, setConfigLoading]   = useState(false);
  const [configSaving, setConfigSaving]     = useState(false);
  const [alerts, setAlerts]                 = useState<StockAlert[]>([]);
  const [alertsLoading, setAlertsLoading]   = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);

  // ── Statuses state ──────────────────────────────────────────────────────
  const [statuses, setStatuses]             = useState<InvStatus[]>([]);
  const [statusLoading, setStatusLoading]   = useState(false);
  const [statusForm, setStatusForm]         = useState({ key: '', label: '', color: '#64748b', order: 0 });
  const [statusEditId, setStatusEditId]     = useState<number | null>(null);
  const [statusSaving, setStatusSaving]     = useState(false);

  // ── Flow actions state ──────────────────────────────────────────────────
  const [flowActions, setFlowActions]       = useState<InvFlowAction[]>([]);
  const [flowLoading, setFlowLoading]       = useState(false);
  const [flowForm, setFlowForm]             = useState({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
  const [flowEditId, setFlowEditId]         = useState<number | null>(null);
  const [flowSaving, setFlowSaving]         = useState(false);

  const loadStatuses = useCallback(() => {
    setStatusLoading(true);
    stockApi.inventoryStatuses.list()
      .then((r: { data?: { statuses?: InvStatus[] } }) => setStatuses(r.data?.statuses || []))
      .catch(() => toast.error('Failed to load statuses'))
      .finally(() => setStatusLoading(false));
  }, []);

  const loadFlowActions = useCallback(() => {
    setFlowLoading(true);
    stockApi.inventoryFlowActions.list()
      .then((r: { data?: { flow_actions?: InvFlowAction[] } }) => setFlowActions(r.data?.flow_actions || []))
      .catch(() => toast.error('Failed to load flow actions'))
      .finally(() => setFlowLoading(false));
  }, []);

  const loadConfig = useCallback(() => {
    setConfigLoading(true);
    configApi.get()
      .then((r: unknown) => {
        const res = r as { data?: TenantConfig };
        const d: TenantConfig = res.data ?? (r as TenantConfig);
        setBufferConfig({
          buffer_stock_default: d.buffer_stock_default ?? null,
          buffer_stock_auto_enabled: d.buffer_stock_auto_enabled ?? false,
          fast_moving_alert_enabled: d.fast_moving_alert_enabled ?? true,
        });
      })
      .catch(() => toast.error('Failed to load config.'))
      .finally(() => setConfigLoading(false));
  }, []);

  const loadAlerts = useCallback(() => {
    setAlertsLoading(true);
    stockApi.alerts()
      .then((r: { data?: { alerts?: StockAlert[]; unread_count?: number } }) => {
        setAlerts(r.data?.alerts || []);
        setUnreadCount(r.data?.unread_count ?? 0);
      })
      .catch(() => toast.error('Failed to load alerts.'))
      .finally(() => setAlertsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'statuses') loadStatuses();
    if (tab === 'flow') { loadStatuses(); loadFlowActions(); }
    if (tab === 'limits') { loadConfig(); loadAlerts(); }
  }, [tab, loadStatuses, loadFlowActions, loadConfig, loadAlerts]);

  const handleSaveBufferConfig = async () => {
    setConfigSaving(true);
    try {
      await configApi.update(bufferConfig);
      toast.success('Buffer settings saved.');
    } catch { toast.error('Failed to save settings.'); }
    finally { setConfigSaving(false); }
  };

  const handleMarkAlertRead = async (id: number) => {
    try {
      await stockApi.alertMarkRead(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { toast.error('Failed to mark as read.'); }
  };

  const handleSaveStatus = async () => {
    if (!statusForm.label) { toast.error('Label is required.'); return; }
    setStatusSaving(true);
    try {
      const key = statusForm.key || statusForm.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const payload = { ...statusForm, key };
      if (statusEditId) {
        await stockApi.inventoryStatuses.update(statusEditId, payload);
        toast.success('Status updated.');
      } else {
        await stockApi.inventoryStatuses.create(payload);
        toast.success('Status created.');
      }
      setStatusForm({ key: '', label: '', color: '#64748b', order: 0 });
      setStatusEditId(null);
      loadStatuses();
    } catch { toast.error('Failed to save status.'); }
    finally { setStatusSaving(false); }
  };

  const handleDeleteStatus = async (id: number) => {
    if (!confirm('Delete this status?')) return;
    try { await stockApi.inventoryStatuses.delete(id); toast.success('Deleted.'); loadStatuses(); }
    catch { toast.error('Failed to delete.'); }
  };

  const handleSaveFlow = async () => {
    if (!flowForm.status_key) { toast.error('Select a status.'); return; }
    setFlowSaving(true);
    try {
      if (flowEditId) {
        await stockApi.inventoryFlowActions.update(flowEditId, flowForm);
        toast.success('Flow action updated.');
      } else {
        await stockApi.inventoryFlowActions.create(flowForm);
        toast.success('Flow action created.');
      }
      setFlowForm({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
      setFlowEditId(null);
      loadFlowActions();
    } catch { toast.error('Failed to save flow action.'); }
    finally { setFlowSaving(false); }
  };

  const handleDeleteFlow = async (id: number) => {
    if (!confirm('Delete this flow action?')) return;
    try { await stockApi.inventoryFlowActions.delete(id); toast.success('Deleted.'); loadFlowActions(); }
    catch { toast.error('Failed to delete.'); }
  };

  useEffect(() => {
    productsApi.products.list({ is_active: 'true' })
      .then((r) => {
        const list: Product[] = r.data?.products || r.data?.results || [];
        setAllProducts(list);
        const t: Record<number, number> = {};
        list.forEach((p) => { t[p.id] = (p as Product & { low_stock_threshold?: number }).low_stock_threshold ?? 10; });
        setThresholds(t);
      })
      .catch(() => toast.error('Failed to load products.'))
      .finally(() => setProductsLoading(false));
  }, []);

  const handleSaveThreshold = async (productId: number, value: number) => {
    setLimitSaving(true);
    try {
      await productsApi.products.update(productId, { low_stock_threshold: value });
      toast.success('Buffer stock updated.');
    } catch {
      toast.error('Failed to update limit.');
    } finally { setLimitSaving(false); }
  };

  const filteredProducts = allProducts.filter((p) =>
    !limitSearch ||
    p.name.toLowerCase().includes(limitSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(limitSearch.toLowerCase())
  );

  const loadWarehouses = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> | undefined = showInactive ? { all: 'true' } : undefined;
    stockApi.warehouses(params)
      .then((r) => setWarehouses(r.data?.warehouses || []))
      .catch(() => toast.error('Failed to load warehouses.'))
      .finally(() => setLoading(false));
  }, [showInactive]);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditId(w.id);
    setForm({
      name: w.name, code: w.code, phone: w.phone || '',
      email: w.email || '', city: w.city || '', address: w.address || '',
      custom_data: w.custom_data || [],
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error('Name and code are required.'); return; }
    setSaving(true);
    try {
      if (editId) {
        await stockApi.updateWarehouse(editId, form);
        toast.success('Warehouse updated.');
      } else {
        await stockApi.createWarehouse(form);
        toast.success('Warehouse created.');
      }
      setModalOpen(false);
      loadWarehouses();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; code?: string[] } } };
      toast.error(ex?.response?.data?.message || ex?.response?.data?.code?.[0] || 'Failed to save warehouse.');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await stockApi.deleteWarehouse(id);
      toast.success('Warehouse deactivated.');
      setConfirmId(null);
      loadWarehouses();
    } catch { toast.error('Failed to deactivate.'); }
  };

  // Custom field helpers
  const addCustomField = () =>
    setForm((p) => ({
      ...p,
      custom_data: [...p.custom_data, { key: `field_${Date.now()}`, label: '', value: '' }],
    }));

  const updateCustomField = (idx: number, patch: Partial<WarehouseCustomField>) =>
    setForm((p) => ({
      ...p,
      custom_data: p.custom_data.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));

  const removeCustomField = (idx: number) =>
    setForm((p) => ({ ...p, custom_data: p.custom_data.filter((_, i) => i !== idx) }));

  const filtered = warehouses.filter((w) =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.code.toLowerCase().includes(search.toLowerCase()) ||
    (w.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Settings</h1>
          <p className="page-subtitle">Configure warehouses and view the feature roadmap.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {([
          { key: 'warehouses', label: '🏭 Warehouses' },
          { key: 'limits',     label: '⚠️ Buffer Stock' },
          { key: 'statuses',   label: '🏷️ Statuses' },
          { key: 'flow',       label: '⚡ Status Flow' },
        ] as { key: typeof tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: tab === t.key ? 'var(--color-primary)' : '#64748b',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ WAREHOUSES TAB ══════════════════════════════════════════════════ */}
      {tab === 'warehouses' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="Search warehouses…" value={search}
                onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 240, margin: 0 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary)' }} />
                Show inactive
              </label>
            </div>
            <button className="btn btn-primary" onClick={openAdd}>+ Add Warehouse</button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Warehouses ({filtered.length})</h2>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏭</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No warehouses yet</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  Add warehouses here — they'll appear in the stock dropdowns automatically.
                </div>
                <button className="btn btn-primary" onClick={openAdd}>+ Add First Warehouse</button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Code</th><th>Phone</th><th>City</th>
                      <th>Custom Fields</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{w.name}</div>
                          {w.email && <div style={{ fontSize: 11, color: '#94a3b8' }}>{w.email}</div>}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.code}</td>
                        <td style={{ fontSize: 13 }}>{w.phone || '—'}</td>
                        <td style={{ fontSize: 13 }}>
                          {w.city || '—'}
                          {w.address && (
                            <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {w.address}
                            </div>
                          )}
                        </td>
                        <td>
                          {(w.custom_data || []).length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {w.custom_data.map((cf, i) => (
                                <span key={i} style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 10 }}>
                                  {cf.label}: {cf.value || '—'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${w.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {w.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>
                            {w.is_active && (
                              <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(w.id)}>
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ BUFFER STOCK TAB ══════════════════════════════════════════════ */}
      {tab === 'limits' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Buffer Stock</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Set the minimum stock level per product. When available stock falls to or below this buffer,
                  the product turns <span style={{ color: '#f59e0b', fontWeight: 700 }}>orange (Buffer Stock)</span> on
                  the Stock Levels page.
                </div>
              </div>
            </div>
          </div>

          {/* Client buffer settings */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h2 className="card-title">Client settings</h2>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                Default buffer, auto analysis and fast-moving email alerts.
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ minWidth: 140 }}>
                <label className="form-label">Default buffer stock</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={bufferConfig.buffer_stock_default ?? ''}
                  onChange={(e) => setBufferConfig((p) => ({
                    ...p, buffer_stock_default: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0),
                  }))}
                  placeholder="10"
                  style={{ width: 100 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={bufferConfig.buffer_stock_auto_enabled ?? false}
                  onChange={(e) => setBufferConfig((p) => ({ ...p, buffer_stock_auto_enabled: e.target.checked }))}
                  style={{ accentColor: 'var(--color-primary)' }} />
                Enable auto monthly analysis
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={bufferConfig.fast_moving_alert_enabled ?? true}
                  onChange={(e) => setBufferConfig((p) => ({ ...p, fast_moving_alert_enabled: e.target.checked }))}
                  style={{ accentColor: 'var(--color-primary)' }} />
                Fast-moving product email alerts
              </label>
              <button className="btn btn-primary" disabled={configSaving || configLoading} onClick={handleSaveBufferConfig}>
                {configSaving ? 'Saving…' : configLoading ? 'Loading…' : 'Save settings'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input className="form-input" placeholder="Search product / SKU…" value={limitSearch}
              onChange={(e) => setLimitSearch(e.target.value)} style={{ maxWidth: 280, margin: 0 }} />
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Products ({filteredProducts.length})</h2>
            </div>
            {productsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No products found.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th style={{ width: 160 }}>Buffer Stock</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const val = thresholds[p.id] ?? bufferConfig.buffer_stock_default ?? 10;
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{p.sku}</td>
                          <td style={{ fontSize: 13 }}>{p.unit}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                className="form-input"
                                type="number"
                                min={0}
                                value={val}
                                onChange={(e) => setThresholds((prev) => ({
                                  ...prev, [p.id]: Math.max(0, parseInt(e.target.value) || 0),
                                }))}
                                style={{ width: 90, margin: 0, textAlign: 'center' }}
                              />
                              {val > 0 && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, color: '#f59e0b',
                                  background: '#fffbeb', border: '1px solid #fde68a',
                                  padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                                }}>
                                  ≤ {val} = Buffer
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={limitSaving}
                              onClick={() => handleSaveThreshold(p.id, thresholds[p.id] ?? bufferConfig.buffer_stock_default ?? 10)}
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stock alerts (fast-moving, low-stock) */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h2 className="card-title">Stock alerts</h2>
              {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            {alertsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No alerts yet. Fast-moving product alerts appear here when the monthly analysis runs.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Month</th>
                      <th>Message</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id} style={{ opacity: a.is_read ? 0.7 : 1 }}>
                        <td><strong>{a.product_name}</strong> <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{a.product_sku}</span></td>
                        <td>
                          <span className={`badge ${a.alert_type === 'fast_moving' ? 'badge-info' : 'badge-warning'}`}>
                            {a.alert_type === 'fast_moving' ? 'Fast-moving' : a.alert_type}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{a.year_month || '—'}</td>
                        <td style={{ fontSize: 13 }}>{a.message}</td>
                        <td>
                          {!a.is_read && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleMarkAlertRead(a.id)}>
                              Mark read
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ STATUSES TAB ══════════════════════════════════════════════════ */}
      {tab === 'statuses' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Inventory Approval Statuses</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Define the statuses an inventory approval request can have. These appear in the Approvals page.
              </div>
            </div>
          </div>

          {/* Add / Edit form */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h2 className="card-title">{statusEditId ? 'Edit Status' : 'Add Status'}</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
                  <label className="form-label">Label *</label>
                  <input className="form-input" placeholder="e.g. In Progress"
                    value={statusForm.label}
                    onChange={(e) => setStatusForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100 }}>
                  <label className="form-label">Key</label>
                  <input className="form-input" placeholder="auto-generated"
                    value={statusForm.key}
                    onChange={(e) => setStatusForm((f) => ({ ...f, key: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ width: 70 }}>
                  <label className="form-label">Color</label>
                  <input type="color" value={statusForm.color}
                    onChange={(e) => setStatusForm((f) => ({ ...f, color: e.target.value }))}
                    style={{ width: '100%', height: 36, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}
                  />
                </div>
                <div className="form-group" style={{ width: 70 }}>
                  <label className="form-label">Order</label>
                  <input className="form-input" type="number" value={statusForm.order}
                    onChange={(e) => setStatusForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, paddingBottom: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={statusSaving}>
                    {statusSaving ? 'Saving…' : statusEditId ? 'Update' : 'Add'}
                  </button>
                  {statusEditId && (
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      setStatusEditId(null);
                      setStatusForm({ key: '', label: '', color: '#64748b', order: 0 });
                    }}>Cancel</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status list */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Statuses ({statuses.length})</h2>
            </div>
            {statusLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : statuses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No statuses yet.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th><th>Label</th><th>Key</th><th>Color</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statuses.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontSize: 13 }}>{s.order}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                            background: s.color + '20', color: s.color,
                          }}>{s.label}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{s.key}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: s.color }} />
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.color}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setStatusEditId(s.id);
                              setStatusForm({ key: s.key, label: s.label, color: s.color, order: s.order });
                            }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStatus(s.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ STATUS FLOW TAB ═════════════════════════════════════════════════ */}
      {tab === 'flow' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Status Flow Actions</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Define what happens when an inventory approval reaches a specific status.
                For example, when status changes to "Approved", forward it to the Dispatch module automatically.
              </div>
            </div>
          </div>

          {/* Add / Edit flow form */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h2 className="card-title">{flowEditId ? 'Edit Flow Action' : 'Add Flow Action'}</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">When status is *</label>
                  <select className="form-input" value={flowForm.status_key}
                    onChange={(e) => setFlowForm((f) => ({ ...f, status_key: e.target.value }))}>
                    <option value="">— Select status —</option>
                    {statuses.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Forward to module</label>
                  <select className="form-input" value={flowForm.target_module}
                    onChange={(e) => setFlowForm((f) => ({ ...f, target_module: e.target.value }))}>
                    <option value="none">Stay in Inventory only</option>
                    <option value="dispatch">Dispatch</option>
                    <option value="invoices">Invoices</option>
                    <option value="orders">Orders</option>
                    <option value="crm">CRM</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Action</label>
                  <select className="form-input" value={flowForm.action}
                    onChange={(e) => setFlowForm((f) => ({ ...f, action: e.target.value }))}>
                    <option value="notify_only">Notify Only</option>
                    <option value="forward_dispatch">Forward to Dispatch</option>
                    <option value="forward_invoices">Forward to Invoices</option>
                    <option value="forward_orders">Forward to Orders</option>
                    <option value="execute_stock">Execute Stock Movement</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input className="form-input" placeholder="What does this flow do?"
                  value={flowForm.description}
                  onChange={(e) => setFlowForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFlow} disabled={flowSaving}>
                  {flowSaving ? 'Saving…' : flowEditId ? 'Update' : 'Add Flow Action'}
                </button>
                {flowEditId && (
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setFlowEditId(null);
                    setFlowForm({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
                  }}>Cancel</button>
                )}
              </div>
            </div>
          </div>

          {/* Flow actions list */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Flow Actions ({flowActions.length})</h2>
            </div>
            {flowLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : flowActions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
                No flow actions yet. Add one above to automate status transitions.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When Status</th><th>Forward To</th><th>Action</th><th>Description</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowActions.map((fa) => (
                      <tr key={fa.id}>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                            background: '#f1f5f9', color: '#334155',
                          }}>{fa.status_label}</span>
                        </td>
                        <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{fa.target_module === 'none' ? 'Inventory only' : fa.target_module}</td>
                        <td style={{ fontSize: 13 }}>
                          {fa.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{fa.description || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setFlowEditId(fa.id);
                              setFlowForm({ status_key: fa.status_key, target_module: fa.target_module, action: fa.action, description: fa.description });
                            }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFlow(fa.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ FEATURE OVERVIEW TAB (commented out) ═════════════════════════════
      {tab === 'features' && (
        <>
          <div className="card" style={{ marginBottom: 28 }}>
            <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Module Progress</div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', maxWidth: 400 }}>
                  <div style={{ height: '100%', width: `${(liveCount / totalCount) * 100}%`, background: 'var(--color-primary)', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{liveCount} of {totalCount} features live</div>
              </div>
            </div>
          </div>
        </>
      )}
      ══════════════════════════════════════════════════════════════════════════ */}

      {/* ═══ ADD / EDIT WAREHOUSE POPUP ══════════════════════════════════════ */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setModalOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{editId ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>✕ Close</button>
            </div>
            <form className="card-body" onSubmit={handleSave}>

              {/* Basic details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Warehouse Name *</label>
                  <input className="form-input" placeholder="e.g. Main Store"
                    value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Warehouse Code *</label>
                  <input className="form-input" placeholder="e.g. WH-001"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" type="tel" placeholder="9876543210" maxLength={10}
                    value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: restrictTo10Digits(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="warehouse@company.com"
                    value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="e.g. Mumbai"
                    value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-input" rows={2} placeholder="Full address…"
                  value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>

              {/* Custom fields */}
              <div style={{ margin: '8px 0 16px', padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Custom Fields</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Add any extra info — capacity, contact person, zone, etc.</div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomField}>
                    + Add Field
                  </button>
                </div>

                {form.custom_data.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8', fontSize: 13 }}>
                    No custom fields yet. Click "+ Add Field" to add one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.custom_data.map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="form-input" placeholder="Field name (e.g. Capacity)"
                          value={cf.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || cf.key;
                            updateCustomField(idx, { label, key });
                          }}
                          style={{ flex: 1, margin: 0 }} />
                        <input className="form-input" placeholder="Value (e.g. 5000 units)"
                          value={cf.value}
                          onChange={(e) => updateCustomField(idx, { value: e.target.value })}
                          style={{ flex: 1, margin: 0 }} />
                        <button type="button" className="btn btn-danger btn-sm"
                          onClick={() => removeCustomField(idx)}
                          style={{ flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update Warehouse' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DEACTIVATE CONFIRM ══════════════════════════════════════════════ */}
      {confirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmId(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Deactivate Warehouse</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmId(null)}>✕</button>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, color: '#475569' }}>
                Are you sure? This warehouse will be hidden from all stock dropdowns. Existing stock records are preserved.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDeactivate(confirmId!)}>
                  Yes, Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
