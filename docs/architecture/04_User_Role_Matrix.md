# 4. User Role Matrix

The platform incorporates three distinct high-level user tiers, plus a customizable roles engine for the lowest tier.

## 1. Super Admin (Platform Owner)

The Super Admin logs into a dedicated **Superadmin Portal** (`admin.trading.com`). They manage the SaaS platform itself. **They cannot see inside a Tenant's database schemas.**

### Capabilities:
- **Tenant Management**: Create, edit, suspend, and delete companies.
- **Billing & Subscriptions**: (Future) Manage paid plans and feature flags.
- **Module Allocation**: Toggle on/off modules like CRM, Warehouse, Pos for specific Tenants.
- **Global Settings**: Configure Meta API, WhatsApp API keys at a master level.
- **Platform Analytics**: Total active users, MRR, Server load, and global metrics.

## 2. Client Admin (Business Owner)

The Client Admin logs into the **Client Portal** on their specific subdomain (`company.trading.com`). They manage an individual business entirely.

### Capabilities:
- **Employee Management**: Invite staff, assign roles.
- **Role Creation**: Build custom roles (e.g., "Warehouse Manager" only sees Inventory & Dispatch).
- **Billing Config**: See their own billing history and active subscription with the Platform Owner.
- **Full Data Access**: They have unrestricted view/edit capabilities over CRM, Inventory, Orders, Invoices, and Reports for their company.
- **Integrations Setup**: Link their company's specific Meta page or WhatsApp numbers.

## 3. End Users (Employees)

Employees log into the **Client Portal** or the **Flutter Mobile App**. Their access is strictly dictated by the Custom Role assigned to them by the Client Admin.

### Example Employee Roles:

#### Sales Executive
- **View**: Leads, Catalog, Customer Database, basic Order tracking.
- **Create**: New Leads, convert Leads to Orders.
- **Cannot**: View profit margins, alter total stock counts, access Invoices or Settings.

#### Warehouse Picker
- **View**: Confirmed Orders ready for picking, Warehouse maps, existing Stock.
- **Create**: Modify stock status, generate Dispatch Stickers.
- **Cannot**: View customer phone numbers (anonymized), view CRM leads, or change module settings.

#### Finance Operations
- **View**: All Orders, Payments, Invoices.
- **Create**: Generate and email Invoices, approve credit limits.
- **Cannot**: Pick stock in the warehouse module.

---

*Note: Roles and permissions are handled per-tenant. The permission engine utilizes Django's built-in `auth.models.Permission` within each tenant schema.*
