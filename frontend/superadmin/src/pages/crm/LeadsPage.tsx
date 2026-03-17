import React, { useState, useEffect } from 'react';
import { crmApi } from '@/api/crmApi';
import type { Lead, LeadStatus, LeadSource } from '@/types';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  order_created: 'Order Created', lost: 'Lost',
};
const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'badge-primary', contacted: 'badge-warning', qualified: 'badge-success',
  order_created: 'badge-success', lost: 'badge-danger',
};
const SOURCE_LABELS: Record<string, string> = {
  meta: '📘 Meta', shopify: '🛍️ Shopify', online: '🌐 Online',
  manual: '✏️ Manual', whatsapp: '💬 WhatsApp', referral: '🤝 Referral',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (search) params.search = search;
      const res = await crmApi.leads.list(params);
      setLeads(res.data?.leads || []);
    } catch {
      toast.error('Failed to fetch leads.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: number, newStatus: LeadStatus) => {
    try {
      await crmApi.leads.update(leadId, { status: newStatus });
      toast.success('Lead status updated.');
      fetchLeads();
    } catch {
      toast.error('Failed to update lead status.');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">CRM — Leads</h1>
        <p className="page-subtitle">Manage leads from Meta, Shopify, online, and manual sources.</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" className="form-input" placeholder="Search by name, phone, email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
            style={{ flex: '1 1 200px', maxWidth: 300 }}
          />
          <select className="form-select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select className="form-select" value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={fetchLeads}>Search</button>
        </div>
      </div>

      {/* Lead count by status */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status}
            className="stat-card"
            style={{ cursor: 'pointer', border: statusFilter === status ? '2px solid var(--color-primary)' : undefined }}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status as LeadStatus)}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{leads.filter((l) => l.status === status).length}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Leads ({leads.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : leads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No leads found.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Source</th><th>Status</th>
                  <th>Assigned To</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td><strong>{lead.name}</strong><br />
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{lead.email}</span>
                    </td>
                    <td>{lead.phone || '—'}</td>
                    <td><span style={{ fontSize: 13 }}>{SOURCE_LABELS[lead.source] || lead.source}</span></td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td>{lead.assigned_to_name || <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
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
