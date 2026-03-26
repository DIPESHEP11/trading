import React, { useState, useEffect, useRef } from 'react';
import { invoicesApi } from '@/api/businessApi';
import toast from 'react-hot-toast';
import type { DispatchSettings, DispatchSticker } from '@/types';

const COURIER_OPTIONS = [
  { value: 'delhivery', label: 'Delhivery' },
  { value: 'dtdc', label: 'DTDC' },
  { value: 'bluedart', label: 'BlueDart' },
  { value: 'ecom_express', label: 'Ecom Express' },
  { value: 'amazon', label: 'Amazon Logistics' },
  { value: 'custom', label: 'Custom' },
];

const COURIER_LABELS: Record<string, string> = Object.fromEntries(
  COURIER_OPTIONS.map((o) => [o.value, o.label])
);

function QrCell({ id }: { id: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlRef.current) {
      window.URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
    let cancelled = false;
    invoicesApi.dispatch
      .getQrBlob(id)
      .then((blob: Blob) => {
        if (!cancelled) {
          const u = window.URL.createObjectURL(blob);
          urlRef.current = u;
          setUrl(u);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (urlRef.current) {
        window.URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [id]);

  if (!url) return <span style={{ fontSize: 10, color: '#94a3b8' }}>QR…</span>;
  return <img src={url} alt="QR" style={{ width: 40, height: 40, display: 'block' }} />;
}

export default function DispatchPage() {
  const [list, setList] = useState<DispatchSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoices, setInvoices] = useState<{ id: number; invoice_number: string; recipient_name: string }[]>([]);
  const [createForm, setCreateForm] = useState({ invoice_id: '', courier: 'delhivery', courier_name_custom: '', awb_number: '' });
  const [dispatchSettings, setDispatchSettings] = useState<DispatchSettings | null>(null);
  const [useFromAddressOption, setUseFromAddressOption] = useState(false);
  const [selectedFromAddressIndex, setSelectedFromAddressIndex] = useState('0');

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (showCreate) {
      invoicesApi.dispatch.settings.get().then((res) => {
        const data = (res as { data?: DispatchSettings }).data ?? (res as DispatchSettings);
        setDispatchSettings(data || null);
      }).catch(() => setDispatchSettings(null));
      invoicesApi
        .list({})
        .then((r: { data?: { invoices?: { id: number; invoice_number: string; recipient_name: string }[] } }) => {
          const inv = (r?.data ?? r)?.invoices ?? [];
          setInvoices(inv);
          if (inv.length && !createForm.invoice_id) setCreateForm((p) => ({ ...p, invoice_id: String(inv[0].id) }));
        })
        .catch(() => toast.error('Failed to load invoices.'));
    }
  }, [showCreate]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.dispatch.list() as { data?: { dispatch?: DispatchSticker[] }; dispatch?: DispatchSticker[] };
      setList(res?.data?.dispatch ?? res?.dispatch ?? []);
    } catch {
      toast.error('Failed to load dispatch list.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const invoiceId = parseInt(createForm.invoice_id, 10);
    if (!invoiceId) {
      toast.error('Select an invoice.');
      return;
    }
    const fromOptions = Array.isArray(dispatchSettings?.from_address_options) ? dispatchSettings!.from_address_options : [];
    const selectedOption = useFromAddressOption ? fromOptions[Number(selectedFromAddressIndex)] : null;
    setCreating(true);
    try {
      await invoicesApi.dispatch.create({
        invoice: invoiceId,
        courier: createForm.courier,
        courier_name_custom: createForm.courier === 'custom' ? createForm.courier_name_custom : '',
        awb_number: createForm.awb_number || '',
        from_name_override: selectedOption?.name || '',
        from_address_override: selectedOption?.address || '',
      });
      toast.success('Dispatch sticker created.');
      setShowCreate(false);
      setCreateForm({ invoice_id: '', courier: 'delhivery', courier_name_custom: '', awb_number: '' });
      setUseFromAddressOption(false);
      setSelectedFromAddressIndex('0');
      fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create dispatch sticker.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadPdf = async (id: number, sticker: DispatchSticker) => {
    try {
      const res = await invoicesApi.dispatch.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fn = `dispatch-${sticker.invoice_number ?? id}-${sticker.awb_number || id}.pdf`;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Dispatch sticker PDF downloaded.');
    } catch {
      toast.error('Failed to download PDF.');
    }
  };

  const courierDisplay = (s: DispatchSticker) =>
    s.courier === 'custom' && s.courier_name_custom
      ? s.courier_name_custom
      : COURIER_LABELS[s.courier] || s.courier;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Dispatch</h1>
          <p className="page-subtitle">
            Product name, from–to address, Product ID (QR), price details. Generate and download dispatch sticker as PDF.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          + Create dispatch sticker
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚚</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>No dispatch stickers yet</h3>
          <p style={{ color: '#64748b', margin: '0 0 16px' }}>
            Create a dispatch sticker for an invoice to see product, from–to address, Product ID QR, price and download the sticker PDF.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + Create dispatch sticker
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">All dispatch stickers ({list.length})</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Product name(s)</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Product ID / QR</th>
                  <th>Price</th>
                  <th>Courier / AWB</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.invoice_number ?? s.invoice}</strong></td>
                    <td>
                      <div style={{ maxWidth: 220 }}>
                        {(s.product_names && s.product_names.length > 0)
                          ? s.product_names.join(', ')
                          : '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 180, fontSize: 12 }}>
                        <strong>{s.from_name || '—'}</strong>
                        {s.from_address && <div style={{ color: '#64748b', marginTop: 2 }}>{s.from_address}</div>}
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 180, fontSize: 12 }}>
                        <strong>{s.to_name || '—'}</strong>
                        {s.to_address && <div style={{ color: '#64748b', marginTop: 2 }}>{s.to_address}</div>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QrCell id={s.id} />
                        <div style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>
                          {s.dispatch_code || s.awb_number || `DISP-${s.id}`}
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.grand_total != null ? (
                        <strong>₹{Number(s.grand_total).toLocaleString()}</strong>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{courierDisplay(s)}</div>
                      {s.awb_number && <div style={{ fontSize: 11, color: '#64748b' }}>AWB: {s.awb_number}</div>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDownloadPdf(s.id, s)}
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflowY: 'auto',
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Create dispatch sticker</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Select an invoice. The sticker will show product name, from–to address, Product ID QR and price. You can then download the sticker as PDF.
            </p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Invoice *</label>
              <select
                className="form-select"
                value={createForm.invoice_id}
                onChange={(e) => setCreateForm((p) => ({ ...p, invoice_id: e.target.value }))}
              >
                <option value="">Select invoice…</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {inv.recipient_name || '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Courier</label>
              <select
                className="form-select"
                value={createForm.courier}
                onChange={(e) => setCreateForm((p) => ({ ...p, courier: e.target.value }))}
              >
                {COURIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {createForm.courier === 'custom' && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Courier name</label>
                <input
                  className="form-input"
                  value={createForm.courier_name_custom}
                  onChange={(e) => setCreateForm((p) => ({ ...p, courier_name_custom: e.target.value }))}
                  placeholder="e.g. My Courier"
                />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">AWB / Tracking number</label>
              <input
                className="form-input"
                value={createForm.awb_number}
                onChange={(e) => setCreateForm((p) => ({ ...p, awb_number: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            {Array.isArray(dispatchSettings?.from_address_options) && dispatchSettings.from_address_options.length > 1 && (
              <div style={{ marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={useFromAddressOption}
                    onChange={(e) => setUseFromAddressOption(e.target.checked)}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Select from address for this dispatch</span>
                </label>
                {useFromAddressOption && (
                  <select
                    className="form-select"
                    value={selectedFromAddressIndex}
                    onChange={(e) => setSelectedFromAddressIndex(e.target.value)}
                  >
                    {dispatchSettings.from_address_options.map((opt, idx) => (
                      <option key={`${opt.name}-${idx}`} value={idx}>
                        {(opt.label || opt.name || `Address ${idx + 1}`)} — {opt.address || ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
