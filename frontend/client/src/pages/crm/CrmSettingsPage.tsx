import React, { useState, useEffect, useMemo } from 'react';
import { crmApi } from '@/api/crmApi';
import type { BulkAssignType, BulkAssignEmployee } from '@/api/crmApi';
import { hrApi } from '@/api/hrApi';
import { configApi } from '@/api/businessApi';
import type { LeadFormSchema, LeadFormField, CrmPhoneRegexPreset } from '@/types';
import toast from 'react-hot-toast';

const DEFAULT_LEAD_FIELDS: LeadFormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, order: 0 },
  { key: 'phone', label: 'Contact', type: 'phone', required: false, order: 1 },
  { key: 'email', label: 'Email', type: 'email', required: false, order: 2 },
  { key: 'address', label: 'Address', type: 'textarea', required: false, order: 3 },
  { key: 'product_name', label: 'Product name', type: 'text', required: false, order: 4 },
  { key: 'product_count', label: 'Product count', type: 'number', required: false, order: 5 },
  { key: 'product_price', label: 'Product price', type: 'number', required: false, order: 6 },
  { key: 'company', label: 'Company', type: 'text', required: false, order: 7 },
  { key: 'source', label: 'Source', type: 'text', required: false, order: 8 },
  { key: 'status', label: 'Status', type: 'text', required: false, order: 9 },
  { key: 'date', label: 'Date', type: 'text', required: false, order: 10 },
];

const FIELD_TYPES: { value: LeadFormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
];

interface CStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }
interface CSource { id: number; key: string; label: string; order: number; is_active: boolean }
interface FlowAction { id: number; status_key: string; status_label: string; target_module: string; action: string; is_active: boolean; description: string }

type Tab = 'form' | 'statuses' | 'sources' | 'flow' | 'assign' | 'leadintegrations';

const MODULE_OPTIONS = [
  { value: 'none',      label: 'Stay in CRM only' },
  { value: 'orders',    label: 'Orders' },
  { value: 'warehouse', label: 'Warehouse / Inventory' },
  { value: 'invoices',  label: 'Invoices' },
  { value: 'dispatch',  label: 'Dispatch' },
  { value: 'products',  label: 'Products' },
];

const ACTION_OPTIONS: Record<string, { value: string; label: string }[]> = {
  none:      [{ value: 'notify_only', label: 'Notify Only' }],
  orders:    [{ value: 'create_order', label: 'Create Order' }],
  warehouse: [{ value: 'send_to_warehouse', label: 'Send to Warehouse' }],
  invoices:  [{ value: 'create_invoice', label: 'Create Invoice' }],
  dispatch:  [{ value: 'mark_dispatch', label: 'Mark for Dispatch' }],
  products:  [{ value: 'notify_only', label: 'Notify Only' }],
};

const COLOR_OPTIONS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#64748b', '#1d4ed8', '#dc2626',
];

export default function CrmSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('form');

  // ── Form Format ──
  const [schema, setSchema]           = useState<LeadFormSchema | null>(null);
  const [schemaFields, setSchemaFields] = useState<LeadFormField[]>([]);
  /** Raw string for dropdown options — allows typing commas; parsed on blur */
  const [optionsRaw, setOptionsRaw] = useState<Record<number, string>>({});
  const [schemaSaving, setSchemaSaving] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(true);
  /** Built-in fields: order, required, labels, phone preset — synced from API `default_fields` */
  const [editedDefaults, setEditedDefaults] = useState<LeadFormField[]>(() => [...DEFAULT_LEAD_FIELDS]);
  const [phoneRegexPresets, setPhoneRegexPresets] = useState<CrmPhoneRegexPreset[]>([]);

  // ── Integrations: webhook/API guidance only ──
  const [externalLinks, setExternalLinks] = useState<{ label: string; url: string }[]>([]);
  const [savingExternalLinks, setSavingExternalLinks] = useState(false);
  const [configCustomFields, setConfigCustomFields] = useState<Record<string, unknown>>({});

  // ── Custom Statuses ──
  const [statuses, setStatuses]       = useState<CStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusForm, setStatusForm]   = useState({ key: '', label: '', color: '#3b82f6' });
  const [editStatusId, setEditStatusId] = useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Custom Sources ──
  const [sources, setSources]         = useState<CSource[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceForm, setSourceForm]   = useState({ key: '', label: '' });
  const [editSourceId, setEditSourceId] = useState<number | null>(null);
  const [sourceSaving, setSourceSaving] = useState(false);

  // ── Status Flow ──
  const [flowActions, setFlowActions]     = useState<FlowAction[]>([]);
  const [flowLoading, setFlowLoading]     = useState(true);
  const [flowForm, setFlowForm]           = useState({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
  const [editFlowId, setEditFlowId]       = useState<number | null>(null);
  const [flowSaving, setFlowSaving]       = useState(false);

  // ── Bulk Assign ──
  const [assignType, setAssignType]   = useState<BulkAssignType>('round_robin');
  const [poolBatch, setPoolBatch]     = useState(4);
  const [useUnassigned, setUseUnassigned] = useState(true);
  const [assignSaving, setAssignSaving] = useState(false);
  const [allEmployees, setAllEmployees] = useState<{ user_id: number; name: string }[]>([]);
  const [pickedEmps, setPickedEmps]   = useState<BulkAssignEmployee[]>([]);
  const [empLoading, setEmpLoading]   = useState(true);

  // ── Load data ──
  useEffect(() => {
    crmApi.leadFormSchema.get()
      .then((r) => {
        const d = r?.data?.data ?? r?.data;
        if (d) {
          setSchema(d);
          setSchemaFields(d.custom_fields ?? d.fields ?? []);
          setPhoneRegexPresets(Array.isArray(d.phone_regex_presets) ? d.phone_regex_presets : []);
          if (Array.isArray(d.default_fields) && d.default_fields.length) {
            setEditedDefaults(
              [...d.default_fields].sort((a: LeadFormField, b: LeadFormField) => (a.order ?? 0) - (b.order ?? 0)),
            );
          }
        }
      })
      .catch(() => toast.error('Failed to load form schema.'))
      .finally(() => setSchemaLoading(false));

    hrApi.employees.list()
      .then((res) => {
        const list = (res as any).data?.employees ?? [];
        const emps = list
          .filter((e: any) => e.user_id != null)
          .map((e: any) => ({
            user_id: e.user_id,
            name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || (e.email ?? `Employee ${e.id}`),
          }));
        setAllEmployees(emps);
        return emps;
      })
      .then((emps) => configApi.get().then((cfgRes) => ({ emps, cfgRes })))
      .then(({ emps, cfgRes }) => {
        const wrap = cfgRes as { data?: Record<string, unknown> };
        const cfg = wrap?.data as Record<string, unknown> | undefined;
        const prefs = cfg?.crm_bulk_assign_defaults as
          | {
              assignment_type?: string;
              pool_batch_size?: number;
              filter_unassigned?: boolean;
              employees?: { user_id: number; count?: number }[];
            }
          | undefined;
        if (!prefs || typeof prefs !== 'object') return;
        if (prefs.assignment_type === 'round_robin' || prefs.assignment_type === 'pool' || prefs.assignment_type === 'custom') {
          setAssignType(prefs.assignment_type);
        }
        if (typeof prefs.pool_batch_size === 'number' && prefs.pool_batch_size >= 1) {
          setPoolBatch(prefs.pool_batch_size);
        }
        if (typeof prefs.filter_unassigned === 'boolean') {
          setUseUnassigned(prefs.filter_unassigned);
        }
        if (Array.isArray(prefs.employees) && prefs.employees.length && emps.length) {
          const byId = new Map(emps.map((e) => [e.user_id, e.name]));
          const picked = prefs.employees
            .map((row) => {
              const name = byId.get(row.user_id);
              if (!name) return null;
              return { user_id: row.user_id, name, count: row.count ?? 0 } as BulkAssignEmployee;
            })
            .filter(Boolean) as BulkAssignEmployee[];
          if (picked.length) setPickedEmps(picked);
        }
        const customFields = (cfg?.custom_fields ?? {}) as Record<string, unknown>;
        setConfigCustomFields(customFields);
        const rawLinks = customFields.crm_external_links;
        if (Array.isArray(rawLinks)) {
          const links = rawLinks
            .map((it) => {
              if (!it || typeof it !== 'object') return null;
              const row = it as Record<string, unknown>;
              return {
                label: String(row.label ?? '').trim(),
                url: String(row.url ?? '').trim(),
              };
            })
            .filter((it): it is { label: string; url: string } => !!it && !!it.url);
          setExternalLinks(links);
        }
      })
      .catch(() => {})
      .finally(() => setEmpLoading(false));

    loadStatuses();
    loadSources();
    loadFlowActions();
  }, []);

  const loadStatuses = () => {
    setStatusLoading(true);
    crmApi.statuses.list()
      .then((r) => setStatuses(r.data?.statuses || []))
      .catch(() => toast.error('Failed to load statuses.'))
      .finally(() => setStatusLoading(false));
  };
  const loadSources = () => {
    setSourceLoading(true);
    crmApi.sources.list()
      .then((r) => setSources(r.data?.sources || []))
      .catch(() => toast.error('Failed to load sources.'))
      .finally(() => setSourceLoading(false));
  };
  const loadFlowActions = () => {
    setFlowLoading(true);
    crmApi.flowActions.list()
      .then((r) => setFlowActions(r.data?.flow_actions || []))
      .catch(() => toast.error('Failed to load flow actions.'))
      .finally(() => setFlowLoading(false));
  };

  // ── Schema helpers ──
  const addField = () => setSchemaFields((p) => [
    ...p, { key: `field_${Date.now()}`, label: 'New field', type: 'text', required: false, order: p.length },
  ]);
  const slugifyLabel = (label: string) =>
    label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `field_${Date.now()}`;
  const updateField = (idx: number, updates: Partial<LeadFormField>) =>
    setSchemaFields((p) => p.map((f, i) => {
      if (i !== idx) return f;
      const next = { ...f, ...updates };
      if ('label' in updates && updates.label != null) next.key = slugifyLabel(updates.label) || f.key;
      return next;
    }));
  const removeField = (idx: number) =>
    setSchemaFields((p) => p.filter((_, i) => i !== idx));

  const defaultOverridesPayload = useMemo(() => {
    const overrides: Record<
      string,
      { order: number; required: boolean; label?: string; phone_preset_id?: string }
    > = {};
    editedDefaults.forEach((f, idx) => {
      const base = DEFAULT_LEAD_FIELDS.find((b) => b.key === f.key);
      const o: { order: number; required: boolean; label?: string; phone_preset_id?: string } = {
        order: idx,
        required: !!f.required,
      };
      if (base && f.label !== base.label) o.label = f.label;
      if (f.key === 'phone') {
        const pid = (f.phone_preset_id ?? '').trim();
        if (pid) o.phone_preset_id = pid;
      }
      overrides[f.key] = o;
    });
    return overrides;
  }, [editedDefaults]);

  const moveDefaultField = (index: number, delta: number) => {
    setEditedDefaults((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const updateDefaultField = (key: string, updates: Partial<LeadFormField>) => {
    setEditedDefaults((prev) => prev.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const moveCustomField = (index: number, delta: number) => {
    setSchemaFields((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleSaveSchema = async () => {
    setSchemaSaving(true);
    try {
      const seen = new Set<string>();
      const customOrderBase = editedDefaults.length;
      const withUniqueKeys = schemaFields.map((f, idx) => {
        let key = f.key || slugifyLabel(f.label || '') || `field_${Date.now()}`;
        if (seen.has(key)) {
          let n = 2;
          while (seen.has(`${key}_${n}`)) n++;
          key = `${key}_${n}`;
        }
        seen.add(key);
        return { ...f, key, order: customOrderBase + idx, options: (f.options ?? []).filter(Boolean) };
      });
      const res = await crmApi.leadFormSchema.update({
        custom_fields: withUniqueKeys,
        default_field_overrides: defaultOverridesPayload,
      });
      const d = (res as any)?.data ?? res;
      if (d) {
        setSchema(d);
        if (Array.isArray(d.phone_regex_presets)) setPhoneRegexPresets(d.phone_regex_presets);
        if (Array.isArray(d.default_fields) && d.default_fields.length) {
          setEditedDefaults(
            [...d.default_fields].sort((a: LeadFormField, b: LeadFormField) => (a.order ?? 0) - (b.order ?? 0)),
          );
        }
      }
      setSchemaFields(withUniqueKeys);
      toast.success('Lead form format saved.');
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: unknown } } };
      const msg = ex?.response?.data?.message || (ex?.response?.data?.errors ? JSON.stringify(ex.response.data.errors) : null) || 'Failed to save schema.';
      toast.error(msg);
    } finally { setSchemaSaving(false); }
  };

  // ── Status helpers ──
  const resetStatusForm = () => { setStatusForm({ key: '', label: '', color: '#3b82f6' }); setEditStatusId(null); };
  const handleSaveStatus = async () => {
    if (!statusForm.label.trim()) { toast.error('Label is required.'); return; }
    const key = statusForm.key.trim() || statusForm.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setStatusSaving(true);
    try {
      if (editStatusId) {
        await crmApi.statuses.update(editStatusId, { ...statusForm, key });
        toast.success('Status updated.');
      } else {
        await crmApi.statuses.create({ ...statusForm, key, order: statuses.length });
        toast.success('Status created.');
      }
      resetStatusForm();
      loadStatuses();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; key?: string[] } } };
      toast.error(ex?.response?.data?.key?.[0] || ex?.response?.data?.message || 'Failed to save status.');
    } finally { setStatusSaving(false); }
  };
  const handleDeleteStatus = async (id: number) => {
    if (!confirm('Delete this status?')) return;
    try { await crmApi.statuses.delete(id); loadStatuses(); toast.success('Status deleted.'); }
    catch { toast.error('Failed to delete status.'); }
  };

  // ── Source helpers ──
  const resetSourceForm = () => { setSourceForm({ key: '', label: '' }); setEditSourceId(null); };
  const handleSaveSource = async () => {
    if (!sourceForm.label.trim()) { toast.error('Label is required.'); return; }
    const key = sourceForm.key.trim() || sourceForm.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setSourceSaving(true);
    try {
      if (editSourceId) {
        await crmApi.sources.update(editSourceId, { ...sourceForm, key });
        toast.success('Source updated.');
      } else {
        await crmApi.sources.create({ ...sourceForm, key, order: sources.length });
        toast.success('Source created.');
      }
      resetSourceForm();
      loadSources();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; key?: string[] } } };
      toast.error(ex?.response?.data?.key?.[0] || ex?.response?.data?.message || 'Failed to save source.');
    } finally { setSourceSaving(false); }
  };
  const handleDeleteSource = async (id: number) => {
    if (!confirm('Delete this source?')) return;
    try { await crmApi.sources.delete(id); loadSources(); toast.success('Source deleted.'); }
    catch { toast.error('Failed to delete source.'); }
  };

  // ── Flow action helpers ──
  const resetFlowForm = () => { setFlowForm({ status_key: '', target_module: 'none', action: 'notify_only', description: '' }); setEditFlowId(null); };
  const handleSaveFlow = async () => {
    if (!flowForm.status_key) { toast.error('Select a status.'); return; }
    setFlowSaving(true);
    try {
      if (editFlowId) {
        await crmApi.flowActions.update(editFlowId, flowForm);
        toast.success('Flow action updated.');
      } else {
        await crmApi.flowActions.create(flowForm);
        toast.success('Flow action created.');
      }
      resetFlowForm();
      loadFlowActions();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; status_key?: string[] } } };
      toast.error(ex?.response?.data?.status_key?.[0] || ex?.response?.data?.message || 'Failed to save flow action.');
    } finally { setFlowSaving(false); }
  };
  const handleDeleteFlow = async (id: number) => {
    if (!confirm('Delete this flow action?')) return;
    try { await crmApi.flowActions.delete(id); loadFlowActions(); toast.success('Flow action deleted.'); }
    catch { toast.error('Failed to delete flow action.'); }
  };

  const configuredStatusKeys = new Set(flowActions.map((f) => f.status_key));
  const unconfiguredStatuses = statuses.filter((s) => !configuredStatusKeys.has(s.key));

  // ── Bulk assign helpers ──
  const toggleEmp = (emp: { user_id: number; name: string }) => {
    setPickedEmps((p) => {
      const exists = p.find((e) => e.user_id === emp.user_id);
      return exists
        ? p.filter((e) => e.user_id !== emp.user_id)
        : [...p, { user_id: emp.user_id, name: emp.name, count: 0 }];
    });
  };
  const setCount = (userId: number, count: number) =>
    setPickedEmps((p) => p.map((e) => e.user_id === userId ? { ...e, count } : e));

  const handleBulkAssign = async () => {
    if (!pickedEmps.length) { toast.error('Select at least one employee.'); return; }
    if (assignType === 'custom') {
      const total = pickedEmps.reduce((s, e) => s + (e.count ?? 0), 0);
      if (total === 0) { toast.error('Set count for each employee in Custom mode.'); return; }
    }
    setAssignSaving(true);
    try {
      const res = await crmApi.leads.bulkAssign({
        filter_unassigned: useUnassigned || undefined,
        assignment_type: assignType,
        employees: pickedEmps,
        pool_batch_size: poolBatch,
      }) as { message?: string; data?: { assigned?: number; total?: number; preferences_saved?: boolean } };
      const d = res?.data;
      const msg = res?.message;
      if (d?.preferences_saved) {
        toast.success(msg || 'No leads to assign yet. Your choices were saved for next time.');
      } else {
        toast.success(msg || `Assigned ${d?.assigned ?? 0} of ${d?.total ?? 0} leads.`);
        setPickedEmps([]);
      }
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Bulk assign failed.');
    } finally { setAssignSaving(false); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'form', label: 'Form Format', icon: '📋' },
    { key: 'statuses', label: 'Lead Statuses', icon: '🏷️' },
    { key: 'sources', label: 'Lead Sources', icon: '📡' },
    { key: 'flow', label: 'Status Flow', icon: '🔀' },
    { key: 'assign', label: 'Bulk Assign', icon: '📋' },
    { key: 'leadintegrations', label: 'Integrations', icon: '🔗' },
  ];

  const webhookBaseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '';

  const addExternalLink = () => {
    setExternalLinks((prev) => [...prev, { label: '', url: '' }]);
  };

  const updateExternalLink = (index: number, next: Partial<{ label: string; url: string }>) => {
    setExternalLinks((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...next } : row)),
    );
  };

  const removeExternalLink = (index: number) => {
    setExternalLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const saveExternalLinks = async () => {
    const clean = externalLinks
      .map((row) => ({ label: row.label.trim(), url: row.url.trim() }))
      .filter((row) => !!row.url);
    setSavingExternalLinks(true);
    try {
      await configApi.update({
        custom_fields: {
          ...configCustomFields,
          crm_external_links: clean,
        },
      });
      setConfigCustomFields((prev) => ({ ...prev, crm_external_links: clean }));
      setExternalLinks(clean);
      toast.success('External links saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save external links.');
    } finally {
      setSavingExternalLinks(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>CRM Settings</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Configure lead form, statuses, sources, and bulk assignments.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--color-primary)' : '#e2e8f0'}`,
                background: active ? 'var(--color-primary)' : '#fff',
                color: active ? '#fff' : '#475569',
              }}>
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: Form Format ═══ */}
      {activeTab === 'form' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Setup Form Format</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Default fields are always shown. Add custom fields below for the lead form, Excel template, and bulk import.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await crmApi.leadFormSchema.downloadTemplate();
                    toast.success('Template downloaded.');
                  } catch {
                    toast.error('Failed to download template.');
                  }
                }}
              >
                📥 Download Template
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveSchema}
                disabled={schemaSaving || schemaLoading}>
                {schemaSaving ? 'Saving…' : 'Save Format'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {schemaLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>
                    Default fields (order & validation)
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                    Reorder fields for forms and imports. Mark fields mandatory. For <strong>Contact</strong>, choose
                    one phone format defined when the client was registered (superadmin). If none are listed, the default
                    international digit rules apply.
                  </p>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    {editedDefaults.map((f, idx) => (
                      <div
                        key={f.key}
                        style={{
                          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
                          padding: '10px 12px', borderBottom: idx < editedDefaults.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} disabled={idx === 0} onClick={() => moveDefaultField(idx, -1)}>↑</button>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} disabled={idx === editedDefaults.length - 1} onClick={() => moveDefaultField(idx, 1)}>↓</button>
                        </div>
                        <input
                          className="form-input"
                          value={f.label}
                          onChange={(e) => updateDefaultField(f.key, { label: e.target.value })}
                          style={{ width: 140, margin: 0 }}
                          disabled={f.key === 'date'}
                        />
                        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{f.key}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!f.required} disabled={f.key === 'date'}
                            onChange={(e) => updateDefaultField(f.key, { required: e.target.checked })} style={{ accentColor: '#3b82f6' }} />
                          Required
                        </label>
                        {f.key === 'phone' && (
                          <div style={{ flex: 1, minWidth: 200 }}>
                            {phoneRegexPresets.length === 0 ? (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                No formats configured for this client. Superadmin can add them under client registration (CRM module).
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {phoneRegexPresets.map((p) => (
                                  <label
                                    key={p.id}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
                                  >
                                    <input
                                      type="radio"
                                      name="lead-phone-preset"
                                      checked={(f.phone_preset_id ?? '') === p.id}
                                      onChange={() => updateDefaultField(f.key, { phone_preset_id: p.id })}
                                      style={{ accentColor: '#3b82f6' }}
                                    />
                                    <span>{p.label || p.id}</span>
                                  </label>
                                ))}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="lead-phone-preset"
                                    checked={!(f.phone_preset_id ?? '').trim()}
                                    onChange={() => updateDefaultField(f.key, { phone_preset_id: '' })}
                                    style={{ accentColor: '#3b82f6' }}
                                  />
                                  <span>Default (generic international digits)</span>
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Custom fields</div>
                {schemaFields.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                    No custom fields yet. Add fields below to collect extra info.
                  </div>
                )}
                {schemaFields.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px' }}
                        disabled={idx === 0}
                        onClick={() => moveCustomField(idx, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px' }}
                        disabled={idx === schemaFields.length - 1}
                        onClick={() => moveCustomField(idx, 1)}
                      >
                        ↓
                      </button>
                    </div>
                    <input className="form-input" placeholder="Field label (e.g. Customer name)" value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      style={{ width: 180, margin: 0 }} />
                    <select className="form-select" value={f.type}
                      onChange={(e) => updateField(idx, { type: e.target.value as LeadFormField['type'] })}
                      style={{ width: 120, margin: 0 }}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {f.type === 'select' && (
                      <input className="form-input" placeholder="Options (comma-separated, e.g. Small, Medium, Large)"
                        value={optionsRaw[idx] ?? (f.options ?? []).join(', ')}
                        onChange={(e) => setOptionsRaw((p) => ({ ...p, [idx]: e.target.value }))}
                        onBlur={() => {
                          const raw = optionsRaw[idx] ?? (f.options ?? []).join(', ');
                          const opts = raw.split(',').map((s) => s.trim()).filter(Boolean);
                          updateField(idx, { options: opts });
                          setOptionsRaw((p) => { const next = { ...p }; delete next[idx]; return next; });
                        }}
                        style={{ width: 240, margin: 0 }} />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={f.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        style={{ accentColor: '#3b82f6' }} />
                      Required
                    </label>
                    <button className="btn btn-danger btn-sm" onClick={() => removeField(idx)}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={addField} style={{ marginTop: 8 }}>
                  + Add Field
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Lead Statuses ═══ */}
      {activeTab === 'statuses' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Lead Statuses</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Create custom statuses for your leads pipeline. These appear in leads filters and status dropdowns.
            </p>
          </div>
          <div className="card-body">
            {/* Add / Edit form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Label *</label>
                <input className="form-input" placeholder="e.g. Follow Up" value={statusForm.label}
                  onChange={(e) => setStatusForm((p) => ({ ...p, label: e.target.value }))}
                  style={{ width: 160, margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Key (slug)</label>
                <input className="form-input" placeholder="auto-generated" value={statusForm.key}
                  onChange={(e) => setStatusForm((p) => ({ ...p, key: e.target.value }))}
                  style={{ width: 140, margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Color</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <div key={c} onClick={() => setStatusForm((p) => ({ ...p, color: c }))}
                      style={{
                        width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                        border: statusForm.color === c ? '2px solid #1e293b' : '2px solid transparent',
                      }} />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={statusSaving}>
                {statusSaving ? 'Saving…' : editStatusId ? 'Update' : '+ Add Status'}
              </button>
              {editStatusId && (
                <button className="btn btn-secondary btn-sm" onClick={resetStatusForm}>Cancel</button>
              )}
            </div>

            {/* List */}
            {statusLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : statuses.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                <div style={{ fontSize: 14 }}>No custom statuses yet. Add your first status above.</div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {statuses.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < statuses.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: editStatusId === s.id ? '#eff6ff' : '#fff',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{s.key}</span>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditStatusId(s.id); setStatusForm({ key: s.key, label: s.label, color: s.color }); }}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStatus(s.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Lead Sources ═══ */}
      {activeTab === 'sources' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Lead Sources</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Create custom sources to track where your leads come from.
            </p>
          </div>
          <div className="card-body">
            {/* Add / Edit form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Label *</label>
                <input className="form-input" placeholder="e.g. Instagram Ads" value={sourceForm.label}
                  onChange={(e) => setSourceForm((p) => ({ ...p, label: e.target.value }))}
                  style={{ width: 180, margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Key (slug)</label>
                <input className="form-input" placeholder="auto-generated" value={sourceForm.key}
                  onChange={(e) => setSourceForm((p) => ({ ...p, key: e.target.value }))}
                  style={{ width: 150, margin: 0 }} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveSource} disabled={sourceSaving}>
                {sourceSaving ? 'Saving…' : editSourceId ? 'Update' : '+ Add Source'}
              </button>
              {editSourceId && (
                <button className="btn btn-secondary btn-sm" onClick={resetSourceForm}>Cancel</button>
              )}
            </div>

            {/* List */}
            {sourceLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : sources.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
                <div style={{ fontSize: 14 }}>No custom sources yet. Add your first source above.</div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {sources.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < sources.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: editSourceId === s.id ? '#eff6ff' : '#fff',
                  }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{s.key}</span>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditSourceId(s.id); setSourceForm({ key: s.key, label: s.label }); }}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSource(s.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Status Flow ═══ */}
      {activeTab === 'flow' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Status Flow Actions</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Configure what happens when a lead's status changes. For each status, choose which module it flows to and what action is taken. If no flow is set, the status only changes within CRM.
            </p>
          </div>
          <div className="card-body">
            {/* Add / Edit form */}
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
                {editFlowId ? 'Edit Flow Action' : 'Add Flow Action'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Status *</label>
                  <select className="form-select" value={flowForm.status_key}
                    onChange={(e) => setFlowForm((p) => ({ ...p, status_key: e.target.value }))}
                    style={{ width: 180, margin: 0 }}>
                    <option value="">Select status…</option>
                    {(editFlowId ? statuses : unconfiguredStatuses).map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Target Module</label>
                  <select className="form-select" value={flowForm.target_module}
                    onChange={(e) => {
                      const mod = e.target.value;
                      const actions = ACTION_OPTIONS[mod] || [];
                      setFlowForm((p) => ({ ...p, target_module: mod, action: actions[0]?.value || 'notify_only' }));
                    }}
                    style={{ width: 200, margin: 0 }}>
                    {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Action</label>
                  <select className="form-select" value={flowForm.action}
                    onChange={(e) => setFlowForm((p) => ({ ...p, action: e.target.value }))}
                    style={{ width: 180, margin: 0 }}>
                    {(ACTION_OPTIONS[flowForm.target_module] || []).map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Description</label>
                  <input className="form-input" placeholder="Optional note" value={flowForm.description}
                    onChange={(e) => setFlowForm((p) => ({ ...p, description: e.target.value }))}
                    style={{ margin: 0 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFlow} disabled={flowSaving}>
                  {flowSaving ? 'Saving…' : editFlowId ? 'Update' : '+ Add Flow'}
                </button>
                {editFlowId && (
                  <button className="btn btn-secondary btn-sm" onClick={resetFlowForm}>Cancel</button>
                )}
              </div>
            </div>

            {/* Flow actions list */}
            {flowLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : flowActions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
                <div style={{ fontSize: 14 }}>No flow actions configured yet.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Statuses without a flow will only change within CRM — no cross-module action.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Status</div>
                  <div>Target Module</div>
                  <div>Action</div>
                  <div>Description</div>
                  <div>Actions</div>
                </div>
                {flowActions.map((f, i) => {
                  const statusObj = statuses.find((s) => s.key === f.status_key);
                  const modLabel = MODULE_OPTIONS.find((m) => m.value === f.target_module)?.label || f.target_module;
                  const actLabel = (ACTION_OPTIONS[f.target_module] || []).find((a) => a.value === f.action)?.label || f.action;
                  return (
                    <div key={f.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8,
                      padding: '10px 14px', alignItems: 'center',
                      borderBottom: i < flowActions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: editFlowId === f.id ? '#eff6ff' : '#fff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: statusObj?.color || '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.status_label}</span>
                      </div>
                      <div>
                        {f.target_module === 'none' ? (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>CRM only</span>
                        ) : (
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#3b82f6', fontWeight: 500 }}>
                            → {modLabel}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{actLabel}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.description || '—'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditFlowId(f.id);
                          setFlowForm({ status_key: f.status_key, target_module: f.target_module, action: f.action, description: f.description });
                        }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFlow(f.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info box about unconfigured statuses */}
            {unconfiguredStatuses.length > 0 && flowActions.length > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                <strong>Statuses without flow:</strong>{' '}
                {unconfiguredStatuses.map((s) => s.label).join(', ')}
                {' '}— these will only change the status within CRM.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Bulk Assign ═══ */}
      {activeTab === 'assign' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Bulk Assign Leads</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Distribute unassigned leads among your employees. If there are no leads yet, running this still saves your strategy and team so you can use the same setup later.
            </p>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>1. Which Leads</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={useUnassigned} onChange={(e) => setUseUnassigned(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }} />
                All currently unassigned leads
              </label>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>2. Strategy</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {([
                  { key: 'round_robin', icon: '🔄', label: 'Round Robin', desc: 'Equal rotation' },
                  { key: 'pool', icon: '🏊', label: 'Pool', desc: `Fill ${poolBatch} leads each` },
                  { key: 'custom', icon: '🎯', label: 'Custom', desc: 'Set exact count per emp' },
                ] as { key: BulkAssignType; icon: string; label: string; desc: string }[]).map((t) => {
                  const active = assignType === t.key;
                  return (
                    <div key={t.key} onClick={() => setAssignType(t.key)}
                      style={{ border: `2px solid ${active ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 10,
                        padding: '12px 14px', cursor: 'pointer', background: active ? '#eff6ff' : '#fff' }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#1d4ed8' : '#1e293b', marginBottom: 4 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t.desc}</div>
                    </div>
                  );
                })}
              </div>
              {assignType === 'pool' && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>Batch size:</label>
                  <input type="number" className="form-input" value={poolBatch} min={1}
                    onChange={(e) => setPoolBatch(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 90, margin: 0 }} />
                </div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>3. Employees</div>
              {empLoading ? (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
              ) : allEmployees.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>No employees found.</div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox"
                      checked={pickedEmps.length === allEmployees.length && allEmployees.length > 0}
                      onChange={(e) => setPickedEmps(e.target.checked
                        ? allEmployees.map((emp) => ({ user_id: emp.user_id, name: emp.name, count: 0 }))
                        : [])}
                      style={{ accentColor: '#3b82f6', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>SELECT ALL ({allEmployees.length})</span>
                  </div>
                  {allEmployees.map((emp) => {
                    const picked = pickedEmps.find((p) => p.user_id === emp.user_id);
                    return (
                      <div key={emp.user_id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          borderBottom: '1px solid #f1f5f9', background: picked ? '#eff6ff' : '#fff' }}>
                        <input type="checkbox" checked={!!picked} onChange={() => toggleEmp(emp)}
                          style={{ cursor: 'pointer', accentColor: '#3b82f6' }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: picked ? 600 : 400 }}>{emp.name}</span>
                        {assignType === 'custom' && picked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 12, color: '#64748b' }}>Leads:</label>
                            <input type="number" className="form-input" value={picked.count ?? 0} min={0}
                              onChange={(e) => setCount(emp.user_id, parseInt(e.target.value) || 0)}
                              style={{ width: 80, margin: 0 }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-primary" onClick={handleBulkAssign}
                disabled={assignSaving || pickedEmps.length === 0}>
                {assignSaving ? 'Assigning…' : '📋 Run Bulk Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Integrations (WhatsApp + external links) ═══ */}
      {activeTab === 'leadintegrations' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Integrations</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Use WhatsApp webhook URL below and add other external API/webhook links as needed.
            </p>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#1e293b' }}>WhatsApp integration link</div>
              <p style={{ margin: '0 0 8px', color: '#64748b' }}>
                Use this as your WhatsApp callback URL (tenant host should match this client).
              </p>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 12, padding: 8, background: '#fff', borderRadius: 6 }}>
                {webhookBaseUrl}/api/v1/integrations/whatsapp/webhook/
              </code>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8' }}>
                WhatsApp GET uses your <code>WHATSAPP_VERIFY_TOKEN</code> env var. Ensure Meta sends POSTs to the correct tenant host.
              </p>
            </div>

            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#1e293b' }}>Other external links</div>
              <p style={{ margin: '0 0 10px', color: '#64748b' }}>
                Add your other API/webhook integration links here.
              </p>
              {externalLinks.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                  No external links added yet.
                </div>
              )}
              {externalLinks.map((row, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="Name (e.g. Meta Lead API)"
                    value={row.label}
                    onChange={(e) => updateExternalLink(index, { label: e.target.value })}
                    style={{ margin: 0, width: 220 }}
                  />
                  <input
                    className="form-input"
                    placeholder="https://example.com/webhook"
                    value={row.url}
                    onChange={(e) => updateExternalLink(index, { url: e.target.value })}
                    style={{ margin: 0, flex: 1 }}
                  />
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExternalLink(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addExternalLink}>
                  + Add link
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={saveExternalLinks} disabled={savingExternalLinks}>
                  {savingExternalLinks ? 'Saving…' : 'Save links'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
