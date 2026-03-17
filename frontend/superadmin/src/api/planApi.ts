import axiosInstance from './axiosInstance';
import type { Plan } from '@/types';

export const planApi = {
  list: () =>
    axiosInstance.get<{ data: { plans: Plan[]; count: number } }>('/plans/').then(r => r.data),
  get: (id: number) =>
    axiosInstance.get<{ data: Plan }>(`/plans/${id}/`).then(r => r.data),
  create: (data: Partial<Plan>) =>
    axiosInstance.post<{ data: Plan }>('/plans/', data).then(r => r.data),
  update: (id: number, data: Partial<Plan>) =>
    axiosInstance.patch<{ data: Plan }>(`/plans/${id}/`, data).then(r => r.data),
  delete: (id: number) =>
    axiosInstance.delete(`/plans/${id}/`).then(r => r.data),
};
