import { useState, useEffect } from 'react';
import { invoicesApi } from '@/api/businessApi';
import type { Invoice, InvoiceStatus } from '@/types';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'badge-neutral', sent: 'badge-primary', paid: 'badge-success',
  overdue: 'badge-danger', cancelled: 'badge-danger',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchInvoices(); }, [statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.list(params);
      setInvoices(res.data?.invoices || []);
    } catch {
      toast.error('Failed to load invoices.');
    } finally { setLoading(false); }
  };

  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + parseFloat(i.total_amount), 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Invoices & Dispatch</h1>
        <p className="page-subtitle">Manage invoices and create dispatch stickers.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{invoices.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid Amount</div>
          <div className="stat-value" style={{ fontSize: 22 }}>₹{totalPaid.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {invoices.filter((i) => i.status === 'overdue').length}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select className="form-select" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All Statuses</option>
          {['draft', 'sent', 'paid', 'overdue', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Invoices ({invoices.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Invoice #</th><th>Order #</th><th>Status</th>
                  <th>Amount</th><th>Due Date</th><th>Created</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No invoices found.
                  </td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td style={{ fontSize: 12 }}>{inv.order_number}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td><strong>₹{parseFloat(inv.total_amount).toLocaleString()}</strong></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
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
