import React, { useState, useEffect } from 'react';
import { productsApi } from '@/api/businessApi';
import type { Category, LeadFormField } from '@/types';
import toast from 'react-hot-toast';

const FIELD_TYPES: { value: LeadFormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

type Tab = 'categories';

export default function ProductSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  // ── Categories ──
  const [categories, setCategories]   = useState<Category[]>([]);
  const [catLoading, setCatLoading]   = useState(true);
  const [catForm, setCatForm]         = useState({ name: '', description: '' });
  const [catFields, setCatFields]     = useState<LeadFormField[]>([]);
  const [catSaving, setCatSaving]     = useState(false);
  const [editingCat, setEditingCat]   = useState<Category | null>(null);
  const [catFormOpen, setCatFormOpen] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const res = await productsApi.categories.list();
      setCategories(res.data?.categories || []);
    } catch { toast.error('Failed to load categories.'); }
    finally { setCatLoading(false); }
  };

  // ── Category helpers ──
  const openAddCategory = () => {
    setEditingCat(null);
    setCatForm({ name: '', description: '' });
    setCatFields([]);
    setCatFormOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, description: cat.description });
    setCatFields(cat.custom_fields ? [...cat.custom_fields] : []);
    setCatFormOpen(true);
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('Category name is required.'); return; }
    setCatSaving(true);
    try {
      const payload = { name: catForm.name.trim(), description: catForm.description.trim(), custom_fields: catFields };
      if (editingCat) {
        await productsApi.categories.update(editingCat.id, payload);
        toast.success('Category updated.');
      } else {
        await productsApi.categories.create(payload);
        toast.success('Category created.');
      }
      setCatFormOpen(false);
      loadCategories();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to save category.');
    } finally { setCatSaving(false); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"? Products in this category will not be deleted.`)) return;
    try {
      await productsApi.categories.delete(cat.id);
      toast.success('Category deleted.');
      loadCategories();
    } catch { toast.error('Failed to delete category.'); }
  };

  // ── Field builder helpers ──
  const addCatField = () => {
    setCatFields((prev) => [
      ...prev,
      { key: `field_${Date.now()}`, label: 'New field', type: 'text', required: false, order: prev.length },
    ]);
  };
  const updateCatField = (idx: number, updates: Partial<LeadFormField>) =>
    setCatFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  const removeCatField = (idx: number) =>
    setCatFields((prev) => prev.filter((_, i) => i !== idx));

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'categories', label: 'Categories', icon: '📂' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Product Settings</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Manage product categories and their custom fields.
        </p>
      </div>

      {/* Tab bar */}
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

      {/* ═══ TAB: Categories ═══ */}
      {activeTab === 'categories' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Categories</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Each category can have its own custom fields. Products inherit these fields when assigned to a category.
              </p>
            </div>
            {!catFormOpen && (
              <button className="btn btn-primary btn-sm" onClick={openAddCategory}>+ New Category</button>
            )}
          </div>
          <div className="card-body">

            {/* Category list */}
            {!catFormOpen && (
              <>
                {catLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                ) : categories.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                    <div style={{ fontSize: 14 }}>No categories yet. Create your first category to get started.</div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    {categories.map((cat, i) => (
                      <div key={cat.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        borderBottom: i < categories.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: '#fff',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{cat.name}</div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                            {cat.description && (
                              <span style={{ fontSize: 12, color: '#64748b' }}>{cat.description}</span>
                            )}
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>
                              {cat.custom_fields?.length ?? 0} custom field{(cat.custom_fields?.length ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {cat.custom_fields && cat.custom_fields.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {cat.custom_fields.map((f) => (
                                <span key={f.key} style={{
                                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                                  background: '#eff6ff', color: '#3b82f6', fontWeight: 500,
                                }}>
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditCategory(cat)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(cat)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Category add/edit form */}
            {catFormOpen && (
              <form onSubmit={handleCatSubmit}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}
                  onClick={() => setCatFormOpen(false)}>
                  ← Back to list
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Category name *</label>
                    <input className="form-input" value={catForm.name}
                      onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                      required placeholder="e.g. Dress, Book, Electronics" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={catForm.description}
                      onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Optional" />
                  </div>
                </div>

                {/* Custom fields builder */}
                <div style={{ marginBottom: 8, marginTop: 16, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                  Custom Fields
                </div>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                  Define extra fields that every product in this category must fill in (e.g. Size, Color, Author, ISBN).
                </p>

                {catFields.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                    No custom fields yet. Add fields to capture category-specific product details.
                  </div>
                )}

                {catFields.map((f, idx) => (
                  <div key={idx} style={{
                    display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center',
                    padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 16 }}>⠿</div>
                    <input className="form-input" placeholder="Key (e.g. size)" value={f.key}
                      onChange={(e) => updateCatField(idx, { key: e.target.value })}
                      style={{ width: 130, margin: 0 }} />
                    <input className="form-input" placeholder="Label" value={f.label}
                      onChange={(e) => updateCatField(idx, { label: e.target.value })}
                      style={{ width: 130, margin: 0 }} />
                    <select className="form-select" value={f.type}
                      onChange={(e) => updateCatField(idx, { type: e.target.value as LeadFormField['type'] })}
                      style={{ width: 120, margin: 0 }}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {f.type === 'select' && (
                      <input className="form-input" placeholder="Options (comma-separated)"
                        value={(f.options || []).join(', ')}
                        onChange={(e) => updateCatField(idx, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                        style={{ width: 180, margin: 0 }} />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={f.required ?? false}
                        onChange={(e) => updateCatField(idx, { required: e.target.checked })}
                        style={{ accentColor: '#3b82f6' }} />
                      Required
                    </label>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCatField(idx)}>✕</button>
                  </div>
                ))}

                <button type="button" className="btn btn-secondary btn-sm" onClick={addCatField} style={{ marginTop: 4, marginBottom: 20 }}>
                  + Add Field
                </button>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCatFormOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={catSaving}>
                    {catSaving ? 'Saving…' : editingCat ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
