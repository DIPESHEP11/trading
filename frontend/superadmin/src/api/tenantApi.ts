import axiosInstance from './axiosInstance';
import type { Tenant } from '@/types';

export const tenantApi = {
  list: (): Promise<{ data: { tenants: Tenant[]; count: number } }> =>
    axiosInstance.get('/tenants/').then((r) => r.data),

  get: (id: number): Promise<{ data: Tenant }> =>
    axiosInstance.get(`/tenants/${id}/`).then((r) => r.data),

  create: (data: Partial<Tenant>): Promise<{ data: Tenant }> =>
    axiosInstance.post('/tenants/', data).then((r) => r.data),

  update: (id: number, data: Partial<Tenant>): Promise<{ data: Tenant }> =>
    axiosInstance.patch(`/tenants/${id}/`, data).then((r) => r.data),

  delete: (id: number): Promise<void> =>
    axiosInstance.delete(`/tenants/${id}/`).then((r) => r.data),
};
