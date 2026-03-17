import axiosInstance from './axiosInstance';

export const productsApi = {
  categories: {
    list: () => axiosInstance.get('/products/categories/').then((r) => r.data),
    create: (data: object) => axiosInstance.post('/products/categories/', data).then((r) => r.data),
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
  warehouses: () => axiosInstance.get('/stock/warehouses/').then((r) => r.data),
  createWarehouse: (data: object) =>
    axiosInstance.post('/stock/warehouses/', data).then((r) => r.data),
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
};

export const invoicesApi = {
  list: (params?: Record<string, string>) =>
    axiosInstance.get('/invoices/', { params }).then((r) => r.data),
  get: (id: number) => axiosInstance.get(`/invoices/${id}/`).then((r) => r.data),
  create: (data: object) => axiosInstance.post('/invoices/', data).then((r) => r.data),
  update: (id: number, data: object) =>
    axiosInstance.patch(`/invoices/${id}/`, data).then((r) => r.data),
  dispatch: {
    list: () => axiosInstance.get('/invoices/dispatch/').then((r) => r.data),
    create: (data: object) =>
      axiosInstance.post('/invoices/dispatch/', data).then((r) => r.data),
  },
};

export const configApi = {
  get: () => axiosInstance.get('/tenant/config/').then((r) => r.data),
  update: (data: object) => axiosInstance.put('/tenant/config/', data).then((r) => r.data),
};
