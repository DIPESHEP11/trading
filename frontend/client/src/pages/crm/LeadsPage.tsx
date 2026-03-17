import React, { useState, useEffect, useRef } from 'react';
import { crmApi } from '@/api/crmApi';
import type { BulkAssignType, BulkAssignEmployee } from '@/api/crmApi';
import { hrApi } from '@/api/hrApi';
import { useAuthStore } from '@/store/authStore';
import type { Lead, LeadFormSchema, LeadFormField } from '@/types';
import toast from 'react-hot-toast';

interface CStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }
interface CSource { id: number; key: string; label: string; order: number; is_active: boolean }

const BADGE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const FIELD_TYPES: { value: LeadFormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' }, { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' }, { value: 'select', label: 'Dropdown' },
];

// ─── Extended Lead type (includes customer + assigned fields) ─────────────────
interface LeadRow extends Lead {
  customer_id?: number | null;
  customer_name?: string | null;
  assigned_to_name?: string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LeadsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  // ── Dynamic statuses / sources ──
  const [customStatuses, setCustomStatuses] = useState<CStatus[]>([]);
  const [customSources, setCustomSources]   = useState<CSource[]>([]);

  const statusLabels: Record<string, string> = {};
  const statusColors: Record<string, string> = {};
  customStatuses.forEach((s, i) => {
    statusLabels[s.key] = s.label;
    statusColors[s.key] = s.color || BADGE_COLORS[i % BADGE_COLORS.length];
  });
  const sourceLabels: Record<string, string> = {};
  customSources.forEach((s) => { sourceLabels[s.key] = s.label; });

  // ── Lead list ──
  const [leads, setLeads]           = useState<LeadRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch]         = useState('');

  // ── Schema ──
  const [schema, setSchema]         = useState<LeadFormSchema | null>(null);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [schemaSaving, setSchemaSaving]       = useState(false);
  const [schemaFields, setSchemaFields]       = useState<LeadFormField[]>([]);

  // ── View lead ──
  const [viewLead, setViewLead]     = useState<LeadRow | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [customerLeads, setCustomerLeads]   = useState<LeadRow[]>([]);
  const [customerLeadsView, setCustomerLeadsView] = useState(false);

  // ── Add lead ──
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [addLeadSaving, setAddLeadSaving]       = useState(false);
  const [addLeadSchemaData, setAddLeadSchemaData] = useState<Record<string, string>>({});
  const [allCustomers, setAllCustomers] = useState<{ id: number; first_name: string; last_name: string }[]>([]);

  // ── Import ──
  const [importing, setImporting]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Bulk selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Bulk assign ──
  const [bulkModal, setBulkModal]   = useState(false);
  const [assignType, setAssignType] = useState<BulkAssignType>('round_robin');
  const [poolBatch, setPoolBatch]   = useState(4);
  const [useUnassigned, setUseUnassigned] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [allEmployees, setAllEmployees] = useState<{ id: number; user_id: number; name: string }[]>([]);
  const [pickedEmps, setPickedEmps] = useState<BulkAssignEmployee[]>([]);

  useEffect(() => {
    crmApi.statuses.list().then((r) => setCustomStatuses(r.data?.statuses || [])).catch(() => {});
    crmApi.sources.list().then((r) => setCustomSources(r.data?.sources || [])).catch(() => {});
    crmApi.leadFormSchema.get().then((r) => {
      const d = r?.data?.data ?? r?.data;
      if (d) { setSchema(d); setSchemaFields(d.fields || []); }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchLeads(); }, [statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (search) params.search = search;
      const res = await crmApi.leads.list(params);
      setLeads(res.data?.leads || []);
    } catch { toast.error('Failed to fetch leads.'); }
    finally { setLoading(false); }
  };

  // ── Load employees once (for bulk assign) ──
  const loadEmployees = async () => {
    if (allEmployees.length) return;
    try {
      const res = await hrApi.employees.list();
      const list = (res as { data?: { employees: { id: number; user_id?: number; first_name?: string; last_name?: string; email?: string }[] } }).data?.employees ?? [];
      // Only include employees with user_id — bulk assign needs User IDs
      setAllEmployees(list
        .filter((e) => e.user_id != null)
        .map((e) => ({
          id: e.id,
          user_id: e.user_id as number,
          name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || (e.email ?? `Employee ${e.id}`),
        })));
    } catch { toast.error('Failed to load employees.'); }
  };

  const openBulkModal = async () => {
    await loadEmployees();
    setBulkModal(true);
  };

  const loadCustomers = async () => {
    if (allCustomers.length) return;
    try {
      const res = await crmApi.customers.list();
      const list = (res as { data?: { customers?: { id: number; first_name?: string; last_name?: string }[] } })?.data?.customers ?? [];
      setAllCustomers(list.map((c) => ({
        id: c.id,
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
      })));
    } catch { /* ignore */ }
  };

  const openAddLeadModal = () => {
    if (schema?.fields?.length) setAddLeadSchemaData(Object.fromEntries(schema.fields.map((f) => [f.key, ''])));
    setAddLeadModalOpen(true);
  };

  // ── Select / deselect leads ──
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  // ── Bulk assign submit ──
  const handleBulkAssign = async () => {
    if (!pickedEmps.length) { toast.error('Select at least one employee.'); return; }
    if (!useUnassigned && selectedIds.size === 0) { toast.error('Select leads or use "all unassigned".'); return; }
    if (assignType === 'custom') {
      const total = pickedEmps.reduce((s, e) => s + (e.count ?? 0), 0);
      if (total === 0) { toast.error('Set count for each employee.'); return; }
    }
    setAssignSaving(true);
    try {
      const res = await crmApi.leads.bulkAssign({
        lead_ids: useUnassigned ? undefined : Array.from(selectedIds),
        filter_unassigned: useUnassigned || undefined,
        assignment_type: assignType,
        employees: pickedEmps,
        pool_batch_size: poolBatch,
      });
      const d = (res as { data?: { assigned: number } })?.data;
      toast.success(`Assigned ${d?.assigned ?? '?'} leads successfully.`);
      setBulkModal(false);
      setSelectedIds(new Set());
      setPickedEmps([]);
      fetchLeads();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Bulk assign failed.');
    } finally { setAssignSaving(false); }
  };

  const togglePickedEmp = (emp: { user_id: number; name: string }) => {
    setPickedEmps((prev) => {
      const exists = prev.find((e) => e.user_id === emp.user_id);
      return exists
        ? prev.filter((e) => e.user_id !== emp.user_id)
        : [...prev, { user_id: emp.user_id, name: emp.name, count: 0 }];
    });
  };
  const setEmpCount = (userId: number, count: number) => {
    setPickedEmps((prev) => prev.map((e) => e.user_id === userId ? { ...e, count } : e));
  };

  // ── Status change ──
  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      const res = await crmApi.leads.update(leadId, { status: newStatus });
      const flowResult = res?.data?.flow_result;
      if (flowResult?.executed && flowResult.target_module !== 'none') {
        toast.success(`Status updated → ${flowResult.message}`, { duration: 5000 });
      } else {
        toast.success('Lead status updated.');
      }
      fetchLeads();
    } catch { toast.error('Failed to update status.'); }
  };

  // ── View lead + customer leads ──
  const handleViewLead = async (id: number) => {
    setViewLoading(true);
    setViewLead(null);
    setCustomerLeads([]);
    setCustomerLeadsView(false);
    try {
      const res = await crmApi.leads.get(id);
      setViewLead(res?.data?.data ?? res?.data ?? null);
    } catch { toast.error('Failed to load lead details.'); }
    finally { setViewLoading(false); }
  };

  const loadCustomerLeads = async (customerId: number) => {
    try {
      const res = await crmApi.customers.leads(customerId);
      setCustomerLeads((res as { data?: { leads: LeadRow[] } })?.data?.leads ?? []);
      setCustomerLeadsView(true);
    } catch { toast.error('Failed to load customer leads.'); }
  };

  // ── Share / template / import ──
  const handleShareForm = () => {
    const url = `${window.location.origin}/form/lead`;
    navigator.clipboard.writeText(url).then(() => toast.success('Form link copied.'));
  };
  const handleDownloadTemplate = async () => {
    try { await crmApi.leadFormSchema.downloadTemplate(); toast.success('Template downloaded.'); }
    catch { toast.error('Failed to download template.'); }
  };
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await crmApi.leadFormSchema.import(file);
      toast.success(`Imported ${res?.data?.created ?? 0} leads.`);
      (res?.data?.errors ?? []).slice(0, 5).forEach((err: { row: number; message: string }) =>
        toast.error(`Row ${err.row}: ${err.message}`));
      fetchLeads();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Import failed.');
    } finally { setImporting(false); e.target.value = ''; }
  };

  // ── Schema ──
  const handleSaveSchema = async () => {
    setSchemaSaving(true);
    try {
      await crmApi.leadFormSchema.update({ fields: schemaFields });
      toast.success('Lead form format saved.');
      setSchemaModalOpen(false);
      crmApi.leadFormSchema.get().then((r) => {
        const d = r?.data?.data ?? r?.data;
        if (d) setSchema(d);
      });
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to save schema.');
    } finally { setSchemaSaving(false); }
  };
  const addSchemaField = () => setSchemaFields((prev) => [
    ...prev, { key: `field_${Date.now()}`, label: 'New field', type: 'text', required: false, order: prev.length },
  ]);
  const updateSchemaField = (idx: number, updates: Partial<LeadFormField>) =>
    setSchemaFields((prev) => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  const removeSchemaField = (idx: number) =>
    setSchemaFields((prev) => prev.filter((_, i) => i !== idx));

  // Map schema keys → Lead core fields (same mapping as backend share form; no static defaults)
  const NAME_KEYS = ['customer_name', 'name', 'full_name', 'client'];
  const EMAIL_KEYS = ['email', 'mail'];
  const PHONE_KEYS = ['phone', 'mobile', 'contact', 'contact_number', 'contact_numbe'];

  const extractLeadFromSchema = (data: Record<string, string>) => {
    let name = '';
    let email = '';
    let phone = '';
    for (const [key, val] of Object.entries(data)) {
      const v = (val ?? '').trim();
      if (!v) continue;
      const k = key.toLowerCase().replace(/\s+/g, '_');
      if (NAME_KEYS.some((nk) => k === nk.toLowerCase())) name = v;
      else if (EMAIL_KEYS.some((ek) => k === ek.toLowerCase())) email = v;
      else if (PHONE_KEYS.some((pk) => k === pk.toLowerCase() || k.includes('contact'))) phone = v;
    }
    return {
      name: name || Object.values(data).find((v) => (v ?? '').trim()) || 'Manual entry',
      email: email || undefined,
      phone: phone || undefined,
      custom_data: data,
    };
  };

  // ── Add lead (schema fields only) ──
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    for (const [key, val] of Object.entries(addLeadSchemaData)) {
      const v = (val ?? '').trim();
      if (v) data[key] = v;
    }
    if (!schema?.fields?.length) {
      toast.error('Form format not configured. Set up fields in CRM Settings.');
      return;
    }
    const required = schema.fields.filter((f) => f.required);
    for (const f of required) {
      if (!(data[f.key] ?? '').trim()) {
        toast.error(`"${f.label}" is required.`);
        return;
      }
    }
    setAddLeadSaving(true);
    try {
      const { name, email, phone, custom_data } = extractLeadFromSchema(data);
      await crmApi.leads.create({
        name,
        email,
        phone,
        source: 'manual',
        custom_data: Object.keys(custom_data).length ? custom_data : undefined,
      });
      toast.success('Lead added.');
      setAddLeadModalOpen(false);
      setAddLeadSchemaData({});
      fetchLeads();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to add lead.');
    } finally { setAddLeadSaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">CRM — Leads</h1>
          <p className="page-subtitle">Manage leads from Meta, Shopify, online, form and manual sources.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openAddLeadModal}>+ Add lead</button>
          <button className="btn btn-secondary" onClick={handleShareForm}>Share form</button>
          <button className="btn btn-secondary" onClick={handleDownloadTemplate}>Download Excel template</button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? 'Importing...' : 'Bulk upload Excel'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" placeholder="Search by name, phone, email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
            style={{ flex: '1 1 200px', maxWidth: 300 }} />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
            <option value="">All Statuses</option>
            {customStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className="form-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
            <option value="">All Sources</option>
            {customSources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={fetchLeads}>Search</button>
          {selectedIds.size > 0 && isAdmin && (
            <button className="btn btn-secondary" onClick={openBulkModal} style={{ marginLeft: 'auto' }}>
              Assign {selectedIds.size} selected →
            </button>
          )}
        </div>
      </div>

      {/* ── Status pills ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {customStatuses.map((st) => {
          const count = leads.filter((l) => l.status === st.key).length;
          const active = statusFilter === st.key;
          return (
            <button
              key={st.key}
              onClick={() => setStatusFilter(active ? '' : st.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: `1.5px solid ${active ? st.color || 'var(--color-primary)' : '#e2e8f0'}`,
                background: active ? (st.color || 'var(--color-primary)') : '#fff',
                color: active ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {st.label}
              <span style={{
                minWidth: 18, height: 18, borderRadius: 10, fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: active ? '#fff' : '#1e293b', padding: '0 4px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Lead table ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">All Leads ({leads.length})</h2>
          {selectedIds.size > 0 && (
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>{selectedIds.size} selected</span>
          )}
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
                  {isAdmin && (
                    <th style={{ width: 36 }}>
                      <input type="checkbox"
                        checked={selectedIds.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }} />
                    </th>
                  )}
                  <th>Name / Contact</th>
                  <th>Client</th>
                  <th>Assigned</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => handleViewLead(lead.id)}>
                    {isAdmin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          style={{ cursor: 'pointer' }} />
                      </td>
                    )}
                    <td>
                      <strong>{lead.name || '—'}</strong>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block' }}>
                        {[lead.email, lead.phone].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </td>
                    <td>
                      {lead.customer_id && lead.customer_name ? (
                        <span
                          style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={(e) => { e.stopPropagation(); loadCustomerLeads(lead.customer_id!); setViewLead(lead); }}
                          title="View all leads from this client"
                        >
                          {lead.customer_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: lead.assigned_to_name ? '#1e293b' : '#94a3b8' }}>
                        {lead.assigned_to_name || '—'}
                      </span>
                    </td>
                    <td><span style={{ fontSize: 13 }}>{sourceLabels[lead.source] || lead.source || '—'}</span></td>
                    <td>
                      <span className="badge" style={{ background: statusColors[lead.status] ? `${statusColors[lead.status]}20` : '#e2e8f0', color: statusColors[lead.status] || '#64748b' }}>{statusLabels[lead.status] || lead.status || '—'}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleViewLead(lead.id)}>More Details</button>
                        <select className="form-select" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
                          value={lead.status} onChange={(e) => handleStatusChange(lead.id, e.target.value)}>
                          {customStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Add Lead
      ═══════════════════════════════════════════════════════════════════════ */}
      {addLeadModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !addLeadSaving && setAddLeadModalOpen(false)}>
          <div className="card" style={{ maxWidth: 440, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Add Lead</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !addLeadSaving && setAddLeadModalOpen(false)}>Close</button>
            </div>
            <form className="card-body" onSubmit={handleAddLeadSubmit}>
              {(!schema?.fields?.length) ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                  Configure the form format in <strong>CRM Settings</strong> first.
                </div>
              ) : (
                <>
                  {[...(schema?.fields ?? [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((f) => (
                    <div key={f.key} className="form-group">
                      <label className="form-label">{f.label}{f.required && ' *'}</label>
                      {f.type === 'textarea' ? (
                        <textarea className="form-textarea" rows={2} value={addLeadSchemaData[f.key] ?? ''}
                          onChange={(e) => setAddLeadSchemaData((p) => ({ ...p, [f.key]: e.target.value }))} required={f.required} />
                      ) : f.type === 'select' ? (
                        <select className="form-select" value={addLeadSchemaData[f.key] ?? ''}
                          onChange={(e) => setAddLeadSchemaData((p) => ({ ...p, [f.key]: e.target.value }))} required={f.required}>
                          <option value="">Select...</option>
                          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="form-input"
                          type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'}
                          value={addLeadSchemaData[f.key] ?? ''}
                          onChange={(e) => setAddLeadSchemaData((p) => ({ ...p, [f.key]: e.target.value }))}
                          required={f.required} placeholder={f.label} />
                      )}
                    </div>
                  ))}
                </>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddLeadModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addLeadSaving}>
                  {addLeadSaving ? 'Adding...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Setup Form Format (admin-only)
      ═══════════════════════════════════════════════════════════════════════ */}
      {schemaModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !schemaSaving && setSchemaModalOpen(false)}>
          <div className="card" style={{ maxWidth: 580, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Lead Form Format</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSchemaModalOpen(false)}>Close</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Define fields for the lead form, Excel template, and bulk import. You can edit this at any time.
              </p>
              {schemaFields.length === 0 && (
                <button className="btn btn-primary btn-sm" onClick={addSchemaField} style={{ marginBottom: 16 }}>+ Add first field</button>
              )}
              {schemaFields.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input className="form-input" placeholder="Key (e.g. customer_name)" value={f.key}
                    onChange={(e) => updateSchemaField(idx, { key: e.target.value })} style={{ width: 140 }} />
                  <input className="form-input" placeholder="Label" value={f.label}
                    onChange={(e) => updateSchemaField(idx, { label: e.target.value })} style={{ width: 120 }} />
                  <select className="form-select" value={f.type}
                    onChange={(e) => updateSchemaField(idx, { type: e.target.value as LeadFormField['type'] })} style={{ width: 110 }}>
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                    <input type="checkbox" checked={f.required}
                      onChange={(e) => updateSchemaField(idx, { required: e.target.checked })} />
                    Required
                  </label>
                  <button className="btn btn-danger btn-sm" onClick={() => removeSchemaField(idx)}>✕</button>
                </div>
              ))}
              {schemaFields.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={addSchemaField} style={{ marginTop: 4 }}>+ Add field</button>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setSchemaModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveSchema} disabled={schemaSaving || schemaFields.length === 0}>
                  {schemaSaving ? 'Saving...' : 'Save Format'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Bulk Assign (admin-only)
      ═══════════════════════════════════════════════════════════════════════ */}
      {bulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !assignSaving && setBulkModal(false)}>
          <div className="card" style={{ maxWidth: 560, maxHeight: '92vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Bulk Assign Leads</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setBulkModal(false)}>Close</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Which leads */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>1. Which Leads</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
                  <input type="radio" checked={!useUnassigned} onChange={() => setUseUnassigned(false)} />
                  Use selected leads ({selectedIds.size} selected)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={useUnassigned} onChange={() => setUseUnassigned(true)} />
                  All unassigned leads
                </label>
              </div>

              {/* Assignment type */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#1e293b' }}>2. Assignment Strategy</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['round_robin', 'pool', 'custom'] as BulkAssignType[]).map((t) => {
                    const labels = { round_robin: '🔄 Round Robin', pool: '🏊 Pool', custom: '🎯 Custom' };
                    const descs  = {
                      round_robin: 'Equal distribution in rotation',
                      pool: 'Fill each employee\'s batch, then continue',
                      custom: 'Set exact count per employee',
                    };
                    const active = assignType === t;
                    return (
                      <div key={t} onClick={() => setAssignType(t)}
                        style={{ flex: 1, border: `2px solid ${active ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 10,
                          padding: '10px 12px', cursor: 'pointer', background: active ? '#eff6ff' : '#fff',
                          transition: 'all 0.15s' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#1d4ed8' : '#1e293b', marginBottom: 4 }}>
                          {labels[t]}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{descs[t]}</div>
                      </div>
                    );
                  })}
                </div>
                {assignType === 'pool' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13 }}>Batch size per employee:</label>
                    <input type="number" className="form-input" value={poolBatch} min={1}
                      onChange={(e) => setPoolBatch(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: 80 }} />
                  </div>
                )}
              </div>

              {/* Employee selection */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>3. Select Employees</div>
                {allEmployees.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>No employees found. Add employees in the HR module.</div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {allEmployees.map((emp) => {
                      const picked = pickedEmps.find((p) => p.user_id === emp.user_id);
                      return (
                        <div key={emp.user_id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9', background: picked ? '#eff6ff' : '#fff' }}>
                          <input type="checkbox" checked={!!picked}
                            onChange={() => togglePickedEmp(emp)}
                            style={{ cursor: 'pointer', accentColor: '#3b82f6' }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: picked ? 600 : 400 }}>{emp.name}</span>
                          {assignType === 'custom' && picked && (
                            <input type="number" className="form-input" placeholder="Count"
                              value={picked.count ?? 0} min={0}
                              onChange={(e) => setEmpCount(emp.user_id, parseInt(e.target.value) || 0)}
                              style={{ width: 80 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {pickedEmps.length > 0 && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                    {pickedEmps.length} employee{pickedEmps.length > 1 ? 's' : ''} selected
                    {assignType === 'custom' && ` · ${pickedEmps.reduce((s, e) => s + (e.count ?? 0), 0)} leads total`}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBulkAssign} disabled={assignSaving || pickedEmps.length === 0}>
                  {assignSaving ? 'Assigning...' : 'Assign Leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: View Lead Details
      ═══════════════════════════════════════════════════════════════════════ */}
      {(viewLead !== null || viewLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setViewLead(null); setCustomerLeadsView(false); }}>
          <div className="card" style={{ maxWidth: 500, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{customerLeadsView ? 'All Leads from Client' : 'Lead Details'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {customerLeadsView && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setCustomerLeadsView(false)}>← Back</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => { setViewLead(null); setCustomerLeadsView(false); }}>Close</button>
              </div>
            </div>
            <div className="card-body">
              {viewLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>
              ) : customerLeadsView ? (
                /* ── Customer leads list ── */
                <div>
                  {viewLead?.customer_id && (
                    <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, marginBottom: 16 }}>
                      <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{viewLead.customer_name ?? 'Client'}</span>
                      <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{customerLeads.length} lead{customerLeads.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {customerLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No leads found for this client.</div>
                  ) : (
                    customerLeads.map((cl) => (
                      <div key={cl.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 13 }}>{cl.name}</strong>
                          <span className="badge" style={{ background: statusColors[cl.status] ? `${statusColors[cl.status]}20` : '#e2e8f0', color: statusColors[cl.status] || '#64748b' }}>{statusLabels[cl.status] || cl.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                          {sourceLabels[cl.source] || cl.source} · {new Date(cl.created_at).toLocaleDateString()}
                          {cl.assigned_to_name && ` · Assigned: ${cl.assigned_to_name}`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : viewLead ? (
                /* ── Single lead detail ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {viewLead.customer_id && (
                    <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>👤 {viewLead.customer_name ?? 'Client'}</span>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => loadCustomerLeads(viewLead.customer_id!)}>
                        View all client leads →
                      </button>
                    </div>
                  )}
                  <div><strong>Name</strong><br />{viewLead.name || '—'}</div>
                  <div><strong>Email</strong><br />{viewLead.email || '—'}</div>
                  <div><strong>Phone</strong><br />{viewLead.phone || '—'}</div>
                  <div><strong>Company</strong><br />{viewLead.company || '—'}</div>
                  <div><strong>Notes</strong><br />{viewLead.notes || '—'}</div>
                  <div><strong>Source</strong><br />{sourceLabels[viewLead.source] || viewLead.source || '—'}</div>
                  <div><strong>Status</strong><br /><span className="badge" style={{ background: statusColors[viewLead.status] ? `${statusColors[viewLead.status]}20` : '#e2e8f0', color: statusColors[viewLead.status] || '#64748b' }}>{statusLabels[viewLead.status] || viewLead.status || '—'}</span></div>
                  <div><strong>Assigned to</strong><br />{(viewLead as LeadRow).assigned_to_name || '—'}</div>
                  <div><strong>Client</strong><br />{viewLead.customer_name || '—'}</div>
                  <div><strong>Created</strong><br />{viewLead.created_at ? new Date(viewLead.created_at).toLocaleString() : '—'}</div>
                  {viewLead.custom_data && Object.keys(viewLead.custom_data).length > 0 && (
                    <>
                      <hr style={{ margin: '8px 0' }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Additional details</div>
                      {Object.entries(viewLead.custom_data).map(([k, v]) => (
                        <div key={k}><strong>{k.replace(/_/g, ' ')}</strong><br />{String(v) || '—'}</div>
                      ))}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
