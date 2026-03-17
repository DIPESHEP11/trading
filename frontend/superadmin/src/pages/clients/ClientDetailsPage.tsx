import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientApi } from '@/api/clientApi';
import toast from 'react-hot-toast';

export default function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<any>(null);

  // Store editable state
  const [modules, setModules] = useState<any>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    description: '',
    contact_email: '',
    domain: ''
  });

  const MODULE_LIST = [
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

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const res = await clientApi.get(Number(id));
        const data = res.data?.data || res.data || res; // handle different response unwrapping
        setClient(data);
        
        // Initialize module state
        const initialModules: any = {};
        MODULE_LIST.forEach(m => {
          initialModules[m.key] = data[m.key] || false;
        });
        setModules(initialModules);

        // Initialize profile state
        setProfileData({
          description: data.description || '',
          contact_email: data.contact_email || '',
          domain: data.domain || '',
        });
      } catch (error) {
        toast.error('Failed to load client details.');
        navigate('/dashboard/clients');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchClient();
  }, [id, navigate]);

  const toggleModule = (key: string) => {
    setModules((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await clientApi.update(Number(id), modules);
      toast.success('Client modules updated successfully.');
      
      // Update local client state to reflect changes
      setClient((prev: any) => ({ ...prev, ...modules }));
    } catch (error) {
      toast.error('Failed to update client.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await clientApi.update(Number(id), {
        description: profileData.description,
        contact_email: profileData.contact_email,
        update_domain: profileData.domain,
      } as any);
      toast.success('Client profile updated successfully.');
      
      setClient((prev: any) => ({ ...prev, ...profileData }));
      setEditingProfile(false);
    } catch (error) {
      toast.error('Failed to update client profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading details…
      </div>
    );
  }

  if (!client) return null;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate('/dashboard/clients')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}
        >
          ← Back to Clients
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--color-border)' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 }}>
              {client.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{client.name}</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>{client.subtitle || 'No subtitle provided'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span className="badge badge-primary">{client.plan?.toUpperCase()}</span>
              <span className="badge badge-neutral">{client.business_model?.toUpperCase()}</span>
              <span className={`badge ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
                {client.is_active ? 'Active' : 'Suspended'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: '1 1 300px', minWidth: 300 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Client Profile</h2>
            {!editingProfile ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingProfile(true)}>✎ Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-neutral btn-sm" onClick={() => {
                  setEditingProfile(false);
                  setProfileData({
                    description: client.description || '',
                    contact_email: client.contact_email || '',
                    domain: client.domain || '',
                  });
                }} disabled={savingProfile}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={savingProfile}>Save</button>
              </div>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
              {editingProfile ? (
                <textarea className="form-textarea" rows={3} value={profileData.description} onChange={e => setProfileData({...profileData, description: e.target.value})} />
              ) : (
                <div style={{ fontSize: 14 }}>{client.description || 'No description provided.'}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Contact Email</div>
              {editingProfile ? (
                <input className="form-input" type="email" value={profileData.contact_email} onChange={e => setProfileData({...profileData, contact_email: e.target.value})} />
              ) : (
                <div style={{ fontSize: 14 }}>{client.contact_email || 'Not provided'}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Primary Domain</div>
              {editingProfile ? (
                <input className="form-input" value={profileData.domain} onChange={e => setProfileData({...profileData, domain: e.target.value})} />
              ) : (
                <div style={{ fontSize: 14 }}>{client.domain || `${client.slug}.localhost`}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Registered On</div>
              <div style={{ fontSize: 14 }}>{client.created_on ? new Date(client.created_on).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: '2 1 600px', minWidth: 320 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Assigned Modules</h2>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
              Click on a module to toggle its access for this client. Changes will only apply after saving.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {MODULE_LIST.map((m) => {
                const enabled = modules[m.key];
                return (
                  <div
                    key={m.key}
                    onClick={() => toggleModule(m.key)}
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
        </div>
      </div>
    </div>
  );
}
