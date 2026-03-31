import { useState, useEffect } from 'react';
import { stockApi } from '@/api/businessApi';
import type { StockRecord, StockMovement } from '@/types';
import toast from 'react-hot-toast';

export default function StockPage() {
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      stockApi.records().then((r) => setRecords(r.data?.stock || [])),
      stockApi.movements().then((r) => setMovements(r.data?.movements || [])),
    ]).catch(() => toast.error('Failed to load stock data.')).finally(() => setLoading(false));
  }, []);

  const lowStockCount = records.filter((r) => parseFloat(r.available_quantity) <= 10).length;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Stock Management</h1>
        <p className="page-subtitle">Monitor stock levels across all warehouses.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total SKUs Tracked</div>
          <div className="stat-value">{records.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid var(--color-danger)` }}>
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{lowStockCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock Movements (Last 100)</div>
          <div className="stat-value">{movements.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['overview', 'movements'] as const).map((tab) => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? '📦 Stock Levels' : '↕️ Movements'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : activeTab === 'overview' ? (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Current Stock Levels</h2></div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Warehouse</th>
                  <th>Qty</th><th>Reserved</th><th>Available</th><th>Status</th></tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const avail = parseFloat(r.available_quantity);
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.product_name}</strong></td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.product_sku}</td>
                      <td>{r.warehouse_name}</td>
                      <td>{r.quantity}</td>
                      <td>{r.reserved_quantity}</td>
                      <td><strong>{r.available_quantity}</strong></td>
                      <td>
                        <span className={`badge ${avail <= 0 ? 'badge-danger' : avail <= 10 ? 'badge-warning' : 'badge-success'}`}>
                          {avail <= 0 ? 'Out of Stock' : avail <= 10 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Stock Movements</h2></div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Type</th><th>Product</th><th>Warehouse</th>
                  <th>Qty</th><th>Reference</th><th>By</th><th>Date</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${m.movement_type === 'in' ? 'badge-success' : m.movement_type === 'out' ? 'badge-danger' : 'badge-primary'}`}>
                        {m.movement_type.toUpperCase()}
                      </span>
                    </td>
                    <td>{m.product_name}</td>
                    <td>{m.warehouse_name}</td>
                    <td><strong>{m.quantity}</strong></td>
                    <td style={{ fontSize: 12 }}>{m.reference || '—'}</td>
                    <td style={{ fontSize: 12 }}>{m.performed_by_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
