import { useState, useEffect } from 'react';
import { trackingApi, invoicesApi } from '@/api/businessApi';
import type { TrackingPartner } from '@/api/businessApi';
import type { DispatchSticker } from '@/types';
import toast from 'react-hot-toast';

const FILLABLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pod_tracking_number', label: 'POD / Tracking number' },
  { value: 'custom_fields', label: 'Custom fields' },
];

function getFormFullUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

export default function TrackingPage() {
  const [partners, setPartners] = useState<{ partners: TrackingPartner[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [configLinkId, setConfigLinkId] = useState<number | null>(null);
  const [fillableForLink, setFillableForLink] = useState<string[]>([]);
  const [savingFillable, setSavingFillable] = useState(false);
  const [showAddFromDispatch, setShowAddFromDispatch] = useState(false);
  const [dispatchList, setDispatchList] = useState<DispatchSticker[]>([]);
  const [addForm, setAddForm] = useState({ dispatch_sticker_id: '', courier_partner_id: '' });
  const [adding, setAdding] = useState(false);

  const fetchPartners = async () => {
    try {
      const res = await trackingApi.partners();
      setPartners(typeof res === 'object' && res && 'partners' in res ? res : { partners: [] });
    } catch {
      toast.error('Failed to load delivery partners.');
      setPartners({ partners: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (showAddFromDispatch) {
      invoicesApi.dispatch
        .list()
        .then((r: { data?: { dispatch?: DispatchSticker[] }; dispatch?: DispatchSticker[] }) => {
          const list = r?.data?.dispatch ?? r?.dispatch ?? [];
          setDispatchList(Array.isArray(list) ? list : []);
        })
        .catch(() => toast.error('Failed to load dispatch list.'));
    }
  }, [showAddFromDispatch]);

  const handleGenerateLink = async (partnerId: number) => {
    setGeneratingId(partnerId);
    try {
      const data = await trackingApi.generateLink(partnerId, fillableForLink.length ? fillableForLink : ['pod_tracking_number']);
      toast.success('Form link generated. Use Copy link to share.');
      if (data?.form_url_path) {
        const full = getFormFullUrl(data.form_url_path);
        await navigator.clipboard.writeText(full);
        toast.success('Link copied to clipboard.');
      }
      fetchPartners();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate link.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCopyLink = (path: string) => {
    const full = getFormFullUrl(path);
    navigator.clipboard.writeText(full).then(
      () => toast.success('Link copied to clipboard.'),
      () => toast.error('Could not copy.')
    );
  };

  const openConfig = (p: TrackingPartner) => {
    if (p.form_link_id && p.fillable_fields) {
      setConfigLinkId(p.form_link_id);
      setFillableForLink([...p.fillable_fields]);
    }
  };

  const saveFillable = async () => {
    if (configLinkId == null) return;
    setSavingFillable(true);
    try {
      await trackingApi.updateLink(configLinkId, fillableForLink);
      toast.success('Updated which fields the delivery partner can fill.');
      setConfigLinkId(null);
      fetchPartners();
    } catch {
      toast.error('Failed to update.');
    } finally {
      setSavingFillable(false);
    }
  };

  const handleAddFromDispatch = async () => {
    const stickerId = parseInt(addForm.dispatch_sticker_id, 10);
    const partnerId = parseInt(addForm.courier_partner_id, 10);
    if (!stickerId || !partnerId) {
      toast.error('Select a dispatch sticker and a delivery partner.');
      return;
    }
    setAdding(true);
    try {
      await trackingApi.fromDispatch(stickerId, partnerId);
      toast.success('Shipment added from dispatch. It will appear on the partner’s form.');
      setShowAddFromDispatch(false);
      setAddForm({ dispatch_sticker_id: '', courier_partner_id: '' });
      fetchPartners();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add shipment.');
    } finally {
      setAdding(false);
    }
  };

  const list = partners?.partners ?? [];

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Tracking</h1>
          <p className="page-subtitle">
            Real-time courier and shipment tracking. Generate a secure form link per delivery partner; new shipments for that partner appear on the same link.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddFromDispatch(true)}>
          + Add from dispatch
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>No delivery partners yet</h3>
          <p style={{ color: '#64748b', margin: '0 0 16px' }}>
            Add delivery partners in Dispatch settings. Then you can generate a form link for each partner and add shipments from dispatch.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Delivery partners & form links</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Shipments</th>
                  <th>Form link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.partner_id}>
                    <td>
                      <strong>{p.partner_name}</strong>
                      {p.courier_id && <div style={{ fontSize: 12, color: '#64748b' }}>{p.courier_id}</div>}
                    </td>
                    <td>{p.shipment_count}</td>
                    <td>
                      {p.has_form_link && p.token ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                          {getFormFullUrl(`/delivery-form/${p.token}`)}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>No link</span>
                      )}
                    </td>
                    <td>
                      {p.has_form_link ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCopyLink(`/delivery-form/${p.token!}`)}
                          >
                            Copy link
                          </button>
                          {' '}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openConfig(p)}
                          >
                            Configure fields
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleGenerateLink(p.partner_id)}
                          disabled={generatingId === p.partner_id}
                        >
                          {generatingId === p.partner_id ? 'Generating…' : 'Generate form link'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configLinkId != null && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflowY: 'auto',
          }}
          onClick={() => setConfigLinkId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Fields the delivery partner can fill</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Tick the fields that the delivery partner can fill in on their form.
            </p>
            <div style={{ marginBottom: 16 }}>
              {FILLABLE_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={fillableForLink.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) setFillableForLink((prev) => [...prev, opt.value]);
                      else setFillableForLink((prev) => prev.filter((f) => f !== opt.value));
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfigLinkId(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveFillable} disabled={savingFillable}>
                {savingFillable ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddFromDispatch && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflowY: 'auto',
          }}
          onClick={() => setShowAddFromDispatch(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Add shipment from dispatch</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Select a dispatch sticker and the delivery partner. The shipment will appear on that partner’s form link.
            </p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Dispatch sticker *</label>
              <select
                className="form-select"
                value={addForm.dispatch_sticker_id}
                onChange={(e) => setAddForm((p) => ({ ...p, dispatch_sticker_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {dispatchList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_number ?? `Invoice ${s.invoice}`} — {s.awb_number || `ID ${s.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Delivery partner *</label>
              <select
                className="form-select"
                value={addForm.courier_partner_id}
                onChange={(e) => setAddForm((p) => ({ ...p, courier_partner_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {list.map((p) => (
                  <option key={p.partner_id} value={p.partner_id}>{p.partner_name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddFromDispatch(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddFromDispatch} disabled={adding}>
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
