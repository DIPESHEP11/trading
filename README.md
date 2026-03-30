# Trading — Multi-Tenant SaaS Platform

A full-stack multi-tenant web application built with **React + Vite** (frontend) and **Python Django** (backend), designed for separate hosting.

## Project Structure

```
trading/
├── backend/     # Django REST Framework API
└── frontend/    # React + Vite + TypeScript
```

---

## Backend Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 14+

### Quick Start

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Mac/Linux
# venv\Scripts\activate           # Windows

# 2. Install dependencies
pip install -r requirements/development.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your DB credentials and secrets

# 4. Create the database (in psql)
# CREATE DATABASE trading_db;

# 5. Run migrations
python manage.py migrate_schemas --shared   # creates shared schema
python manage.py migrate_schemas            # creates tenant schemas

# 6. Create a superuser
python manage.py createsuperuser

# 7. Start the server
python manage.py runserver
```

### API Endpoints (v1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/` | Register new user |
| POST | `/api/v1/auth/login/` | Login, returns JWT tokens |
| POST | `/api/v1/auth/logout/` | Revoke refresh token |
| GET/PATCH | `/api/v1/auth/me/` | Current user profile |
| POST | `/api/v1/auth/token/refresh/` | Refresh access token |
| GET/POST | `/api/v1/tenants/` | List/create tenants (super admin) |
| GET/PUT/DELETE | `/api/v1/tenants/<id>/` | Tenant detail |
| GET | `/api/v1/users/` | List users |
| GET/PATCH/DELETE | `/api/v1/users/<id>/` | User detail |
| POST | `/api/v1/integrations/whatsapp/send/` | Send WhatsApp message |
| GET/POST | `/api/v1/integrations/whatsapp/webhook/` | WhatsApp webhook |
| GET | `/api/v1/integrations/meta/user/<id>/` | Meta user info |

---

## Frontend Setup

### Prerequisites
- Node.js 18+

### Quick Start

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set VITE_API_BASE_URL to your backend URL

# 3. Start development server
npm run dev
# → http://localhost:5173
```

### Frontend Structure

```
src/
├── api/          # Axios API service files (per feature)
├── components/   # Reusable UI components
├── pages/        # Route-level pages
├── store/        # Zustand global state
├── types/        # TypeScript interfaces
└── styles/       # Global CSS design system
```

---

## External Integrations

### Meta / Facebook
Add your credentials to `backend/.env`:
```env
META_APP_ID=your_app_id
META_APP_SECRET=your_secret
META_ACCESS_TOKEN=your_access_token
```

### WhatsApp Business API
```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

---

## Multi-Tenancy

- Uses **django-tenants** with PostgreSQL schema-based isolation
- Each tenant gets an isolated schema automatically on creation
- Tenants are identified by **subdomain** (e.g., `company1.localhost`)
- Add tenants via the Django admin or `POST /api/v1/tenants/`

---

## Hosting Separately

| Service | Backend | Frontend |
|---------|---------|----------|
| Recommended | Railway / Render / Heroku | Vercel / Netlify |
| Docker | `gunicorn config.wsgi:application` | `npm run build` (serve `dist/`) |

Set `CORS_ALLOWED_ORIGINS` in backend `.env` to your frontend domain.










## BRD 

Business Requirement Document (BRD)
Multi-Tenant Customizable CRM, Stock Management & Trading Platform
1. Introduction
1.1 Purpose

The purpose of this project is to develop a multi-tenant customizable business management platform that integrates CRM, Product Management, Stock Management, Order Management, and Trading workflows into a single system.

The platform will allow multiple businesses (clients) to use the same system while configuring their own business workflows, modules, and permissions.

This approach eliminates the need to build separate software for each company, enabling a one-to-many SaaS model.

1.2 Scope

The system will provide:

CRM management

Product & stock management

Order processing

Warehouse operations

Invoice & dispatch management

Courier integration

Product tracking

Manufacturing workflows

Role and permission management

Multi-tenant architecture

Mobile and web access

The system will support different business models and workflows depending on the client’s industry.

2. System Overview

The platform will consist of three primary user levels.

2.1 Super Admin (Platform Owner)

The Super Admin represents the platform provider (your company) and manages the entire system.

Responsibilities

Super Admin can:

Create and manage clients (companies)

Assign modules to clients

Configure business workflows

Enable or disable mobile application modules

Customize system features based on business needs

Manage platform hosting and deployment

Monitor all client activities

Super Admin Capabilities

Client onboarding

Module management

Workflow configuration

Platform analytics

Subscription or licensing management (future feature)

2.2 Client (Business Owner)

Each Client represents a business organization using the platform.

Clients will have access to a Client Admin Panel to manage their business operations.

Client Admin Capabilities

Client administrators can:

Register employees

Create roles

Assign permissions

Manage employee access

Monitor business activities

Client Monitoring Features

Client admins can monitor:

Employee work activities

Sales and orders

Stock levels

Product movement

Warehouse operations

Salary and employee performance

Business analytics

2.3 End Users (Employees)

Employees access the system through:

Web portal

Mobile application

Employees perform daily operational tasks.

Employee Responsibilities

Employees can:

Manage leads

Process orders

Update stock

Generate invoices

Dispatch products

Track shipments

Update sales data

Access to system features will be controlled through role-based permissions.

3. Multi-Tenant Architecture

The platform will follow a multi-tenant SaaS architecture.

Traditional Model

One Client → One Software Project

Proposed Platform Model

One Platform → Multiple Clients

Each client can have:

Different modules

Different workflows

Different permissions

Different business rules

However, all clients operate on the same core platform.

Benefits

Faster onboarding

Reduced development cost

Easier maintenance

High scalability

Centralized updates

4. Mobile Application Strategy

The platform will use a Single Mobile Application for all clients.

Approach

A single Flutter mobile application will serve all clients.

When a user logs in:

System identifies the tenant (client company)

Loads the client configuration

Enables modules assigned to that client

Example Login Response
{
  "tenant_id": 12,
  "company": "Happy Kid",
  "modules": ["crm","warehouse","tracking"]
}
Example Tenant Configuration
GET /tenant/config

{
   "company_name": "Oriol",
   "modules": {
      "crm": true,
      "warehouse": true,
      "manufacturing": false
   },
   "theme_color": "#4A7CFF",
   "logo": "oriol_logo.png"
}

The mobile UI dynamically loads the features based on this configuration.

Advantages

Only one mobile app build

Easier updates

SaaS ready architecture

No need to maintain multiple apps

Scalable for many clients

5. Core Platform Modules

The platform will follow a modular architecture.
Modules can be enabled or disabled for each client.

Core Modules

CRM Management

Lead Management

Customer Management

Product Management

Stock Management

Order Management

Warehouse Management

Invoice Management

Dispatch Management

Courier Integration

Product Tracking

Role & Permission Management

Employee Management

Reports & Analytics

6. Additional Modules (Future Expansion)

The system will support additional modules that can be assigned to specific clients.

Examples include:

Manufacturing Management

Retail POS System

Subscription Management

Payment Integration

E-commerce Integration (Shopify, WooCommerce)

Marketing Automation

Inventory Forecasting

AI Sales Prediction

Vendor Management

Procurement Management

Super Admin can assign these modules to a client when onboarding them.

7. Example Client Workflows

Different clients will use different workflows depending on their business model.

7.1 Oriol – Medical Product Distribution
Business Type

Medical product supplier.

Business Flow

Oriol sells products to:

Customers

Retailers

Hospitals

Hospitals receive stock without immediate payment.

Process

Oriol supplies products to hospitals

Hospitals sell products to patients

Hospitals report monthly sales

Oriol tracks:

Product sold

Remaining stock

Product movement

Hospitals can transfer stock between each other

Required Modules

Product management

Stock tracking

Hospital stock allocation

Stock transfer

Sales reporting

7.2 Happy Kid – Baby Product Sales
Order Sources

Orders may come from:

Meta leads

Shopify

Online orders

Meta Lead Workflow

Lead received

Lead assigned to employee

Employee confirms order

Order sent to warehouse

Shopify Orders

Orders received from Shopify
Orders are already confirmed → sent to warehouse

Online Orders

Order received

Admin approval required

Sent to warehouse

Warehouse Process

Generate invoice

Create dispatch sticker

Send to courier

Track delivery

Required Modules

Lead management

Order management

Warehouse management

Invoice generation

Dispatch management

Courier integration

Tracking system

7.3 SayPal – Manufacturing & Distribution
Business Flow

Agency or shop places order

Order reviewed in admin dashboard

Admin approval

Order sent to manufacturing unit

Product manufactured

Invoice generated

Dispatch sticker created

Courier shipment

Product tracking

Required Modules

Order management

Manufacturing workflow

Invoice system

Dispatch system

Courier integration

Product tracking

8. Technology Stack
Mobile Application

Flutter

Web Admin Panel

React.js

Backend

Python Django

Database

PostgreSQL

Architecture

Multi-Tenant SaaS Platform

9. Key Platform Benefits

Multi-tenant SaaS architecture

Custom workflow configuration

Module-based feature assignment

Single mobile application

Highly scalable system

Suitable for multiple industries

Reduced development cost for new clients

Centralized system management

✅ Conclusion

This platform aims to become a flexible SaaS business management system that supports multiple industries by allowing businesses to configure their own workflows, modules, and permissions while running on a single scalable platform.

If you want, I can also help you create the next important documents for this project, which are extremely useful before development:

1️⃣ System Architecture Diagram
2️⃣ Multi-Tenant Database Design
3️⃣ Module Architecture
4️⃣ User Role Matrix
5️⃣ API Structure (Django)
6️⃣ Flutter Dynamic Module Architecture

These will make your project look like a real SaaS startup architecture (similar to Zoho / Odoo). 🚀

# trading
