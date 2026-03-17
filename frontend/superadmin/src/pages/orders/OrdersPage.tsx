import React, { useState, useEffect } from 'react';
import { ordersApi } from '@/api/businessApi';
import type { Order, OrderStatus } from '@/types';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning', approved: 'badge-primary', warehouse: 'badge-primary',
  invoiced: 'badge-neutral', dispatched: 'badge-success', delivered: 'badge-success',
  cancelled: 'badge-danger', returned: 'badge-danger',
};
const SOURCE_ICONS: Record<string, string> = {
  meta: '📘', shopify: '🛍️', online: '🌐', manual: '✏️', whatsapp: '💬', referral: '🤝',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  useEffect(() => { fetchOrders(); }, [statusFilter, sourceFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      const res = await ordersApi.list(params);
      setOrders(res.data?.orders || []);
      setStats(res.data?.stats || {});
    } catch {
      toast.error('Failed to load orders.');
    } finally { setLoading(false); }
  };

  const handleApprove = async (id: number) => {
    try {
      await ordersApi.approve(id);
      toast.success('Order approved!');
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Approval failed.');
    }
  };

  const statusCards = [
    { key: 'pending', label: 'Pending Approval', color: '#d97706' },
    { key: 'approved', label: 'Approved', color: '#2563eb' },
    { key: 'warehouse', label: 'In Warehouse', color: '#7c3aed' },
    { key: 'dispatched', label: 'Dispatched', color: '#16a34a' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <p className="page-subtitle">Track and manage orders from all sources.</p>
      </div>

      {/* Status summary cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {statusCards.map((s) => (
          <div key={s.key} className="stat-card"
            style={{ cursor: 'pointer', borderLeft: `4px solid ${s.color}`,
              border: statusFilter === s.key ? `2px solid ${s.color}` : `1px solid var(--color-border)` }}
            onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{stats[s.key] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="form-select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">All Statuses</option>
            {['pending','approved','warehouse','invoiced','dispatched','delivered','cancelled'].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select className="form-select" value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_ICONS).map(([v, icon]) => (
              <option key={v} value={v}>{icon} {v.charAt(0).toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Orders ({orders.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th><th>Source</th><th>Customer</th><th>Amount</th>
                  <th>Status</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No orders found.
                  </td></tr>
                ) : orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.order_number}</strong></td>
                    <td>{SOURCE_ICONS[order.source] || ''} {order.source}</td>
                    <td>{order.customer_name || order.shipping_name || '—'}</td>
                    <td><strong>₹{parseFloat(order.total_amount).toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[order.status] || 'badge-neutral'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {order.status === 'pending' && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(order.id)}>
                          Approve
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
  );
}
