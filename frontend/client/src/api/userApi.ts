import axiosInstance from './axiosInstance';
import type { User } from '@/types';

export const userApi = {
  list: (params?: Record<string, string>): Promise<{ data: { users: User[]; count: number } }> =>
    axiosInstance.get('/users/', { params }).then((r) => r.data),

  get: (id: number): Promise<{ data: User }> =>
    axiosInstance.get(`/users/${id}/`).then((r) => r.data),

  update: (id: number, data: Partial<User>): Promise<{ data: User }> =>
    axiosInstance.patch(`/users/${id}/`, data).then((r) => r.data),

  deactivate: (id: number): Promise<void> =>
    axiosInstance.delete(`/users/${id}/`).then((r) => r.data),
};
