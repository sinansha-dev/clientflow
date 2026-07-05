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
import { ClientPortalPage } from './pages/portal/client-portal';

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
      { path: '/clients', element: <ClientsListPage /> },
      { path: '/clients/:id', element: <ClientDetailsPage /> },
      { path: '/projects', element: <ProjectsListPage /> },
      { path: '/projects/:id', element: <ProjectDetailsPage /> },
      { path: '/portal', element: <ClientPortalPage /> },
      { path: '/tasks', element: <TasksLayoutPage /> },
      { path: '/timesheets', element: <TimesheetWorkspacePage /> },
      { path: '/calendar', element: <CalendarWorkspacePage /> },
      { path: '/team', element: <TeamListPage /> },
      { path: '/team/:id', element: <TeamProfilePage /> },
      { path: '/invoices', element: <PlaceholderPage title="Invoices" /> },
      { path: '/reports', element: <ReportsWorkspacePage /> },
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
