import { useState, useEffect } from 'react';
import { ordersApi } from '@/api/businessApi';
import type { Order } from '@/types';
import toast from 'react-hot-toast';
import LeadDetailsCard from '@/components/LeadDetailsCard';

interface OStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }

const SOURCE_ICONS: Record<string, string> = {
  meta: '📘', shopify: '🛍️', online: '🌐', manual: '✏️', whatsapp: '💬', referral: '🤝',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [statuses, setStatuses] = useState<OStatus[]>([]);

  // Order detail modal (for viewing full order + lead details)
  const [viewOrder, setViewOrder] = useState<any | null>(null);

  // Rejection modal
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    ordersApi.statuses.list()
      .then((r) => setStatuses(r.data?.statuses || []))
      .catch(() => {});
  }, []);

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
      const res = await ordersApi.approve(id);
      toast.success('Order approved!');
      if (res.data?.flow_result?.message) {
        toast(res.data.flow_result.message, { icon: '🔀' });
      }
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Approval failed.');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await ordersApi.update(id, { status: newStatus });
      toast.success('Status updated.');
      if (res.data?.flow_result?.message) {
        toast(res.data.flow_result.message, { icon: '🔀' });
      }
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Status update failed.');
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error('Rejection reason is required.'); return; }
    setRejecting(true);
    try {
      await ordersApi.reject(rejectId, { reason: rejectReason.trim() });
      toast.success('Order rejected and reverted.');
      setRejectId(null);
      setRejectReason('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Rejection failed.');
    } finally { setRejecting(false); }
  };

  const getStatusColor = (key: string) => statuses.find((s) => s.key === key)?.color || '#64748b';
  const getStatusLabel = (key: string) => statuses.find((s) => s.key === key)?.label || key;

  const activeStatuses = statuses.filter((s) => s.is_active);
  const topStatuses = activeStatuses.slice(0, 6);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <p className="page-subtitle">Track and manage orders from all sources.</p>
      </div>

      {/* Status summary cards — compact */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {topStatuses.map((s) => (
          <div key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
            style={{
              cursor: 'pointer', padding: '8px 16px', borderRadius: 10,
              borderLeft: `3px solid ${s.color}`,
              border: statusFilter === s.key ? `2px solid ${s.color}` : `1px solid var(--color-border)`,
              background: statusFilter === s.key ? `${s.color}10` : '#fff',
              display: 'flex', alignItems: 'center', gap: 10, minWidth: 120,
            }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{stats[s.key] ?? 0}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">All Statuses</option>
            {activeStatuses.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
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
                  <th>Order #</th><th>Source</th><th>Customer</th><th>Items</th><th>Amount</th>
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
                    <td style={{ fontSize: 12, color: '#64748b' }}>{(order as any).items_summary || (order.items?.length ? `${order.items.length} item(s)` : '—')}</td>
                    <td><strong>₹{parseFloat(order.total_amount).toLocaleString()}</strong></td>
                    <td>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: '1px solid #e2e8f0', cursor: 'pointer',
                          color: getStatusColor(order.status), background: `${getStatusColor(order.status)}15`,
                        }}>
                        {activeStatuses.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            try {
                              const res = await ordersApi.get(order.id);
                              setViewOrder(res?.data ?? res);
                            } catch {
                              toast.error('Failed to load order.');
                            }
                          }}
                          style={{ fontSize: 11, padding: '3px 10px' }}>
                          More Details
                        </button>
                        {order.status === 'pending' && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(order.id)}
                            style={{ fontSize: 11, padding: '3px 10px' }}>
                            Approve
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm"
                          onClick={() => { setRejectId(order.id); setRejectReason(''); }}
                          style={{ fontSize: 11, padding: '3px 10px' }}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {viewOrder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 16px',
        }} onClick={() => setViewOrder(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 14, padding: 28, width: '100%',
            maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              Order #{viewOrder.order_number}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Source: {viewOrder.source} · Status: {getStatusLabel(viewOrder.status)} · {new Date(viewOrder.created_at).toLocaleString()}
            </p>
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Customer</div>
                <div style={{ fontWeight: 500 }}>{viewOrder.customer_name || viewOrder.shipping_name || '—'}</div>
                {viewOrder.shipping_phone && <div style={{ fontSize: 12, color: '#64748b' }}>{viewOrder.shipping_phone}</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>₹{parseFloat(viewOrder.total_amount || 0).toLocaleString()}</div>
              </div>
              {viewOrder.items?.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Items</div>
                  {viewOrder.items.map((it: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                      {it.product_name} × {it.quantity} — ₹{parseFloat(it.total_price || 0).toLocaleString()}
                    </div>
                  ))}
                </div>
              )}
              {viewOrder.notes && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 13 }}>
                  <strong>Notes:</strong> {viewOrder.notes}
                </div>
              )}
            </div>
            {viewOrder.lead_details && <LeadDetailsCard lead={viewOrder.lead_details} />}
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setRejectId(null)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 28, width: '100%',
              maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              Reject Order
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              This order will be reverted to its previous status. Please provide a reason.
            </p>
            <div className="form-group">
              <label className="form-label">Reason for Rejection *</label>
              <textarea className="form-input" rows={3} value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectId(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}>
                {rejecting ? 'Rejecting…' : 'Reject & Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
