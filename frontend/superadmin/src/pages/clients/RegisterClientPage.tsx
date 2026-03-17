import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clientApi, type RegisterClientPayload } from '@/api/clientApi';
import { planApi } from '@/api/planApi';
import { restrictTo10Digits } from '@/utils/phone';
import type { Plan } from '@/types';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4;

const BUSINESS_MODELS = [
  { value: 'b2b', label: 'B2B', desc: 'Business to Business', icon: '🏢' },
  { value: 'b2c', label: 'B2C', desc: 'Business to Consumer', icon: '🛒' },
  { value: 'd2c', label: 'D2C', desc: 'Direct to Consumer', icon: '🚀' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Mixed Model', icon: '⚡' },
  { value: 'marketplace', label: 'Marketplace', desc: 'Multi-vendor Platform', icon: '🏪' },
  { value: 'saas', label: 'SaaS', desc: 'Software as a Service', icon: '💻' },
  { value: 'services', label: 'Services', desc: 'Consulting / Services', icon: '🤝' },
  { value: 'other', label: 'Other', desc: 'Custom Model', icon: '✨' },
];

interface ModuleToggle {
  key: keyof RegisterClientPayload;
  label: string;
  desc: string;
  icon: string;
}

const MODULE_LIST: ModuleToggle[] = [
  { key: 'module_crm', label: 'CRM', desc: 'Leads, Customers & Pipeline', icon: '🎯' },
  { key: 'module_products', label: 'Products', desc: 'Catalogue & Categories', icon: '📦' },
  { key: 'module_stock', label: 'Stock', desc: 'Inventory & Stock levels', icon: '🏭' },
  { key: 'module_orders', label: 'Orders', desc: 'Order processing & tracking', icon: '📋' },
  { key: 'module_warehouse', label: 'Warehouse', desc: 'Multi-warehouse management', icon: '🏬' },
  { key: 'module_invoices', label: 'Invoices', desc: 'Billing & Invoicing', icon: '🧾' },
  { key: 'module_dispatch', label: 'Dispatch', desc: 'Shipping & Dispatch stickers', icon: '🚚' },
  { key: 'module_tracking', label: 'Tracking', desc: 'Real-time courier tracking', icon: '📍' },
  { key: 'module_manufacturing', label: 'Manufacturing', desc: 'Production & BOM', icon: '⚙️' },
  { key: 'module_hr', label: 'HR', desc: 'Staff management & Payroll', icon: '👥' },
  { key: 'module_analytics', label: 'Analytics', desc: 'Reports & Dashboard insights', icon: '📊' },
];

const defaultModules = {
  module_crm: true, module_products: true, module_stock: true,
  module_orders: true, module_warehouse: true, module_invoices: true,
  module_dispatch: true, module_tracking: false, module_manufacturing: false,
  module_hr: false, module_analytics: true,
};

const STEPS = ['Brand', 'Modules', 'Business Model', 'Admin User'];

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function RegisterClientPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantIdParam = searchParams.get('tenantId');
  const existingTenantId = tenantIdParam ? parseInt(tenantIdParam, 10) : null;
  const [step, setStep] = useState<Step>(existingTenantId ? 4 : 1);
  const [loading, setLoading] = useState(false);
  const [existingTenant, setExistingTenant] = useState<{ name: string; subtitle: string; plan: string; business_model: string; module_crm?: boolean; [k: string]: unknown } | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Plans from API
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    planApi.list()
      .then(res => {
        const d = (res as unknown as { data: { plans: Plan[] } }).data;
        setPlans(d?.plans || []);
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    if (!existingTenantId) return;
    clientApi.get(existingTenantId)
      .then((res: { data?: { name?: string; subtitle?: string; plan?: string; business_model?: string }; name?: string; subtitle?: string; plan?: string; business_model?: string }) => {
        const t = (res as { data?: typeof res }).data ?? res;
        setExistingTenant(t as typeof existingTenant);
        setName(t.name ?? '');
        setSubtitle(t.subtitle ?? '');
        setPlan(t.plan ?? '');
        setBusinessModel(t.business_model ?? 'hybrid');
        if (t && typeof t === 'object' && 'module_crm' in t) {
          setModules({
            module_crm: !!t.module_crm,
            module_products: !!(t as { module_products?: boolean }).module_products,
            module_stock: !!(t as { module_stock?: boolean }).module_stock,
            module_orders: !!(t as { module_orders?: boolean }).module_orders,
            module_warehouse: !!(t as { module_warehouse?: boolean }).module_warehouse,
            module_invoices: !!(t as { module_invoices?: boolean }).module_invoices,
            module_dispatch: !!(t as { module_dispatch?: boolean }).module_dispatch,
            module_tracking: !!(t as { module_tracking?: boolean }).module_tracking,
            module_manufacturing: !!(t as { module_manufacturing?: boolean }).module_manufacturing,
            module_hr: !!(t as { module_hr?: boolean }).module_hr,
            module_analytics: !!(t as { module_analytics?: boolean }).module_analytics,
          });
        }
      })
      .catch(() => toast.error('Failed to load client.'));
  }, [existingTenantId]);

  // Step 1 — Brand
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [domain, setDomain] = useState('');

  // Step 2 — Modules
  const [modules, setModules] = useState({ ...defaultModules });

  // Step 3 — Business Model & Plan
  const [businessModel, setBusinessModel] = useState('b2b');
  // null = no plan selected (optional)
  const [plan, setPlan] = useState<string | null>(null);

  // Step 4 — Admin User
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectPlan = (slug: string | null) => {
    setPlan(slug);
    if (!slug) return;
    const found = plans.find(p => p.slug === slug);
    if (!found) return;
    // Auto-fill module toggles from the plan's default flags
    setModules({
      module_crm: found.module_crm,
      module_products: found.module_products,
      module_stock: found.module_stock,
      module_orders: found.module_orders,
      module_warehouse: found.module_warehouse,
      module_invoices: found.module_invoices,
      module_dispatch: found.module_dispatch,
      module_tracking: found.module_tracking,
      module_manufacturing: found.module_manufacturing,
      module_hr: found.module_hr,
      module_analytics: found.module_analytics,
    });
  };

  const goNext = () => {
    if (step === 1 && !name.trim()) { toast.error('Client name is required'); return; }
    if (step === 4) { handleSubmit(); return; }
    setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async () => {
    if (!adminEmail.trim() || !adminPassword.trim() || !adminFirstName.trim()) {
      toast.error('Admin email, name and password are required');
      return;
    }
    setLoading(true);
    try {
      if (existingTenantId) {
        await clientApi.assignAdminToTenant(existingTenantId, {
          email: adminEmail,
          first_name: adminFirstName,
          last_name: adminLastName,
          phone: adminPhone,
          password: adminPassword,
        });
        toast.success(`Admin assigned to "${name}" successfully! 🎉`);
      } else {
        await clientApi.registerClient({
          name,
          subtitle,
          description,
          contact_email: contactEmail,
          plan: plan ?? '',
          business_model: businessModel,
          domain: domain || `${name.toLowerCase().replace(/\s+/g, '-')}.localhost`,
          logo: logoFile,
          ...modules,
          admin: {
            email: adminEmail,
            first_name: adminFirstName,
            last_name: adminLastName,
            phone: adminPhone,
            password: adminPassword,
          },
        });
        toast.success(`Client "${name}" registered successfully! 🎉`);
      }
      navigate('/dashboard/clients');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[] | Record<string, string[]>> } } };
      const msg = e?.response?.data?.message || 'Registration failed. Please try again.';
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const messages: string[] = [];
        const walk = (obj: Record<string, unknown> | string[]): void => {
          if (Array.isArray(obj)) {
            obj.forEach((m) => typeof m === 'string' && messages.push(m));
            return;
          }
          Object.values(obj).forEach((v) => {
            if (Array.isArray(v)) v.forEach((m) => typeof m === 'string' && messages.push(m));
            else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
          });
        };
        walk(errors as Record<string, unknown>);
        if (messages.length) {
          messages.forEach((m) => toast.error(m));
        } else {
          toast.error(msg);
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Render helpers ───────────────────────────────────────────────────── */
  const enabledCount = Object.values(modules).filter(Boolean).length;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <button
          onClick={() => (step > 1 && !existingTenantId ? setStep((s) => (s - 1) as Step) : navigate('/dashboard/clients'))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}
        >
          ← Back
        </button>
        <h1 className="page-title">{existingTenantId ? 'Assign Client Admin' : 'Register New Client'}</h1>
        <p className="page-subtitle">
          {existingTenantId ? 'Add or assign the primary admin for this client. They can log in to the client portal after setup.' : 'Set up a new client tenant — brand, modules, business model, and admin access.'}
        </p>
      </div>

      {/* ─── Step Indicator (hide when assigning admin to existing client) ─────────────────────────────────────────────── */}
      {!existingTenantId && (
      <div style={{ display: 'flex', gap: 0, marginBottom: 40, position: 'relative' }}>
        {STEPS.map((label, i) => {
          const sn = (i + 1) as Step;
          const done = step > sn;
          const active = step === sn;
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: 18, left: '50%', width: '100%', height: 2,
                  background: done ? 'var(--color-primary)' : 'var(--color-border)',
                  transition: 'background 0.3s',
                }} />
              )}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, zIndex: 1,
                background: done ? 'var(--color-primary)' : active ? 'var(--color-primary)' : 'var(--color-border)',
                color: (done || active) ? '#fff' : 'var(--color-text-muted)',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : sn}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: active ? 'var(--color-primary)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      )}

      {/* ─── Step Content ───────────────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="card-body">

          {/* STEP 1: Brand (skip when assigning to existing client) */}
          {!existingTenantId && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>🏢 Client Brand Identity</h2>

              {/* Logo Upload */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div
                  onClick={() => logoRef.current?.click()}
                  style={{
                    width: 100, height: 100, border: '2px dashed var(--color-border)', borderRadius: 12,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg)',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 28 }}>🖼️</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Upload Logo</span>
                    </>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-secondary)' }}>Client Logo</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>PNG, JPG, SVG — recommended 200×200px</span>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: 'fit-content' }} onClick={() => logoRef.current?.click()}>
                    {logoFile ? 'Change Logo' : 'Select File'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Client / Company Name *</label>
                <input className="form-input" placeholder="e.g. Acme Corp" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Subtitle / Tagline</label>
                <input className="form-input" placeholder="e.g. India's fastest growing FMCG brand" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={3} placeholder="Brief about the client's business..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input className="form-input" type="email" placeholder="admin@acmecorp.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Domain / Subdomain</label>
                  <input className="form-input" placeholder="acme.localhost" value={domain} onChange={(e) => setDomain(e.target.value)} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Auto-generated if left blank</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Modules */}
          {!existingTenantId && step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>🧩 Assign Modules</h2>
                <span className="badge badge-primary">{enabledCount} of {MODULE_LIST.length} enabled</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -12 }}>Select which features this client can access. You can change these later.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {MODULE_LIST.map((m) => {
                  const enabled = modules[m.key as keyof typeof modules];
                  return (
                    <div
                      key={m.key}
                      onClick={() => toggleModule(m.key as keyof typeof modules)}
                      style={{
                        border: `2px solid ${enabled ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 10,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        background: enabled ? 'var(--color-primary-light)' : 'var(--color-white)',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 22 }}>{m.icon}</span>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, border: `2px solid ${enabled ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          background: enabled ? 'var(--color-primary)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {enabled && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: enabled ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Business Model & Plan */}
          {!existingTenantId && step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>🎯 Business Model & Plan</h2>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Select Business Flow</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {BUSINESS_MODELS.map((bm) => (
                    <div
                      key={bm.value}
                      onClick={() => setBusinessModel(bm.value)}
                      style={{
                        border: `2px solid ${businessModel === bm.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                        background: businessModel === bm.value ? 'var(--color-primary-light)' : 'var(--color-white)',
                        transition: 'all 0.2s', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{bm.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: businessModel === bm.value ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{bm.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{bm.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Select Plan <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 12 }}>(optional)</span></div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Selecting a plan will auto-fill the module settings above. You can still customise them individually.
                </p>
                {plansLoading ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading plans…</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {/* Skip / No plan */}
                    <div
                      onClick={() => selectPlan(null)}
                      style={{
                        border: `2px solid ${plan === null ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 10, padding: '16px', cursor: 'pointer',
                        background: plan === null ? 'var(--color-primary-light)' : 'var(--color-white)',
                        transition: 'all 0.2s',
                        boxShadow: plan === null ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100,
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🚫</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: plan === null ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>No Plan</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center' }}>Skip — assign modules manually</div>
                    </div>

                    {plans.filter(p => p.is_active).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectPlan(p.slug)}
                        style={{
                          border: `2px solid ${plan === p.slug ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: 10, padding: '16px', cursor: 'pointer',
                          background: plan === p.slug ? 'var(--color-primary-light)' : 'var(--color-white)',
                          transition: 'all 0.2s',
                          boxShadow: plan === p.slug ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 15, color: plan === p.slug ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', margin: '8px 0 10px' }}>
                          ₹{parseFloat(p.price).toLocaleString()}
                          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>/{p.billing_period.replace('_', '-')}</span>
                        </div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {p.features.slice(0, 4).map((f, i) => (
                            <li key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'flex', gap: 6 }}>
                              <span style={{ color: 'var(--color-success)' }}>✓</span> {f}
                            </li>
                          ))}
                          {p.max_users && (
                            <li style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'flex', gap: 6 }}>
                              <span style={{ color: 'var(--color-success)' }}>✓</span> Up to {p.max_users} users
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}

                    {plans.filter(p => p.is_active).length === 0 && (
                      <div style={{ gridColumn: '1/-1', color: 'var(--color-text-muted)', fontSize: 13, padding: '16px 0' }}>
                        No plans created yet. <a href="/dashboard/plans" style={{ color: 'var(--color-primary)' }}>Create a plan →</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Admin User (or only step when existingTenantId) */}
          {(existingTenantId || step === 4) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>👤 Assign Client Admin</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -12 }}>
                This user will be the primary admin for <strong>{name}</strong>. They can log in to the client portal after setup.
              </p>

              {/* Review card */}
              <div style={{ background: 'var(--color-primary-light)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                {logoPreview ? (
                  <img src={logoPreview} alt={name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>
                    {name[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{name || 'Unnamed'}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{subtitle}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span className="badge badge-primary">{plan ? plans.find(p => p.slug === plan)?.name ?? plan.toUpperCase() : 'No Plan'}</span>
                    <span className="badge badge-neutral">{businessModel.toUpperCase()}</span>
                    <span className="badge badge-success">{enabledCount} modules</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-input" placeholder="John" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" placeholder="Doe" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Admin Email *</label>
                <input className="form-input" type="email" placeholder="admin@clientname.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" placeholder="9876543210" maxLength={10} value={adminPhone} onChange={(e) => setAdminPhone(restrictTo10Digits(e.target.value))}  />
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 16 }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>The client admin should change this on first login.</span>
              </div>
            </div>
          )}

          {/* ─── Footer Buttons ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-secondary"
              onClick={() => (step > 1 && !existingTenantId ? setStep((s) => (s - 1) as Step) : navigate('/dashboard/clients'))}
            >
              {existingTenantId || step === 1 ? 'Cancel' : '← Back'}
            </button>
            <button
              className="btn btn-primary"
              onClick={goNext}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" style={{ borderTopColor: '#fff' }} /> {existingTenantId ? 'Assigning…' : 'Registering…'}</>
              ) : existingTenantId || step === 4 ? (
                existingTenantId ? '🚀 Assign Admin' : '🚀 Register Client'
              ) : (
                'Continue →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
