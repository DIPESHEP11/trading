import axiosInstance from './axiosInstance';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types';

export const authApi = {
  register: (data: RegisterPayload): Promise<AuthResponse> =>
    axiosInstance.post('/auth/register/', data).then((r) => r.data),

  login: (data: LoginPayload): Promise<AuthResponse> =>
    axiosInstance.post('/auth/login/', data).then((r) => r.data),

  logout: (refresh: string): Promise<void> =>
    axiosInstance.post('/auth/logout/', { refresh }).then((r) => r.data),

  me: (): Promise<{ data: User }> =>
    axiosInstance.get('/auth/me/').then((r) => r.data),

  updateMe: (data: Partial<User>): Promise<{ data: User }> =>
    axiosInstance.patch('/auth/me/', data).then((r) => r.data),

  changePassword: (oldPassword: string, newPassword: string): Promise<void> =>
    axiosInstance
      .post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword })
      .then((r) => r.data),

  refreshToken: (refresh: string): Promise<{ access: string }> =>
    axiosInstance.post('/auth/token/refresh/', { refresh }).then((r) => r.data),
};
