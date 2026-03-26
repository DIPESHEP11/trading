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
  buffer_stock_default?: number | null;
  buffer_stock_auto_enabled?: boolean;
  fast_moving_alert_enabled?: boolean;
}

// ─── CRM ───────────────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'order_created' | 'lost';
export type LeadSource = 'meta' | 'shopify' | 'online' | 'manual' | 'whatsapp' | 'referral' | 'form' | 'excel';

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
  custom_data?: Record<string, string>;
  created_at: string;
}

export interface CrmPhoneRegexPreset {
  id: string;
  label: string;
  pattern: string;
}

export interface LeadFormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';
  required?: boolean;
  order?: number;
  options?: string[];
  /** When type is phone: full-string regex (e.g. ^[0-9]{10}$ or E.164-style pattern) */
  pattern?: string;
  /** Selected preset id from tenant crm_phone_regex_presets (set in superadmin) */
  phone_preset_id?: string;
}

export interface LeadFormSchema {
  id?: number;
  fields: LeadFormField[];
  /** Merged built-in fields (API); includes resolved pattern for phone when a preset is chosen */
  default_fields?: LeadFormField[];
  custom_fields?: LeadFormField[];
  /** Presets from superadmin; client admin picks one for Contact validation */
  phone_regex_presets?: CrmPhoneRegexPreset[];
  is_locked?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Products & Stock ────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  parent: number | null;
  description: string;
  is_active: boolean;
  custom_fields: LeadFormField[];
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
  custom_data?: Record<string, string>;
}

export interface WarehouseCustomField {
  key: string;
  label: string;
  value: string;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  warehouse_type?: 'our' | 'third_party';
  public_access_token?: string | null;
  public_view_url?: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  is_active: boolean;
  custom_data: WarehouseCustomField[];
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
  returned_quantity: string;
  low_stock_threshold: number;
  has_returns: boolean;
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
  custom_data: Record<string, string>;
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
  items_summary?: string;
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

export type InvoiceStatus = string;

export interface InvoiceLineItem {
  id: number;
  description: string;
  hsn_sac: string;
  quantity: string;
  unit: string;
  rate: string;
  discount_amount: string;
  taxable_value: string;
  tax_rate: string;
  cgst_rate: string;
  cgst_amount: string;
  sgst_rate: string;
  sgst_amount: string;
  igst_rate: string;
  igst_amount: string;
  cess_rate: string;
  cess_amount: string;
  total: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  invoice_type: string;
  supply_type: string;
  order: number | null;
  order_number: string | null;
  status: InvoiceStatus;
  is_gst: boolean;
  is_reverse_charge: boolean;
  is_intra_state: boolean;
  supplier_name: string;
  supplier_gstin: string;
  supplier_state: string;
  recipient_name: string;
  recipient_gstin: string;
  recipient_state: string;
  place_of_supply: string;
  total_taxable_value: string;
  total_cgst: string;
  total_sgst: string;
  total_igst: string;
  total_cess: string;
  total_discount: string;
  round_off: string;
  grand_total: string;
  grand_total_words: string;
  total_amount: string;
  due_date: string | null;
  paid_at: string | null;
  irn: string;
  qr_code_data: string;
  line_items: InvoiceLineItem[];
  created_at: string;
  flow_result?: { message: string; executed: boolean };
}

export interface DispatchSticker {
  id: number;
  invoice: number;
  invoice_number?: string;
  courier: string;
  courier_name_custom?: string;
  awb_number: string;
  weight_kg: string | null;
  dimensions?: string;
  dispatched_at: string | null;
  tracking_url: string;
  from_name?: string;
  from_address?: string;
  from_name_override?: string;
  from_address_override?: string;
  to_name?: string;
  to_address?: string;
  product_names?: string[];
  line_items_summary?: { description: string; quantity: string; rate: string; total: string }[];
  grand_total?: string;
  dispatch_code?: string;
  created_at?: string;
}

export type FlowAfterDispatch = 'notify_only' | 'mark_delivered' | 'update_tracking' | 'transfer_to_tracking' | 'none';

export type DefaultTrackingStatus = '' | 'in_transit' | 'out_for_delivery' | 'delivered';

export interface DispatchSettings {
  id: number;
  flow_after_dispatch: FlowAfterDispatch;
  default_tracking_status?: DefaultTrackingStatus;
  from_address_options?: { label?: string; name: string; address: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface CourierPartner {
  id: number;
  name: string;
  courier_id: string;
  address: string;
  pincode: string;
  contact_person_name: string;
  contact_phone: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomDispatchStatus {
  id: number;
  key: string;
  label: string;
  color: string;
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DispatchFlowAfter = 'none' | 'notify_only' | 'mark_delivered' | 'update_tracking' | 'transfer_to_tracking';

export interface DispatchFlowAction {
  id: number;
  status_key: string;
  status_label?: string;
  flow_after: DispatchFlowAfter;
  default_tracking_status: string;
  is_active: boolean;
  description: string;
  created_at?: string;
  updated_at?: string;
}

// ─── HR / Employee ────────────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: number;
  title: string;
  category: string;
  file?: string;
  file_url: string | null;
  created_at: string;
}

export interface EmployeeCustomFieldValue {
  id: number;
  field_id: number;
  field_name: string;
  section: string;
  value: string;
}

export interface EmployeeCustomField {
  id: number;
  name: string;
  section: 'basic' | 'personal' | 'experience' | 'education' | 'official';
  created_at?: string;
}

export interface Employee {
  id: number;
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: number | null;   // Custom Role id (from API)
  role_name?: string | null;
  user_role?: string;   // member | staff (legacy)
  photo: string | null;
  date_of_birth: string | null;
  gender: string;
  blood_group: string;
  address: string;
  address_proof: string | null;
  home_phone: string;
  reference_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  department: string;
  designation: string;
  salary: string | null;
  experience_details: string;
  experience_certificate: string | null;
  education_details: string;
  qualification_document: string | null;
  description: string;
  join_date: string;
  resigned: boolean;
  resign_date: string | null;
  tenure: string;
  documents: EmployeeDocument[];
  custom_values: EmployeeCustomFieldValue[];
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
