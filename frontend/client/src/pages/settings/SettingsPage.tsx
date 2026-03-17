import { useEffect, useState } from 'react';
import { configApi } from '@/api/businessApi';
import toast from 'react-hot-toast';

interface Config {
  company_name?: string;
  subtitle?: string;
  description?: string;
  contact_email?: string;
  domain?: string;
  currency?: string;
  timezone?: string;
  company_rules?: string;
  custom_fields?: Record<string, string>;
  [k: string]: unknown;
}

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'UTC',
];

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);

  // Editable form state
  const [companyName, setCompanyName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [companyRules, setCompanyRules] = useState('');
  const [customFieldsList, setCustomFieldsList] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoadFailed(false);
    setLoadErrorMsg(null);
    try {
      const res = await configApi.get();
      // Backend returns { success, message, data: { tenant_id, company_name, ... } }
      const data = (res as { data?: Config }).data ?? res;
      const configObj = data && typeof data === 'object' ? (data as Config) : null;
      if (configObj) {
        setConfig(configObj);
        setCompanyName(configObj.company_name ?? '');
        setSubtitle(configObj.subtitle ?? '');
        setDescription(configObj.description ?? '');
        setContactEmail(configObj.contact_email ?? '');
        setCurrency(configObj.currency ?? 'INR');
        setTimezone(configObj.timezone ?? 'Asia/Kolkata');
        setCompanyRules(configObj.company_rules ?? '');
        const cf = typeof configObj.custom_fields === 'object' && configObj.custom_fields !== null ? configObj.custom_fields : {};
        setCustomFieldsList(Object.entries(cf).map(([k, v]) => ({ key: k, value: String(v ?? '') })));
      } else {
        setConfig({});
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load settings.';
      toast.error(msg);
      setConfig({});
      setLoadFailed(true);
      setLoadErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await configApi.update({
        company_name: companyName,
        subtitle,
        description,
        contact_email: contactEmail,
        currency,
        timezone,
        company_rules: companyRules,
        custom_fields: customFieldsList.reduce<Record<string, string>>((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {}),
      });
      toast.success('Settings saved.');
      fetchConfig();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    setCustomFieldsList((p) => [...p, { key: '', value: '' }]);
  };
  const removeCustomField = (index: number) => {
    setCustomFieldsList((p) => p.filter((_, i) => i !== index));
  };
  const updateCustomField = (index: number, key: string, value: string) => {
    setCustomFieldsList((p) => p.map((item, i) => (i === index ? { key, value } : item)));
  };

  const inputStyle = { margin: 0 } as const;
  const sectionStyle = { marginBottom: 24 };

  if (loading) return <div className="page-content" style={{ padding: 20 }}>Loading...</div>;
  if (config === null) return <div className="page-content" style={{ padding: 20 }}>No settings available.</div>;

  const configOrEmpty = config ?? {};

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Client Profile & Settings</h1>
          <p className="page-subtitle">Set your profile, company details, company rules, and custom fields.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save all'}
        </button>
      </div>

      {loadFailed && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>
          {loadErrorMsg?.includes('migrate_schemas') ? (
            <>
              <strong>Database schema update required.</strong> Ask your administrator to run in the backend: <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>python manage.py migrate_schemas</code> then reload this page. You can still edit and save below after the migration.
            </>
          ) : (
            <>
              Could not load previous settings. {loadErrorMsg ? <span>{loadErrorMsg}</span> : 'Check that you are using your tenant domain (e.g. happy-kid-.localhost for the API).'} You can still edit and save below.
            </>
          )}
        </div>
      )}

      <div style={{ maxWidth: 800 }}>
        {/* Profile & Company details */}
        <div className="card" style={sectionStyle}>
          <div className="card-header">
            <h2 className="card-title">Profile & Company details</h2>
          </div>
          <div className="card-body" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Company name</label>
                <input className="form-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} placeholder="e.g. Happy Kid" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Subtitle / tagline</label>
                <input className="form-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={inputStyle} placeholder="Short tagline" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Company description" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact email</label>
                <input className="form-input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={inputStyle} placeholder="contact@example.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Currency</label>
                  <input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} placeholder="INR" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Timezone</label>
                  <select className="form-select" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle}>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
                <strong>Primary domain:</strong> {configOrEmpty.domain || '—'} (read-only, set by Superadmin)
              </div>
            </div>
          </div>
        </div>

        {/* Company rules */}
        <div className="card" style={sectionStyle}>
          <div className="card-header">
            <h2 className="card-title">Company rules</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Policies, rules, or internal notes.</p>
          </div>
          <div className="card-body" style={{ padding: '20px 24px' }}>
            <textarea
              className="form-input"
              rows={5}
              value={companyRules}
              onChange={(e) => setCompanyRules(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', width: '100%' }}
              placeholder="e.g. Payment terms, return policy, internal rules…"
            />
          </div>
        </div>

        {/* Custom fields */}
        <div className="card" style={sectionStyle}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="card-title">Custom fields</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Add your own key-value fields (e.g. Tax ID, License number).</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomField}>+ Add field</button>
          </div>
          <div className="card-body" style={{ padding: '20px 24px' }}>
            {customFieldsList.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No custom fields yet. Click &quot;+ Add field&quot; to add one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customFieldsList.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="form-input"
                      style={{ width: 160, ...inputStyle }}
                      placeholder="Field name"
                      value={item.key}
                      onChange={(e) => updateCustomField(index, e.target.value, item.value)}
                    />
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 140, ...inputStyle }}
                      placeholder="Value"
                      value={item.value}
                      onChange={(e) => updateCustomField(index, item.key, e.target.value)}
                    />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCustomField(index)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
