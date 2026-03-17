# 1. System Architecture Diagram

This architecture provides a scalable, one-to-many SaaS model. It separates responsibilities between the Super Admin provider and individual Client Tenants. 

## High-Level Architecture

```mermaid
graph TD
    subgraph Frontend Layer
        SA[Super Admin Portal<br/>React/Vite]
        CA[Client Portal<br/>React/Vite]
        MA[Mobile App<br/>Flutter]
    end

    subgraph API Layer [Django REST Framework]
        API_GW[API Gateway & Router]
        TM[Tenant Middleware<br/>django-tenants]
        
        API_GW --> TM
    end

    subgraph Core Services
        AUTH[Authentication & JWT]
        CRM[CRM Engine]
        INV[Inventory & Stock]
        ORD[Order & Workflow Mgt]
    end

    subgraph Database Layer [PostgreSQL]
        PS[Public Schema<br/>Global Data & Tenants]
        TS1[Tenant Schema 1<br/>Company A Data]
        TS2[Tenant Schema 2<br/>Company B Data]
        TSN[Tenant Schema N]
    end

    subgraph External Integrations
        META[Meta / Facebook API]
        WA[WhatsApp Business API]
        PAY[Payment Gateway]
    end

    %% Connections
    SA -->|api.traiding.com| API_GW
    CA -->|*.traiding.com| API_GW
    MA -->|api.traiding.com| API_GW

    TM --> AUTH
    TM --> CRM
    TM --> INV
    TM --> ORD

    TM -->|Public Routing| PS
    TM -->|Tenant Routing| TS1
    TM -->|Tenant Routing| TS2

    CRM --> META
    ORD --> WA
    ORD --> PAY
```

## Key Components

1. **Frontend Layer**: 
   - **Super Admin Portal**: Used by the platform owner to manage subscriptions, create tenants, and define which modules a tenant can access. 
   - **Client Portal**: A separate React app accessed via subdomains (e.g., `company1.traiding.com`). This is where clients configure their own roles, employees, and workflows.
   - **Mobile App**: A unified Flutter application that dynamically enables/disables modules based on the logged-in tenant's configuration.

2. **API & Middleware Layer**:
   - The Django application relies on `django-tenants`. The `TenantMainMiddleware` inspects the incoming request subdomain and routes it to the correct PostgreSQL schema.
   
3. **Database Layer**:
   - **Public Schema**: Contains shared models exclusively (e.g., `Tenant`, `Domain`, `Global Subscription Plans`).
   - **Tenant Schemas**: Fully isolated schemas created automatically per client. Contains all business logic models (`Product`, `Order`, `Invoice`, `User Profiles`, etc.). Data cannot bleed between tenants.
