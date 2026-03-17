import React, { useState, useEffect, useCallback } from 'react';
import { stockApi } from '@/api/businessApi';
import type { Warehouse } from '@/types';
import toast from 'react-hot-toast';

type WarehouseForm = {
  name: string; code: string; warehouse_type: 'our' | 'third_party'; address: string; city: string;
};

const EMPTY_FORM: WarehouseForm = { name: '', code: '', warehouse_type: 'our', address: '', city: '' };

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [form, setForm]             = useState<WarehouseForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  // Deactivate confirm
  const [confirmId, setConfirmId]   = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = showInactive ? { all: 'true' } : {};
    stockApi.warehouses(params)
      .then((r) => setWarehouses(r.data?.warehouses || []))
      .catch(() => toast.error('Failed to load warehouses.'))
      .finally(() => setLoading(false));
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (w: Warehouse) => {
    setEditId(w.id);
    setForm({
      name: w.name,
      code: w.code,
      warehouse_type: (w.warehouse_type as 'our' | 'third_party') || 'our',
      address: w.address || '',
      city: w.city || '',
    });
    setModalOpen(true);
  };

  const copyShareLink = (w: Warehouse) => {
    const path = w.public_view_url || (w.public_access_token ? `/warehouse-view/${w.public_access_token}` : null);
    if (!path) { toast.error('No share link for this warehouse.'); return; }
    const url = `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied! Share with incharge. Stock appears when you transfer products here (Transfers) or add via Stock Levels.', { duration: 5000 });
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error('Name and code are required.'); return; }
    setSaving(true);
    try {
      if (editId) {
        await stockApi.updateWarehouse(editId, form);
        toast.success('Warehouse updated.');
      } else {
        await stockApi.createWarehouse(form);
        toast.success('Warehouse created.');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: Record<string, unknown> } };
      const d = ex?.response?.data;
      const msg = (typeof d?.message === 'string' ? d.message : null)
        ?? (Array.isArray(d?.code) ? d.code[0] : null)
        ?? (typeof d?.code === 'string' ? d.code : null)
        ?? (d && typeof d === 'object' ? (Object.values(d)[0] as string[])?.[0] : null);
      toast.error(msg || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await stockApi.deleteWarehouse(id);
      toast.success('Warehouse deactivated.');
      setConfirmId(null);
      load();
    } catch {
      toast.error('Failed to deactivate warehouse.');
    }
  };

  const filtered = warehouses.filter((w) =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.code.toLowerCase().includes(search.toLowerCase()) ||
    (w.city || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = warehouses.filter((w) => w.is_active).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Manage storage locations and distribution centres.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Warehouse</button>
      </div>

      {/* Compact Stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Warehouses', value: warehouses.length, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'Active',           value: activeCount,       color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Inactive',         value: warehouses.length - activeCount, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
        ].map((s) => (
          <div key={s.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 16px', borderRadius: 10,
            background: s.bg, border: `1.5px solid ${s.border}`,
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.value}</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search warehouses…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260, margin: 0 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)' }} />
          Show inactive
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Warehouse List ({filtered.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
            <div>No warehouses found.</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAdd}>
              + Add First Warehouse
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Code</th><th>Type</th><th>City</th><th>Address</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.code}</td>
                    <td>
                      <span className={`badge ${(w.warehouse_type || 'our') === 'third_party' ? 'badge-info' : 'badge-secondary'}`}>
                        {(w.warehouse_type || 'our') === 'third_party' ? 'Third Party' : 'Our'}
                      </span>
                    </td>
                    <td>{w.city || '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.address || '—'}
                    </td>
                    <td>
                      <span className={`badge ${w.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {w.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>
                        {(w.warehouse_type || 'our') === 'third_party' && (w.public_access_token || w.public_view_url) && (
                          <button className="btn btn-primary btn-sm" onClick={() => copyShareLink(w)} title="Copy share link">
                            📋 Copy Link
                          </button>
                        )}
                        {w.is_active && (
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(w.id)}>
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Popup */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setModalOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{editId ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>✕ Close</button>
            </div>
            <form className="card-body" onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Warehouse Name *</label>
                <input className="form-input" placeholder="e.g. Main Warehouse"
                  value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Warehouse Type</label>
                <select className="form-select" value={form.warehouse_type}
                  onChange={(e) => setForm((p) => ({ ...p, warehouse_type: e.target.value as 'our' | 'third_party' }))}>
                  <option value="our">Our Warehouse</option>
                  <option value="third_party">Third Party</option>
                </select>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Third party = share a link with the incharge to view stock & mark usage.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Warehouse Code *</label>
                <input className="form-input" placeholder="e.g. WH-001"
                  value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} required />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Unique identifier code for this warehouse.</div>
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" placeholder="e.g. Mumbai"
                  value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-input" rows={3} placeholder="Full address…"
                  value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirm Popup */}
      {confirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmId(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Deactivate Warehouse</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmId(null)}>✕</button>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, color: '#475569' }}>
                Are you sure you want to deactivate this warehouse? Existing stock records will be preserved.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDeactivate(confirmId!)}>
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
