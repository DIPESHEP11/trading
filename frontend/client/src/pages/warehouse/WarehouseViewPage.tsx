import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { stockApi } from '@/api/businessApi';
import toast from 'react-hot-toast';

interface StockItem {
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  available: string;
}

export default function WarehouseViewPage() {
  const { token } = useParams<{ token: string }>();
  const [warehouseName, setWarehouseName] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageItems, setUsageItems] = useState<{ product_id: number; product_name: string; quantity: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return; }
    stockApi.warehouseView(token)
      .then((r: { data?: { warehouse_name?: string; stock?: StockItem[] } }) => {
        setWarehouseName(r.data?.warehouse_name || 'Warehouse');
        setStock(r.data?.stock || []);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message || 'Invalid or expired link.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const addUsageRow = () => {
    if (stock.length === 0) return;
    const first = stock[0];
    setUsageItems((p) => [...p, { product_id: first.product_id, product_name: first.product_name, quantity: '' }]);
  };

  const updateUsageRow = (idx: number, field: 'product_id' | 'quantity', value: string | number) => {
    setUsageItems((p) => {
      const next = [...p];
      if (field === 'product_id') {
        const item = stock.find((s) => s.product_id === Number(value));
        next[idx] = { ...next[idx], product_id: Number(value), product_name: item?.product_name || '', quantity: next[idx].quantity };
      } else {
        next[idx] = { ...next[idx], quantity: String(value) };
      }
      return next;
    });
  };

  const removeUsageRow = (idx: number) => {
    setUsageItems((p) => p.filter((_, i) => i !== idx));
  };

  const handleSubmitUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const items = usageItems
      .filter((u) => u.product_id && parseFloat(u.quantity) > 0)
      .map((u) => ({ product_id: u.product_id, quantity: String(parseFloat(u.quantity)) }));
    if (items.length === 0) {
      toast.error('Add at least one product with quantity.');
      return;
    }
    setSubmitting(true);
    try {
      await stockApi.warehouseViewUsage(token, { items });
      toast.success('Usage recorded. Stock updated.');
      setUsageItems([]);
      const r = await stockApi.warehouseView(token);
      setStock((r as { data?: { stock?: StockItem[] } }).data?.stock || []);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to record usage.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ color: '#1e293b', marginBottom: 8 }}>Link Invalid or Expired</h2>
          <p style={{ color: '#64748b' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{warehouseName}</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>View stock and mark product usage (reduces warehouse stock).</p>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>
            Current Stock ({stock.length} products)
          </div>
          {stock.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', marginBottom: 16, fontSize: 15 }}>No stock in this warehouse yet.</div>
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, maxWidth: 480, margin: '0 auto',
                textAlign: 'left', fontSize: 13, color: '#0369a1',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>How stock gets here</div>
                <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
                  Stock appears when your admin <strong>transfers</strong> products to this warehouse (Inventory → Transfers) or adds stock (Stock Levels → Add Movement → Stock In).
                </p>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  Once stock is here, you can record usage below to reduce the count (e.g. 10 products, 2 used → record 2, stock becomes 8).
                </p>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Product</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b' }}>SKU</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Qty</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.product_id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{s.product_name}</td>
                      <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{s.product_sku || '—'}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{s.quantity}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: parseFloat(s.available) > 0 ? '#15803d' : '#dc2626' }}>{s.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>
            Mark Product Usage
          </div>
          <form onSubmit={handleSubmitUsage} style={{ padding: 16 }}>
            {usageItems.map((u, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  value={u.product_id}
                  onChange={(e) => updateUsageRow(idx, 'product_id', e.target.value)}
                  style={{ flex: '1 1 200px', minWidth: 180 }}
                >
                  {stock.map((s) => (
                    <option key={s.product_id} value={s.product_id}>{s.product_name} ({s.available} available)</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Qty used"
                  value={u.quantity}
                  onChange={(e) => updateUsageRow(idx, 'quantity', e.target.value)}
                  min="0"
                  step="1"
                  style={{ width: 100 }}
                />
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeUsageRow(idx)}>Remove</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={addUsageRow} disabled={stock.length === 0}>
                + Add usage row
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || usageItems.length === 0}>
                {submitting ? 'Saving…' : 'Record Usage'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
