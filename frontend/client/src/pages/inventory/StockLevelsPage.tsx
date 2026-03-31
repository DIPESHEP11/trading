import React, { useState, useEffect, useCallback, useRef } from 'react';
import { stockApi, productsApi } from '@/api/businessApi';
import type { StockRecord, Warehouse, Product } from '@/types';
import toast from 'react-hot-toast';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'in_stock', label: 'In Stock' },
  { key: 'low_stock', label: 'Low Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
  { key: 'returned', label: 'Returned' },
];

function getStatus(avail: number, threshold = 10) {
  if (avail <= 0) return 'out_of_stock';
  if (avail <= threshold) return 'low_stock';
  return 'in_stock';
}

const intQty = (v: string | number | undefined | null) => Math.round(parseFloat(String(v ?? 0)));

export default function StockLevelsPage() {
  const [records, setRecords]     = useState<StockRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [whFilter, setWhFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add movement modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState({
    product: '', warehouse: '', movement_type: 'in', quantity: '',
    reference: '', notes: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  // Item type: product | raw_material (for Stock In / Return / Adjustment)
  const [itemType, setItemType]       = useState<'product' | 'raw_material'>('product');
  const [rmInput, setRmInput]         = useState('');
  const [rmSuggestions, setRmSuggestions] = useState<Product[]>([]);
  const [rmSelected, setRmSelected]   = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const rmRef = useRef<HTMLDivElement>(null);

  // Custom fields for movement
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (whFilter) params.warehouse = whFilter;
    Promise.all([
      stockApi.records(params).then((r) => setRecords(r.data?.stock || [])),
      stockApi.warehouses().then((r) => setWarehouses(r.data?.warehouses || [])),
      productsApi.products.list({ is_active: 'true' }).then((r) =>
        setProducts(r.data?.products || r.data?.results || [])),
    ])
      .catch(() => toast.error('Failed to load stock data.'))
      .finally(() => setLoading(false));
  }, [search, whFilter]);

  useEffect(() => { load(); }, [load]);

  const isReturnedView = statusFilter === 'returned';

  const filtered = records.filter((r) => {
    const retQty = parseFloat(String(r.returned_quantity ?? 0));
    if (isReturnedView) return retQty > 0;
    const avail = parseFloat(String(r.available_quantity ?? 0));
    const threshold = r.low_stock_threshold ?? 10;
    if (!statusFilter) return true;
    if (getStatus(avail, threshold) !== statusFilter) return false;
    return true;
  });

  const totalQty = records.reduce((s, r) => s + parseFloat(String(r.quantity ?? 0)), 0);
  const totalReturned = records.reduce((s, r) => s + parseFloat(String(r.returned_quantity ?? 0)), 0);
  const lowStockCount = records.filter((r) => {
    const a = parseFloat(String(r.available_quantity ?? 0));
    return a > 0 && a <= (r.low_stock_threshold ?? 10);
  }).length;
  const outOfStockCount = records.filter((r) => parseFloat(String(r.available_quantity ?? 0)) <= 0).length;

  // edit & return both use a dropdown with all items + auto-fill
  const isEditMode = addForm.movement_type === 'edit';
  const useDropdownMode = addForm.movement_type === 'edit' || addForm.movement_type === 'return';

  const handleEditProductSelect = (productId: string) => {
    setAddForm((p) => ({ ...p, product: productId }));
    if (!productId) return;
    const rec = records.find((r) => String(r.product) === productId);
    if (rec) {
      setAddForm((p) => ({
        ...p,
        product: productId,
        warehouse: String(rec.warehouse),
        quantity: isEditMode ? String(intQty(rec.quantity)) : '',
      }));
    }
  };

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    let productId = addForm.product;
    const movementType = isEditMode ? 'adjustment' : addForm.movement_type;

    // ── Raw material path (only for stock-in / adjustment modes) ──
    if (!useDropdownMode && itemType === 'raw_material') {
      if (!rmInput.trim()) { toast.error('Enter a raw material name.'); return; }
      if (!addForm.warehouse) { toast.error('Select a warehouse.'); return; }
      if (!addForm.quantity)  { toast.error('Enter a quantity.'); return; }

      setAddSaving(true);
      try {
        if (rmSelected) {
          productId = String(rmSelected.id);
        } else {
          const existing = products.find(
            (p) => p.name.toLowerCase() === rmInput.trim().toLowerCase()
          );
          if (existing) {
            productId = String(existing.id);
          } else {
            const slug = rmInput.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const res = await productsApi.products.create({
              name: rmInput.trim(),
              sku: `RM-${slug}-${Date.now().toString().slice(-5)}`,
              price: 0, cost_price: 0, unit: 'unit', is_active: true,
            });
            const created = (res as { data?: { id?: number }; id?: number })?.data ?? res;
            productId = String((created as { id: number }).id);
            productsApi.products.list({ is_active: 'true' }).then((r) =>
              setProducts(r.data?.products || r.data?.results || []));
          }
        }
      } catch {
        toast.error('Failed to register raw material.');
        setAddSaving(false);
        return;
      }
    } else {
      if (!productId || !addForm.warehouse || !addForm.quantity) {
        toast.error('Product, warehouse and quantity are required.');
        return;
      }
      setAddSaving(true);
    }

    const custom_data: Record<string, string> = {};
    customFields.forEach((cf) => { if (cf.key.trim()) custom_data[cf.key.trim()] = cf.value; });

    try {
      await stockApi.addMovement({
        product: parseInt(productId),
        warehouse: parseInt(addForm.warehouse),
        movement_type: movementType,
        quantity: Math.round(parseFloat(addForm.quantity)),
        reference: addForm.reference,
        notes: addForm.notes,
        custom_data,
      });
      toast.success(isEditMode ? 'Stock updated.' : addForm.movement_type === 'return' ? 'Return recorded.' : 'Stock movement recorded.');
      setAddOpen(false);
      setAddForm({ product: '', warehouse: '', movement_type: 'in', quantity: '', reference: '', notes: '' });
      setRmInput(''); setRmSelected(null); setCustomFields([]);
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to update stock.');
    } finally { setAddSaving(false); }
  };

  const openAddStock = (type = 'in', productId = '', warehouseId = '') => {
    setAddForm({
      product: productId, warehouse: warehouseId,
      movement_type: type, quantity: '', reference: '', notes: '',
    });
    setItemType('product');
    setRmInput(''); setRmSelected(null); setRmSuggestions([]);
    setCustomFields([]);
    setAddOpen(true);
  };

  const openEditStock = (rec: StockRecord) => {
    setAddForm({
      product: String(rec.product),
      warehouse: String(rec.warehouse),
      movement_type: 'edit',
      quantity: String(intQty(rec.quantity)),
      reference: '', notes: '',
    });
    setItemType('product');
    setRmInput(''); setRmSelected(null); setRmSuggestions([]);
    setCustomFields([]);
    setAddOpen(true);
  };

  // Raw material autocomplete
  const handleRmInput = (val: string) => {
    setRmInput(val);
    setRmSelected(null);
    if (val.trim().length >= 1) {
      const q = val.toLowerCase();
      setRmSuggestions(products.filter((p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      ).slice(0, 6));
      setShowSuggestions(true);
    } else {
      setRmSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // ── Movement type configs ──────────────────────────────────────────────
  const TYPES = [
    { key: 'in',         label: '📥 Stock In',   color: '#10b981' },
    { key: 'edit',       label: '✏️ Stock Edit',  color: '#8b5cf6' },
    { key: 'return',     label: '↩️ Return',      color: '#3b82f6' },
    // { key: 'adjustment', label: '⚖️ Adjustment',  color: '#f59e0b' },
  ];

  const titleMap: Record<string, string> = {
    in: '📥 Add Stock', edit: '✏️ Edit Stock',
    return: '↩️ Stock Return',
  };
  const btnMap: Record<string, string> = {
    in: '📥 Add Stock', edit: '✏️ Update Stock',
    return: '↩️ Record Return',
  };

  // Current stock info for selected product (edit & return modes)
  const editRecord = useDropdownMode && addForm.product
    ? records.find((r) =>
        String(r.product) === addForm.product &&
        (addForm.warehouse ? String(r.warehouse) === addForm.warehouse : true))
    : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Levels</h1>
          <p className="page-subtitle">Real-time stock visibility across all warehouses.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => openAddStock('in')}>
            📥 Add Stock
          </button>
          <button className="btn btn-secondary" onClick={() => openAddStock('edit')}>
            ✏️ Edit Stock
          </button>
        </div>
      </div>

      {/* Compact Stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total SKUs',    value: records.length,          color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'Total Qty',     value: totalQty.toFixed(0),     color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Low Stock',     value: lowStockCount,           color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
          { label: 'Out of Stock',  value: outOfStockCount,         color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Returned',      value: totalReturned.toFixed(0), color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
        ].map((s) => (
          <div key={s.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 10,
            background: s.bg, border: `1px solid ${s.border}`,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button key={f.key} onClick={() => setStatusFilter(active && f.key ? '' : f.key)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: `1.5px solid ${active ? 'var(--color-primary)' : '#e2e8f0'}`,
                background: active ? 'var(--color-primary)' : '#fff',
                color: active ? '#fff' : '#64748b', transition: 'all 0.15s',
              }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search product / SKU…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260, margin: 0 }} />
        <select className="form-select" value={whFilter} onChange={(e) => setWhFilter(e.target.value)}
          style={{ maxWidth: 200, margin: 0 }}>
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Stock Records ({filtered.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>
              No stock records yet
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Add stock to a product to start tracking inventory levels.
            </div>
            <button className="btn btn-primary" onClick={() => openAddStock('in')}>
              📥 Add Stock Now
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>Warehouse</th>
                  {isReturnedView ? (
                    <><th>Returned Qty</th><th>Current Stock</th><th>Status</th></>
                  ) : (
                    <><th>Qty</th><th>Reserved</th><th>Available</th><th>Status</th><th></th></>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const avail = parseFloat(String(r.available_quantity ?? 0));
                  const threshold = r.low_stock_threshold ?? 10;
                  const st = getStatus(avail, threshold);
                  return (
                    <tr key={r.id} style={isReturnedView ? { background: '#eff6ff' } : st === 'low_stock' ? { background: '#fffbeb' } : st === 'out_of_stock' ? { background: '#fef2f2' } : undefined}>
                      <td><strong>{r.product_name}</strong></td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {r.product_sku}
                      </td>
                      <td>{r.warehouse_name}</td>
                      {isReturnedView ? (
                        <>
                          <td><strong style={{ color: '#1d4ed8' }}>{intQty(r.returned_quantity)}</strong></td>
                          <td style={{ color: '#64748b' }}>{intQty(r.quantity)}</td>
                          <td>
                            <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                              ↩ Returned
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{intQty(r.quantity)}</td>
                          <td style={{ color: '#64748b' }}>{intQty(r.reserved_quantity)}</td>
                          <td><strong>{intQty(r.available_quantity)}</strong></td>
                          <td>
                            <span className={`badge ${st === 'out_of_stock' ? 'badge-danger' : st === 'low_stock' ? 'badge-warning' : 'badge-success'}`}>
                              {st === 'out_of_stock' ? 'Out of Stock' : st === 'low_stock' ? 'Low Stock' : 'In Stock'}
                            </span>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                              Limit: {threshold}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-primary btn-sm"
                                onClick={() => openAddStock('in', String(r.product), String(r.warehouse))}>
                                📥 Add
                              </button>
                              <button className="btn btn-secondary btn-sm"
                                onClick={() => openEditStock(r)}>
                                ✏️ Edit
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Stock Movement Popup ═══════════════════════════════════════════ */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !addSaving && setAddOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{titleMap[addForm.movement_type] || '📥 Add Stock'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(false)}>✕ Close</button>
            </div>
            <form className="card-body" onSubmit={handleAddMovement}>

              {/* ── Type selector ── */}
              <div className="form-group">
                <label className="form-label">Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TYPES.map((t) => (
                    <button type="button" key={t.key}
                      onClick={() => {
                        setAddForm((p) => ({ ...p, movement_type: t.key, product: '', warehouse: '', quantity: '' }));
                        setItemType('product'); setRmInput(''); setRmSelected(null);
                      }}
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
                {/* {addForm.movement_type === 'adjustment' && (
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    Adjustment sets the stock to the exact quantity entered (cycle count).
                  </p>
                )} */}
                {useDropdownMode && (
                  <p style={{ fontSize: 11, color: '#8b5cf6', marginTop: 6 }}>
                    Select a product or raw material below — current stock details will auto-fill.
                  </p>
                )}
              </div>

              {/* ── EDIT / RETURN MODE: single dropdown with all items ── */}
              {useDropdownMode && (
                <div className="form-group">
                  <label className="form-label">Select Product / Raw Material *</label>
                  <select className="form-select" value={addForm.product}
                    onChange={(e) => handleEditProductSelect(e.target.value)} required>
                    <option value="">Select item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                  {addForm.product && (
                    <div style={{ marginTop: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>Current Stock Info</div>
                      {editRecord ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                          <span style={{ color: '#64748b' }}>Warehouse:</span>
                          <span style={{ fontWeight: 600 }}>{editRecord.warehouse_name}</span>
                          <span style={{ color: '#64748b' }}>Current Qty:</span>
                          <span style={{ fontWeight: 600 }}>{intQty(editRecord.quantity)}</span>
                          <span style={{ color: '#64748b' }}>Reserved:</span>
                          <span style={{ fontWeight: 600 }}>{intQty(editRecord.reserved_quantity)}</span>
                          <span style={{ color: '#64748b' }}>Available:</span>
                          <span style={{ fontWeight: 600, color: '#15803d' }}>{intQty(editRecord.available_quantity)}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#f59e0b' }}>
                          No existing stock record found — this will create a new entry.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── STOCK IN / ADJUSTMENT: Product / Raw Material switcher ── */}
              {!useDropdownMode && (
                <div className="form-group">
                  <label className="form-label">Item Type *</label>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 4, marginBottom: 10 }}>
                    {([
                      { key: 'product',      label: '🛍️ Product' },
                      { key: 'raw_material', label: '🧱 Raw Material' },
                    ] as { key: 'product' | 'raw_material'; label: string }[]).map((t) => (
                      <button type="button" key={t.key}
                        onClick={() => { setItemType(t.key); setRmInput(''); setRmSelected(null); setAddForm((p) => ({ ...p, product: '' })); }}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                          background: itemType === t.key ? '#fff' : 'transparent',
                          boxShadow: itemType === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                          fontWeight: itemType === t.key ? 700 : 500, fontSize: 13,
                          color: itemType === t.key ? 'var(--color-primary)' : '#64748b',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {itemType === 'product' && (
                    <select className="form-select" value={addForm.product}
                      onChange={(e) => setAddForm((p) => ({ ...p, product: e.target.value }))} required>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  )}

                  {itemType === 'raw_material' && (
                    <div ref={rmRef} style={{ position: 'relative' }}>
                      <input className="form-input" placeholder="Type raw material name…"
                        value={rmInput} autoComplete="off"
                        onChange={(e) => handleRmInput(e.target.value)}
                        onFocus={() => rmInput && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} />
                      {showSuggestions && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', marginTop: 2,
                        }}>
                          {rmSuggestions.length > 0 ? rmSuggestions.map((p) => (
                            <div key={p.id}
                              onMouseDown={() => { setRmSelected(p); setRmInput(p.name); setShowSuggestions(false); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                                borderBottom: '1px solid #f1f5f9',
                                background: rmSelected?.id === p.id ? '#eff6ff' : '#fff' }}>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>SKU: {p.sku}</div>
                            </div>
                          )) : (
                            <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>
                              No match — will be created as a new raw material.
                            </div>
                          )}
                        </div>
                      )}
                      {rmInput.trim() && (
                        <div style={{ marginTop: 6, fontSize: 11 }}>
                          {rmSelected ? (
                            <span style={{ color: '#10b981' }}>✓ Using existing: <strong>{rmSelected.name}</strong></span>
                          ) : products.find((p) => p.name.toLowerCase() === rmInput.trim().toLowerCase()) ? (
                            <span style={{ color: '#10b981' }}>✓ Matches existing product</span>
                          ) : (
                            <span style={{ color: '#f59e0b' }}>⚡ New — "<strong>{rmInput.trim()}</strong>" will be auto-created</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Warehouse ── */}
              <div className="form-group">
                <label className="form-label">Warehouse *</label>
                <select className="form-select" value={addForm.warehouse}
                  onChange={(e) => setAddForm((p) => ({ ...p, warehouse: e.target.value }))} required>
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              {/* ── Quantity ── */}
              <div className="form-group">
                <label className="form-label">
                  {isEditMode ? 'New Quantity *' : addForm.movement_type === 'return' ? 'Return Quantity *' : addForm.movement_type === 'adjustment' ? 'New Stock Quantity *' : 'Quantity *'}
                </label>
                <input className="form-input" type="number" min="0" step="1"
                  placeholder="0" value={addForm.quantity}
                  onChange={(e) => setAddForm((p) => ({ ...p, quantity: e.target.value }))} required />
                {useDropdownMode && editRecord && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Current: <strong>{intQty(editRecord.quantity)}</strong> → {isEditMode ? 'Enter the new total quantity' : 'Enter the return quantity'}
                  </div>
                )}
              </div>

              {/* ── Reference ── */}
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input className="form-input" placeholder="Order no., Invoice no., etc."
                  value={addForm.reference}
                  onChange={(e) => setAddForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>

              {/* ── Notes ── */}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} placeholder="Optional notes…"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>

              {/* ── Custom Fields ── */}
              <div style={{ margin: '4px 0 12px', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Custom Fields</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Add extra info — batch no., supplier, expiry, lot no., etc.
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setCustomFields((p) => [...p, { key: '', value: '' }])}>
                    + Add Field
                  </button>
                </div>
                {customFields.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontSize: 12 }}>
                    No custom fields. Click "+ Add Field" to add one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {customFields.map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="form-input" placeholder="Field name" value={cf.key}
                          onChange={(e) => setCustomFields((p) =>
                            p.map((f, i) => i === idx ? { ...f, key: e.target.value } : f)
                          )} style={{ flex: 1, margin: 0 }} />
                        <input className="form-input" placeholder="Value" value={cf.value}
                          onChange={(e) => setCustomFields((p) =>
                            p.map((f, i) => i === idx ? { ...f, value: e.target.value } : f)
                          )} style={{ flex: 1, margin: 0 }} />
                        <button type="button" className="btn btn-danger btn-sm"
                          onClick={() => setCustomFields((p) => p.filter((_, i) => i !== idx))}
                          style={{ flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Actions ── */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addSaving}>
                  {addSaving ? 'Saving…' : btnMap[addForm.movement_type] || '📥 Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
