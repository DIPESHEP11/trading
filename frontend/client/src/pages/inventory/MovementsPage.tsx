import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, productsApi } from '@/api/businessApi';
import type { StockMovement, Warehouse, Product } from '@/types';
import toast from 'react-hot-toast';

type MovementType = '' | 'in' | 'out' | 'transfer' | 'adjustment' | 'return';

const TYPE_PILLS: { key: MovementType; label: string; color: string }[] = [
  { key: '',           label: 'All',        color: '#64748b' },
  { key: 'in',        label: '📥 In',       color: '#10b981' },
  { key: 'out',       label: '📤 Out',      color: '#ef4444' },
  { key: 'transfer',  label: '🔀 Transfer', color: '#8b5cf6' },
  { key: 'return',    label: '↩️ Return',   color: '#3b82f6' },
  { key: 'adjustment', label: '⚖️ Adjust',  color: '#f59e0b' },
];

const TYPE_BADGE_CLASS: Record<string, string> = {
  in: 'badge-success', out: 'badge-danger', transfer: 'badge-primary',
  return: 'badge-primary', adjustment: 'badge-warning',
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [typeFilter, setTypeFilter] = useState<MovementType>('');
  const [whFilter, setWhFilter]   = useState('');
  const [search, setSearch]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  // Add movement modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState({
    product: '', warehouse: '', movement_type: 'in', quantity: '',
    reference: '', notes: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (typeFilter) params.movement_type = typeFilter;
    if (whFilter) params.warehouse = whFilter;
    if (search) params.search = search;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    Promise.all([
      stockApi.movements(params).then((r) => setMovements(r.data?.movements || [])),
      stockApi.warehouses().then((r) => setWarehouses(r.data?.warehouses || [])),
      productsApi.products.list({ is_active: 'true' }).then((r) =>
        setProducts(r.data?.products || r.data?.results || [])),
    ])
      .catch(() => toast.error('Failed to load movements.'))
      .finally(() => setLoading(false));
  }, [typeFilter, whFilter, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const counts: Record<string, number> = { '': movements.length };
  TYPE_PILLS.slice(1).forEach((t) => {
    counts[t.key] = movements.filter((m) => m.movement_type === t.key).length;
  });

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.product || !addForm.warehouse || !addForm.quantity) {
      toast.error('Product, warehouse and quantity are required.');
      return;
    }
    setAddSaving(true);
    try {
      await stockApi.addMovement({
        product: parseInt(addForm.product),
        warehouse: parseInt(addForm.warehouse),
        movement_type: addForm.movement_type,
        quantity: parseFloat(addForm.quantity),
        reference: addForm.reference,
        notes: addForm.notes,
      });
      toast.success('Movement recorded.');
      setAddOpen(false);
      setAddForm({ product: '', warehouse: '', movement_type: 'in', quantity: '', reference: '', notes: '' });
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to record movement.');
    } finally { setAddSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Movements</h1>
          <p className="page-subtitle">Complete audit trail of every stock change.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Record Movement</button>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TYPE_PILLS.map((t) => {
          const active = typeFilter === t.key;
          return (
            <button key={t.key} onClick={() => setTypeFilter(active && t.key ? '' as MovementType : t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: `1.5px solid ${active ? t.color : '#e2e8f0'}`,
                background: active ? t.color : '#fff',
                color: active ? '#fff' : '#64748b', transition: 'all 0.15s',
              }}>
              {t.label}
              <span style={{
                background: active ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: active ? '#fff' : '#64748b',
                borderRadius: 10, padding: '1px 6px', fontSize: 11,
              }}>
                {t.key === '' ? movements.length : counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search product…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220, margin: 0 }} />
        <select className="form-select" value={whFilter} onChange={(e) => setWhFilter(e.target.value)}
          style={{ maxWidth: 180, margin: 0 }}>
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input type="date" className="form-input" value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)} style={{ maxWidth: 160, margin: 0 }} />
        <input type="date" className="form-input" value={dateTo}
          onChange={(e) => setDateTo(e.target.value)} style={{ maxWidth: 160, margin: 0 }} />
        {(typeFilter || whFilter || search || dateFrom || dateTo) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setTypeFilter(''); setWhFilter(''); setSearch(''); setDateFrom(''); setDateTo(''); }}>
            Clear Filters
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Movement History ({movements.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>↕️</div>
            <div>No movements found.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th><th>Product</th><th>Warehouse</th>
                  <th>Qty</th><th>Reference</th><th>Notes</th><th>Custom</th><th>By</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${TYPE_BADGE_CLASS[m.movement_type] ?? 'badge-primary'}`}>
                        {m.movement_type.toUpperCase()}
                      </span>
                    </td>
                    <td><strong>{m.product_name}</strong></td>
                    <td>{m.warehouse_name}</td>
                    <td><strong>{m.quantity}</strong></td>
                    <td style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.reference || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.notes || '—'}
                    </td>
                    <td>
                      {m.custom_data && Object.keys(m.custom_data).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Object.entries(m.custom_data).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 8 }}>
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{m.performed_by_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Movement Popup */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !addSaving && setAddOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Record Movement</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(false)}>✕ Close</button>
            </div>
            <form className="card-body" onSubmit={handleAddMovement}>
              <div className="form-group">
                <label className="form-label">Movement Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { key: 'in', label: '📥 Stock In', color: '#10b981' },
                    { key: 'out', label: '📤 Stock Out', color: '#ef4444' },
                    { key: 'return', label: '↩️ Return', color: '#3b82f6' },
                    { key: 'adjustment', label: '⚖️ Adjustment', color: '#f59e0b' },
                  ].map((t) => (
                    <button type="button" key={t.key}
                      onClick={() => setAddForm((p) => ({ ...p, movement_type: t.key }))}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', border: `2px solid ${addForm.movement_type === t.key ? t.color : '#e2e8f0'}`,
                        background: addForm.movement_type === t.key ? t.color + '18' : '#fff',
                        color: addForm.movement_type === t.key ? t.color : '#64748b',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {addForm.movement_type === 'adjustment' && (
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    Adjustment sets the stock to the exact quantity entered (cycle count correction).
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={addForm.product}
                  onChange={(e) => setAddForm((p) => ({ ...p, product: e.target.value }))} required>
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Warehouse *</label>
                <select className="form-select" value={addForm.warehouse}
                  onChange={(e) => setAddForm((p) => ({ ...p, warehouse: e.target.value }))} required>
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {addForm.movement_type === 'adjustment' ? 'New Stock Quantity *' : 'Quantity *'}
                </label>
                <input className="form-input" type="number" min="0" step="0.001" placeholder="0"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((p) => ({ ...p, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input className="form-input" placeholder="Order no., Invoice no., etc."
                  value={addForm.reference}
                  onChange={(e) => setAddForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} placeholder="Optional notes…"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addSaving}>
                  {addSaving ? 'Saving…' : 'Record Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
