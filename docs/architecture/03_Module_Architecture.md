# 3. Module Architecture

The Traiding platform is built dynamically, treating features as "Modules." This allows the Super Admin to turn on or off major chunks of functionality for any given Tenant. 

## The Concept

Instead of a one-size-fits-all approach, a Tenant configures an active bundle. E.g., a hospital supplier might only need `Warehouse` and `Dispatch` without the standard `Retail POS`. The frontend (React and Flutter) will selectively render features based on the Tenant's active modules.

### Core Modules

1. **Auth & Setup**: (Always On) Handling employees, roles, profiles.
2. **CRM**: Lead tracking, sales pipelines, customer directories, call logs.
3. **Inventory & Warehouse**: Stock checking, multi-warehouse handling, product variants, minimum stock alerts.
4. **Order Management**: Order lifecycle (Draft -> Confirmed -> Packed -> Dispatched).
5. **Invoicing**: Finance module for generating tax-compliant PDF invoices.
6. **Dispatch & Tracking**: Integration with couriers (e.g., Delhivery, FedEx), printing shipping stickers.

### Optional / Future Modules
- **Manufacturing Routing**: BoM (Bill of Materials), raw material tracking, production stages.
- **Support Tickets**: Helpdesk built into the platform.
- **Retail POS**: A specialized touchscreen UI for physical store checkouts.
- **Marketing Automation**: SMS, WhatsApp, and Email broadcast sequences.

## How it Works Technically

1. **Django Database Level**: A central `TenantModuleConfig` table in the Public Schema maps the `Tenant.id` to a JSON array of active modules.
2. **Django API Level**: API Views check permissions. If a tenant accesses `/api/v1/manufacturing/...` but the module is disabled, Django responds with `403 Forbidden` (`ModuleNotEnabledException`).
3. **React Client Level**: On initial load, the Client Portal calls `/api/v1/auth/me/` which includes the `tenant.active_modules`. Routes in React are wrapped in `<ProtectedRoute requireModule="crm" />`. If missing, the Sidebar hides the CRM link entirely.
4. **Flutter App Level**: Uses the same `/api/v1/auth/me/` logic to dynamically render Bottom Navigation Tabs and Dashboard cards.
