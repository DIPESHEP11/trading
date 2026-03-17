import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import '@/styles/index.css';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import ClientSelectPage from '@/pages/auth/ClientSelectPage';

// Dashboard
import DashboardLayout from '@/components/Layout/DashboardLayout';
import DashboardHomePage from '@/pages/dashboard/DashboardHomePage';

// CRM
import LeadsPage from '@/pages/crm/LeadsPage';
import LeadFormPage from '@/pages/crm/LeadFormPage';
import CrmSettingsPage from '@/pages/crm/CrmSettingsPage';

// Products
import ProductsPage from '@/pages/products/ProductsPage';
import ProductSettingsPage from '@/pages/products/ProductSettingsPage';

// Inventory module
import StockLevelsPage    from '@/pages/inventory/StockLevelsPage';
import MovementsPage      from '@/pages/inventory/MovementsPage';
import WarehousesPage     from '@/pages/inventory/WarehousesPage';
import TransfersPage      from '@/pages/inventory/TransfersPage';
import InventorySettingsPage from '@/pages/inventory/InventorySettingsPage';
import AnalysisPage from '@/pages/inventory/AnalysisPage';
import InventoryApprovalPage from '@/pages/inventory/InventoryApprovalPage';

// Orders
import OrdersPage from '@/pages/orders/OrdersPage';
import OrderSettingsPage from '@/pages/orders/OrderSettingsPage';

// Invoices
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import InvoiceSettingsPage from '@/pages/invoices/InvoiceSettingsPage';

// Settings & History
import SettingsPage from '@/pages/settings/SettingsPage';
import HistoryPage from '@/pages/history/HistoryPage';

// HR / Employees
import EmployeesPage from '@/pages/hr/EmployeesPage';

// Permissions
import PermissionsPage from '@/pages/permissions/PermissionsPage';

// Dispatch
import DispatchPage from '@/pages/dispatch/DispatchPage';
import DispatchSettingsPage from '@/pages/dispatch/DispatchSettingsPage';
// Tracking
import TrackingPage from '@/pages/tracking/TrackingPage';
import DeliveryFormPage from '@/pages/tracking/DeliveryFormPage';
import WarehouseViewPage from '@/pages/warehouse/WarehouseViewPage';
// Module placeholders (warehouse, analytics, manufacturing)
import ModulePage from '@/pages/placeholder/ModulePage';

// ─── Auth Guards ────────────────────────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

/** Only tenant_admin and super_admin can access. Others redirect to dashboard. */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const isAdmin = role === 'tenant_admin' || role === 'super_admin';
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            borderRadius: '10px',
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
        <Route path="/clients" element={<ClientSelectPage />} />
        <Route path="/form/lead" element={<LeadFormPage />} />
        <Route path="/delivery-form/:token" element={<DeliveryFormPage />} />
        <Route path="/warehouse-view/:token" element={<WarehouseViewPage />} />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard/*"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <Routes>
                  <Route index element={<DashboardHomePage />} />

                  {/* CRM */}
                  <Route path="crm/leads" element={<LeadsPage />} />
                  <Route path="crm/settings" element={<AdminRoute><CrmSettingsPage /></AdminRoute>} />

                  {/* Products */}
                  <Route path="products/list" element={<ProductsPage />} />
                  <Route path="products/settings" element={<AdminRoute><ProductSettingsPage /></AdminRoute>} />
                  {/* Legacy redirect */}
                  <Route path="products" element={<Navigate to="/dashboard/products/list" replace />} />

                  {/* Inventory sub-module routes */}
                  <Route path="inventory/stock"      element={<StockLevelsPage />} />
                  <Route path="inventory/movements"  element={<MovementsPage />} />
                  <Route path="inventory/warehouses" element={<WarehousesPage />} />
                  <Route path="inventory/transfers"  element={<TransfersPage />} />
                  <Route path="inventory/analysis"   element={<AnalysisPage />} />
                  <Route path="inventory/approvals"  element={<InventoryApprovalPage />} />
                  <Route path="inventory/settings"   element={<AdminRoute><InventorySettingsPage /></AdminRoute>} />

                  {/* Legacy redirect */}
                  <Route path="stock" element={<Navigate to="/dashboard/inventory/stock" replace />} />
                  <Route path="warehouse" element={<Navigate to="/dashboard/inventory/warehouses" replace />} />

                  {/* Orders */}
                  <Route path="orders/list" element={<OrdersPage />} />
                  <Route path="orders/settings" element={<AdminRoute><OrderSettingsPage /></AdminRoute>} />
                  <Route path="orders" element={<Navigate to="/dashboard/orders/list" replace />} />

                  {/* Invoices */}
                  <Route path="invoices/list" element={<InvoicesPage />} />
                  <Route path="invoices/settings" element={<AdminRoute><InvoiceSettingsPage /></AdminRoute>} />
                  <Route path="invoices" element={<Navigate to="/dashboard/invoices/list" replace />} />

                  {/* Dispatch */}
                  <Route path="dispatch"        element={<DispatchPage />} />
                  <Route path="dispatch/settings" element={<AdminRoute><DispatchSettingsPage /></AdminRoute>} />

                  {/* Placeholder modules (pages in development) */}
                  <Route path="analytics"     element={<ModulePage module="analytics" />} />
                  <Route path="tracking"      element={<TrackingPage />} />
                  <Route path="manufacturing" element={<ModulePage module="manufacturing" />} />

                  {/* HR */}
                  <Route path="employees" element={<EmployeesPage />} />

                  {/* Settings, Permissions, History — admin only */}
                  <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                  <Route path="permissions" element={<AdminRoute><PermissionsPage /></AdminRoute>} />
                  <Route path="history" element={<AdminRoute><HistoryPage /></AdminRoute>} />

                  {/* Catch-all within dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            </PrivateRoute>
          }
        />

        <Route path="/" element={
          typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? <Navigate to="/clients" replace />
            : <Navigate to="/dashboard" replace />
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
