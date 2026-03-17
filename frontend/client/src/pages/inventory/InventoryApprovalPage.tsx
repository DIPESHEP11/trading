import React, { useState, useEffect, useCallback } from 'react';
import { stockApi } from '@/api/businessApi';
import LeadDetailsCard from '@/components/LeadDetailsCard';
import toast from 'react-hot-toast';

interface ApprovalItem {
  product_id: number;
  product_name: string;
  quantity: number;
  notes?: string;
}

interface InvStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean; }

interface Approval {
  id: number;
  request_number: string;
  status: string;
  source_module: string;
  source_reference: string;
  requested_action: string;
  warehouse: number | null;
  warehouse_name: string | null;
  destination_warehouse: number | null;
  destination_warehouse_name: string | null;
  next_module: string;
  items: ApprovalItem[];
  notes: string;
  rejection_reason: string;
  lead_details?: { id: number; name: string; email: string; phone: string; company: string; notes: string; source: string; status: string; custom_data?: Record<string, string>; assigned_to_name?: string | null };
  requested_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

const DEFAULT_TABS = [
  { key: '',         label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const SOURCE_LABELS: Record<string, string> = {
  orders: 'Orders',
  crm: 'CRM / Leads',
  invoices: 'Invoices',
  dispatch: 'Dispatch',
  manual: 'Manual',
  other: 'Other',
};

const ACTION_LABELS: Record<string, string> = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  reserve: 'Reserve',
  transfer: 'Transfer',
  dispatch: 'Dispatch',
  other: 'Other',
};

const statusPill = (s: string, allStatuses: InvStatus[]) => {
  const found = allStatuses.find((st) => st.key === s);
  const color = found?.color || '#64748b';
  const label = found?.label || s;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: color + '20', color: color, textTransform: 'capitalize',
    }}>{label}</span>
  );
};

export default function InventoryApprovalPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [allStatuses, setAllStatuses] = useState<InvStatus[]>([]);

  // Detail / action modals
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    stockApi.inventoryStatuses.list()
      .then((r: { data?: { statuses?: InvStatus[] } }) => setAllStatuses(r.data?.statuses || []))
      .catch(() => {});
  }, []);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    source_module: 'manual',
    source_reference: '',
    requested_action: 'stock_out',
    warehouse: '',
    next_module: '',
    notes: '',
    items: [{ product_id: '', product_name: '', quantity: '' }] as { product_id: string; product_name: string; quantity: string }[],
  });
  const [createSaving, setCreateSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (tab) params.status = tab;
    stockApi.approvals.list(params)
      .then((r: { data?: { approvals?: Approval[]; counts?: Counts } }) => {
        setApprovals(r.data?.approvals || []);
        setCounts(r.data?.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
      })
      .catch(() => toast.error('Failed to load approvals'))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = approvals.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.request_number.toLowerCase().includes(s) ||
      (a.source_reference || '').toLowerCase().includes(s) ||
      (a.requested_by_name || '').toLowerCase().includes(s) ||
      (a.warehouse_name || '').toLowerCase().includes(s)
    );
  });

  const handleStatusChange = async (a: Approval, newStatus: string) => {
    if (newStatus === 'rejected') { setShowReject(true); return; }
    setActionLoading(true);
    try {
      const res = await stockApi.approvals.changeStatus(a.id, { status: newStatus });
      toast.success(res.message || `Status changed to ${newStatus}`);
      if (res.data?.flow_result?.message) toast.success(res.data.flow_result.message);
      setShowDetail(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Failed to change status';
      toast.error(msg);
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      }
    }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    setActionLoading(true);
    try {
      await stockApi.approvals.changeStatus(selectedApproval.id, { status: 'rejected', rejection_reason: rejectReason });
      toast.success('Request rejected');
      setShowReject(false);
      setShowDetail(false);
      setRejectReason('');
      load();
    } catch { toast.error('Failed to reject'); }
    finally { setActionLoading(false); }
  };

  const handleCreate = async () => {
    if (!createForm.requested_action) { toast.error('Select an action'); return; }
    setCreateSaving(true);
    try {
      const items = createForm.items
        .filter((i) => i.product_name && i.quantity)
        .map((i) => ({
          product_id: Number(i.product_id) || 0,
          product_name: i.product_name,
          quantity: Number(i.quantity),
        }));
      await stockApi.approvals.create({
        source_module: createForm.source_module,
        source_reference: createForm.source_reference,
        requested_action: createForm.requested_action,
        warehouse: createForm.warehouse ? Number(createForm.warehouse) : null,
        next_module: createForm.next_module,
        notes: createForm.notes,
        items,
      });
      toast.success('Approval request created');
      setShowCreate(false);
      setCreateForm({
        source_module: 'manual', source_reference: '', requested_action: 'stock_out',
        warehouse: '', next_module: '', notes: '',
        items: [{ product_id: '', product_name: '', quantity: '' }],
      });
      load();
    } catch { toast.error('Failed to create request'); }
    finally { setCreateSaving(false); }
  };

  const addItem = () => setCreateForm((f) => ({
    ...f, items: [...f.items, { product_id: '', product_name: '', quantity: '' }],
  }));
  const removeItem = (idx: number) => setCreateForm((f) => ({
    ...f, items: f.items.filter((_, i) => i !== idx),
  }));
  const updateItem = (idx: number, field: string, val: string) => setCreateForm((f) => ({
    ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it),
  }));

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Inventory Approval</h1>
          <p style={{ color: '#666', marginTop: 4 }}>Review and approve inventory requests from all modules.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: '#1A1A2E', color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>+ New Request</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Pending', count: counts.pending, color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Approved', count: counts.approved, color: '#10B981', bg: '#ECFDF5' },
          { label: 'Rejected', count: counts.rejected, color: '#EF4444', bg: '#FEF2F2' },
          { label: 'Total', count: counts.total, color: '#6366F1', bg: '#EEF2FF' },
        ].map((s) => (
          <div key={s.label} style={{
            flex: 1, background: s.bg, borderRadius: 8, padding: '8px 14px',
            borderLeft: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, flexWrap: 'wrap' }}>
          {[{ key: '', label: 'All' }, ...allStatuses.map((s) => ({ key: s.key, label: s.label }))].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: tab === t.key ? '#1A1A2E' : 'transparent',
              color: tab === t.key ? '#fff' : '#555',
            }}>{t.label}</button>
          ))}
        </div>
        <input
          placeholder="Search requests..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd',
            fontSize: 14, width: 260,
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ color: '#888', fontWeight: 500 }}>No approval requests found</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Request #', 'Source', 'Action', 'Warehouse', 'Items', 'Status', 'Requested By', 'Date', ''].map(
                  (h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                      color: '#64748b', textTransform: 'uppercase',
                    }}>{h}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{a.request_number}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    <span style={{
                      background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    }}>{SOURCE_LABELS[a.source_module] || a.source_module}</span>
                    {a.source_reference && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{a.source_reference}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {ACTION_LABELS[a.requested_action] || a.requested_action}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {a.warehouse_name || '—'}
                    {a.destination_warehouse_name && (
                      <span style={{ color: '#888' }}> → {a.destination_warehouse_name}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {(a.items || []).length} item{(a.items || []).length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{statusPill(a.status, allStatuses)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{a.requested_by_name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => { setSelectedApproval(a); setShowDetail(true); }} style={{
                      background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 12px',
                      fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}>More Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedApproval && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowDetail(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: 640, maxHeight: '85vh', overflow: 'auto',
            padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{selectedApproval.request_number}</h2>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                  {SOURCE_LABELS[selectedApproval.source_module] || selectedApproval.source_module}
                  {selectedApproval.source_reference && ` — ${selectedApproval.source_module === 'orders' ? 'Order #' : ''}${selectedApproval.source_reference}`}
                </div>
              </div>
              {statusPill(selectedApproval.status, allStatuses)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Action', value: ACTION_LABELS[selectedApproval.requested_action] || selectedApproval.requested_action },
                { label: 'Warehouse', value: selectedApproval.warehouse_name || '—' },
                { label: 'Next Module', value: selectedApproval.next_module || 'None' },
                { label: 'Requested By', value: selectedApproval.requested_by_name || '—' },
                { label: 'Date', value: new Date(selectedApproval.created_at).toLocaleString() },
                ...(selectedApproval.approved_by_name ? [
                  { label: selectedApproval.status === 'rejected' ? 'Rejected By' : 'Approved By', value: selectedApproval.approved_by_name },
                ] : []),
              ].map((f) => (
                <div key={f.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Product details */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>Product details</div>
              {(selectedApproval.items || []).length === 0 ? (
                <div style={{ color: '#888', fontSize: 13 }}>No items</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedApproval.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px' }}>{item.product_name}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '6px 10px', color: '#888' }}>{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selectedApproval.notes && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                <strong>Notes:</strong> {selectedApproval.notes}
              </div>
            )}

            {selectedApproval.rejection_reason && (
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
                <strong>Rejection Reason:</strong> {selectedApproval.rejection_reason}
              </div>
            )}

            {selectedApproval.lead_details && (
              <div style={{ marginBottom: 16 }}>
                <LeadDetailsCard lead={selectedApproval.lead_details} />
              </div>
            )}

            {/* Status change actions */}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Change Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {allStatuses
                  .filter((s) => s.key !== selectedApproval.status)
                  .map((s) => (
                    <button key={s.key}
                      onClick={() => handleStatusChange(selectedApproval, s.key)}
                      disabled={actionLoading}
                      style={{
                        background: s.color + '15', color: s.color,
                        border: `1px solid ${s.color}40`, borderRadius: 8,
                        padding: '6px 16px', fontWeight: 600, fontSize: 13,
                        cursor: 'pointer',
                      }}>
                      {s.label}
                    </button>
                  ))}
                <button onClick={() => setShowDetail(false)} style={{
                  background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 16px',
                  fontWeight: 600, cursor: 'pointer', fontSize: 13, marginLeft: 'auto',
                }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && selectedApproval && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowReject(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: 440, padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>
              Reject {selectedApproval.request_number}
            </h3>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Reason *</label>
            <textarea
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              rows={4} placeholder="Why is this request being rejected?"
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd',
                fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowReject(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 20px',
                fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleReject} disabled={actionLoading} style={{
                background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontWeight: 600, cursor: 'pointer',
              }}>{actionLoading ? 'Rejecting...' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowCreate(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: 580, maxHeight: '85vh', overflow: 'auto',
            padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>New Approval Request</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Source Module</label>
                <select value={createForm.source_module}
                  onChange={(e) => setCreateForm((f) => ({ ...f, source_module: e.target.value }))}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="manual">Manual</option>
                  <option value="orders">Orders</option>
                  <option value="crm">CRM / Leads</option>
                  <option value="invoices">Invoices</option>
                  <option value="dispatch">Dispatch</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reference</label>
                <input value={createForm.source_reference}
                  onChange={(e) => setCreateForm((f) => ({ ...f, source_reference: e.target.value }))}
                  placeholder="Order #, Lead ID..."
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Action</label>
                <select value={createForm.requested_action}
                  onChange={(e) => setCreateForm((f) => ({ ...f, requested_action: e.target.value }))}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="stock_in">Stock In</option>
                  <option value="stock_out">Stock Out</option>
                  <option value="reserve">Reserve</option>
                  <option value="transfer">Transfer</option>
                  <option value="dispatch">Dispatch</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Forward To (Next)</label>
                <select value={createForm.next_module}
                  onChange={(e) => setCreateForm((f) => ({ ...f, next_module: e.target.value }))}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">None</option>
                  <option value="dispatch">Dispatch</option>
                  <option value="invoices">Invoices</option>
                  <option value="orders">Orders</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Items</label>
              {createForm.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input value={item.product_name}
                    onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                    placeholder="Product name"
                    style={{ flex: 2, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
                  />
                  <input value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    placeholder="Qty" type="number"
                    style={{ width: 80, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
                  />
                  {createForm.items.length > 1 && (
                    <button onClick={() => removeItem(idx)} style={{
                      background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6,
                      padding: '4px 8px', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={addItem} style={{
                background: 'none', color: '#6366F1', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, padding: 0,
              }}>+ Add Item</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Any additional notes..."
                style={{
                  width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd',
                  fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 20px',
                fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleCreate} disabled={createSaving} style={{
                background: '#1A1A2E', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontWeight: 600, cursor: 'pointer',
              }}>{createSaving ? 'Creating...' : 'Create Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
