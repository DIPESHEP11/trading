import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { trackingApi } from '@/api/businessApi';
import toast from 'react-hot-toast';

type Shipment = {
  id: number;
  product_name: string;
  product_id: string;
  qr_data: string;
  from_address: string;
  to_address: string;
  contact_number: string;
  delivery_partner_details: string;
  pod_tracking_number: string;
  custom_fields: Record<string, unknown>;
  status: string;
};

type FormData = {
  fillable_fields: string[];
  partner_name: string;
  shipments: Shipment[];
};

export default function DeliveryFormPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<number, { pod_tracking_number?: string; custom_fields?: Record<string, string> }>>({});

  useEffect(() => {
    if (!token) {
      setError('Invalid link.');
      setLoading(false);
      return;
    }
    trackingApi
      .publicForm(token)
      .then((res) => {
        setData(res as FormData);
        const initial: Record<number, { pod_tracking_number?: string; custom_fields?: Record<string, string> }> = {};
        (res?.shipments ?? []).forEach((s: Shipment) => {
          initial[s.id] = {
            pod_tracking_number: s.pod_tracking_number || '',
            custom_fields: (s.custom_fields as Record<string, string>) || {},
          };
        });
        setFormValues(initial);
      })
      .catch(() => {
        setError('Invalid or expired form link.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const fillable = new Set(data?.fillable_fields ?? []);
  const canFillPod = fillable.has('pod_tracking_number');
  const canFillCustom = fillable.has('custom_fields');

  const handleSubmit = async (shipmentId: number) => {
    if (!token) return;
    setSubmitting(shipmentId);
    try {
      const v = formValues[shipmentId] ?? {};
      const payload: { shipment_id: number; pod_tracking_number?: string; custom_fields?: Record<string, unknown> } = {
        shipment_id: shipmentId,
      };
      if (canFillPod && v.pod_tracking_number !== undefined) payload.pod_tracking_number = v.pod_tracking_number;
      if (canFillCustom && v.custom_fields) payload.custom_fields = v.custom_fields;
      await trackingApi.publicFormSubmit(token, payload);
      toast.success('Submitted.');
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shipments: prev.shipments.map((s) =>
            s.id === shipmentId
              ? {
                  ...s,
                  pod_tracking_number: payload.pod_tracking_number ?? s.pod_tracking_number,
                  custom_fields: { ...(s.custom_fields || {}), ...(payload.custom_fields || {}) },
                }
              : s
          ),
        };
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit.');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#dc2626', marginBottom: 8 }}>{error || 'Form not found.'}</p>
          <p style={{ fontSize: 14, color: '#64748b' }}>Please use the link shared by your delivery coordinator.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
          Delivery form
        </h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Partner: <strong>{data.partner_name}</strong>. Fill in the fields below for each shipment and submit.
        </p>
      </div>

      {data.shipments.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748b' }}>No shipments assigned yet. New shipments will appear here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.shipments.map((s) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: '#1e293b' }}>
                {s.product_name || `Shipment #${s.id}`}
              </h3>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: 13, marginBottom: 16 }}>
                <dt style={{ color: '#64748b' }}>Product ID</dt>
                <dd style={{ margin: 0 }}>{s.product_id || '—'}</dd>
                <dt style={{ color: '#64748b' }}>From</dt>
                <dd style={{ margin: 0 }}>{s.from_address || '—'}</dd>
                <dt style={{ color: '#64748b' }}>To</dt>
                <dd style={{ margin: 0 }}>{s.to_address || '—'}</dd>
                <dt style={{ color: '#64748b' }}>Contact</dt>
                <dd style={{ margin: 0 }}>{s.contact_number || '—'}</dd>
                <dt style={{ color: '#64748b' }}>Partner details</dt>
                <dd style={{ margin: 0 }}>{s.delivery_partner_details || '—'}</dd>
              </dl>

              {(canFillPod || canFillCustom) && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  {canFillPod && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">POD / Tracking number</label>
                      <input
                        className="form-input"
                        value={formValues[s.id]?.pod_tracking_number ?? ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [s.id]: { ...prev[s.id], pod_tracking_number: e.target.value },
                          }))
                        }
                        placeholder="Enter POD or tracking number"
                      />
                    </div>
                  )}
                  {canFillCustom && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Custom fields (optional)</label>
                      <input
                        className="form-input"
                        placeholder='e.g. {"delivery_notes": "Left at gate"}'
                        value={typeof formValues[s.id]?.custom_fields === 'object'
                          ? JSON.stringify(formValues[s.id].custom_fields)
                          : ''}
                        onChange={(e) => {
                          let parsed: Record<string, string> = {};
                          try {
                            const v = e.target.value.trim();
                            if (v) parsed = JSON.parse(v);
                          } catch {}
                          setFormValues((prev) => ({
                            ...prev,
                            [s.id]: { ...prev[s.id], custom_fields: parsed },
                          }));
                        }}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSubmit(s.id)}
                    disabled={submitting === s.id}
                  >
                    {submitting === s.id ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              )}

              {!canFillPod && !canFillCustom && (
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No fillable fields for this shipment.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
