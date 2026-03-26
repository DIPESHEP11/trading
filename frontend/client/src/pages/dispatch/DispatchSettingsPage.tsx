import React, { useState, useEffect } from 'react';
import { invoicesApi } from '@/api/businessApi';
import { restrictTo10Digits } from '@/utils/phone';
import toast from 'react-hot-toast';
import type {
  DispatchSettings as DispatchSettingsType,
  CourierPartner,
  FlowAfterDispatch,
  DefaultTrackingStatus,
  CustomDispatchStatus,
  DispatchFlowAction,
  DispatchFlowAfter,
} from '@/types';

const FLOW_OPTIONS: { value: FlowAfterDispatch; label: string }[] = [
  { value: 'notify_only', label: 'Notify only' },
  { value: 'mark_delivered', label: 'Mark as delivered' },
  { value: 'update_tracking', label: 'Update tracking status' },
  { value: 'transfer_to_tracking', label: 'Transfer to tracking module' },
  { value: 'none', label: 'No automatic action' },
];

const TRACKING_STATUS_OPTIONS: { value: DefaultTrackingStatus; label: string }[] = [
  { value: '', label: '— No default —' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

const FLOW_AFTER_OPTIONS: { value: DispatchFlowAfter; label: string }[] = [
  { value: 'none', label: 'Stay in Dispatch only' },
  { value: 'notify_only', label: 'Notify only' },
  { value: 'mark_delivered', label: 'Mark as delivered' },
  { value: 'update_tracking', label: 'Update tracking status' },
  { value: 'transfer_to_tracking', label: 'Transfer to tracking module' },
];

const COLOR_OPTIONS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#64748b', '#1d4ed8', '#dc2626',
];

const emptyPartner = { name: '', courier_id: '', address: '', pincode: '', contact_person_name: '', contact_phone: '' };

function getSettingsData(res: unknown): DispatchSettingsType | null {
  const r = res as { data?: DispatchSettingsType };
  const data = r?.data ?? res;
  if (data && typeof data === 'object' && 'flow_after_dispatch' in data) {
    return data as DispatchSettingsType;
  }
  return null;
}

function getPartnersList(res: unknown): CourierPartner[] {
  const r = res as { data?: { partners?: CourierPartner[] } };
  const list = r?.data?.partners ?? (res as { partners?: CourierPartner[] })?.partners ?? [];
  return Array.isArray(list) ? list : [];
}

function getStatusesList(res: unknown): CustomDispatchStatus[] {
  const r = res as { data?: { statuses?: CustomDispatchStatus[] } };
  const list = r?.data?.statuses ?? (res as { statuses?: CustomDispatchStatus[] })?.statuses ?? [];
  return Array.isArray(list) ? list : [];
}

function getFlowActionsList(res: unknown): DispatchFlowAction[] {
  const r = res as { data?: { flow_actions?: DispatchFlowAction[] } };
  const list = r?.data?.flow_actions ?? (res as { flow_actions?: DispatchFlowAction[] })?.flow_actions ?? [];
  return Array.isArray(list) ? list : [];
}

export default function DispatchSettingsPage() {
  const [fromAddressOptions, setFromAddressOptions] = useState<{ label: string; name: string; address: string }[]>([]);
  const [settings, setSettings] = useState<DispatchSettingsType | null>(null);
  const [partners, setPartners] = useState<CourierPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNoDataMessage, setShowNoDataMessage] = useState(false);
  const [flow, setFlow] = useState<FlowAfterDispatch>('notify_only');
  const [trackingStatus, setTrackingStatus] = useState<DefaultTrackingStatus>('');
  const [savingFlow, setSavingFlow] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<CourierPartner | null>(null);
  const [partnerForm, setPartnerForm] = useState(emptyPartner);
  const [savingPartner, setSavingPartner] = useState(false);

  const [statuses, setStatuses] = useState<CustomDispatchStatus[]>([]);
  const [flowActions, setFlowActions] = useState<DispatchFlowAction[]>([]);
  const [statusForm, setStatusForm] = useState({ key: '', label: '', color: '#64748b' });
  const [editStatusId, setEditStatusId] = useState<number | null>(null);
  const [flowForm, setFlowForm] = useState<{ status_key: string; flow_after: DispatchFlowAfter; default_tracking_status: string }>({
    status_key: '', flow_after: 'none', default_tracking_status: '',
  });
  const [editFlowId, setEditFlowId] = useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [flowSaving, setFlowSaving] = useState(false);

  const showTrackingStatus =
    flow === 'update_tracking' || flow === 'transfer_to_tracking';

  const isNoDataError = (e: unknown): boolean => {
    const err = e as { response?: { status?: number; data?: { message?: string } } };
    const status = err?.response?.status;
    const msg = (err?.response?.data?.message || '').toLowerCase();
    if (status === 404) return true;
    if (msg && (msg.includes('not found') || msg.includes('not identified') || msg.includes('no data'))) return true;
    return false;
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setShowNoDataMessage(false);
    try {
      const [settingsResult, partnersResult, statusesResult, flowActionsResult] = await Promise.allSettled([
        invoicesApi.dispatch.settings.get(),
        invoicesApi.dispatch.partners.list(),
        invoicesApi.dispatch.statuses.list(),
        invoicesApi.dispatch.flowActions.list(),
      ]);

      let hadNoDataResponse = false;
      let hadRealError = false;

      if (settingsResult.status === 'fulfilled') {
        const settingsData = getSettingsData(settingsResult.value);
        if (settingsData) {
          setSettings(settingsData);
          setFlow(settingsData.flow_after_dispatch);
          setTrackingStatus((settingsData.default_tracking_status as DefaultTrackingStatus) ?? '');
          const fromOptions = Array.isArray(settingsData.from_address_options)
            ? settingsData.from_address_options.map((opt) => ({
                label: String(opt?.label ?? ''),
                name: String(opt?.name ?? ''),
                address: String(opt?.address ?? ''),
              }))
            : [];
          setFromAddressOptions(fromOptions);
        }
      } else {
        if (isNoDataError(settingsResult.reason)) hadNoDataResponse = true;
        else {
          hadRealError = true;
          const err = settingsResult.reason as { response?: { data?: { message?: string } } };
          setLoadError(err?.response?.data?.message || 'Failed to load dispatch settings.');
        }
      }

      if (partnersResult.status === 'fulfilled') {
        setPartners(getPartnersList(partnersResult.value));
      } else if (partnersResult.status === 'rejected' && isNoDataError(partnersResult.reason)) {
        hadNoDataResponse = true;
      }

      if (statusesResult.status === 'fulfilled') {
        setStatuses(getStatusesList(statusesResult.value));
      } else if (statusesResult.status === 'rejected' && isNoDataError(statusesResult.reason)) {
        hadNoDataResponse = true;
      }

      if (flowActionsResult.status === 'fulfilled') {
        setFlowActions(getFlowActionsList(flowActionsResult.value));
      } else if (flowActionsResult.status === 'rejected' && isNoDataError(flowActionsResult.reason)) {
        hadNoDataResponse = true;
      }

      if (hadNoDataResponse && !hadRealError) setShowNoDataMessage(true);
      // Also show "No data" when load succeeded but everything is empty (e.g. first-time setup)
      const partnersList = partnersResult.status === 'fulfilled' ? getPartnersList(partnersResult.value) : [];
      const statusesList = statusesResult.status === 'fulfilled' ? getStatusesList(statusesResult.value) : [];
      const flowList = flowActionsResult.status === 'fulfilled' ? getFlowActionsList(flowActionsResult.value) : [];
      const settingsData = settingsResult.status === 'fulfilled' ? getSettingsData(settingsResult.value) : null;
      if (!hadRealError && !settingsData && partnersList.length === 0 && statusesList.length === 0 && flowList.length === 0) {
        setShowNoDataMessage(true);
      }
    } catch (e: unknown) {
      if (isNoDataError(e)) {
        setLoadError(null);
        setShowNoDataMessage(true);
      } else {
        const err = e as { response?: { data?: { message?: string } } };
        setLoadError(err?.response?.data?.message || 'Failed to load dispatch settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveFlow = async () => {
    setSavingFlow(true);
    try {
      const payload: { flow_after_dispatch: FlowAfterDispatch; default_tracking_status?: string; from_address_options?: { label?: string; name: string; address: string }[] } = {
        flow_after_dispatch: flow,
      };
      if (showTrackingStatus) {
        payload.default_tracking_status = trackingStatus || undefined;
      }
      payload.from_address_options = fromAddressOptions
        .map((opt) => ({
          label: (opt.label || '').trim(),
          name: (opt.name || '').trim(),
          address: (opt.address || '').trim(),
        }))
        .filter((opt) => opt.name && opt.address);
      const res = await invoicesApi.dispatch.settings.update(payload);
      const data = getSettingsData(res);
      if (data) setSettings(data);
      toast.success('Dispatch settings saved.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save settings.');
    } finally {
      setSavingFlow(false);
    }
  };

  const openAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm(emptyPartner);
    setShowPartnerForm(true);
  };

  const openEditPartner = (p: CourierPartner) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name,
      courier_id: p.courier_id ?? '',
      address: p.address ?? '',
      pincode: p.pincode ?? '',
      contact_person_name: p.contact_person_name ?? '',
      contact_phone: p.contact_phone ?? '',
    });
    setShowPartnerForm(true);
  };

  const closePartnerForm = () => {
    setShowPartnerForm(false);
    setEditingPartner(null);
    setPartnerForm(emptyPartner);
  };

  const handleSavePartner = async () => {
    if (!partnerForm.name.trim()) {
      toast.error('Courier name is required.');
      return;
    }
    setSavingPartner(true);
    try {
      if (editingPartner) {
        await invoicesApi.dispatch.partners.update(editingPartner.id, {
          name: partnerForm.name.trim(),
          courier_id: partnerForm.courier_id.trim() || undefined,
          address: partnerForm.address.trim() || undefined,
          pincode: partnerForm.pincode.trim() || undefined,
          contact_person_name: partnerForm.contact_person_name.trim() || undefined,
          contact_phone: partnerForm.contact_phone.trim() || undefined,
        });
        toast.success('Courier partner updated.');
      } else {
        await invoicesApi.dispatch.partners.create({
          name: partnerForm.name.trim(),
          courier_id: partnerForm.courier_id.trim() || undefined,
          address: partnerForm.address.trim() || undefined,
          pincode: partnerForm.pincode.trim() || undefined,
          contact_person_name: partnerForm.contact_person_name.trim() || undefined,
          contact_phone: partnerForm.contact_phone.trim() || undefined,
        });
        toast.success('Courier partner added.');
      }
      closePartnerForm();
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || (editingPartner ? 'Failed to update partner.' : 'Failed to add partner.'));
    } finally {
      setSavingPartner(false);
    }
  };

  const handleDeletePartner = async (p: CourierPartner) => {
    if (!window.confirm(`Delete courier partner "${p.name}"?`)) return;
    try {
      await invoicesApi.dispatch.partners.delete(p.id);
      toast.success('Courier partner deleted.');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to delete partner.');
    }
  };

  const unconfiguredStatuses = statuses.filter((s) => !flowActions.some((f) => f.status_key === s.key));

  const handleSaveStatus = async () => {
    const key = (statusForm.key || statusForm.label.toLowerCase().replace(/\s+/g, '_')).replace(/[^a-z0-9_]/g, '');
    if (!key || !statusForm.label.trim()) {
      toast.error('Label is required.');
      return;
    }
    setStatusSaving(true);
    try {
      if (editStatusId) {
        await invoicesApi.dispatch.statuses.update(editStatusId, {
          key, label: statusForm.label.trim(), color: statusForm.color,
        });
        toast.success('Status updated.');
      } else {
        await invoicesApi.dispatch.statuses.create({
          key, label: statusForm.label.trim(), color: statusForm.color,
        });
        toast.success('Status added.');
      }
      setEditStatusId(null);
      setStatusForm({ key: '', label: '', color: '#64748b' });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const resetStatusForm = () => {
    setEditStatusId(null);
    setStatusForm({ key: '', label: '', color: '#64748b' });
  };

  const handleDeleteStatus = async (id: number) => {
    if (!window.confirm('Delete this status? Flow action for it will need to be removed first if configured.')) return;
    try {
      await invoicesApi.dispatch.statuses.delete(id);
      toast.success('Status deleted.');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to delete status.');
    }
  };

  const handleSaveFlowAction = async () => {
    if (!flowForm.status_key) {
      toast.error('Select a status.');
      return;
    }
    setFlowSaving(true);
    try {
      const payload = {
        status_key: flowForm.status_key,
        flow_after: flowForm.flow_after,
        default_tracking_status: (flowForm.flow_after === 'update_tracking' || flowForm.flow_after === 'transfer_to_tracking')
          ? (flowForm.default_tracking_status || undefined)
          : undefined,
      };
      if (editFlowId) {
        await invoicesApi.dispatch.flowActions.update(editFlowId, payload);
        toast.success('Flow action updated.');
      } else {
        await invoicesApi.dispatch.flowActions.create(payload);
        toast.success('Flow action added.');
      }
      setEditFlowId(null);
      setFlowForm({ status_key: '', flow_after: 'none', default_tracking_status: '' });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save flow action.');
    } finally {
      setFlowSaving(false);
    }
  };

  const resetFlowForm = () => {
    setEditFlowId(null);
    setFlowForm({ status_key: '', flow_after: 'none', default_tracking_status: '' });
  };

  const handleDeleteFlowAction = async (id: number) => {
    if (!window.confirm('Remove this flow action?')) return;
    try {
      await invoicesApi.dispatch.flowActions.delete(id);
      toast.success('Flow action removed.');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to delete flow action.');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Dispatch Settings</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 8 }}>Dispatch Settings</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Set what happens after dispatch (e.g. transfer to tracking, set status) and manage courier delivery partners.
        </p>
      </div>

      {loadError && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderLeft: '4px solid var(--color-danger)',
            background: 'var(--color-danger-light)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--color-danger)' }}>
            {loadError}
          </p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {showNoDataMessage && !loadError && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderLeft: '4px solid var(--color-primary)',
            background: 'var(--color-primary-light, #eff6ff)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--color-primary, #1d4ed8)' }}>
            No data yet. Add flow settings, statuses, and courier partners below.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      )}

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 className="card-title" style={{ marginBottom: 4 }}>Flow after dispatch</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Choose the next step when an order or item is dispatched. You can transfer data to the tracking module and set a default status.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
            <div className="form-group">
              <label className="form-label">Next step</label>
              <select
                className="form-select"
                value={flow}
                onChange={(e) => setFlow(e.target.value as FlowAfterDispatch)}
                style={{ maxWidth: 320 }}
              >
                {FLOW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {showTrackingStatus && (
              <div className="form-group">
                <label className="form-label">Status to set (in tracking)</label>
                <select
                  className="form-select"
                  value={trackingStatus}
                  onChange={(e) => setTrackingStatus(e.target.value as DefaultTrackingStatus)}
                  style={{ maxWidth: 320 }}
                >
                  {TRACKING_STATUS_OPTIONS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Client admin can set the default status when data is sent to the tracking module.
                </p>
              </div>
            )}
            <div style={{ border: '1px solid var(--color-border, #e2e8f0)', borderRadius: 10, padding: 12 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>From addresses (for dispatch sticker)</label>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Add multiple sender addresses. While creating dispatch, user can tick/select one address.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fromAddressOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      placeholder="Label (optional)"
                      value={opt.label}
                      onChange={(e) => setFromAddressOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))}
                    />
                    <input
                      className="form-input"
                      placeholder="From name"
                      value={opt.name}
                      onChange={(e) => setFromAddressOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                    />
                    <input
                      className="form-input"
                      placeholder="From address"
                      value={opt.address}
                      onChange={(e) => setFromAddressOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, address: e.target.value } : p)))}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setFromAddressOptions((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setFromAddressOptions((prev) => [...prev, { label: '', name: '', address: '' }])}
              >
                + Add from address
              </button>
            </div>
            <div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveFlow}
                disabled={savingFlow}
              >
                {savingFlow ? 'Saving…' : 'Save flow settings'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 className="card-title" style={{ marginBottom: 4 }}>Dispatch statuses</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Create statuses (e.g. Processing, Delivered) for dispatch items. When a dispatch item gets a status, you can set what happens next in <strong>Status flow</strong> below. If no flow is set for a status, it only applies within the Dispatch module.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Label *</label>
              <input
                className="form-input"
                placeholder="e.g. Delivered"
                value={statusForm.label}
                onChange={(e) => setStatusForm((p) => ({ ...p, label: e.target.value }))}
                style={{ width: 160 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Key (slug)</label>
              <input
                className="form-input"
                placeholder="auto"
                value={statusForm.key || statusForm.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}
                onChange={(e) => setStatusForm((p) => ({ ...p, key: e.target.value }))}
                style={{ width: 140 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Color</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {COLOR_OPTIONS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setStatusForm((p) => ({ ...p, color: c }))}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: c,
                      cursor: 'pointer',
                      border: statusForm.color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={statusSaving}>
              {statusSaving ? 'Saving…' : editStatusId ? 'Update' : '+ Add status'}
            </button>
            {editStatusId && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetStatusForm}>Cancel</button>
            )}
          </div>
          {statuses.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>No dispatch statuses yet. Add statuses above (e.g. Processing, Delivered), then configure flow per status below.</p>
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {statuses.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderBottom: i < statuses.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: editStatusId === s.id ? 'var(--color-primary-light)' : undefined,
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{s.key}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditStatusId(s.id); setStatusForm({ key: s.key, label: s.label, color: s.color }); }}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteStatus(s.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 className="card-title" style={{ marginBottom: 4 }}>Status flow</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            For each status, set what happens when that status is set on a dispatch item. For example: when status is <strong>Delivered</strong> → Transfer to tracking module (data moves to tracking). If no flow is set, the status only applies within Dispatch.
          </p>
          <div style={{ padding: 16, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{editFlowId ? 'Edit flow action' : 'Add flow action'}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Status *</label>
                <select
                  className="form-select"
                  value={flowForm.status_key}
                  onChange={(e) => setFlowForm((p) => ({ ...p, status_key: e.target.value }))}
                  style={{ width: 180 }}
                >
                  <option value="">Select status…</option>
                  {(editFlowId ? statuses : unconfiguredStatuses).map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>When this status is set</label>
                <select
                  className="form-select"
                  value={flowForm.flow_after}
                  onChange={(e) => setFlowForm((p) => ({ ...p, flow_after: e.target.value as DispatchFlowAfter }))}
                  style={{ width: 220 }}
                >
                  {FLOW_AFTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(flowForm.flow_after === 'update_tracking' || flowForm.flow_after === 'transfer_to_tracking') && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Default tracking status</label>
                  <select
                    className="form-select"
                    value={flowForm.default_tracking_status}
                    onChange={(e) => setFlowForm((p) => ({ ...p, default_tracking_status: e.target.value }))}
                    style={{ width: 160 }}
                  >
                    {TRACKING_STATUS_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveFlowAction} disabled={flowSaving}>
                {flowSaving ? 'Saving…' : editFlowId ? 'Update' : '+ Add flow'}
              </button>
              {editFlowId && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetFlowForm}>Cancel</button>
              )}
            </div>
          </div>
          {flowActions.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>No flow actions yet. Add statuses above, then add a flow for each status (e.g. Delivered → Transfer to tracking module).</p>
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, padding: '10px 14px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                <div>Status</div>
                <div>Flow</div>
                <div>Tracking status</div>
                <div>Actions</div>
              </div>
              {flowActions.map((f, i) => {
                const statusObj = statuses.find((s) => s.key === f.status_key);
                const flowLabel = FLOW_AFTER_OPTIONS.find((o) => o.value === f.flow_after)?.label || f.flow_after;
                const trackingLabel = f.default_tracking_status ? (TRACKING_STATUS_OPTIONS.find((o) => o.value === f.default_tracking_status)?.label || f.default_tracking_status) : '—';
                return (
                  <div
                    key={f.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: 8,
                      padding: '10px 14px',
                      alignItems: 'center',
                      borderBottom: i < flowActions.length - 1 ? '1px solid var(--color-border)' : 'none',
                      background: editFlowId === f.id ? 'var(--color-primary-light)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: statusObj?.color || '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{f.status_label ?? f.status_key}</span>
                    </div>
                    <div style={{ fontSize: 13 }}>{flowLabel}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{trackingLabel}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditFlowId(f.id); setFlowForm({ status_key: f.status_key, flow_after: f.flow_after, default_tracking_status: f.default_tracking_status || '' }); }}>Edit</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteFlowAction(f.id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h2 className="card-title" style={{ margin: 0, marginBottom: 4 }}>Courier delivery partners</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Add courier name, ID, address and contact person. Edit or delete from the table.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={openAddPartner}>
              + Add partner
            </button>
          </div>
          {partners.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                background: 'var(--color-bg)',
                borderRadius: 8,
                color: 'var(--color-text-secondary)',
              }}
            >
              <p style={{ margin: 0 }}>No courier partners yet. Click &quot;Add partner&quot; to add one.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Courier name</th>
                    <th>Courier ID</th>
                    <th>Address</th>
                    <th>Pin code</th>
                    <th>Contact person</th>
                    <th>Contact phone</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.courier_id || '—'}</td>
                      <td>{p.address || '—'}</td>
                      <td>{p.pincode || '—'}</td>
                      <td>{p.contact_person_name || '—'}</td>
                      <td>{p.contact_phone || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginRight: 8 }}
                          onClick={() => openEditPartner(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeletePartner(p)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showPartnerForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={closePartnerForm}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{editingPartner ? 'Edit courier partner' : 'Add courier partner'}</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closePartnerForm}>
                Close
              </button>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Courier name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Delhivery"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Courier ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={partnerForm.courier_id}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, courier_id: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-input"
                  value={partnerForm.address}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, city, state"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Pin code</label>
                <input
                  type="text"
                  className="form-input"
                  value={partnerForm.pincode}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, pincode: e.target.value }))}
                  placeholder="Postal / pin code"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact person name</label>
                <input
                  type="text"
                  className="form-input"
                  value={partnerForm.contact_person_name}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, contact_person_name: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact phone number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={partnerForm.contact_phone}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, contact_phone: restrictTo10Digits(e.target.value) }))}
                  placeholder="9876543210" maxLength={10}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'flex-end',
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-border)',
                  marginTop: 8,
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={closePartnerForm} disabled={savingPartner}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSavePartner} disabled={savingPartner}>
                  {savingPartner ? 'Saving…' : editingPartner ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
