import React, { useState, useEffect, useCallback } from 'react';
import { stockApi } from '@/api/businessApi';
import type { StockMovement } from '@/types';
import toast from 'react-hot-toast';

const intQty = (v: string | number | undefined | null) => Math.round(parseFloat(String(v ?? 0)));

type Period = 'week' | 'month' | 'custom';

interface ProductStat {
  product: number;
  product_name: string;
  totalIn: number;
  totalOut: number;
  totalTransfer: number;
  totalReturn: number;
  totalMovements: number;
  totalQtyMoved: number;
}

function getDateRange(period: Period, customFrom: string, customTo: string) {
  const today = new Date();
  const to = new Date(today); to.setHours(23, 59, 59);
  let from: Date;

  if (period === 'week') {
    from = new Date(today);
    from.setDate(today.getDate() - 7);
  } else if (period === 'month') {
    from = new Date(today);
    from.setMonth(today.getMonth() - 1);
  } else {
    from = customFrom ? new Date(customFrom) : new Date(today.getFullYear(), today.getMonth(), 1);
    if (customTo) to.setTime(new Date(customTo).getTime());
  }
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AnalysisPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]   = useState('');
  const [search, setSearch]       = useState('');
  const [detailProduct, setDetailProduct] = useState<ProductStat | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const { date_from, date_to } = getDateRange(period, customFrom, customTo);
    stockApi.movements({ date_from, date_to, limit: '5000' })
      .then((r) => setMovements(r.data?.movements || []))
      .catch(() => toast.error('Failed to load movements.'))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // Aggregate by product
  const statsMap = new Map<number, ProductStat>();
  movements.forEach((m) => {
    let stat = statsMap.get(m.product);
    if (!stat) {
      stat = {
        product: m.product, product_name: m.product_name,
        totalIn: 0, totalOut: 0, totalTransfer: 0, totalReturn: 0,
        totalMovements: 0, totalQtyMoved: 0,
      };
      statsMap.set(m.product, stat);
    }
    const qty = intQty(m.quantity);
    stat.totalMovements += 1;
    stat.totalQtyMoved += qty;
    if (m.movement_type === 'in') stat.totalIn += qty;
    else if (m.movement_type === 'out') stat.totalOut += qty;
    else if (m.movement_type === 'transfer') stat.totalTransfer += qty;
    else if (m.movement_type === 'return') stat.totalReturn += qty;
  });

  let productStats = Array.from(statsMap.values())
    .sort((a, b) => b.totalQtyMoved - a.totalQtyMoved);

  if (search) {
    const q = search.toLowerCase();
    productStats = productStats.filter((s) => s.product_name.toLowerCase().includes(q));
  }

  const topProduct = productStats[0];
  const totalMoves = productStats.reduce((s, p) => s + p.totalMovements, 0);
  const totalQty   = productStats.reduce((s, p) => s + p.totalQtyMoved, 0);
  const maxQty     = topProduct?.totalQtyMoved || 1;

  const { date_from, date_to } = getDateRange(period, customFrom, customTo);

  // Detail: movements for selected product
  const detailMovements = detailProduct
    ? movements.filter((m) => m.product === detailProduct.product)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  // Group detail movements by date
  const groupedByDate = new Map<string, StockMovement[]>();
  detailMovements.forEach((m) => {
    const day = m.created_at.slice(0, 10);
    const arr = groupedByDate.get(day) || [];
    arr.push(m);
    groupedByDate.set(day, arr);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Analysis</h1>
          <p className="page-subtitle">
            Product & raw material demand based on movement history.
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {([
          { key: 'week' as Period,  label: 'Last 7 Days' },
          { key: 'month' as Period, label: 'Last 30 Days' },
          { key: 'custom' as Period, label: 'Custom Range' },
        ]).map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${period === p.key ? 'var(--color-primary)' : '#e2e8f0'}`,
              background: period === p.key ? 'var(--color-primary)' : '#fff',
              color: period === p.key ? '#fff' : '#475569',
            }}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="form-input" value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ margin: 0, maxWidth: 160, fontSize: 12 }} />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input type="date" className="form-input" value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ margin: 0, maxWidth: 160, fontSize: 12 }} />
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Products Tracked', value: productStats.length, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'Total Movements',  value: totalMoves,          color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Total Qty Moved',  value: totalQty,            color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Most Active', value: topProduct?.product_name || '—', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
        ].map((s) => (
          <div key={s.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 16px', borderRadius: 10,
            background: s.bg, border: `1.5px solid ${s.border}`,
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ color: s.color, fontSize: typeof s.value === 'number' ? 18 : 14, fontWeight: 700 }}>{s.value}</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
        Showing data from <strong>{formatDate(date_from)}</strong> to <strong>{formatDate(date_to)}</strong>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Search product or raw material…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, margin: 0 }} />
      </div>

      {/* Product demand table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Product Demand Ranking</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : productStats.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📈</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>
              No movement data
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {search ? 'No products match your search.' : 'No stock movements found for this period.'}
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Product / Raw Material</th>
                  <th>Demand</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Transfer</th>
                  <th>Return</th>
                  <th>Moves</th>
                  <th>Total Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((s, i) => {
                  const pct = Math.round((s.totalQtyMoved / maxQty) * 100);
                  return (
                    <tr key={s.product} style={i === 0 ? { background: '#f5f3ff' } : undefined}>
                      <td style={{ fontWeight: 700, color: i < 3 ? '#8b5cf6' : '#94a3b8', fontSize: 14 }}>
                        {i + 1}
                      </td>
                      <td>
                        <strong>{s.product_name}</strong>
                        {i === 0 && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: '#8b5cf6', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>
                            Top
                          </span>
                        )}
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%', borderRadius: 4,
                              background: pct > 80 ? '#8b5cf6' : pct > 50 ? '#3b82f6' : pct > 25 ? '#10b981' : '#94a3b8',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 30 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>{s.totalIn || '—'}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{s.totalOut || '—'}</td>
                      <td style={{ color: '#3b82f6', fontWeight: 600 }}>{s.totalTransfer || '—'}</td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>{s.totalReturn || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{s.totalMovements}</td>
                      <td><strong>{s.totalQtyMoved}</strong></td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm"
                          onClick={() => setDetailProduct(s)}>
                          Details
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

      {/* ── Detail Popup ── */}
      {detailProduct && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setDetailProduct(null)}>
          <div className="card" style={{ width: '92%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">📈 {detailProduct.product_name} — Movement Details</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setDetailProduct(null)}>✕ Close</button>
            </div>
            <div className="card-body">

              {/* Summary cards */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Stock In',  value: detailProduct.totalIn,       color: '#10b981', bg: '#f0fdf4' },
                  { label: 'Stock Out', value: detailProduct.totalOut,      color: '#ef4444', bg: '#fef2f2' },
                  { label: 'Transfer',  value: detailProduct.totalTransfer, color: '#3b82f6', bg: '#eff6ff' },
                  { label: 'Return',    value: detailProduct.totalReturn,   color: '#f59e0b', bg: '#fffbeb' },
                  { label: 'Total Qty', value: detailProduct.totalQtyMoved, color: '#8b5cf6', bg: '#f5f3ff' },
                ].map((c) => (
                  <div key={c.label} style={{
                    padding: '8px 14px', borderRadius: 8, background: c.bg,
                    textAlign: 'center', minWidth: 80,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Day-by-day breakdown */}
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Day-by-Day Breakdown</h3>
              {Array.from(groupedByDate.entries()).map(([day, dayMovements]) => {
                const dayTotal = dayMovements.reduce((s, m) => s + intQty(m.quantity), 0);
                return (
                  <div key={day} style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(day)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>
                        {dayMovements.length} move{dayMovements.length > 1 ? 's' : ''} · {dayTotal} qty
                      </span>
                    </div>
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Type</th><th>Warehouse</th><th>Qty</th><th>Reference</th><th>By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayMovements.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <span className="badge" style={{
                                  background:
                                    m.movement_type === 'in' ? '#d1fae5' :
                                    m.movement_type === 'out' ? '#fee2e2' :
                                    m.movement_type === 'transfer' ? '#dbeafe' :
                                    m.movement_type === 'return' ? '#fef3c7' : '#f1f5f9',
                                  color:
                                    m.movement_type === 'in' ? '#065f46' :
                                    m.movement_type === 'out' ? '#991b1b' :
                                    m.movement_type === 'transfer' ? '#1e40af' :
                                    m.movement_type === 'return' ? '#92400e' : '#475569',
                                  fontSize: 11,
                                }}>
                                  {m.movement_type === 'in' ? '📥 In' :
                                   m.movement_type === 'out' ? '📤 Out' :
                                   m.movement_type === 'transfer' ? '🔀 Transfer' :
                                   m.movement_type === 'return' ? '↩️ Return' :
                                   m.movement_type === 'adjustment' ? '⚖️ Adjust' : m.movement_type}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>{m.warehouse_name}</td>
                              <td><strong>{intQty(m.quantity)}</strong></td>
                              <td style={{ fontSize: 11, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.reference || '—'}
                              </td>
                              <td style={{ fontSize: 11, color: '#64748b' }}>{m.performed_by_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {detailMovements.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  No movements found in this period.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
