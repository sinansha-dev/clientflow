import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/auth-layout';
import { AppLayout } from './layouts/app-layout';
import { ProtectedRoute } from './routes/protected-route';
import { DashboardPage } from './pages/dashboard';
import { ForgotPasswordPage } from './pages/forgot-password';
import { LoginPage } from './pages/login';
import { NotFoundPage } from './pages/not-found';
import { PlaceholderPage } from './pages/placeholder';
import { ProfilePage } from './pages/profile';
import { ResetPasswordPage } from './pages/reset-password';
import { UnauthorizedPage } from './pages/unauthorized';
import { UsersPage } from './pages/users';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/clients', element: <PlaceholderPage title="Clients" /> },
      { path: '/projects', element: <PlaceholderPage title="Projects" /> },
      { path: '/tasks', element: <PlaceholderPage title="Tasks" /> },
      { path: '/calendar', element: <PlaceholderPage title="Calendar" /> },
      { path: '/team', element: <PlaceholderPage title="Team" /> },
      { path: '/invoices', element: <PlaceholderPage title="Invoices" /> },
      { path: '/reports', element: <PlaceholderPage title="Reports" /> },
      { path: '/settings', element: <PlaceholderPage title="Settings" /> },
      { path: '/profile', element: <ProfilePage /> },
      {
        path: '/users',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
