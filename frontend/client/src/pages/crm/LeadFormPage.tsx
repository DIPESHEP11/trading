import React, { useState, useEffect } from 'react';
import { crmApi } from '@/api/crmApi';
import type { LeadFormField } from '@/types';

export default function LeadFormPage() {
  const [fields, setFields] = useState<LeadFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await crmApi.leadFormPublic.getSchema();
        const f = res?.data?.data?.fields ?? res?.data?.fields ?? [];
        setFields(f);
        setFormData(Object.fromEntries(f.map((x: LeadFormField) => [x.key, ''])));
      } catch {
        setError('Could not load form.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await crmApi.leadFormPublic.submit(formData);
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading form...</div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-card">
          <p>This form is not configured yet.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-card">
          <h1 style={{ fontSize: 24, marginBottom: 12, color: 'var(--color-success)' }}>Thank you!</h1>
          <p>Your submission has been received. We will get back to you soon.</p>
        </div>
      </div>
    );
  }

  const sortedFields = [...fields].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <div className="auth-page" style={{ minHeight: '100vh', padding: 24 }}>
      <div className="auth-card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="auth-logo">
          <h1>Trai<span>ding</span></h1>
          <p>Submit your details</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {sortedFields.map((f) => (
            <div key={f.key} className="form-group">
              <label className="form-label">
                {f.label} {f.required && '*'}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  className="form-textarea"
                  value={formData[f.key] || ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                  rows={3}
                />
              ) : f.type === 'select' ? (
                <select
                  className="form-select"
                  value={formData[f.key] || ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                >
                  <option value="">Select...</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'}
                  value={formData[f.key] || ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                />
              )}
            </div>
          ))}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
