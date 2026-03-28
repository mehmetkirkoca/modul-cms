import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from './lib/auth-store.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/login/LoginPage.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { UsersPage } from './pages/users/UsersPage.js';
import { PluginsPage } from './pages/plugins/PluginsPage.js';
import { PostsPage } from './pages/content/PostsPage.js';
import { PostEditPage } from './pages/content/PostEditPage.js';
import { CategoriesPage } from './pages/content/CategoriesPage.js';

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

const postsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/content/posts',
  component: PostsPage,
});

const postEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/content/posts/$id',
  component: PostEditPage,
});

const postNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/content/posts/new',
  component: PostEditPage,
});

const categoriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/content/categories',
  component: CategoriesPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    usersRoute,
    pluginsRoute,
    postsRoute,
    postEditRoute,
    postNewRoute,
    categoriesRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
