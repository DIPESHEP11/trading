import axiosInstance from './axiosInstance';

export const productsApi = {
  categories: {
    list: () => axiosInstance.get('/products/categories/').then((r) => r.data),
    create: (data: object) => axiosInstance.post('/products/categories/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/products/categories/${id}/`, data).then((r) => r.data),
    delete: (id: number) => axiosInstance.delete(`/products/categories/${id}/`).then((r) => r.data),
  },
  products: {
    list: (params?: Record<string, string>) =>
      axiosInstance.get('/products/', { params }).then((r) => r.data),
    get: (id: number) => axiosInstance.get(`/products/${id}/`).then((r) => r.data),
    create: (data: object) => axiosInstance.post('/products/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/products/${id}/`, data).then((r) => r.data),
    delete: (id: number) => axiosInstance.delete(`/products/${id}/`).then((r) => r.data),
  },
};

export const stockApi = {
  records: (params?: Record<string, string>) =>
    axiosInstance.get('/stock/records/', { params }).then((r) => r.data),
  movements: (params?: Record<string, string>) =>
    axiosInstance.get('/stock/movements/', { params }).then((r) => r.data),
  addMovement: (data: object) =>
    axiosInstance.post('/stock/movements/', data).then((r) => r.data),
  transfer: (data: object) =>
    axiosInstance.post('/stock/transfer/', data).then((r) => r.data),
  warehouses: (params?: Record<string, string>) =>
    axiosInstance.get('/stock/warehouses/', { params }).then((r) => r.data),
  createWarehouse: (data: object) =>
    axiosInstance.post('/stock/warehouses/', data).then((r) => r.data),
  updateWarehouse: (id: number, data: object) =>
    axiosInstance.patch(`/stock/warehouses/${id}/`, data).then((r) => r.data),
  deleteWarehouse: (id: number) =>
    axiosInstance.delete(`/stock/warehouses/${id}/`).then((r) => r.data),

  /** Public (no auth) — for third-party warehouse incharge */
  warehouseView: (token: string) =>
    axiosInstance.get(`/stock/warehouse-view/${token}/`).then((r) => r.data),
  warehouseViewUsage: (token: string, data: { items: { product_id: number; quantity: string }[]; reference?: string; notes?: string }) =>
    axiosInstance.post(`/stock/warehouse-view/${token}/usage/`, data).then((r) => r.data),

  approvals: {
    list: (params?: Record<string, string>) =>
      axiosInstance.get('/stock/approvals/', { params }).then((r) => r.data),
    get: (id: number) =>
      axiosInstance.get(`/stock/approvals/${id}/`).then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/stock/approvals/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/stock/approvals/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/stock/approvals/${id}/`).then((r) => r.data),
    approve: (id: number) =>
      axiosInstance.post(`/stock/approvals/${id}/approve/`).then((r) => r.data),
    reject: (id: number, data: { rejection_reason: string }) =>
      axiosInstance.post(`/stock/approvals/${id}/reject/`, data).then((r) => r.data),
    changeStatus: (id: number, data: { status: string; rejection_reason?: string }) =>
      axiosInstance.post(`/stock/approvals/${id}/change-status/`, data).then((r) => r.data),
  },

  inventoryStatuses: {
    list: () => axiosInstance.get('/stock/statuses/').then((r) => r.data),
    create: (data: object) => axiosInstance.post('/stock/statuses/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/stock/statuses/${id}/`, data).then((r) => r.data),
    delete: (id: number) => axiosInstance.delete(`/stock/statuses/${id}/`).then((r) => r.data),
  },

  inventoryFlowActions: {
    list: () => axiosInstance.get('/stock/flow-actions/').then((r) => r.data),
    create: (data: object) => axiosInstance.post('/stock/flow-actions/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/stock/flow-actions/${id}/`, data).then((r) => r.data),
    delete: (id: number) => axiosInstance.delete(`/stock/flow-actions/${id}/`).then((r) => r.data),
  },

  alerts: () => axiosInstance.get('/stock/alerts/').then((r) => r.data),
  alertMarkRead: (id: number) =>
    axiosInstance.patch(`/stock/alerts/${id}/read/`).then((r) => r.data),
  monthlySummary: (params?: { month?: string }) =>
    axiosInstance.get('/stock/monthly-summary/', { params }).then((r) => r.data),
};

export const ordersApi = {
  list: (params?: Record<string, string>) =>
    axiosInstance.get('/orders/', { params }).then((r) => r.data),
  get: (id: number) => axiosInstance.get(`/orders/${id}/`).then((r) => r.data),
  create: (data: object) => axiosInstance.post('/orders/', data).then((r) => r.data),
  update: (id: number, data: object) =>
    axiosInstance.patch(`/orders/${id}/`, data).then((r) => r.data),
  approve: (id: number) =>
    axiosInstance.post(`/orders/${id}/approve/`).then((r) => r.data),
  reject: (id: number, data: { reason: string; revert_to?: string }) =>
    axiosInstance.post(`/orders/${id}/reject/`, data).then((r) => r.data),
  statuses: {
    list: () => axiosInstance.get('/orders/statuses/').then((r) => r.data),
    create: (data: object) => axiosInstance.post('/orders/statuses/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/orders/statuses/${id}/`, data).then((r) => r.data),
    delete: (id: number) => axiosInstance.delete(`/orders/statuses/${id}/`).then((r) => r.data),
  },
  flowActions: {
    list: () => axiosInstance.get('/orders/flow-actions/').then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/orders/flow-actions/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/orders/flow-actions/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/orders/flow-actions/${id}/`).then((r) => r.data),
  },
};

export const invoicesApi = {
  list: (params?: Record<string, string>) =>
    axiosInstance.get('/invoices/', { params }).then((r) => r.data),
  get: (id: number) => axiosInstance.get(`/invoices/${id}/`).then((r) => r.data),
  ordersPending: () =>
    axiosInstance.get('/invoices/orders-pending/').then((r) => r.data),
  createFromOrder: (orderId: number, invoiceType: 'proforma' | 'tax_invoice' | 'bill_of_supply') =>
    axiosInstance.post(`/invoices/from-order/${orderId}/`, { invoice_type: invoiceType }).then((r) => r.data),
  create: (data: object) => axiosInstance.post('/invoices/', data).then((r) => r.data),
  update: (id: number, data: object) =>
    axiosInstance.patch(`/invoices/${id}/`, data).then((r) => r.data),
  convert: (id: number) =>
    axiosInstance.post(`/invoices/${id}/convert/`).then((r) => r.data),
  downloadPdf: (id: number) =>
    axiosInstance.get(`/invoices/${id}/pdf/`, { responseType: 'blob' }).then((r) => r),
  calculate: (data: object) =>
    axiosInstance.post('/invoices/calculate/', data).then((r) => r.data),
  items: {
    add: (invoiceId: number, data: object) =>
      axiosInstance.post(`/invoices/${invoiceId}/items/`, data).then((r) => r.data),
    update: (invoiceId: number, itemId: number, data: object) =>
      axiosInstance.put(`/invoices/${invoiceId}/items/${itemId}/`, data).then((r) => r.data),
    delete: (invoiceId: number, itemId: number) =>
      axiosInstance.delete(`/invoices/${invoiceId}/items/${itemId}/`).then((r) => r.data),
  },
  dispatch: {
    list: () => axiosInstance.get('/invoices/dispatch/').then((r) => r.data),
    get: (id: number) => axiosInstance.get(`/invoices/dispatch/${id}/`).then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/invoices/dispatch/', data).then((r) => r.data),
    downloadPdf: (id: number) =>
      axiosInstance.get(`/invoices/dispatch/${id}/pdf/`, { responseType: 'blob' }).then((r) => r),
    getQrBlob: (id: number) =>
      axiosInstance.get(`/invoices/dispatch/${id}/qr/`, { responseType: 'blob' }).then((r) => r.data),
    settings: {
      get: () => axiosInstance.get('/invoices/dispatch/settings/').then((r) => r.data),
      update: (data: { flow_after_dispatch?: string; default_tracking_status?: string }) =>
        axiosInstance.put('/invoices/dispatch/settings/', data).then((r) => r.data),
    },
    statuses: {
      list: () => axiosInstance.get('/invoices/dispatch/statuses/').then((r) => r.data),
      create: (data: { key: string; label: string; color?: string; order?: number }) =>
        axiosInstance.post('/invoices/dispatch/statuses/', data).then((r) => r.data),
      update: (id: number, data: { key?: string; label?: string; color?: string; order?: number; is_active?: boolean }) =>
        axiosInstance.put(`/invoices/dispatch/statuses/${id}/`, data).then((r) => r.data),
      delete: (id: number) => axiosInstance.delete(`/invoices/dispatch/statuses/${id}/`).then((r) => r.data),
    },
    flowActions: {
      list: () => axiosInstance.get('/invoices/dispatch/flow-actions/').then((r) => r.data),
      create: (data: { status_key: string; flow_after: string; default_tracking_status?: string; description?: string }) =>
        axiosInstance.post('/invoices/dispatch/flow-actions/', data).then((r) => r.data),
      update: (id: number, data: { status_key?: string; flow_after?: string; default_tracking_status?: string; description?: string; is_active?: boolean }) =>
        axiosInstance.put(`/invoices/dispatch/flow-actions/${id}/`, data).then((r) => r.data),
      delete: (id: number) => axiosInstance.delete(`/invoices/dispatch/flow-actions/${id}/`).then((r) => r.data),
    },
    partners: {
      list: () => axiosInstance.get('/invoices/dispatch/partners/').then((r) => r.data),
      create: (data: { name: string; courier_id?: string; address?: string; pincode?: string; contact_person_name?: string; contact_phone?: string }) =>
        axiosInstance.post('/invoices/dispatch/partners/', data).then((r) => r.data),
      get: (id: number) => axiosInstance.get(`/invoices/dispatch/partners/${id}/`).then((r) => r.data),
      update: (id: number, data: { name?: string; courier_id?: string; address?: string; pincode?: string; contact_person_name?: string; contact_phone?: string }) =>
        axiosInstance.put(`/invoices/dispatch/partners/${id}/`, data).then((r) => r.data),
      delete: (id: number) => axiosInstance.delete(`/invoices/dispatch/partners/${id}/`).then((r) => r.data),
    },
  },
  settings: {
    get: () => axiosInstance.get('/invoices/settings/').then((r) => r.data),
    update: (data: object) =>
      axiosInstance.put('/invoices/settings/', data).then((r) => r.data),
    uploadLogo: (formData: FormData) =>
      axiosInstance.post('/invoices/settings/logo/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
  },
  ref: {
    states: () => axiosInstance.get('/invoices/ref/states/').then((r) => r.data),
    gstSlabs: () => axiosInstance.get('/invoices/ref/gst-slabs/').then((r) => r.data),
  },
  statuses: {
    list: () => axiosInstance.get('/invoices/statuses/').then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/invoices/statuses/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/invoices/statuses/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/invoices/statuses/${id}/`).then((r) => r.data),
  },
  flowActions: {
    list: () => axiosInstance.get('/invoices/flow-actions/').then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/invoices/flow-actions/', data).then((r) => r.data),
    update: (id: number, data: object) =>
      axiosInstance.patch(`/invoices/flow-actions/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/invoices/flow-actions/${id}/`).then((r) => r.data),
  },
};

export const configApi = {
  get: () => axiosInstance.get('/tenant/config/').then((r) => r.data),
  update: (data: object) => axiosInstance.put('/tenant/config/', data).then((r) => r.data),
};

export const historyApi = {
  list: (params?: { module?: string; date_from?: string; date_to?: string }) =>
    axiosInstance.get('/history/', { params }).then((r) => r.data),
  export: (params?: { module?: string; date_from?: string; date_to?: string }) =>
    axiosInstance.get('/history/export/', { params }).then((r) => r.data),
  delete: (id: number) => axiosInstance.delete(`/history/${id}/`).then((r) => r.data),
};

export const dashboardApi = {
  stats: () => axiosInstance.get('/dashboard/stats/').then((r) => r.data),
};

// ─── Tracking (dispatch → delivery partner form) ─────────────────────────────

export type TrackingPartner = {
  partner_id: number;
  partner_name: string;
  courier_id: string;
  has_form_link: boolean;
  form_link_id: number | null;
  token: string | null;
  fillable_fields: string[];
  shipment_count: number;
};

export type TrackingShipmentItem = {
  id: number;
  product_name: string;
  product_id: string;
  qr_data: string;
  from_address: string;
  to_address: string;
  contact_number: string;
  delivery_partner_details: string;
  pod_tracking_number: string;
  custom_fields: Record<string, unknown>;
  status: string;
  courier_partner: number;
  courier_partner_name?: string;
};

export const trackingApi = {
  partners: () =>
    axiosInstance.get('/tracking/partners/').then((r) => r.data?.data ?? r.data),
  shipments: (partnerId?: number) =>
    axiosInstance
      .get('/tracking/shipments/', partnerId != null ? { params: { partner_id: partnerId } } : undefined)
      .then((r) => r.data?.data ?? r.data),
  createShipment: (data: object) =>
    axiosInstance.post('/tracking/shipments/', data).then((r) => r.data?.data ?? r.data),
  fromDispatch: (dispatchStickerId: number, courierPartnerId: number) =>
    axiosInstance
      .post('/tracking/shipments/from-dispatch/', {
        dispatch_sticker_id: dispatchStickerId,
        courier_partner_id: courierPartnerId,
      })
      .then((r) => r.data?.data ?? r.data),
  generateLink: (partnerId: number, fillableFields: string[]) =>
    axiosInstance
      .post(`/tracking/partners/${partnerId}/generate-link/`, { fillable_fields: fillableFields })
      .then((r) => r.data?.data ?? r.data),
  getLink: (linkId: number) =>
    axiosInstance.get(`/tracking/links/${linkId}/`).then((r) => r.data?.data ?? r.data),
  updateLink: (linkId: number, fillableFields: string[]) =>
    axiosInstance
      .patch(`/tracking/links/${linkId}/`, { fillable_fields: fillableFields })
      .then((r) => r.data?.data ?? r.data),
  /** Public form (no auth); backend allows AllowAny for these paths */
  publicForm: (token: string) =>
    axiosInstance.get(`/tracking/public/form/${encodeURIComponent(token)}/`).then((r) => r.data?.data ?? r.data),
  publicFormSubmit: (token: string, payload: { shipment_id: number; pod_tracking_number?: string; custom_fields?: Record<string, unknown> }) =>
    axiosInstance
      .post(`/tracking/public/form/${encodeURIComponent(token)}/submit/`, payload)
      .then((r) => r.data?.data ?? r.data),
};
