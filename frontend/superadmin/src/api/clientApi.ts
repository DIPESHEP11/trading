import axiosInstance from './axiosInstance';
import type { CrmPhoneRegexPreset } from '@/types';

export interface ClientModule {
  crm: boolean;
  products: boolean;
  stock: boolean;
  orders: boolean;
  warehouse: boolean;
  invoices: boolean;
  dispatch: boolean;
  tracking: boolean;
  manufacturing: boolean;
  hr: boolean;
  analytics: boolean;
}

export interface ClientAdminPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
}

export interface RegisterClientPayload {
  name: string;
  subtitle: string;
  description: string;
  contact_email: string;
  plan: string;
  business_model: string;
  domain: string;
  logo?: File | null;
  module_crm: boolean;
  module_products: boolean;
  module_stock: boolean;
  module_orders: boolean;
  module_warehouse: boolean;
  module_invoices: boolean;
  module_dispatch: boolean;
  module_tracking: boolean;
  module_manufacturing: boolean;
  module_hr: boolean;
  module_analytics: boolean;
  admin: ClientAdminPayload;
  /** Defined by superadmin; client CRM picks one preset for Contact validation */
  crm_phone_regex_presets?: CrmPhoneRegexPreset[];
}

export const clientApi = {
  list: () => axiosInstance.get('/tenants/').then((r) => r.data),

  get: (id: number) => axiosInstance.get(`/tenants/${id}/`).then((r) => r.data),

  assignAdminToTenant: (tenantId: number, admin: ClientAdminPayload) => {
    const form = new FormData();
    form.append('admin.email', admin.email);
    form.append('admin.first_name', admin.first_name);
    form.append('admin.last_name', admin.last_name || '');
    form.append('admin.phone', admin.phone || '');
    form.append('admin.password', admin.password);
    return axiosInstance.post(`/tenants/${tenantId}/assign-admin/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  registerClient: (payload: RegisterClientPayload) => {
    const form = new FormData();
    // Brand
    form.append('name', payload.name);
    form.append('subtitle', payload.subtitle || '');
    form.append('description', payload.description || '');
    form.append('contact_email', payload.contact_email || '');
    if (payload.logo) form.append('logo', payload.logo);

    // Plan & model
    form.append('plan', payload.plan);
    form.append('business_model', payload.business_model);
    form.append('domain', payload.domain || '');

    // Modules
    form.append('module_crm', String(payload.module_crm));
    form.append('module_products', String(payload.module_products));
    form.append('module_stock', String(payload.module_stock));
    form.append('module_orders', String(payload.module_orders));
    form.append('module_warehouse', String(payload.module_warehouse));
    form.append('module_invoices', String(payload.module_invoices));
    form.append('module_dispatch', String(payload.module_dispatch));
    form.append('module_tracking', String(payload.module_tracking));
    form.append('module_manufacturing', String(payload.module_manufacturing));
    form.append('module_hr', String(payload.module_hr));
    form.append('module_analytics', String(payload.module_analytics));

    // Admin user (nested as admin[field])
    form.append('admin.email', payload.admin.email);
    form.append('admin.first_name', payload.admin.first_name);
    form.append('admin.last_name', payload.admin.last_name || '');
    form.append('admin.phone', payload.admin.phone || '');
    form.append('admin.password', payload.admin.password);

    const presets = payload.crm_phone_regex_presets ?? [];
    form.append('crm_phone_regex_presets', JSON.stringify(presets));

    return axiosInstance.post('/tenants/register/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  update: (id: number, data: Partial<RegisterClientPayload>) =>
    axiosInstance.patch(`/tenants/${id}/`, data).then((r) => r.data),

  delete: (id: number) => axiosInstance.delete(`/tenants/${id}/`).then((r) => r.data),
};
