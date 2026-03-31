import { useState, useEffect } from 'react';
import { historyApi } from '@/api/businessApi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'crm', label: 'CRM' },
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Orders' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'settings', label: 'Settings' },
  { value: 'hr', label: 'HR' },
  { value: 'warehouses', label: 'Warehouses' },
  { value: 'tracking', label: 'Tracking' },
];

type HistoryEntry = {
  id: number;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  title: string;
  details: Record<string, unknown>;
  performed_by: string;
  performed_by_email: string;
  created_at: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (moduleFilter) params.module = moduleFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await historyApi.list(params);
      const data = (res as { data?: { history?: HistoryEntry[] } })?.data ?? res;
      setHistory(data?.history ?? []);
    } catch {
      toast.error('Failed to load history.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [moduleFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this history entry? A summary will be retained for audit.')) return;
    setDeletingId(id);
    try {
      await historyApi.delete(id);
      toast.success('History deleted. Summary retained.');
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const params: Record<string, string> = {};
      if (moduleFilter) params.module = moduleFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await historyApi.export(params);
      const data = (res as { data?: { history?: HistoryEntry[] } })?.data ?? res;
      const items = data?.history ?? history;

      // Use print dialog - user can "Save as PDF"
      const printContent = document.createElement('div');
      printContent.style.padding = '24px';
      printContent.style.fontFamily = 'system-ui, sans-serif';
      printContent.innerHTML = `
        <h1>Module History Report</h1>
        <p>Generated: ${format(new Date(), 'PPpp')}</p>
        ${moduleFilter ? `<p>Module: ${MODULE_OPTIONS.find(m => m.value === moduleFilter)?.label || moduleFilter}</p>` : ''}
        ${dateFrom || dateTo ? `<p>Date range: ${dateFrom || '—'} to ${dateTo || '—'}</p>` : ''}
        <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th>Date</th><th>Module</th><th>Action</th><th>Title</th><th>By</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((h: HistoryEntry) => `
              <tr>
                <td>${h.created_at ? format(new Date(h.created_at), 'yyyy-MM-dd HH:mm') : '—'}</td>
                <td>${h.module}</td>
                <td>${h.action}</td>
                <td>${h.title}</td>
                <td>${h.performed_by || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write('<html><head><title>History Report</title></head><body>' + printContent.innerHTML + '</body></html>');
        w.document.close();
        w.focus();
        setTimeout(() => {
          w.print();
          w.close();
        }, 250);
      } else {
        toast.error('Popup blocked. Allow popups to download PDF.');
      }
    } catch {
      toast.error('Failed to export.');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const params: Record<string, string> = {};
      if (moduleFilter) params.module = moduleFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const blob = await historyApi.exportExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `module_history_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded.');
    } catch {
      toast.error('Failed to export Excel.');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Module History</h1>
          <p className="page-subtitle">View and export activity history. Deleted entries leave an audit summary.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Module</label>
            <select className="form-select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              {MODULE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From date</label>
            <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To date</label>
            <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleDownloadPDF} disabled={history.length === 0}>
            Download PDF
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDownloadExcel} disabled={history.length === 0}>
            Download Excel
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p>No history records for the selected filters.</p>
            <p style={{ marginTop: 8, fontSize: 13 }}>
              Try selecting <strong>All Modules</strong> or broadening the date range. History appears when leads are created, updated, or deleted, or when settings change.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {h.created_at ? format(new Date(h.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                    </td>
                    <td><span className="badge badge-secondary">{h.module}</span></td>
                    <td style={{ fontSize: 12 }}>{h.action}</td>
                    <td>{h.title}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{h.performed_by || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deletingId === h.id}
                        onClick={() => handleDelete(h.id)}
                      >
                        {deletingId === h.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
