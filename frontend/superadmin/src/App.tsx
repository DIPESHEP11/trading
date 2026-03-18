import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/api/axiosInstance';
import '@/styles/index.css';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';

// Dashboard
import DashboardLayout from '@/components/Layout/DashboardLayout';
import DashboardHomePage from '@/pages/dashboard/DashboardHomePage';

// Clients / Tenants (Superadmin)
import ClientsPage from '@/pages/clients/ClientsPage';
import RegisterClientPage from '@/pages/clients/RegisterClientPage';
import ClientDetailsPage from '@/pages/clients/ClientDetailsPage';

// Plans (Superadmin)
import PlansPage from '@/pages/plans/PlansPage';

// Client Admins (Superadmin)
import ClientAdminsPage from '@/pages/users/ClientAdminsPage';
import SettingsPage from '@/pages/settings/SettingsPage';

// ─── Auth Guards ────────────────────────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isAuthenticated) return;
    axiosInstance.get('/auth/me/').catch(() => {
      logout();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    });
  }, [isAuthenticated, logout]);

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
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

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard/*"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <Routes>
                  <Route index element={<DashboardHomePage />} />

                  {/* Clients */}
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/register" element={<RegisterClientPage />} />
                  <Route path="clients/:id" element={<ClientDetailsPage />} />

                  {/* Plans */}
                  <Route path="plans" element={<PlansPage />} />

                  {/* Client Admins */}
                  <Route path="users" element={<ClientAdminsPage />} />

                  {/* Settings */}
                  <Route path="settings" element={<SettingsPage />} />

                  {/* Catch-all within dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            </PrivateRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
