from django.urls import path, include

urlpatterns = [
    # ── Core auth & user management ───────────────────────────────────────
    path('auth/', include('api.v1.auth.urls')),
    path('users/', include('api.v1.users.urls')),
    path('tenants/', include('api.v1.tenants.urls')),

    # ── Tenant configuration (Flutter endpoint) ─────────────────────────
    path('tenant/config/', include('api.v1.config.urls')),

    # ── Module history (client admin only) ─────────────────────────────────
    path('history/', include('api.v1.history.urls')),

    # ── BRD Phase 1 modules ──────────────────────────────────────────────
    path('crm/', include('api.v1.crm.urls')),
    path('products/', include('api.v1.products.urls')),
    path('stock/', include('api.v1.stock.urls')),
    path('orders/', include('api.v1.orders.urls')),
    path('invoices/', include('api.v1.invoices.urls')),
    path('tracking/', include('api.v1.tracking.urls')),
    path('hr/', include('api.v1.hr.urls')),
    path('manufacturing/', include('apps.manufacturing.urls')),

    # ── Dashboard stats (tenant-scoped) ─────────────────────────────────
    path('dashboard/', include('api.v1.dashboard.urls')),

    # ── Subscription plans (superadmin-managed, public schema) ───────────
    path('plans/', include('api.v1.plans.urls')),

    # ── External integrations ────────────────────────────────────────────
    path('integrations/', include('api.v1.integrations.urls')),
]
