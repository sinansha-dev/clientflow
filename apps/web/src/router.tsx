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
import { ClientsListPage } from './pages/clients/clients-list';
import { ClientDetailsPage } from './pages/clients/client-details';
import { ProjectsListPage } from './pages/projects/projects-list';
import { ProjectDetailsPage } from './pages/projects/project-details';
import { TasksLayoutPage } from './pages/tasks/tasks-layout';
import { TeamListPage } from './pages/team/team-list';
import { TeamProfilePage } from './pages/team/team-profile';
import { TimesheetWorkspacePage } from './pages/timesheets/timesheet-workspace';
import { CalendarWorkspacePage } from './pages/calendar/calendar-workspace';
import { ReportsWorkspacePage } from './pages/reports/reports-workspace';
import { FinanceWorkspacePage } from './pages/finance/finance-workspace';
import { ClientPortalPage } from './pages/portal/client-portal';

const staffOnly = ['ADMIN', 'STAFF'] as const;

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
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/clients',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <ClientsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/clients/:id',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <ClientDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/projects',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <ProjectsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/projects/:id',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <ProjectDetailsPage />
          </ProtectedRoute>
        ),
      },
      { path: '/portal', element: <ClientPortalPage /> },
      {
        path: '/tasks',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <TasksLayoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/timesheets',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <TimesheetWorkspacePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/calendar',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <CalendarWorkspacePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/team',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <TeamListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/team/:id',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <TeamProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/invoices',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <FinanceWorkspacePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports',
        element: (
          <ProtectedRoute roles={[...staffOnly]}>
            <ReportsWorkspacePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <PlaceholderPage title="Settings" />
          </ProtectedRoute>
        ),
      },
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
