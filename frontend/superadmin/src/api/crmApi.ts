import axiosInstance from './axiosInstance';
import type { Lead, Customer } from '@/types';

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
  },
};
