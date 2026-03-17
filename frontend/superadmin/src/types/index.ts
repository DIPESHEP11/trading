// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  avatar: string | null;
  role: 'super_admin' | 'tenant_admin' | 'staff' | 'member';
  is_active: boolean;
  date_joined: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password: string;
  password_confirm: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: User & { access: string; refresh: string };
}

// ─── Tenant ────────────────────────────────────────────────────────────────

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  description: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  is_active: boolean;
  created_on: string;
  domain?: string;
}

// ─── Tenant Config (Flutter endpoint) ─────────────────────────────────────

export interface TenantModules {
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

export interface TenantConfig {
  tenant_id: number;
  company: string;
  theme_color: string;
  logo: string | null;
  currency: string;
  timezone: string;
  order_requires_approval: boolean;
  modules: TenantModules;
}

// ─── CRM ───────────────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'order_created' | 'lost';
export type LeadSource = 'meta' | 'shopify' | 'online' | 'manual' | 'whatsapp' | 'referral';

export interface Customer {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  country: string;
  tags: string[];
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Lead {
  id: number;
  source: LeadSource;
  status: LeadStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  customer: number | null;
  external_id: string;
  created_at: string;
}

// ─── Products & Stock ────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  parent: number | null;
  description: string;
  is_active: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: number | null;
  category_name: string | null;
  unit: string;
  price: string;
  cost_price: string;
  tax_percent: string;
  image: string | null;
  is_active: boolean;
  low_stock_threshold: number;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  is_active: boolean;
}

export interface StockRecord {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  warehouse: number;
  warehouse_name: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  product: number;
  product_name: string;
  warehouse: number;
  warehouse_name: string;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'return';
  quantity: string;
  reference: string;
  notes: string;
  performed_by_name: string | null;
  created_at: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'approved' | 'warehouse' | 'invoiced' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';

export interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

export interface Order {
  id: number;
  order_number: string;
  source: LeadSource;
  status: OrderStatus;
  customer: number | null;
  customer_name: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  subtotal: string;
  total_amount: string;
  notes: string;
  items: OrderItem[];
  created_at: string;
}

// ─── Invoice & Dispatch ───────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: number;
  invoice_number: string;
  order: number;
  order_number: string;
  status: InvoiceStatus;
  total_amount: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface DispatchSticker {
  id: number;
  invoice: number;
  courier: string;
  awb_number: string;
  weight_kg: string | null;
  dispatched_at: string | null;
  tracking_url: string;
}

// ─── Client Admins ────────────────────────────────────────────────────────────

export interface ClientAdmin {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  date_joined: string;
  client_id: number | null;
  client_name: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface Plan {
  id: number;
  name: string;
  slug: string;
  price: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  description: string;
  features: string[];
  max_users: number | null;
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
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
