import axiosInstance from './axiosInstance';
import type { Employee, EmployeeCustomField, EmployeeDocument } from '@/types';

const BASE = '/hr';

export const hrApi = {
  employees: {
    list: (params?: Record<string, string | boolean | number>) =>
      axiosInstance.get<{ data: { employees: Employee[]; count: number } }>(`${BASE}/employees/`, { params }).then(r => r.data),
    get: (id: number) =>
      axiosInstance.get<{ data: Employee }>(`${BASE}/employees/${id}/`).then(r => r.data),
    create: (data: FormData | Record<string, unknown>) =>
      axiosInstance.post<{ data: Employee }>(`${BASE}/employees/`, data).then(r => r.data),
    update: (id: number, data: FormData | Record<string, unknown>) =>
      axiosInstance.patch<{ data: Employee }>(`${BASE}/employees/${id}/`, data).then(r => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`${BASE}/employees/${id}/`).then(r => r.data),
    sendResetLink: (id: number) =>
      axiosInstance.post<{ message?: string }>(`${BASE}/employees/${id}/send-reset-link/`).then(r => r.data),
  },

  customFields: {
    list: () =>
      axiosInstance.get<{ data: EmployeeCustomField[] }>(`${BASE}/custom-fields/`).then(r => r.data),
    create: (data: Partial<EmployeeCustomField>) =>
      axiosInstance.post<{ data: EmployeeCustomField }>(`${BASE}/custom-fields/`, data).then(r => r.data),
    update: (id: number, data: Partial<EmployeeCustomField>) =>
      axiosInstance.patch<{ data: EmployeeCustomField }>(`${BASE}/custom-fields/${id}/`, data).then(r => r.data),
    delete: (id: number) =>
      axiosInstance.delete(`${BASE}/custom-fields/${id}/`).then(r => r.data),
  },

  documents: {
    upload: (empId: number, formData: FormData) =>
      axiosInstance
        .post<{ data: EmployeeDocument }>(`${BASE}/employees/${empId}/documents/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data),
    delete: (docId: number) =>
      axiosInstance.delete(`${BASE}/documents/${docId}/`).then(r => r.data),
  },

  permissions: {
    listEmployees: () =>
      axiosInstance.get<{ data: EmployeePermSummary[] }>(`${BASE}/permissions/`).then(r => r.data),
    get: (employeeProfileId: number) =>
      axiosInstance
        .get<{ data: { employee: EmployeePermSummary; permissions: ModulePermission[] } }>(`${BASE}/permissions/`, { params: { employee: employeeProfileId } })
        .then(r => r.data),
    save: (employeeProfileId: number, permissions: Record<string, PermFlags>) =>
      axiosInstance
        .put(`${BASE}/permissions/`, { permissions }, { params: { employee: employeeProfileId } })
        .then(r => r.data),
    /** Current user's module permissions — used to filter nav for employees (admin sees all) */
    my: () =>
      axiosInstance.get<{ data: { modules: Record<string, PermFlags> } }>(`${BASE}/permissions/me/`).then(r => r.data),
  },
};

export interface EmployeePermSummary {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  user_id: number;
  department: string;
  designation: string;
}

export interface PermFlags {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface ModulePermission extends PermFlags {
  module: string;
}
