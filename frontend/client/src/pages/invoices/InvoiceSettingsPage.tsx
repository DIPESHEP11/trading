import React, { useState, useEffect, useRef } from 'react';
import { invoicesApi } from '@/api/businessApi';
import { restrictTo10Digits } from '@/utils/phone';
import toast from 'react-hot-toast';

interface SerialRange { from: number; to: number; current?: number }

interface ISettings {
  tax_type: string; supplier_name: string; supplier_address: string;
  supplier_city: string; supplier_state: string; supplier_pincode: string;
  supplier_gstin: string; supplier_pan: string; supplier_cin: string;
  supplier_phone: string; supplier_email: string;
  company_logo: string | null; msme_type: string; msme_number: string;
  authorized_signatory: string; signature_image: string | null;
  bank_name: string; bank_account_number: string; bank_ifsc: string;
  bank_branch: string; bank_upi_id: string;
  invoice_prefix: string; next_invoice_number: number;
  proforma_prefix: string; next_proforma_number: number;
  serial_number_ranges?: SerialRange[];
  default_due_days: number; default_terms: string;
  default_currency: string; currency_symbol: string;
  e_invoicing_enabled: boolean; default_tax_rate: string;
}

interface CurrencyOption { code: string; symbol: string; name: string; country: string }

const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India' },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', country: 'United Arab Emirates' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', country: 'Saudi Arabia' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', country: 'South Korea' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', country: 'Malaysia' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', country: 'Thailand' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'Indonesia' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', country: 'Philippines' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', country: 'Vietnam' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', country: 'Sri Lanka' },
  { code: 'NPR', symbol: '₨', name: 'Nepalese Rupee', country: 'Nepal' },
  { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', country: 'Myanmar' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', country: 'Egypt' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', country: 'Tanzania' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', country: 'Mexico' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', country: 'Argentina' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso', country: 'Chile' },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso', country: 'Colombia' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', country: 'Peru' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', country: 'Sweden' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', country: 'Norway' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', country: 'Denmark' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', country: 'Poland' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', country: 'Czech Republic' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', country: 'Hungary' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', country: 'Romania' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', country: 'Turkey' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', country: 'Russia' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', country: 'Ukraine' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', country: 'Israel' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', country: 'Qatar' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', country: 'Kuwait' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', country: 'Bahrain' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', country: 'Oman' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'New Zealand' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', country: 'Hong Kong' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', country: 'Taiwan' },
];
interface IStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }
interface FlowAction { id: number; status_key: string; status_label: string; target_module: string; action: string; is_active: boolean; description: string }
interface IndianState { code: string; name: string }

type Tab = 'general' | 'gst' | 'bank' | 'statuses' | 'flow';

const MODULE_OPTIONS = [
  { value: 'none',      label: 'Stay in Invoices only' },
  { value: 'orders',    label: 'Orders' },
  { value: 'warehouse', label: 'Warehouse / Inventory' },
  { value: 'dispatch',  label: 'Dispatch' },
  { value: 'crm',       label: 'CRM' },
];
const ACTION_OPTIONS: Record<string, { value: string; label: string }[]> = {
  none:      [{ value: 'notify_only', label: 'Notify Only' }],
  orders:    [{ value: 'notify_only', label: 'Notify Only' }],
  warehouse: [{ value: 'send_to_warehouse', label: 'Send to Warehouse' }],
  dispatch:  [{ value: 'mark_dispatch', label: 'Mark for Dispatch' }],
  crm:       [{ value: 'notify_only', label: 'Notify Only' }],
};
const COLOR_OPTIONS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#64748b', '#1d4ed8', '#dc2626',
];

const emptySettings: ISettings = {
  tax_type: 'no_gst', supplier_name: '', supplier_address: '', supplier_city: '',
  supplier_state: '', supplier_pincode: '', supplier_gstin: '', supplier_pan: '',
  supplier_cin: '', supplier_phone: '', supplier_email: '',
  company_logo: null, msme_type: '', msme_number: '',
  authorized_signatory: '', signature_image: null,
  bank_name: '', bank_account_number: '', bank_ifsc: '', bank_branch: '', bank_upi_id: '',
  invoice_prefix: 'INV', next_invoice_number: 1, proforma_prefix: 'PI', next_proforma_number: 1,
  serial_number_ranges: [],
  default_due_days: 30, default_terms: '', default_currency: 'INR', currency_symbol: '₹',
  e_invoicing_enabled: false, default_tax_rate: '18',
};

export default function InvoiceSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<ISettings>(emptySettings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<IndianState[]>([]);
  const [uploading, setUploading] = useState(false);

  // Currency search
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCurrencies = CURRENCIES.filter((c) => {
    const q = currencySearch.toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
  });

  const selectedCurrency = CURRENCIES.find((c) => c.code === settings.default_currency) || CURRENCIES[0];

  // Statuses
  const [statuses, setStatuses] = useState<IStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({ key: '', label: '', color: '#3b82f6' });
  const [editStatusId, setEditStatusId] = useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Flow
  const [flowActions, setFlowActions] = useState<FlowAction[]>([]);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowForm, setFlowForm] = useState({ status_key: '', target_module: 'none', action: 'notify_only', description: '' });
  const [editFlowId, setEditFlowId] = useState<number | null>(null);
  const [flowSaving, setFlowSaving] = useState(false);

  useEffect(() => {
    invoicesApi.settings.get()
      .then((r) => setSettings({ ...emptySettings, ...r.data }))
      .catch(() => toast.error('Failed to load settings.'))
      .finally(() => setLoading(false));
    invoicesApi.ref.states()
      .then((r) => setStates(r.data?.states || []))
      .catch(() => {});
    loadStatuses();
    loadFlowActions();
  }, []);

  const loadStatuses = () => {
    setStatusLoading(true);
    invoicesApi.statuses.list()
      .then((r) => setStatuses(r.data?.statuses || []))
      .catch(() => toast.error('Failed to load statuses.'))
      .finally(() => setStatusLoading(false));
  };
  const loadFlowActions = () => {
    setFlowLoading(true);
    invoicesApi.flowActions.list()
      .then((r) => setFlowActions(r.data?.flow_actions || []))
      .catch(() => toast.error('Failed to load flow actions.'))
      .finally(() => setFlowLoading(false));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await invoicesApi.settings.update(settings);
      setSettings({ ...emptySettings, ...res.data });
      toast.success('Invoice settings saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings.');
    } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'company_logo' | 'signature_image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append(field, file);
      const res = await invoicesApi.settings.uploadLogo(fd);
      setSettings({ ...emptySettings, ...res.data });
      toast.success(field === 'company_logo' ? 'Logo uploaded.' : 'Signature uploaded.');
    } catch { toast.error('Upload failed.'); }
    finally { setUploading(false); }
  };

  const upd = (field: keyof ISettings, value: any) =>
    setSettings((p) => ({ ...p, [field]: value }));

  const isGST = settings.tax_type === 'indian_gst';

  // Status helpers
  const resetStatusForm = () => { setStatusForm({ key: '', label: '', color: '#3b82f6' }); setEditStatusId(null); };
  const handleSaveStatus = async () => {
    if (!statusForm.label.trim()) { toast.error('Label is required.'); return; }
    const key = statusForm.key.trim() || statusForm.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setStatusSaving(true);
    try {
      if (editStatusId) {
        await invoicesApi.statuses.update(editStatusId, { ...statusForm, key });
        toast.success('Status updated.');
      } else {
        await invoicesApi.statuses.create({ ...statusForm, key, order: statuses.length });
        toast.success('Status created.');
      }
      resetStatusForm(); loadStatuses();
    } catch (err: any) {
      toast.error(err?.response?.data?.key?.[0] || err?.response?.data?.message || 'Failed.');
    } finally { setStatusSaving(false); }
  };
  const handleDeleteStatus = async (id: number) => {
    if (!confirm('Delete this status?')) return;
    try { await invoicesApi.statuses.delete(id); loadStatuses(); toast.success('Deleted.'); }
    catch { toast.error('Failed.'); }
  };

  // Flow helpers
  const resetFlowForm = () => { setFlowForm({ status_key: '', target_module: 'none', action: 'notify_only', description: '' }); setEditFlowId(null); };
  const configuredStatusKeys = new Set(flowActions.map((f) => f.status_key));
  const unconfiguredStatuses = statuses.filter((s) => !configuredStatusKeys.has(s.key));
  const handleSaveFlow = async () => {
    if (!flowForm.status_key) { toast.error('Select a status.'); return; }
    setFlowSaving(true);
    try {
      if (editFlowId) {
        await invoicesApi.flowActions.update(editFlowId, flowForm);
        toast.success('Flow action updated.');
      } else {
        await invoicesApi.flowActions.create(flowForm);
        toast.success('Flow action created.');
      }
      resetFlowForm(); loadFlowActions();
    } catch (err: any) {
      toast.error(err?.response?.data?.status_key?.[0] || err?.response?.data?.message || 'Failed.');
    } finally { setFlowSaving(false); }
  };
  const handleDeleteFlow = async (id: number) => {
    if (!confirm('Delete this flow action?')) return;
    try { await invoicesApi.flowActions.delete(id); loadFlowActions(); toast.success('Deleted.'); }
    catch { toast.error('Failed.'); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'general', label: 'General', icon: '📋' },
    { key: 'gst', label: 'GST / Tax', icon: '🧾' },
    { key: 'bank', label: 'Bank & Terms', icon: '🏦' },
    { key: 'statuses', label: 'Statuses', icon: '🏷️' },
    { key: 'flow', label: 'Status Flow', icon: '🔀' },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading settings…</div>;

  const inputStyle = { margin: 0 } as const;
  const sectionStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 } as const;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Invoice Settings</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Configure GST, supplier details, bank info, statuses, and flow actions.
        </p>
      </div>

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

      {/* ═══ General ═══ */}
      {activeTab === 'general' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>General Settings</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Invoice numbering, defaults, and e-invoicing.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
          <div className="card-body">
            <div style={sectionStyle}>
              <div className="form-group">
                <label className="form-label">Invoice Prefix</label>
                <input className="form-input" value={settings.invoice_prefix}
                  onChange={(e) => upd('invoice_prefix', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Next Invoice Number</label>
                <input className="form-input" type="number" value={settings.next_invoice_number}
                  onChange={(e) => upd('next_invoice_number', parseInt(e.target.value) || 1)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Proforma Prefix</label>
                <input className="form-input" value={settings.proforma_prefix}
                  onChange={(e) => upd('proforma_prefix', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Next Proforma Number</label>
                <input className="form-input" type="number" value={settings.next_proforma_number}
                  onChange={(e) => upd('next_proforma_number', parseInt(e.target.value) || 1)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Due Days</label>
                <input className="form-input" type="number" value={settings.default_due_days}
                  onChange={(e) => upd('default_due_days', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Tax Rate (%)</label>
                <input className="form-input" value={settings.default_tax_rate}
                  onChange={(e) => upd('default_tax_rate', e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Optional: Serial number ranges */}
            <div style={{ marginTop: 24, padding: '16px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: '#1e293b' }}>
                Serial number ranges (optional)
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
                Define multiple series, e.g. 20,000–30,000 and 40,000–80,000. Invoice numbers will use the next available number from the first range with capacity; if none are set, the single &quot;Next Invoice Number&quot; above is used.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(settings.serial_number_ranges || []).map((range, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>From</label>
                      <input className="form-input" type="number" min={1} value={range.from}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSettings((p) => ({
                            ...p,
                            serial_number_ranges: (p.serial_number_ranges || []).map((r, i) =>
                              i === idx ? { ...r, from: val } : r
                            ),
                          }));
                        }} style={{ width: 120, ...inputStyle }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>To</label>
                      <input className="form-input" type="number" min={1} value={range.to}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSettings((p) => ({
                            ...p,
                            serial_number_ranges: (p.serial_number_ranges || []).map((r, i) =>
                              i === idx ? { ...r, to: val } : r
                            ),
                          }));
                        }} style={{ width: 120, ...inputStyle }} />
                    </div>
                    {range.current != null && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Next in range: <strong>{range.current}</strong>
                      </span>
                    )}
                    <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 18 }}
                      onClick={() => setSettings((p) => ({
                        ...p,
                        serial_number_ranges: (p.serial_number_ranges || []).filter((_, i) => i !== idx),
                      }))}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setSettings((p) => ({
                    ...p,
                    serial_number_ranges: [...(p.serial_number_ranges || []), { from: 1, to: 100 }],
                  }))}>
                  + Add range
                </button>
              </div>
            </div>

            {/* Default Currency */}
            <div style={{ marginTop: 20 }}>
              <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600, fontSize: 13 }}>Default Currency</label>
              <div ref={currencyRef} style={{ position: 'relative', maxWidth: 420 }}>
                <div
                  onClick={() => { setCurrencyOpen(!currencyOpen); setCurrencySearch(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer',
                    background: '#fff', fontSize: 14, transition: 'border-color .2s',
                    ...(currencyOpen ? { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,.12)' } : {}),
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{selectedCurrency.symbol}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{selectedCurrency.code}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{selectedCurrency.name} — {selectedCurrency.country}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>▼</span>
                </div>

                {currencyOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                    marginTop: 4, boxShadow: '0 8px 30px rgba(0,0,0,.12)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        autoFocus
                        placeholder="Search currency, country…"
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        style={{
                          width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8,
                          padding: '7px 12px', fontSize: 13, outline: 'none',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                        onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                      />
                    </div>
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {filteredCurrencies.length === 0 && (
                        <div style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                          No currencies found
                        </div>
                      )}
                      {filteredCurrencies.map((c) => {
                        const isSelected = c.code === settings.default_currency;
                        return (
                          <div
                            key={c.code}
                            onClick={() => {
                              upd('default_currency', c.code);
                              upd('currency_symbol', c.symbol);
                              setCurrencyOpen(false);
                              setCurrencySearch('');
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                              background: isSelected ? '#eff6ff' : 'transparent',
                              transition: 'background .15s',
                            }}
                            onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = '#f8fafc'); }}
                            onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent'); }}
                          >
                            <span style={{ width: 28, fontSize: 16, textAlign: 'center' }}>{c.symbol}</span>
                            <span style={{ fontWeight: 600, minWidth: 40 }}>{c.code}</span>
                            <span style={{ color: '#64748b', flex: 1 }}>{c.name}</span>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>{c.country}</span>
                            {isSelected && <span style={{ color: '#3b82f6', fontSize: 14 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                This symbol ({selectedCurrency.symbol}) will appear on invoices and PDF exports.
              </p>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.e_invoicing_enabled}
                  onChange={(e) => upd('e_invoicing_enabled', e.target.checked)}
                  style={{ accentColor: '#3b82f6' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Enable E-Invoicing (IRN + QR Code)</span>
              </label>
              <p style={{ margin: '4px 0 0 26px', fontSize: 12, color: '#94a3b8' }}>
                Required if your annual turnover exceeds ₹5 Crore.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ GST / Tax ═══ */}
      {activeTab === 'gst' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>GST / Tax Configuration</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Choose tax type and configure supplier/business details.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
          <div className="card-body">
            {/* Tax Type Toggle */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[
                { val: 'no_gst', label: 'No GST / Non-Taxable', desc: 'Bill of Supply / Cash Memo', icon: '📄' },
                { val: 'indian_gst', label: 'Indian GST Compliant', desc: 'Tax Invoice with GSTIN, HSN, CGST/SGST/IGST', icon: '🧾' },
              ].map((opt) => (
                <div key={opt.val} onClick={() => upd('tax_type', opt.val)}
                  style={{
                    flex: 1, padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${settings.tax_type === opt.val ? '#3b82f6' : '#e2e8f0'}`,
                    background: settings.tax_type === opt.val ? '#eff6ff' : '#fff',
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{opt.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: settings.tax_type === opt.val ? '#1d4ed8' : '#1e293b' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{opt.desc}</div>
                </div>
              ))}
            </div>

            {/* Feature comparison */}
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 24 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Feature</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: '#64748b' }}>No GST</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: '#1d4ed8' }}>Indian GST</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Heading', 'Bill of Supply / Cash Memo', 'Tax Invoice'],
                    ['GSTIN', 'Not required', 'Mandatory (B2B)'],
                    ['Tax Breakup', 'Hidden', 'CGST+SGST or IGST'],
                    ['HSN/SAC', 'Optional', 'Mandatory (6-digit)'],
                    ['ITC (Input Tax Credit)', 'Buyer cannot claim', 'Buyer can claim'],
                    ['Used By', 'Unregistered / Composition dealers', 'All GST-registered businesses'],
                  ].map(([feat, noGst, gst]) => (
                    <tr key={feat} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{feat}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8' }}>{noGst}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>{gst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Company Logo */}
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>Company Logo (for Invoice PDF)</h4>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div>
                {settings.company_logo ? (
                  <img src={settings.company_logo} alt="Logo" style={{ maxHeight: 60, maxWidth: 200, borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 120, height: 60, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>No Logo</div>
                )}
              </div>
              <div>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => handleLogoUpload(e, 'company_logo')} disabled={uploading} />
                </label>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>PNG or JPG, max 200px height recommended.</p>
              </div>
            </div>

            {/* Supplier details (always shown, GSTIN only for GST) */}
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>Supplier / Business Details</h4>
            <div style={sectionStyle}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input className="form-input" value={settings.supplier_name}
                  onChange={(e) => upd('supplier_name', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" value={settings.supplier_phone}
                  onChange={(e) => upd('supplier_phone', restrictTo10Digits(e.target.value))}
                  placeholder="9876543210" maxLength={10} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={settings.supplier_email}
                  onChange={(e) => upd('supplier_email', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={settings.supplier_city}
                  onChange={(e) => upd('supplier_city', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-select" value={settings.supplier_state}
                  onChange={(e) => upd('supplier_state', e.target.value)} style={inputStyle}>
                  <option value="">Select State…</option>
                  {states.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={settings.supplier_pincode}
                  onChange={(e) => upd('supplier_pincode', e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Full Address</label>
              <textarea className="form-input" rows={2} value={settings.supplier_address}
                onChange={(e) => upd('supplier_address', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {isGST && (
              <>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 12px', color: '#1e293b' }}>GST Registration</h4>
                <div style={sectionStyle}>
                  <div className="form-group">
                    <label className="form-label">GSTIN (15 characters) *</label>
                    <input className="form-input" maxLength={15} value={settings.supplier_gstin}
                      onChange={(e) => upd('supplier_gstin', e.target.value.toUpperCase())} style={inputStyle}
                      placeholder="e.g. 29AABCT1332L1ZC" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN</label>
                    <input className="form-input" maxLength={10} value={settings.supplier_pan}
                      onChange={(e) => upd('supplier_pan', e.target.value.toUpperCase())} style={inputStyle} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CIN (Company only)</label>
                    <input className="form-input" maxLength={21} value={settings.supplier_cin}
                      onChange={(e) => upd('supplier_cin', e.target.value.toUpperCase())} style={inputStyle} />
                  </div>
                </div>

                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 12px', color: '#1e293b' }}>MSME / UDYAM Details</h4>
                <div style={sectionStyle}>
                  <div className="form-group">
                    <label className="form-label">MSME/UDYAM Type</label>
                    <select className="form-select" value={settings.msme_type}
                      onChange={(e) => upd('msme_type', e.target.value)} style={inputStyle}>
                      <option value="">Not Applicable</option>
                      <option value="Micro">Micro</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">UDYAM Registration Number</label>
                    <input className="form-input" value={settings.msme_number}
                      onChange={(e) => upd('msme_number', e.target.value.toUpperCase())} style={inputStyle}
                      placeholder="e.g. UDYAM-KL-07-0004665" />
                  </div>
                </div>

                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 12px', color: '#1e293b' }}>Authorized Signatory</h4>
                <div style={sectionStyle}>
                  <div className="form-group">
                    <label className="form-label">Signatory Name</label>
                    <input className="form-input" value={settings.authorized_signatory}
                      onChange={(e) => upd('authorized_signatory', e.target.value)} style={inputStyle} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Signature Image</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {settings.signature_image && (
                        <img src={settings.signature_image} alt="Signature" style={{ maxHeight: 40, borderRadius: 4 }} />
                      )}
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', fontSize: 11 }}>
                        Upload
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => handleLogoUpload(e, 'signature_image')} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Bank & Terms ═══ */}
      {activeTab === 'bank' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Bank Details & Terms</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Printed on every invoice for payment reference.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
          <div className="card-body">
            <div style={sectionStyle}>
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input className="form-input" value={settings.bank_name}
                  onChange={(e) => upd('bank_name', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-input" value={settings.bank_account_number}
                  onChange={(e) => upd('bank_account_number', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input className="form-input" maxLength={11} value={settings.bank_ifsc}
                  onChange={(e) => upd('bank_ifsc', e.target.value.toUpperCase())} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input className="form-input" value={settings.bank_branch}
                  onChange={(e) => upd('bank_branch', e.target.value)} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID</label>
                <input className="form-input" value={settings.bank_upi_id}
                  onChange={(e) => upd('bank_upi_id', e.target.value)} style={inputStyle}
                  placeholder="e.g. business@upi" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Default Terms & Conditions</label>
              <textarea className="form-input" rows={4} value={settings.default_terms}
                onChange={(e) => upd('default_terms', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ Statuses ═══ */}
      {activeTab === 'statuses' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Invoice Statuses</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Custom statuses for your invoice pipeline.</p>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Label *</label>
                <input className="form-input" placeholder="e.g. Partially Paid" value={statusForm.label}
                  onChange={(e) => setStatusForm((p) => ({ ...p, label: e.target.value }))} style={{ width: 160, ...inputStyle }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Key (slug)</label>
                <input className="form-input" placeholder="auto" value={statusForm.key}
                  onChange={(e) => setStatusForm((p) => ({ ...p, key: e.target.value }))} style={{ width: 140, ...inputStyle }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Color</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <div key={c} onClick={() => setStatusForm((p) => ({ ...p, color: c }))}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                        border: statusForm.color === c ? '2px solid #1e293b' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={statusSaving}>
                {statusSaving ? 'Saving…' : editStatusId ? 'Update' : '+ Add Status'}
              </button>
              {editStatusId && <button className="btn btn-secondary btn-sm" onClick={resetStatusForm}>Cancel</button>}
            </div>
            {statusLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : statuses.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No statuses yet.</div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {statuses.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < statuses.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: editStatusId === s.id ? '#eff6ff' : '#fff' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{s.key}</span>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditStatusId(s.id); setStatusForm({ key: s.key, label: s.label, color: s.color }); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStatus(s.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Flow ═══ */}
      {activeTab === 'flow' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Status Flow Actions</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              What happens when an invoice status changes. If no flow is set, the status only changes within Invoices.
            </p>
          </div>
          <div className="card-body">
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                {editFlowId ? 'Edit Flow Action' : 'Add Flow Action'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Status *</label>
                  <select className="form-select" value={flowForm.status_key}
                    onChange={(e) => setFlowForm((p) => ({ ...p, status_key: e.target.value }))} style={{ width: 180, ...inputStyle }}>
                    <option value="">Select…</option>
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
                      const acts = ACTION_OPTIONS[mod] || [];
                      setFlowForm((p) => ({ ...p, target_module: mod, action: acts[0]?.value || 'notify_only' }));
                    }} style={{ width: 200, ...inputStyle }}>
                    {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Action</label>
                  <select className="form-select" value={flowForm.action}
                    onChange={(e) => setFlowForm((p) => ({ ...p, action: e.target.value }))} style={{ width: 180, ...inputStyle }}>
                    {(ACTION_OPTIONS[flowForm.target_module] || []).map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Description</label>
                  <input className="form-input" placeholder="Optional" value={flowForm.description}
                    onChange={(e) => setFlowForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFlow} disabled={flowSaving}>
                  {flowSaving ? 'Saving…' : editFlowId ? 'Update' : '+ Add Flow'}
                </button>
                {editFlowId && <button className="btn btn-secondary btn-sm" onClick={resetFlowForm}>Cancel</button>}
              </div>
            </div>

            {flowLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : flowActions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
                <div style={{ fontSize: 14 }}>No flow actions configured yet.</div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Status</div><div>Target Module</div><div>Action</div><div>Description</div><div>Actions</div>
                </div>
                {flowActions.map((f, i) => {
                  const so = statuses.find((s) => s.key === f.status_key);
                  const ml = MODULE_OPTIONS.find((m) => m.value === f.target_module)?.label || f.target_module;
                  const al = (ACTION_OPTIONS[f.target_module] || []).find((a) => a.value === f.action)?.label || f.action;
                  return (
                    <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, padding: '10px 14px', alignItems: 'center',
                      borderBottom: i < flowActions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: editFlowId === f.id ? '#eff6ff' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: so?.color || '#94a3b8' }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.status_label}</span>
                      </div>
                      <div>{f.target_module === 'none' ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Invoices only</span>
                        : <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#3b82f6', fontWeight: 500 }}>→ {ml}</span>}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{al}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.description || '—'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditFlowId(f.id); setFlowForm({ status_key: f.status_key, target_module: f.target_module, action: f.action, description: f.description });
                        }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFlow(f.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {unconfiguredStatuses.length > 0 && flowActions.length > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                <strong>Statuses without flow:</strong> {unconfiguredStatuses.map((s) => s.label).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
