import axiosInstance from './axiosInstance';
import type { Lead, Customer, LeadFormSchema } from '@/types';

export type BulkAssignType = 'round_robin' | 'pool' | 'custom';

export interface BulkAssignEmployee { user_id: number; name?: string; count?: number; }

export const crmApi = {
  leads: {
    list: (params?: Record<string, string>) =>
      axiosInstance.get('/crm/leads/', { params }).then((r) => r.data),
    get: (id: number) =>
      axiosInstance.get(`/crm/leads/${id}/`).then((r) => r.data),
    create: (data: Partial<Lead>) =>
      axiosInstance.post('/crm/leads/', data).then((r) => r.data),
    update: (id: number, data: Partial<Lead>) =>
      axiosInstance.patch(`/crm/leads/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/crm/leads/${id}/`).then((r) => r.data),
    assign: (id: number, userId: number) =>
      axiosInstance.post(`/crm/leads/${id}/assign/`, { user_id: userId }).then((r) => r.data),
    bulkAssign: (payload: {
      lead_ids?: number[];
      filter_unassigned?: boolean;
      assignment_type: BulkAssignType;
      employees: BulkAssignEmployee[];
      pool_batch_size?: number;
    }) => axiosInstance.post('/crm/leads/bulk-assign/', payload).then((r) => r.data),
  },
  leadFormSchema: {
    get: () => axiosInstance.get('/crm/lead-form-schema/').then((r) => r.data),
    update: (data: { fields: LeadFormSchema['fields'] }) =>
      axiosInstance.put('/crm/lead-form-schema/', data).then((r) => r.data),
    downloadTemplate: () =>
      axiosInstance.get('/crm/lead-form-schema/template/', { responseType: 'blob' }).then((r) => {
        const url = window.URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads_template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      }),
    import: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return axiosInstance.post('/crm/lead-form-schema/import/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
  },
  leadFormPublic: {
    getSchema: () => axiosInstance.get('/crm/lead-form-public/').then((r) => r.data),
    submit: (data: Record<string, string>) =>
      axiosInstance.post('/crm/lead-submit/', data).then((r) => r.data),
  },
  statuses: {
    list: () => axiosInstance.get('/crm/statuses/').then((r) => r.data),
    create: (data: { key: string; label: string; color?: string; order?: number }) =>
      axiosInstance.post('/crm/statuses/', data).then((r) => r.data),
    update: (id: number, data: Partial<{ key: string; label: string; color: string; order: number; is_active: boolean }>) =>
      axiosInstance.patch(`/crm/statuses/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/crm/statuses/${id}/`).then((r) => r.data),
  },
  sources: {
    list: () => axiosInstance.get('/crm/sources/').then((r) => r.data),
    create: (data: { key: string; label: string; order?: number }) =>
      axiosInstance.post('/crm/sources/', data).then((r) => r.data),
    update: (id: number, data: Partial<{ key: string; label: string; order: number; is_active: boolean }>) =>
      axiosInstance.patch(`/crm/sources/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/crm/sources/${id}/`).then((r) => r.data),
  },
  flowActions: {
    list: () => axiosInstance.get('/crm/flow-actions/').then((r) => r.data),
    create: (data: { status_key: string; target_module: string; action: string; description?: string }) =>
      axiosInstance.post('/crm/flow-actions/', data).then((r) => r.data),
    update: (id: number, data: Partial<{ status_key: string; target_module: string; action: string; description: string; is_active: boolean }>) =>
      axiosInstance.patch(`/crm/flow-actions/${id}/`, data).then((r) => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`/crm/flow-actions/${id}/`).then((r) => r.data),
  },
  customers: {
    list: (params?: Record<string, string>) =>
      axiosInstance.get('/crm/customers/', { params }).then((r) => r.data),
    get: (id: number) =>
      axiosInstance.get(`/crm/customers/${id}/`).then((r) => r.data),
    create: (data: Partial<Customer>) =>
      axiosInstance.post('/crm/customers/', data).then((r) => r.data),
    update: (id: number, data: Partial<Customer>) =>
      axiosInstance.patch(`/crm/customers/${id}/`, data).then((r) => r.data),
    leads: (id: number) =>
      axiosInstance.get(`/crm/customers/${id}/leads/`).then((r) => r.data),
  },
};
