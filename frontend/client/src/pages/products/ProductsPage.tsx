import React, { useState, useEffect } from 'react';
import { productsApi } from '@/api/businessApi';
import type { Product, Category } from '@/types';
import toast from 'react-hot-toast';

const UNIT_OPTIONS = ['piece', 'box', 'kg', 'litre', 'metre', 'dozen', 'pair', 'set'];

const EMPTY_PRODUCT_FORM = {
  sku: '',
  name: '',
  description: '',
  category: '' as string | number,
  unit: 'piece',
  price: '',
  cost_price: '',
  tax_percent: '',
  low_stock_threshold: '10',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsPage() {
  // Products list
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);

  // View popup
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // ─── Add / Edit product modal ──────────────────────────────────────────────
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ ...EMPTY_PRODUCT_FORM });
  const [customData, setCustomData] = useState<Record<string, string>>({});

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchProducts(); }, [categoryFilter]);

  const fetchCategories = async () => {
    try {
      const res = await productsApi.categories.list();
      setCategories(res.data?.categories || []);
    } catch {
      toast.error('Failed to load categories.');
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const res = await productsApi.products.list(params);
      setProducts(res.data?.products || []);
    } catch {
      toast.error('Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getCategoryById = (id: number | string | null) =>
    categories.find((c) => c.id === Number(id)) ?? null;

  const selectedCategory = getCategoryById(productForm.category);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_PRODUCT_FORM });
    setCustomData({});
    setProductModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category ?? '',
      unit: p.unit,
      price: p.price,
      cost_price: p.cost_price,
      tax_percent: p.tax_percent,
      low_stock_threshold: String(p.low_stock_threshold),
    });
    setCustomData(p.custom_data ?? {});
    setProductModalOpen(true);
  };

  const handleCategoryChange = (catId: string) => {
    setProductForm((f) => ({ ...f, category: catId }));
    const cat = getCategoryById(catId);
    if (cat?.custom_fields?.length) {
      const newData: Record<string, string> = {};
      cat.custom_fields.forEach((f) => { newData[f.key] = ''; });
      setCustomData(newData);
    } else {
      setCustomData({});
    }
  };

  // ─── Product CRUD ──────────────────────────────────────────────────────────
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.sku.trim() || !productForm.name.trim()) {
      toast.error('SKU and Name are required.');
      return;
    }
    setProductSaving(true);
    try {
      const payload = {
        sku: productForm.sku.trim(),
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        category: productForm.category || null,
        unit: productForm.unit,
        price: productForm.price || '0',
        cost_price: productForm.cost_price || '0',
        tax_percent: productForm.tax_percent || '0',
        low_stock_threshold: Number(productForm.low_stock_threshold) || 10,
        custom_data: Object.keys(customData).length ? customData : {},
      };
      if (editingProduct) {
        await productsApi.products.update(editingProduct.id, payload);
        toast.success('Product updated.');
      } else {
        await productsApi.products.create(payload);
        toast.success('Product added.');
      }
      setProductModalOpen(false);
      fetchProducts();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to save product.');
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeactivateProduct = async (p: Product) => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    try {
      await productsApi.products.delete(p.id);
      toast.success('Product deactivated.');
      fetchProducts();
    } catch {
      toast.error('Failed to deactivate product.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">Manage your product catalog and SKUs.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={openAddProduct}>+ Add Product</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text" className="form-input" placeholder="Search by name or SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
          style={{ maxWidth: 280 }}
        />
        <select
          className="form-select" value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={fetchProducts}>Search</button>
      </div>

      {/* Products table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">All Products ({products.length})</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th><th>Name</th><th>Category</th>
                  <th>Price</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                      No products found.
                    </td>
                  </tr>
                ) : products.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewProduct(p)}
                  >
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{p.sku}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {p.description.substring(0, 50)}{p.description.length > 50 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>{p.category_name || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                    <td><strong>₹{parseFloat(p.price).toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditProduct(p)}
                        >Edit</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivateProduct(p)}
                        >Deactivate</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── View product popup ─────────────────────────────────────────────── */}
      {viewProduct && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setViewProduct(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Product details</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewProduct(null)}>Close</button>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>SKU</span><br /><strong style={{ fontFamily: 'monospace' }}>{viewProduct.sku}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Status</span><br /><span className={`badge ${viewProduct.is_active ? 'badge-success' : 'badge-danger'}`}>{viewProduct.is_active ? 'Active' : 'Inactive'}</span></div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Name</span><br /><strong>{viewProduct.name}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Category</span><br />{viewProduct.category_name || '—'}</div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Unit</span><br />{viewProduct.unit}</div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Low stock at</span><br />{viewProduct.low_stock_threshold}</div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Price</span><br /><strong>₹{parseFloat(viewProduct.price).toLocaleString()}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Cost price</span><br />₹{parseFloat(viewProduct.cost_price).toLocaleString()}</div>
                  <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tax %</span><br />{viewProduct.tax_percent}%</div>
                </div>
                {viewProduct.description && (
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Description</span>
                    <p style={{ margin: '4px 0 0' }}>{viewProduct.description}</p>
                  </div>
                )}

                {/* Category custom fields */}
                {viewProduct.custom_data && Object.keys(viewProduct.custom_data).length > 0 && (() => {
                  const cat = getCategoryById(viewProduct.category);
                  const fieldMap: Record<string, string> = {};
                  cat?.custom_fields?.forEach((f) => { fieldMap[f.key] = f.label; });
                  return (
                    <>
                      <hr style={{ margin: '8px 0' }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {cat ? cat.name : 'Category'} details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {Object.entries(viewProduct.custom_data).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              {fieldMap[k] || k.replace(/_/g, ' ')}
                            </span>
                            <br />
                            {String(v) || '—'}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setViewProduct(null); openEditProduct(viewProduct); }}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setViewProduct(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add / Edit product modal ────────────────────────────────────────── */}
      {productModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => !productSaving && setProductModalOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">{editingProduct ? 'Edit product' : 'Add product'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !productSaving && setProductModalOpen(false)}>Close</button>
            </div>
            <form className="card-body" onSubmit={handleProductSubmit}>

              {/* Standard fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input
                    className="form-input"
                    value={productForm.sku}
                    onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                    required placeholder="e.g. DRESS-001"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={String(productForm.category)}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">— No category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  className="form-input"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  required placeholder="Product name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea" rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={productForm.unit} onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}>
                    {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input className="form-input" type="number" min="0" step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost price (₹)</label>
                  <input className="form-input" type="number" min="0" step="0.01"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm((f) => ({ ...f, cost_price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax %</label>
                  <input className="form-input" type="number" min="0" max="100" step="0.01"
                    value={productForm.tax_percent}
                    onChange={(e) => setProductForm((f) => ({ ...f, tax_percent: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Low stock threshold</label>
                  <input className="form-input" type="number" min="0"
                    value={productForm.low_stock_threshold}
                    onChange={(e) => setProductForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                  />
                </div>
              </div>

              {/* Dynamic category custom fields */}
              {selectedCategory && selectedCategory.custom_fields?.length > 0 && (
                <>
                  <div style={{
                    margin: '16px 0 12px',
                    padding: '10px 14px',
                    background: 'var(--color-bg-secondary, #f5f5f5)',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.03em',
                  }}>
                    {selectedCategory.name} — specific details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[...selectedCategory.custom_fields]
                      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                      .map((f) => (
                        <div
                          key={f.key}
                          className="form-group"
                          style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}
                        >
                          <label className="form-label">{f.label}{f.required && ' *'}</label>
                          {f.type === 'textarea' ? (
                            <textarea
                              className="form-textarea" rows={2}
                              value={customData[f.key] ?? ''}
                              onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: e.target.value }))}
                              required={f.required}
                            />
                          ) : f.type === 'select' ? (
                            <select
                              className="form-select"
                              value={customData[f.key] ?? ''}
                              onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: e.target.value }))}
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
                              value={customData[f.key] ?? ''}
                              onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: e.target.value }))}
                              required={f.required}
                              placeholder={f.label}
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={productSaving}>
                  {productSaving ? 'Saving...' : editingProduct ? 'Save changes' : 'Add product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
