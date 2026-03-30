import React, { useState, useEffect } from 'react';
import { invoicesApi } from '@/api/businessApi';
import { restrictTo10Digits } from '@/utils/phone';
import LeadDetailsCard from '@/components/LeadDetailsCard';
import toast from 'react-hot-toast';

interface IStatus { id: number; key: string; label: string; color: string; order: number; is_active: boolean }
interface IndianState { code: string; name: string }
interface GSTSlab { rate: number; label: string }
interface InvoiceRow {
  id: number; invoice_number: string; invoice_type: string; supply_type: string;
  order_number: string | null; status: string; is_gst: boolean;
  recipient_name: string; recipient_gstin: string;
  grand_total: string; total_amount: string; due_date: string | null;
  paid_at: string | null; created_at: string;
}
interface LineItemForm {
  description: string; hsn_sac: string; quantity: string; unit: string;
  rate: string; discount_amount: string; tax_rate: string;
}

const emptyItem: LineItemForm = {
  description: '', hsn_sac: '', quantity: '1', unit: 'NOS', rate: '0',
  discount_amount: '0', tax_rate: '18',
};

type MainTab = 'invoices' | 'from_orders';

interface PendingOrder {
  id: number; order_number: string; source: string; status: string;
  customer_name?: string; shipping_name?: string; total_amount: string;
  items?: { product_name: string; quantity: number; unit_price: string }[];
  shipping_phone?: string; shipping_address?: string; shipping_city?: string;
  shipping_state?: string; shipping_pincode?: string; notes?: string;
  lead_details?: any; created_at: string;
}

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('invoices');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ordersPending, setOrdersPending] = useState<PendingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [selectedOrderForCreate, setSelectedOrderForCreate] = useState<string>('');
  const [creatingFromOrder, setCreatingFromOrder] = useState(false);
  const [statuses, setStatuses] = useState<IStatus[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
  const [slabs, setSlabs] = useState<GSTSlab[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Create / Edit form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [form, setForm] = useState({
    invoice_type: 'bill_of_supply' as string,
    is_gst: false,
    supply_type: 'b2b',
    supplier_name: '', supplier_address: '', supplier_city: '',
    supplier_state: '', supplier_pincode: '', supplier_gstin: '',
    supplier_phone: '', supplier_email: '',
    recipient_name: '', recipient_address: '', recipient_city: '',
    recipient_state: '', recipient_pincode: '', recipient_gstin: '',
    recipient_phone: '', recipient_email: '',
    place_of_supply: '', is_reverse_charge: false, notes: '',
  });
  const [showSupplierEdit, setShowSupplierEdit] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...emptyItem }]);

  useEffect(() => {
    invoicesApi.statuses.list().then((r) => setStatuses(r.data?.statuses || [])).catch(() => {});
    invoicesApi.ref.states().then((r) => setStates(r.data?.states || [])).catch(() => {});
    invoicesApi.ref.gstSlabs().then((r) => setSlabs(r.data?.slabs || [])).catch(() => {});
    invoicesApi.settings.get().then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchInvoices(); }, [statusFilter, typeFilter]);

  const fetchOrdersPending = async () => {
    setOrdersLoading(true);
    try {
      const res = await invoicesApi.ordersPending();
      // API returns { success, message, data: { orders, count } }
      const orders = (res?.data?.orders ?? res?.orders ?? []) as PendingOrder[];
      setOrdersPending(Array.isArray(orders) ? orders : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load orders pending invoice.';
      toast.error(msg);
      setOrdersPending([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'from_orders') fetchOrdersPending();
  }, [activeTab]);

  const handleCreateFromOrder = async (orderId: number, invoiceType: 'proforma' | 'tax_invoice' | 'bill_of_supply') => {
    setCreatingFromOrder(true);
    try {
      const res = await invoicesApi.createFromOrder(orderId, invoiceType);
      const inv = (res?.data ?? res) as { id?: number; invoice_number?: string; invoice_type?: string } | null;
      toast.success(invoiceType === 'proforma' ? 'Proforma created!' : 'Invoice created!');
      setSelectedOrder(null);
      fetchOrdersPending();
      fetchInvoices();
      setActiveTab('invoices');
      if (inv?.id) openEdit(inv.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invoice.');
    } finally {
      setCreatingFromOrder(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await invoicesApi.list(params);
      setInvoices(res.data?.invoices || []);
      setStats(res.data?.stats || {});
    } catch { toast.error('Failed to load invoices.'); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await invoicesApi.update(id, { status: newStatus });
      toast.success('Status updated.');
      if (res.data?.flow_result?.message) toast(res.data.flow_result.message, { icon: '🔀' });
      fetchInvoices();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed.'); }
  };

  const handleConvert = async (id: number) => {
    try {
      await invoicesApi.convert(id);
      toast.success('Proforma converted to invoice!');
      fetchInvoices();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Conversion failed.'); }
  };

  const handleDownloadPdf = async (id: number, invNumber: string) => {
    try {
      const res = await invoicesApi.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded!');
    } catch { toast.error('Failed to download PDF.'); }
  };

  const openEdit = async (id: number) => {
    try {
      const res = await invoicesApi.get(id) as { data?: any };
      const inv = res?.data ?? res;
      if (!inv) { toast.error('Invoice not found.'); return; }
      setEditingInvoice(inv);
      setEditingId(id);
      setForm({
        invoice_type: inv.invoice_type || 'bill_of_supply',
        is_gst: !!inv.is_gst,
        supply_type: inv.supply_type || 'b2b',
        supplier_name: inv.supplier_name || '',
        supplier_address: inv.supplier_address || '',
        supplier_city: inv.supplier_city || '',
        supplier_state: inv.supplier_state || '',
        supplier_pincode: inv.supplier_pincode || '',
        supplier_gstin: inv.supplier_gstin || '',
        supplier_phone: inv.supplier_phone || '',
        supplier_email: inv.supplier_email || '',
        recipient_name: inv.recipient_name || '',
        recipient_address: inv.recipient_address || '',
        recipient_city: inv.recipient_city || '',
        recipient_state: inv.recipient_state || '',
        recipient_pincode: inv.recipient_pincode || '',
        recipient_gstin: inv.recipient_gstin || '',
        recipient_phone: inv.recipient_phone || '',
        recipient_email: inv.recipient_email || '',
        place_of_supply: inv.place_of_supply || '',
        is_reverse_charge: !!inv.is_reverse_charge,
        notes: inv.notes || '',
      });
      const items = (inv.line_items || []).map((it: any) => ({
        description: it.description || '',
        hsn_sac: (it.hsn_sac ?? it.hsn_sac_code ?? '') || '',
        quantity: String(it.quantity ?? 1),
        unit: it.unit || 'NOS',
        rate: String(it.rate ?? 0),
        discount_amount: String(it.discount_amount ?? 0),
        tax_rate: String(it.tax_rate ?? 18),
      }));
      setLineItems(items.length ? items : [{ ...emptyItem }]);
      setShowSupplierEdit(false);
      setShowCreate(true);
    } catch {
      toast.error('Failed to load invoice.');
    }
  };

  const handleUpdate = async () => {
    if (editingId == null) return;
    if (!form.recipient_name.trim()) { toast.error('Recipient name is required.'); return; }
    if (lineItems.length === 0 || !lineItems[0].description.trim()) { toast.error('Add at least one line item.'); return; }
    setCreating(true);
    try {
      const payload = {
        invoice_type: form.invoice_type,
        is_gst: form.is_gst,
        supply_type: form.supply_type,
        supplier_name: form.supplier_name,
        supplier_address: form.supplier_address,
        supplier_city: form.supplier_city,
        supplier_state: form.supplier_state,
        supplier_pincode: form.supplier_pincode,
        supplier_gstin: form.supplier_gstin,
        supplier_phone: form.supplier_phone,
        supplier_email: form.supplier_email,
        recipient_name: form.recipient_name,
        recipient_address: form.recipient_address,
        recipient_city: form.recipient_city,
        recipient_state: form.recipient_state,
        recipient_pincode: form.recipient_pincode,
        recipient_gstin: form.recipient_gstin,
        recipient_phone: form.recipient_phone,
        recipient_email: form.recipient_email,
        place_of_supply: form.place_of_supply,
        is_reverse_charge: form.is_reverse_charge,
        notes: form.notes,
      };
      await invoicesApi.update(editingId, payload);
      const existingIds = (editingInvoice?.line_items || []).map((it: any) => it.id).filter(Boolean);
      for (const itemId of existingIds) {
        await invoicesApi.items.delete(editingId, itemId);
      }
      for (const it of lineItems) {
        await invoicesApi.items.add(editingId, {
          description: it.description,
          hsn_sac: it.hsn_sac,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit,
          rate: parseFloat(it.rate) || 0,
          discount_amount: parseFloat(it.discount_amount) || 0,
          tax_rate: parseFloat(it.tax_rate) || 0,
        });
      }
      toast.success('Invoice updated.');
      setShowCreate(false);
      setEditingId(null);
      setEditingInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update invoice.');
    } finally {
      setCreating(false);
    }
  };

  const isGST = settings?.tax_type === 'indian_gst';

  const openCreate = (type: string) => {
    const gstDefault = settings?.tax_type === 'indian_gst';
    const isProforma = type === 'proforma';
    const invoiceType = isProforma ? 'proforma'
      : gstDefault ? 'tax_invoice' : 'bill_of_supply';

    setForm({
      invoice_type: invoiceType,
      is_gst: gstDefault,
      supply_type: 'b2b',
      supplier_name: settings?.supplier_name || '',
      supplier_address: settings?.supplier_address || '',
      supplier_city: settings?.supplier_city || '',
      supplier_state: settings?.supplier_state || '',
      supplier_pincode: settings?.supplier_pincode || '',
      supplier_gstin: settings?.supplier_gstin || '',
      supplier_phone: settings?.supplier_phone || '',
      supplier_email: settings?.supplier_email || '',
      recipient_name: '', recipient_address: '', recipient_city: '',
      recipient_state: '', recipient_pincode: '', recipient_gstin: '',
      recipient_phone: '', recipient_email: '',
      place_of_supply: '', is_reverse_charge: false, notes: '',
    });
    setShowSupplierEdit(false);
    setLineItems([{ ...emptyItem, tax_rate: settings?.default_tax_rate || '18' }]);
    setSelectedOrderForCreate('');
    if (!ordersPending.length) fetchOrdersPending();
    setShowCreate(true);
  };

  const applyOrderToCreateForm = (ord: PendingOrder) => {
    setForm((prev) => ({
      ...prev,
      recipient_name: ord.customer_name || ord.shipping_name || '',
      recipient_phone: ord.shipping_phone || '',
      recipient_address: ord.shipping_address || '',
      recipient_city: ord.shipping_city || '',
      recipient_state: ord.shipping_state || '',
      recipient_pincode: ord.shipping_pincode || '',
      place_of_supply: ord.shipping_state || '',
      notes: ord.notes || prev.notes || '',
    }));
    const mappedItems = (ord.items || []).map((it) => ({
      description: it.product_name || '',
      hsn_sac: '',
      quantity: String(it.quantity || 1),
      unit: 'NOS',
      rate: String(it.unit_price || '0'),
      discount_amount: '0',
      tax_rate: String(settings?.default_tax_rate || '18'),
    }));
    if (mappedItems.length) setLineItems(mappedItems);
  };

  const updForm = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const addItem = () => setLineItems((p) => [...p, { ...emptyItem, tax_rate: settings?.default_tax_rate || '18' }]);
  const removeItem = (i: number) => setLineItems((p) => p.filter((_, idx) => idx !== i));
  const updItem = (i: number, k: string, v: string) =>
    setLineItems((p) => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const handleCreate = async () => {
    if (!form.recipient_name.trim()) { toast.error('Recipient name is required.'); return; }
    if (lineItems.length === 0 || !lineItems[0].description.trim()) { toast.error('Add at least one line item.'); return; }
    setCreating(true);
    try {
      const payload = {
        ...form,
        order: selectedOrderForCreate ? parseInt(selectedOrderForCreate, 10) : undefined,
        line_items: lineItems.map((it) => ({
          description: it.description,
          hsn_sac: it.hsn_sac,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit,
          rate: parseFloat(it.rate) || 0,
          discount_amount: parseFloat(it.discount_amount) || 0,
          tax_rate: parseFloat(it.tax_rate) || 0,
        })),
      };
      await invoicesApi.create(payload);
      toast.success(form.invoice_type === 'proforma' ? 'Proforma invoice created!' : 'Invoice created!');
      setShowCreate(false);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invoice.');
    } finally { setCreating(false); }
  };

  const getStatusColor = (key: string) => statuses.find((s) => s.key === key)?.color || '#64748b';
  const getStatusLabel = (key: string) => statuses.find((s) => s.key === key)?.label || key;
  const activeStatuses = statuses.filter((s) => s.is_active);
  const topStatuses = activeStatuses.slice(0, 5);

  const getStateName = (code: string) => states.find((s) => s.code === code)?.name || code;

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      tax_invoice: 'Tax Invoice', bill_of_supply: 'Bill of Supply',
      proforma: 'Proforma', cash_memo: 'Cash Memo',
    };
    return map[t] || t;
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">
            {isGST ? 'GST-compliant Tax Invoices & Proforma' : 'Bills of Supply, Cash Memos & Proforma'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"
            onClick={() => openCreate('proforma')}>+ Proforma</button>
          <button className="btn btn-primary btn-sm"
            onClick={() => openCreate('invoice')}>
            + Invoice
          </button>
        </div>
      </div>

      {/* Tab bar: Invoices | From Orders */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button
          className={`btn btn-sm ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('invoices')}>
          Invoices
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'from_orders' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('from_orders')}>
          From Orders
        </button>
      </div>

      {/* Invoices tab content */}
      {activeTab === 'invoices' && (
      <>
      {/* Status cards — compact */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {topStatuses.map((s) => (
          <div key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
            style={{
              cursor: 'pointer', padding: '8px 16px', borderRadius: 10,
              borderLeft: `3px solid ${s.color}`,
              border: statusFilter === s.key ? `2px solid ${s.color}` : `1px solid var(--color-border)`,
              background: statusFilter === s.key ? `${s.color}10` : '#fff',
              display: 'flex', alignItems: 'center', gap: 10, minWidth: 100,
            }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{stats[s.key] ?? 0}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">All Statuses</option>
            {activeStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className="form-select" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">All Types</option>
            <option value="tax_invoice">Tax Invoice</option>
            <option value="bill_of_supply">Bill of Supply</option>
            <option value="proforma">Proforma</option>
            <option value="cash_memo">Cash Memo</option>
          </select>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Invoices ({invoices.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Type</th><th>Recipient</th>
                  {isGST && <th>GSTIN</th>}
                  <th>Amount</th><th>Status</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={isGST ? 8 : 7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No invoices found.
                  </td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoice_number}</strong>
                      {inv.order_number && <div style={{ fontSize: 11, color: '#94a3b8' }}>Order: {inv.order_number}</div>}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 500,
                        background: inv.invoice_type === 'proforma' ? '#f3e8ff' : inv.invoice_type === 'tax_invoice' ? '#dbeafe' : '#f1f5f9',
                        color: inv.invoice_type === 'proforma' ? '#7c3aed' : inv.invoice_type === 'tax_invoice' ? '#1d4ed8' : '#475569',
                      }}>
                        {typeLabel(inv.invoice_type)}
                      </span>
                    </td>
                    <td>{inv.recipient_name || '—'}</td>
                    {isGST && <td style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{inv.recipient_gstin || '—'}</td>}
                    <td><strong>₹{parseFloat(inv.grand_total || inv.total_amount).toLocaleString()}</strong></td>
                    <td>
                      <select value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: '1px solid #e2e8f0', cursor: 'pointer',
                          color: getStatusColor(inv.status), background: `${getStatusColor(inv.status)}15`,
                        }}>
                        {activeStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => openEdit(inv.id)}
                          title="Edit invoice">Edit</button>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          title="Download PDF">PDF</button>
                        {inv.invoice_type === 'proforma' && inv.status === 'proforma' && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => handleConvert(inv.id)}>Convert</button>
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

      {/* ═══ Create Invoice Modal ═══ */}
      {showCreate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 16px',
        }} onClick={() => { setShowCreate(false); setEditingId(null); setEditingInvoice(null); }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 28, width: '100%',
              maxWidth: 800, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              {editingId != null ? 'Edit Invoice' : form.invoice_type === 'proforma' ? 'New Proforma Invoice' :
                form.is_gst ? 'New Tax Invoice' : 'New Invoice (Bill of Supply)'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              {editingId != null
                ? `Editing ${editingInvoice?.invoice_number ?? ''}.`
                : form.is_gst ? 'GST-compliant invoice with CGST/SGST or IGST calculation.' : 'Non-taxable bill of supply.'}
            </p>

            {editingInvoice?.lead_details && (
              <div style={{ marginBottom: 18 }}>
                <LeadDetailsCard lead={editingInvoice.lead_details} compact />
              </div>
            )}

            {editingId == null && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  Create from Order (optional)
                </label>
                <select
                  className="form-select"
                  value={selectedOrderForCreate}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedOrderForCreate(id);
                    if (!id) return;
                    const ord = ordersPending.find((o) => o.id === parseInt(id, 10));
                    if (ord) applyOrderToCreateForm(ord);
                  }}
                >
                  <option value="">Select pending order…</option>
                  {ordersPending.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_number} — {ord.customer_name || ord.shipping_name || 'Customer'} — ₹{parseFloat(ord.total_amount || '0').toLocaleString()}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                  Selecting an order auto-fills recipient details and line items.
                </p>
              </div>
            )}

            {/* GST Toggle + Supply Type */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
              padding: '10px 16px', background: form.is_gst ? '#eff6ff' : '#f8fafc',
              borderRadius: 10, border: `1.5px solid ${form.is_gst ? '#bfdbfe' : '#e2e8f0'}`,
              transition: 'all .2s',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={form.is_gst}
                  onChange={(e) => {
                    const gst = e.target.checked;
                    updForm('is_gst', gst);
                    if (form.invoice_type !== 'proforma') {
                      updForm('invoice_type', gst ? 'tax_invoice' : 'bill_of_supply');
                    }
                  }}
                  style={{ accentColor: '#3b82f6', width: 16, height: 16 }} />
                <span style={{ color: form.is_gst ? '#1d4ed8' : '#475569' }}>
                  GST Invoice {form.is_gst ? '(Tax Invoice)' : '(No Tax)'}
                </span>
              </label>

              {form.is_gst && (
                <>
                  <div style={{ width: 1, height: 24, background: '#cbd5e1' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ val: 'b2b', label: 'B2B' }, { val: 'b2c', label: 'B2C' }].map((o) => (
                      <button key={o.val} className={`btn btn-sm ${form.supply_type === o.val ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, padding: '3px 12px' }}
                        onClick={() => updForm('supply_type', o.val)}>{o.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Supplier / From — auto-filled, collapsible edit */}
            <div style={{
              marginBottom: 18, padding: '12px 16px', background: '#f8fafc', borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#1e293b' }}>From (Supplier)</h4>
                  {!showSupplierEdit && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                      {form.supplier_name && <span style={{ fontWeight: 600 }}>{form.supplier_name}</span>}
                      {form.supplier_name && (form.supplier_city || form.supplier_state) && ' — '}
                      {[form.supplier_city, states.find(s => s.code === form.supplier_state)?.name].filter(Boolean).join(', ')}
                      {form.is_gst && form.supplier_gstin && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'monospace', color: '#3b82f6' }}>
                          GSTIN: {form.supplier_gstin}
                        </span>
                      )}
                      {!form.supplier_name && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not configured — set in Invoice Settings</span>}
                    </div>
                  )}
                </div>
                <button className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => setShowSupplierEdit(!showSupplierEdit)}>
                  {showSupplierEdit ? 'Collapse' : 'Edit'}
                </button>
              </div>

              {showSupplierEdit && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Company Name</label>
                      <input className="form-input" value={form.supplier_name}
                        onChange={(e) => updForm('supplier_name', e.target.value)}
                        style={{ margin: 0, fontSize: 12 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Phone</label>
                      <input className="form-input" type="tel" value={form.supplier_phone}
                        onChange={(e) => updForm('supplier_phone', restrictTo10Digits(e.target.value))}
                        placeholder="9876543210" maxLength={10}
                        style={{ margin: 0, fontSize: 12 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Email</label>
                      <input className="form-input" value={form.supplier_email}
                        onChange={(e) => updForm('supplier_email', e.target.value)}
                        style={{ margin: 0, fontSize: 12 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>City</label>
                      <input className="form-input" value={form.supplier_city}
                        onChange={(e) => updForm('supplier_city', e.target.value)}
                        style={{ margin: 0, fontSize: 12 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>State</label>
                      <select className="form-select" value={form.supplier_state}
                        onChange={(e) => updForm('supplier_state', e.target.value)}
                        style={{ margin: 0, fontSize: 12 }}>
                        <option value="">Select…</option>
                        {states.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Pincode</label>
                      <input className="form-input" value={form.supplier_pincode}
                        onChange={(e) => updForm('supplier_pincode', e.target.value)}
                        style={{ margin: 0, fontSize: 12 }} />
                    </div>
                    {form.is_gst && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>GSTIN</label>
                        <input className="form-input" maxLength={15} value={form.supplier_gstin}
                          onChange={(e) => updForm('supplier_gstin', e.target.value.toUpperCase())}
                          style={{ margin: 0, fontSize: 12 }} placeholder="15-char GSTIN" />
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, marginTop: 10 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Address</label>
                    <textarea className="form-input" rows={2} value={form.supplier_address}
                      onChange={(e) => updForm('supplier_address', e.target.value)}
                      style={{ margin: 0, resize: 'vertical', fontSize: 12 }} />
                  </div>
                </div>
              )}
            </div>

            {/* Recipient */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>Recipient (Bill To)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Name *</label>
                <input className="form-input" value={form.recipient_name}
                  onChange={(e) => updForm('recipient_name', e.target.value)} style={{ margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Phone</label>
                <input className="form-input" type="tel" value={form.recipient_phone}
                  onChange={(e) => updForm('recipient_phone', restrictTo10Digits(e.target.value))}
                  placeholder="9876543210" maxLength={10} style={{ margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Email</label>
                <input className="form-input" value={form.recipient_email}
                  onChange={(e) => updForm('recipient_email', e.target.value)} style={{ margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>City</label>
                <input className="form-input" value={form.recipient_city}
                  onChange={(e) => updForm('recipient_city', e.target.value)} style={{ margin: 0 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>State {form.is_gst && '*'}</label>
                <select className="form-select" value={form.recipient_state}
                  onChange={(e) => {
                    updForm('recipient_state', e.target.value);
                    updForm('place_of_supply', e.target.value);
                  }} style={{ margin: 0 }}>
                  <option value="">Select…</option>
                  {states.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Pincode</label>
                <input className="form-input" value={form.recipient_pincode}
                  onChange={(e) => updForm('recipient_pincode', e.target.value)} style={{ margin: 0 }} />
              </div>
              {form.is_gst && form.supply_type === 'b2b' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>GSTIN *</label>
                  <input className="form-input" maxLength={15} value={form.recipient_gstin}
                    onChange={(e) => updForm('recipient_gstin', e.target.value.toUpperCase())}
                    style={{ margin: 0 }} placeholder="15-char GSTIN" />
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Address</label>
              <textarea className="form-input" rows={2} value={form.recipient_address}
                onChange={(e) => updForm('recipient_address', e.target.value)} style={{ margin: 0, resize: 'vertical' }} />
            </div>

            {form.is_gst && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Place of Supply</label>
                  <select className="form-select" value={form.place_of_supply}
                    onChange={(e) => updForm('place_of_supply', e.target.value)} style={{ margin: 0, width: 220 }}>
                    <option value="">Same as recipient state</option>
                    {states.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginTop: 18 }}>
                  <input type="checkbox" checked={form.is_reverse_charge}
                    onChange={(e) => updForm('is_reverse_charge', e.target.checked)}
                    style={{ accentColor: '#3b82f6' }} />
                  Reverse Charge
                </label>
                {settings?.supplier_state && form.place_of_supply && (
                  <div style={{ marginTop: 18, fontSize: 12, padding: '4px 10px', borderRadius: 6,
                    background: settings.supplier_state === form.place_of_supply ? '#dcfce7' : '#dbeafe',
                    color: settings.supplier_state === form.place_of_supply ? '#166534' : '#1e40af', fontWeight: 600 }}>
                    {settings.supplier_state === form.place_of_supply ? 'Intra-State → CGST + SGST' : 'Inter-State → IGST'}
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>Line Items</h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: form.is_gst ? '2fr 1fr 60px 60px 80px 60px 80px 30px' : '3fr 60px 60px 80px 60px 30px',
                gap: 6, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                fontSize: 11, fontWeight: 600, color: '#64748b',
              }}>
                <div>Description</div>
                {form.is_gst && <div>HSN/SAC</div>}
                <div>Qty</div><div>Unit</div><div>Rate</div><div>Disc</div>
                {form.is_gst && <div>Tax %</div>}
                <div></div>
              </div>
              {lineItems.map((item, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: form.is_gst ? '2fr 1fr 60px 60px 80px 60px 80px 30px' : '3fr 60px 60px 80px 60px 30px',
                  gap: 6, padding: '6px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center',
                }}>
                  <input className="form-input" placeholder="Item description" value={item.description}
                    onChange={(e) => updItem(i, 'description', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  {form.is_gst && (
                    <input className="form-input" placeholder="HSN" maxLength={8} value={item.hsn_sac}
                      onChange={(e) => updItem(i, 'hsn_sac', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  )}
                  <input className="form-input" type="number" value={item.quantity}
                    onChange={(e) => updItem(i, 'quantity', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  <input className="form-input" value={item.unit}
                    onChange={(e) => updItem(i, 'unit', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  <input className="form-input" type="number" value={item.rate}
                    onChange={(e) => updItem(i, 'rate', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  <input className="form-input" type="number" value={item.discount_amount}
                    onChange={(e) => updItem(i, 'discount_amount', e.target.value)} style={{ margin: 0, fontSize: 12 }} />
                  {form.is_gst && (
                    <select className="form-select" value={item.tax_rate}
                      onChange={(e) => updItem(i, 'tax_rate', e.target.value)} style={{ margin: 0, fontSize: 12 }}>
                      {slabs.map((s) => <option key={s.rate} value={s.rate}>{s.label}</option>)}
                    </select>
                  )}
                  <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => removeItem(i)}>✕</button>
                </div>
              ))}
              <div style={{ padding: '8px 12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ fontSize: 11 }}>+ Add Item</button>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Notes</label>
              <textarea className="form-input" rows={2} value={form.notes}
                onChange={(e) => updForm('notes', e.target.value)} style={{ margin: 0, resize: 'vertical' }} />
            </div>

            {/* Bank & Terms from Settings */}
            {settings && (settings.bank_name || settings.default_terms) && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b',
              }}>
                <span style={{ fontWeight: 700, color: '#475569', fontSize: 11 }}>From Invoice Settings: </span>
                {settings.bank_name && (
                  <span>Bank: {settings.bank_name}{settings.bank_account_number ? ` (A/c: ${settings.bank_account_number})` : ''} </span>
                )}
                {settings.bank_ifsc && <span>IFSC: {settings.bank_ifsc} </span>}
                {settings.default_terms && <span>| Terms: {settings.default_terms}</span>}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setShowCreate(false); setEditingId(null); setEditingInvoice(null); }}>
                Cancel
              </button>
              {editingId != null ? (
                <button className="btn btn-primary btn-sm" onClick={handleUpdate} disabled={creating}>
                  {creating ? 'Saving…' : 'Save changes'}
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : form.invoice_type === 'proforma' ? 'Create Proforma' : 'Create Invoice'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
      {activeTab === 'from_orders' && (
        <>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Orders Pending Invoice ({ordersPending.length})</h2>
              <button className="btn btn-secondary btn-sm" onClick={fetchOrdersPending} disabled={ordersLoading}>
                {ordersLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {ordersLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersPending.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                        No orders pending invoice. Assign orders to Invoice module from the Orders flow.
                      </td></tr>
                    ) : ordersPending.map((ord) => (
                      <tr key={ord.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(ord)}>
                        <td><strong>{ord.order_number}</strong></td>
                        <td>{ord.customer_name || ord.shipping_name || '—'}</td>
                        <td>{ord.status}</td>
                        <td><strong>₹{parseFloat(ord.total_amount || '0').toLocaleString()}</strong></td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(ord.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order detail modal */}
          {selectedOrder && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              zIndex: 1000, overflowY: 'auto', padding: '40px 16px',
            }} onClick={() => setSelectedOrder(null)}>
              <div onClick={(e) => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 600, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Order {selectedOrder.order_number}</h3>
                {selectedOrder.lead_details && (
                  <div style={{ marginBottom: 16 }}>
                    <LeadDetailsCard lead={selectedOrder.lead_details} compact />
                  </div>
                )}
                <div style={{ marginBottom: 16, fontSize: 13 }}>
                  <div><strong>Customer:</strong> {selectedOrder.customer_name || selectedOrder.shipping_name || '—'}</div>
                  {selectedOrder.shipping_phone && <div><strong>Phone:</strong> {selectedOrder.shipping_phone}</div>}
                  {selectedOrder.shipping_address && <div><strong>Address:</strong> {selectedOrder.shipping_address}, {selectedOrder.shipping_city} {selectedOrder.shipping_state} {selectedOrder.shipping_pincode}</div>}
                  {selectedOrder.notes && <div><strong>Notes:</strong> {selectedOrder.notes}</div>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700 }}>Items</h4>
                  <table className="table" style={{ fontSize: 12 }}>
                    <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                    <tbody>
                      {(selectedOrder.items || []).map((it: any, i: number) => (
                        <tr key={i}>
                          <td>{it.product_name}</td>
                          <td>{it.quantity}</td>
                          <td>₹{parseFloat(it.unit_price || '0').toLocaleString()}</td>
                          <td>₹{(parseFloat(it.unit_price || '0') * (it.quantity || 0)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginBottom: 16, fontWeight: 700 }}>Total: ₹{parseFloat(selectedOrder.total_amount || '0').toLocaleString()}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(null)}>Close</button>
                  <button className="btn btn-secondary btn-sm" disabled={creatingFromOrder}
                    onClick={() => handleCreateFromOrder(selectedOrder.id, 'proforma')}>
                    {creatingFromOrder ? 'Creating…' : 'Create Proforma'}
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={creatingFromOrder}
                    onClick={() => handleCreateFromOrder(selectedOrder.id, isGST ? 'tax_invoice' : 'bill_of_supply')}>
                    {creatingFromOrder ? 'Creating…' : 'Create Invoice'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
