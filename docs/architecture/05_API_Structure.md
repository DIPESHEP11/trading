# 5. API Structure (Django REST Framework)

The Trading backend uses Django REST Framework (DRF) to serve JSON to the React Portals and the Flutter Mobile App. The API heavily utilizes dynamic routing based on subdomains (the `django-tenants` middleware extracts the tenant from the Host header).

## Subdomain Routing Principle

- **Platform Admin Requests**: Addressed to `admin.trading.com/api/v1/...`
- **Tenant Requests**: Addressed to `<tenant_slug>.trading.com/api/v1/...` (e.g., `oriol.trading.com`)

## 1. Global Endpoints (Public Schema)

These endpoints are strictly for the Super Admin Portal and are processed against the public schema. 

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/auth/login/` | Platform superadmin login |
| GET | `/api/v1/tenants/` | List all active clients/tenants |
| POST | `/api/v1/tenants/` | Provision a new tenant (creates schema, runs migrations) |
| GET/PUT | `/api/v1/tenants/<id>/` | View or edit a tenant's domain, modules, or status |
| DELETE | `/api/v1/tenants/<id>/` | Soft-delete a tenant and archive their schema |
| GET | `/api/v1/analytics/platform/` | Global SaaS metrics |

## 2. Tenant Endpoints (Tenant Schema)

These endpoints run against the individual tenant schemas.

### Authentication & Setup
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login/` | Client/Employee login (returns JWT) |
| GET | `/api/v1/auth/me/` | Current user profile & active tenant modules |
| GET/POST | `/api/v1/roles/` | Setup custom employee roles |
| GET/POST | `/api/v1/employees/` | Invite/list team members |

### CRM
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/crm/leads/` | Manage sales leads |
| PUT/PATCH | `/api/v1/crm/leads/<id>/` | Update lead status / pipeline |
| GET/POST | `/api/v1/crm/customers/` | Master customer directory |

### Inventory & Warehouse
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/inventory/products/` | Product catalog |
| GET/POST | `/api/v1/inventory/warehouses/`| Manage locations |
| POST | `/api/v1/inventory/stock/move/` | Transfer stock between warehouses |

### Orders & Invoicing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/sales/orders/` | Create business orders |
| POST | `/api/v1/sales/orders/<id>/confirm/`| Move draft to confirmed |
| GET/POST | `/api/v1/sales/invoices/` | Generate tax invoices |
| POST | `/api/v1/sales/dispatch/` | Print courier dispatch stickers |

### Integrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/integrations/whatsapp/send/`| Broadcast templates |
| POST | `/api/v1/integrations/whatsapp/webhook/`| Inbound CRM messages |
