import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, productsApi } from '@/api/businessApi';
import type { Warehouse, StockMovement, Product, StockRecord } from '@/types';
import toast from 'react-hot-toast';

const intQty = (v: string | number | undefined | null) => Math.round(parseFloat(String(v ?? 0)));

export default function TransfersPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [transfers, setTransfers]   = useState<StockMovement[]>([]);
  const [records, setRecords]       = useState<StockRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');

  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [form, setForm] = useState({
    product: '', from_warehouse: '', to_warehouse: '',
    quantity: '', reference: '',
  });

  // Bulk transfer: shared warehouses + product/qty rows
  type BulkRow = { product: string; quantity: string };
  const [bulkForm, setBulkForm] = useState({ from_warehouse: '', to_warehouse: '', reference: '' });
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ product: '', quantity: '' }]);

  // Detail popup
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      stockApi.warehouses().then((r) => setWarehouses(r.data?.warehouses || [])),
      productsApi.products.list({ is_active: 'true' }).then((r) =>
        setProducts(r.data?.products || r.data?.results || [])),
      stockApi.movements({ movement_type: 'transfer', limit: '50' }).then((r) =>
        setTransfers(r.data?.movements || [])),
      stockApi.records().then((r) => setRecords(r.data?.stock || [])),
    ])
      .catch(() => toast.error('Failed to load data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.from_warehouse || !form.to_warehouse || !form.quantity) {
      toast.error('All fields are required.');
      return;
    }
    if (form.from_warehouse === form.to_warehouse) {
      toast.error('Source and destination warehouses must be different.');
      return;
    }
    const qty = Math.round(parseFloat(form.quantity));
    const buffer = (prod as Product & { low_stock_threshold?: number })?.low_stock_threshold ?? 10;
    const remaining = fromStock - qty;
    if (remaining <= buffer && prod && fromWh && !window.confirm(
      `Buffer stock limit is crossing. ${prod.name} will have ${remaining} left (buffer: ${buffer}). Continue?`
    )) {
      return;
    }
    setSaving(true);
    try {
      await stockApi.transfer({
        product: parseInt(form.product),
        from_warehouse: parseInt(form.from_warehouse),
        to_warehouse: parseInt(form.to_warehouse),
        quantity: Math.round(parseFloat(form.quantity)),
        reference: form.reference,
      });
      toast.success('Transfer completed successfully.');
      setForm({ product: '', from_warehouse: '', to_warehouse: '', quantity: '', reference: '' });
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Transfer failed.');
    } finally { setSaving(false); }
  };

  const handleBulkTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm.from_warehouse || !bulkForm.to_warehouse) {
      toast.error('Select source and destination warehouses.');
      return;
    }
    if (bulkForm.from_warehouse === bulkForm.to_warehouse) {
      toast.error('Source and destination warehouses must be different.');
      return;
    }
    const validRows = bulkRows.filter((r) => r.product && r.quantity && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      toast.error('Add at least one product with quantity.');
      return;
    }
    // Check buffer stock limit — warn if transfer would leave stock at or below buffer
    const fromWhBulk = warehouses.find((w) => w.id === parseInt(bulkForm.from_warehouse));
    const crossing: { name: string; remaining: number; buffer: number }[] = [];
    for (const r of validRows) {
      const p = products.find((x) => x.id === parseInt(r.product));
      const rec = (p && fromWhBulk) ? records.find((x) => x.product === p.id && x.warehouse === fromWhBulk.id) : null;
      const fromStock = rec ? intQty(rec.quantity) : 0;
      const qty = Math.round(parseFloat(r.quantity));
      const buffer = (p as Product & { low_stock_threshold?: number })?.low_stock_threshold ?? 10;
      const remaining = fromStock - qty;
      if (remaining <= buffer && p) {
        crossing.push({ name: p.name, remaining, buffer });
      }
    }
    if (crossing.length > 0 && !window.confirm(
      `Buffer stock limit is crossing for:\n${crossing.map((c) => `• ${c.name}: remaining ${c.remaining} (buffer: ${c.buffer})`).join('\n')}\n\nDo you want to continue?`
    )) {
      return;
    }
    setSaving(true);
    try {
      await stockApi.transfer({
        from_warehouse: parseInt(bulkForm.from_warehouse),
        to_warehouse: parseInt(bulkForm.to_warehouse),
        reference: bulkForm.reference,
        items: validRows.map((r) => ({ product: parseInt(r.product), quantity: Math.round(parseFloat(r.quantity)) })),
      });
      toast.success(`Transferred ${validRows.length} product(s) successfully.`);
      setBulkForm({ from_warehouse: '', to_warehouse: '', reference: '' });
      setBulkRows([{ product: '', quantity: '' }]);
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Bulk transfer failed.');
    } finally { setSaving(false); }
  };

  const addBulkRow = () => setBulkRows((r) => [...r, { product: '', quantity: '' }]);
  const removeBulkRow = (idx: number) =>
    setBulkRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== idx)));

  const fromWh = warehouses.find((w) => w.id === parseInt(form.from_warehouse));
  const toWh   = warehouses.find((w) => w.id === parseInt(form.to_warehouse));
  const prod   = products.find((p) => p.id === parseInt(form.product));

  // Stock info for selected product
  const selectedRecords = prod
    ? records.filter((r) => r.product === prod.id)
    : [];
  // Stock at selected "From Warehouse"
  const fromRecord = (prod && fromWh)
    ? selectedRecords.find((r) => r.warehouse === fromWh.id)
    : null;
  const fromStock = fromRecord ? intQty(fromRecord.quantity) : 0;

  // Search filtered transfers
  const filteredTransfers = transfers.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.product_name?.toLowerCase().includes(q) ||
      t.warehouse_name?.toLowerCase().includes(q) ||
      ((t as any).destination_warehouse_name || '').toLowerCase().includes(q) ||
      (t.reference || '').toLowerCase().includes(q)
    );
  });

  // Detail popup data
  const detailRecords = detailProduct
    ? records.filter((r) => r.product === detailProduct.id)
    : [];
  const detailTransfers = detailProduct
    ? transfers.filter((t) => t.product === detailProduct.id)
    : [];

  const openDetail = (p: Product) => {
    setDetailProduct(p);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Transfers</h1>
          <p className="page-subtitle">Move stock seamlessly between warehouses.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24, alignItems: 'start' }}>

        {/* Transfer Form */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h2 className="card-title">🔀 New Transfer</h2>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setMode('single')}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: mode === 'single' ? '#fff' : 'transparent',
                  boxShadow: mode === 'single' ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                  color: mode === 'single' ? '#1e40af' : '#64748b',
                }}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: mode === 'bulk' ? '#fff' : 'transparent',
                  boxShadow: mode === 'bulk' ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                  color: mode === 'bulk' ? '#1e40af' : '#64748b',
                }}
              >
                Bulk
              </button>
            </div>
          </div>

          {mode === 'single' && (
          <form onSubmit={handleTransfer}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={form.product}
                  onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} required>
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'end', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From Warehouse *</label>
                  <select className="form-select" value={form.from_warehouse}
                    onChange={(e) => setForm((p) => ({ ...p, from_warehouse: e.target.value }))} required>
                    <option value="">Source…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === parseInt(form.to_warehouse)}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ textAlign: 'center', fontSize: 20, paddingBottom: 8, color: '#94a3b8' }}>→</div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To Warehouse *</label>
                  <select className="form-select" value={form.to_warehouse}
                    onChange={(e) => setForm((p) => ({ ...p, to_warehouse: e.target.value }))} required>
                    <option value="">Destination…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === parseInt(form.from_warehouse)}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock at selected from-warehouse */}
              {prod && fromWh && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: fromStock > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${fromStock > 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 8, padding: '8px 14px', marginTop: 10,
                }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    <strong>{prod.name}</strong> at <strong>{fromWh.name}</strong>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: fromStock > 0 ? '#15803d' : '#ef4444' }}>
                    {fromStock} in stock
                  </span>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Transfer Count *</label>
                <input className="form-input" type="number" min="1" step="1"
                  max={fromStock > 0 ? fromStock : undefined}
                  placeholder="Enter quantity to transfer" value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required />
                {prod && fromWh && fromStock > 0 && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Max: <strong>{fromStock}</strong> available at {fromWh.name}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Reference</label>
                <input className="form-input" placeholder="Transfer note or reference no."
                  value={form.reference}
                  onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>

              {/* Preview */}
              {prod && fromWh && toWh && form.quantity && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600, marginBottom: 4 }}>Transfer Preview</div>
                  <div style={{ fontSize: 13, color: '#1e40af' }}>
                    Move <strong>{form.quantity}</strong> × {prod.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                    {fromWh.name} → {toWh.name}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
                {saving ? 'Processing…' : '🔀 Execute Transfer'}
              </button>
            </div>
          </form>
          )}

          {mode === 'bulk' && (
          <form onSubmit={handleBulkTransfer}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'end', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From Warehouse *</label>
                  <select className="form-select" value={bulkForm.from_warehouse}
                    onChange={(e) => setBulkForm((p) => ({ ...p, from_warehouse: e.target.value }))} required>
                    <option value="">Source…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === parseInt(bulkForm.to_warehouse)}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ textAlign: 'center', fontSize: 20, paddingBottom: 8, color: '#94a3b8' }}>→</div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To Warehouse *</label>
                  <select className="form-select" value={bulkForm.to_warehouse}
                    onChange={(e) => setBulkForm((p) => ({ ...p, to_warehouse: e.target.value }))} required>
                    <option value="">Destination…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === parseInt(bulkForm.from_warehouse)}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reference</label>
                <input className="form-input" placeholder="Transfer note or reference no."
                  value={bulkForm.reference}
                  onChange={(e) => setBulkForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Products *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addBulkRow}>
                    + Add row
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr><th>Product</th><th style={{ width: 100 }}>Qty</th><th style={{ width: 44 }}></th></tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, idx) => {
                        const p = products.find((x) => x.id === parseInt(row.product));
                        const wh = warehouses.find((w) => w.id === parseInt(bulkForm.from_warehouse));
                        const rec = (p && wh) ? records.find((r) => r.product === p.id && r.warehouse === wh.id) : null;
                        const maxQty = rec ? intQty(rec.quantity) : 0;
                        return (
                          <tr key={idx}>
                            <td>
                              <select className="form-select" value={row.product}
                                onChange={(e) => setBulkRows((r) => r.map((x, i) => i === idx ? { ...x, product: e.target.value } : x))}
                                style={{ margin: 0, minWidth: 160 }}>
                                <option value="">Select product…</option>
                                {products.map((pr) => (
                                  <option key={pr.id} value={pr.id}>{pr.name} ({pr.sku})</option>
                                ))}
                              </select>
                              {p && wh ? (
                                <div style={{
                                  fontSize: 11, marginTop: 4,
                                  color: maxQty > 0 ? '#15803d' : '#dc2626',
                                  fontWeight: 600,
                                }}>
                                  {maxQty} in stock at {wh.name}
                                </div>
                              ) : p && !bulkForm.from_warehouse ? (
                                <div style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
                                  Select source warehouse above to see available stock
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <input className="form-input" type="number" min="0" step="1"
                                value={row.quantity}
                                placeholder={maxQty > 0 ? `Max: ${maxQty}` : ''}
                                max={maxQty > 0 ? maxQty : undefined}
                                onChange={(e) => setBulkRows((r) => r.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                                style={{ width: 80, margin: 0, textAlign: 'center' }} />
                            </td>
                            <td>
                              <button type="button" className="btn btn-danger btn-sm"
                                onClick={() => removeBulkRow(idx)}
                                disabled={bulkRows.length <= 1}
                                title="Remove row">
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Add one or more products with quantities. Empty rows are ignored.
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
                {saving ? 'Processing…' : `🔀 Execute Bulk Transfer (${bulkRows.filter((r) => r.product && parseFloat(r.quantity) > 0).length} items)`}
              </button>
            </div>
          </form>
          )}
        </div>

        {/* Recent Transfers */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">Recent Transfers</h2>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            <input className="form-input" placeholder="Search product, warehouse, reference…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ margin: 0 }} />
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
          ) : filteredTransfers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
              <div>{search ? 'No transfers match your search.' : 'No transfers yet.'}</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th>From</th><th>To</th><th>Qty</th><th>Ref</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((t) => {
                    const tProd = products.find((p) => p.id === t.product);
                    return (
                      <tr key={t.id}>
                        <td><strong>{t.product_name}</strong></td>
                        <td style={{ fontSize: 12 }}>{t.warehouse_name}</td>
                        <td style={{ fontSize: 12, color: '#10b981' }}>
                          {(t as any).destination_warehouse_name || '—'}
                        </td>
                        <td><strong>{intQty(t.quantity)}</strong></td>
                        <td style={{ fontSize: 11, color: '#64748b', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.reference || '—'}
                        </td>
                        <td style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {tProd && (
                            <button type="button" className="btn btn-secondary btn-sm"
                              onClick={() => openDetail(tProd)}>
                              History
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Stock Detail Popup ── */}
      {detailOpen && detailProduct && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setDetailOpen(false)}>
          <div className="card" style={{ width: '90%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">📦 {detailProduct.name} — History</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setDetailOpen(false)}>✕ Close</button>
            </div>
            <div className="card-body">

              {/* Product info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 13, marginBottom: 20 }}>
                <span style={{ color: '#64748b' }}>SKU:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{detailProduct.sku}</span>
                <span style={{ color: '#64748b' }}>Unit:</span>
                <span style={{ fontWeight: 600 }}>{detailProduct.unit || '—'}</span>
                <span style={{ color: '#64748b' }}>Price:</span>
                <span style={{ fontWeight: 600 }}>{detailProduct.price ?? '—'}</span>
              </div>

              {/* Stock per warehouse */}
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Stock by Warehouse</h3>
              {detailRecords.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>No stock records found.</div>
              ) : (
                <div className="table-wrapper" style={{ marginBottom: 20 }}>
                  <table className="table">
                    <thead>
                      <tr><th>Warehouse</th><th>Quantity</th><th>Reserved</th><th>Available</th></tr>
                    </thead>
                    <tbody>
                      {detailRecords.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.warehouse_name}</strong></td>
                          <td>{intQty(r.quantity)}</td>
                          <td style={{ color: '#64748b' }}>{intQty(r.reserved_quantity)}</td>
                          <td><strong style={{ color: '#15803d' }}>{intQty(r.available_quantity)}</strong></td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td>Total</td>
                        <td>{detailRecords.reduce((s, r) => s + intQty(r.quantity), 0)}</td>
                        <td style={{ color: '#64748b' }}>{detailRecords.reduce((s, r) => s + intQty(r.reserved_quantity), 0)}</td>
                        <td style={{ color: '#15803d' }}>{detailRecords.reduce((s, r) => s + intQty(r.available_quantity), 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Transfer history */}
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Transfer History</h3>
              {detailTransfers.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>No transfers recorded.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr><th>From</th><th>To</th><th>Qty</th><th>Reference</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {detailTransfers.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontSize: 12 }}>{t.warehouse_name}</td>
                          <td style={{ fontSize: 12, color: '#10b981' }}>{(t as any).destination_warehouse_name || '—'}</td>
                          <td><strong>{intQty(t.quantity)}</strong></td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{t.reference || '—'}</td>
                          <td style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan={2}>Total Transferred</td>
                        <td>{detailTransfers.reduce((s, t) => s + intQty(t.quantity), 0)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
