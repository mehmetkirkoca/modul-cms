import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from './lib/auth-store.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/login/LoginPage.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { UsersPage } from './pages/users/UsersPage.js';
import { PluginsPage } from './pages/plugins/PluginsPage.js';
import { PluginPage } from './pages/plugins/PluginPage.js';

const rootRoute = createRootRoute();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AppShell,
  beforeLoad: () => {
    if (!useAuthStore.getState().accessToken) {
      throw redirect({ to: '/login' });
    }
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: DashboardPage,
});

const usersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/users',
  component: UsersPage,
});

const pluginsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/plugins',
  component: PluginsPage,
});

export const pluginPageRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/plugins/$component',
  component: PluginPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    usersRoute,
    pluginsRoute,
    pluginPageRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
