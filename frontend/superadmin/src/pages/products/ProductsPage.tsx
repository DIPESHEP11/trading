import React, { useState, useEffect } from 'react';
import { productsApi } from '@/api/businessApi';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await productsApi.products.list(params);
      setProducts(res.data?.products || []);
    } catch {
      toast.error('Failed to load products.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">Manage your product catalog and SKUs.</p>
          </div>
          <button className="btn btn-primary">+ Add Product</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
        <input type="text" className="form-input" placeholder="Search by name or SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
          style={{ maxWidth: 320 }}
        />
        <button className="btn btn-secondary" onClick={fetchProducts}>Search</button>
      </div>

      {/* Products grid */}
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
                <tr><th>SKU</th><th>Name</th><th>Category</th>
                  <th>Unit</th><th>Price</th><th>Status</th></tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No products found. Add your first product.
                  </td></tr>
                ) : products.map((p) => (
                  <tr key={p.id}>
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
                    <td>{p.unit}</td>
                    <td><strong>₹{parseFloat(p.price).toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
