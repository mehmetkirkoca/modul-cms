# Faz 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin shell'i bare React + Web Components outlet'e yeniden yaz; content plugin'i submodule'e taşı ve admin Web Components ekle; Next.js starter temayı plugin-aware MVC yapısıyla submodule olarak oluştur.

**Architecture:** React admin shell, plugin UI'larını `<PluginOutlet>` üzerinden Web Component olarak mount eder. Core yeni üç endpoint sunar: navigation, plugins/active, plugin bundle static serving. Content plugin kendi admin bundle'ını esbuild ile derler. Next.js tema `[[...slug]]` front controller + routes/web.ts üzerinden plugin-aware çalışır.

**Tech Stack:** Node.js/Fastify (core), React/TanStack Router (admin shell), Vanilla TS/Web Components + esbuild (plugin admin), Next.js 15/React 19 (tema)

---

## Dosya Haritası

### Oluşturulacak
- `packages/core/src/api/rest/admin.routes.ts` — navigation, plugins/active, theme activation
- `packages/core/src/tests/admin.test.ts` — admin endpoint testleri
- `packages/admin/src/components/PluginOutlet.tsx` — Web Component mount
- `plugins/content/admin/package.json` — esbuild setup
- `plugins/content/admin/tsconfig.json`
- `plugins/content/admin/src/index.ts` — custom elements register
- `plugins/content/admin/src/lib/api.ts` — fetch wrapper
- `plugins/content/admin/src/components/posts-page.ts`
- `plugins/content/admin/src/components/post-edit.ts`
- `plugins/content/admin/src/components/categories-page.ts`
- `themes/module-theme-nextjs/package.json`
- `themes/module-theme-nextjs/tsconfig.json`
- `themes/module-theme-nextjs/next.config.ts`
- `themes/module-theme-nextjs/theme.manifest.json`
- `themes/module-theme-nextjs/app/layout.tsx`
- `themes/module-theme-nextjs/app/globals.css`
- `themes/module-theme-nextjs/app/[[...slug]]/page.tsx`
- `themes/module-theme-nextjs/routes/web.ts`
- `themes/module-theme-nextjs/controllers/HomeController.ts`
- `themes/module-theme-nextjs/controllers/PostController.ts`
- `themes/module-theme-nextjs/controllers/CategoryController.ts`
- `themes/module-theme-nextjs/views/home.tsx`
- `themes/module-theme-nextjs/views/post.tsx`
- `themes/module-theme-nextjs/views/category.tsx`
- `themes/module-theme-nextjs/views/not-found.tsx`
- `themes/module-theme-nextjs/lib/cms-client.ts`
- `themes/module-theme-nextjs/lib/route-matcher.ts`

### Değiştirilecek
- `packages/core/src/app.ts` — admin routes register, plugin bundle static serving
- `packages/core/src/db/repositories/plugin.repository.ts` — `listActive()` ekle
- `packages/admin/src/router.ts` — content routes kaldır
- `packages/admin/src/main.tsx` — `window.__CMS_TOKEN__` inject
- `packages/admin/src/pages/plugins/PluginsPage.tsx` — navigation API + outlet
- `plugins/content/plugin.manifest.ts` — adminPages ekle

### Silinecek
- `packages/admin/src/pages/content/PostsPage.tsx`
- `packages/admin/src/pages/content/PostEditPage.tsx`
- `packages/admin/src/pages/content/CategoriesPage.tsx`

---

## Task 1: Submodule Repo Kurulumu

**Ön koşul:** GitHub hesabınızda iki yeni repo oluşturun (Settings → Repositories → New):
- `module-plugin-content` (private veya public)
- `module-theme-nextjs` (private veya public)

**Files:**
- Modify: `.gitmodules` (git tarafından yönetilir)

- [ ] **Step 1: `plugins/content` reposunu GitHub'a push et**

```bash
cd /home/mehmet/Documents/moduleCMS/plugins/content
git init
git add .
git commit -m "feat: initial content plugin"
git remote add origin https://github.com/YOUR_USERNAME/module-plugin-content.git
git push -u origin main
cd /home/mehmet/Documents/moduleCMS
```

- [ ] **Step 2: `plugins/content` dizinini sil ve submodule olarak ekle**

```bash
cd /home/mehmet/Documents/moduleCMS
git rm -r --cached plugins/content
rm -rf plugins/content
git submodule add https://github.com/YOUR_USERNAME/module-plugin-content.git plugins/content
git submodule update --init --recursive
```

- [ ] **Step 3: `themes/` dizinini oluştur, tema submodule'ü ekle**

```bash
mkdir -p themes
git submodule add https://github.com/YOUR_USERNAME/module-theme-nextjs.git themes/module-theme-nextjs
```

Not: Tema reposu boş olabilir, içeriği Task 5'te doldurulacak.

- [ ] **Step 4: `.gitmodules` dosyasını doğrula**

```
[submodule "plugins/content"]
	path = plugins/content
	url = https://github.com/YOUR_USERNAME/module-plugin-content.git
[submodule "themes/module-theme-nextjs"]
	path = themes/module-theme-nextjs
	url = https://github.com/YOUR_USERNAME/module-theme-nextjs.git
```

Komut: `cat .gitmodules`
Beklenen: İki submodule girişi

- [ ] **Step 5: Commit**

```bash
git add .gitmodules plugins/content themes/
git commit -m "chore: convert plugins/content and themes/module-theme-nextjs to git submodules"
```

---

## Task 2: Core — Yeni Admin Endpointleri

**Files:**
- Create: `packages/core/src/api/rest/admin.routes.ts`
- Create: `packages/core/src/tests/admin.test.ts`
- Modify: `packages/core/src/db/repositories/plugin.repository.ts`
- Modify: `packages/core/src/app.ts`

- [ ] **Step 1: `plugin.repository.ts`'e `listActive()` ekle**

`packages/core/src/db/repositories/plugin.repository.ts` içinde mevcut `list()` metodunun hemen altına:

```typescript
  async listActive() {
    return db.select().from(pluginRegistry).where(eq(pluginRegistry.status, 'active'));
  },
```

- [ ] **Step 2: Failing testleri yaz**

`packages/core/src/tests/admin.test.ts` dosyasını oluştur:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    redis: { on: () => {}, quit: async () => {} } as never,
    jwtSecret: 'test-secret',
  });
});

afterAll(async () => {
  await app.close();
});

async function login() {
  // Bu test DB'de seed user gerektirir — integration test
  return 'test-token';
}

describe('GET /api/v1/admin/navigation', () => {
  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/navigation',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/plugins/active', () => {
  it('returns array of active plugin names', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plugins/active',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/v1/themes/:name/activate', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/themes/module-theme-nextjs/activate',
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: Testleri çalıştır — fail etmeli**

```bash
cd /home/mehmet/Documents/moduleCMS
pnpm --filter @module-cms/core test 2>&1 | tail -20
```

Beklenen: `Cannot find module '../app.js'` veya route not found hataları

- [ ] **Step 4: `admin.routes.ts` dosyasını oluştur**

`packages/core/src/api/rest/admin.routes.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { configRepository } from '../../db/repositories/config.repository.js';
import { requireAuth } from '../../auth/middleware.js';

interface AdminPage {
  path: string;
  component: string;
  label: string;
  icon?: string;
}

interface ThemeManifest {
  name: string;
  version: string;
  framework: string;
  requires?: string[];
}

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/v1/admin/navigation — auth gerekli
  app.get('/navigation', { preHandler: requireAuth }, async (_request, reply) => {
    const plugins = await pluginRepository.listActive();
    const navigation = plugins
      .filter((p) => p.adminPages && (p.adminPages as AdminPage[]).length > 0)
      .flatMap((p) =>
        (p.adminPages as AdminPage[]).map((page) => ({
          ...page,
          bundleUrl: `/plugins/${p.name}/admin.js`,
        })),
      );
    return reply.send(navigation);
  });

  // GET /api/v1/plugins/active — public
  app.get('/plugins/active', async (_request, reply) => {
    const plugins = await pluginRepository.listActive();
    return reply.send(plugins.map((p) => p.name));
  });

  // POST /api/v1/themes/:name/activate — auth gerekli
  app.post('/themes/:name/activate', { preHandler: requireAuth }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.status(400).send({ error: 'INVALID_THEME_NAME' });
    }

    const manifestPath = path.resolve(
      process.cwd(),
      `../../themes/${name}/theme.manifest.json`,
    );

    if (!existsSync(manifestPath)) {
      return reply.status(404).send({ error: 'THEME_NOT_FOUND', name });
    }

    const manifest: ThemeManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    const activePlugins = await pluginRepository.listActive();
    const activeNames = activePlugins.map((p) => p.name);
    const missing = (manifest.requires ?? []).filter((r) => !activeNames.includes(r));

    if (missing.length > 0) {
      return reply.status(400).send({ error: 'MISSING_PLUGINS', missing });
    }

    await configRepository.set('active_theme', name);
    return reply.send({ theme: name, activated: true });
  });
}
```

- [ ] **Step 5: `app.ts`'e admin routes ve plugin bundle serving ekle**

`packages/core/src/app.ts` içinde mevcut imports bloğuna ekle:

```typescript
import { adminRoutes } from './api/rest/admin.routes.js';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
```

`app.ts` içinde `pluginsRoutes` kaydının hemen altına ekle:

```typescript
  // Admin routes
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(async (fastify) => {
    fastify.get('/api/v1/plugins/active', async (_req, reply) => {
      // adminRoutes'taki /plugins/active ile çakışmasın diye burada tekrar register edilmez
      // adminRoutes prefix'i /api/v1/admin olduğundan /api/v1/plugins/active ayrı kayıt ister
    });
  });
```

**Not:** `plugins/active` endpoint'i prefix uyuşmazlığı nedeniyle doğrudan `app.ts`'te kayıtlanır. `adminRoutes`'taki `/plugins/active` route'unu `/api/v1/admin/navigation` ile aynı dosyada tutmak için prefix'i `''` yapıyoruz. `app.ts`'te şöyle kayıt yap:

```typescript
  // adminRoutes prefix olmadan register — kendi prefix'lerini içeriyor
  await app.register(adminRoutes, { prefix: '/api/v1' });
```

Ve `admin.routes.ts` içindeki path'leri güncelle:

```typescript
// navigation: '/admin/navigation'
// plugins/active: '/plugins/active'
// themes activate: '/themes/:name/activate'
app.get('/admin/navigation', { preHandler: requireAuth }, ...);
app.get('/plugins/active', ...);
app.post('/themes/:name/activate', { preHandler: requireAuth }, ...);
```

- [ ] **Step 6: Plugin bundle static serving ekle**

`app.ts`'te `adminRoutes` kaydının hemen altına:

```typescript
  // Plugin admin bundle static serving
  app.get('/plugins/:name/admin.js', async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.status(400).send({ error: 'INVALID_PLUGIN_NAME' });
    }
    const bundlePath = path.resolve(
      process.cwd(),
      `../../plugins/${name}/admin/dist/index.js`,
    );
    if (!existsSync(bundlePath)) {
      return reply.status(404).send({ error: 'BUNDLE_NOT_FOUND' });
    }
    const content = await readFile(bundlePath, 'utf-8');
    return reply.type('application/javascript').send(content);
  });
```

- [ ] **Step 7: Testleri çalıştır — pass etmeli**

```bash
pnpm --filter @module-cms/core test 2>&1 | tail -20
```

Beklenen: `GET /api/v1/plugins/active` → PASS, auth testleri PASS

- [ ] **Step 8: Core'u başlat ve endpoint'leri test et**

```bash
pkill -f "tsx watch" 2>/dev/null; sleep 1
pnpm --filter @module-cms/core dev > /tmp/core.log 2>&1 &
sleep 5

TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@modulecms.dev","password":"admin123"}' | jq -r '.accessToken')

echo "=== plugins/active ==="
curl -s http://localhost:3000/api/v1/plugins/active | jq .

echo "=== admin/navigation (with auth) ==="
curl -s http://localhost:3000/api/v1/admin/navigation \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Beklenen:
```
=== plugins/active ===
["content"]
=== admin/navigation ===
[]   ← content plugin henüz adminPages içermiyor, Task 4'te eklenecek
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/api/rest/admin.routes.ts \
        packages/core/src/tests/admin.test.ts \
        packages/core/src/db/repositories/plugin.repository.ts \
        packages/core/src/app.ts
git commit -m "feat: add admin navigation, plugins/active, and theme activation endpoints"
```

---

## Task 3: Admin Shell Yeniden Yapılandırması

**Files:**
- Delete: `packages/admin/src/pages/content/PostsPage.tsx`
- Delete: `packages/admin/src/pages/content/PostEditPage.tsx`
- Delete: `packages/admin/src/pages/content/CategoriesPage.tsx`
- Modify: `packages/admin/src/router.ts`
- Modify: `packages/admin/src/main.tsx`
- Modify: `packages/admin/src/pages/plugins/PluginsPage.tsx`
- Create: `packages/admin/src/components/PluginOutlet.tsx`

- [ ] **Step 1: Content sayfalarını sil**

```bash
rm packages/admin/src/pages/content/PostsPage.tsx
rm packages/admin/src/pages/content/PostEditPage.tsx
rm packages/admin/src/pages/content/CategoriesPage.tsx
rmdir packages/admin/src/pages/content 2>/dev/null || true
```

- [ ] **Step 2: `router.ts`'i güncelle — content routes kaldır**

`packages/admin/src/router.ts` dosyasını tamamen şununla değiştir:

```typescript
import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from './lib/auth-store.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/login/LoginPage.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { UsersPage } from './pages/users/UsersPage.js';
import { PluginsPage } from './pages/plugins/PluginsPage.js';

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

const pluginPageRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/plugins/$pluginPath',
  component: PluginsPage,
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
```

- [ ] **Step 3: `PluginOutlet.tsx` oluştur**

`packages/admin/src/components/PluginOutlet.tsx`:

```typescript
import { useEffect, useRef } from 'react';

interface PluginOutletProps {
  component: string;   // custom element adı, örn: 'content-posts-page'
  bundleUrl: string;   // '/plugins/content/admin.js'
}

const loadedBundles = new Set<string>();

export function PluginOutlet({ component, bundleUrl }: PluginOutletProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      // Bundle daha önce yüklenmediyse script tag inject et
      if (!loadedBundles.has(bundleUrl)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = bundleUrl;
          script.onload = () => { loadedBundles.add(bundleUrl); resolve(); };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Custom element'i container'a mount et
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const el = document.createElement(component);
        containerRef.current.appendChild(el);
      }
    };

    load().catch(console.error);
  }, [component, bundleUrl]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 4: `PluginsPage.tsx`'i güncelle**

`packages/admin/src/pages/plugins/PluginsPage.tsx` dosyasını tamamen şununla değiştir:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { apiClient } from '../../lib/api-client.js';
import { PluginOutlet } from '../../components/PluginOutlet.js';

interface Plugin {
  name: string;
  version: string;
  status: string;
  runtime: string;
  registeredAt: string;
}

interface NavItem {
  path: string;
  component: string;
  label: string;
  bundleUrl: string;
}

export function PluginsPage() {
  const params = useParams({ strict: false }) as { pluginPath?: string };
  const activePath = params.pluginPath ? `/${params.pluginPath}` : null;

  const { data: pluginsData, isLoading: pluginsLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => apiClient.get<{ plugins: Plugin[] }>('/plugins').then((r) => r.data),
  });

  const { data: navItems = [] } = useQuery({
    queryKey: ['admin-navigation'],
    queryFn: () => apiClient.get<NavItem[]>('/admin/navigation').then((r) => r.data),
  });

  const activeNavItem = activePath
    ? navItems.find((n) => n.path === activePath)
    : null;

  return (
    <div className="flex gap-6">
      {/* Sol panel: plugin listesi + nav */}
      <div className="w-64 flex-shrink-0">
        <h1 className="text-xl font-semibold mb-4">Plugins</h1>

        {pluginsLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : (
          <div className="space-y-1">
            {pluginsData?.plugins.map((p) => {
              const pluginNavItems = navItems.filter((n) =>
                n.bundleUrl.includes(`/plugins/${p.name}/`),
              );
              return (
                <div key={p.name} className="mb-3">
                  <div className="text-xs font-medium text-gray-500 uppercase px-2 mb-1">
                    {p.name}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  {pluginNavItems.map((nav) => (
                    <Link
                      key={nav.path}
                      to="/plugins/$pluginPath"
                      params={{ pluginPath: nav.path.replace(/^\//, '') }}
                      className="block px-3 py-1.5 text-sm rounded hover:bg-gray-100"
                      activeProps={{ className: 'bg-gray-100 font-medium' }}
                    >
                      {nav.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sağ panel: plugin outlet */}
      <div className="flex-1">
        {activeNavItem ? (
          <PluginOutlet
            component={activeNavItem.component}
            bundleUrl={activeNavItem.bundleUrl}
          />
        ) : (
          <div className="text-gray-500 text-sm">
            Soldaki menüden bir plugin sayfası seçin.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `main.tsx`'e `window.__CMS_TOKEN__` inject ekle**

`packages/admin/src/main.tsx` dosyasını şununla değiştir:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client.js';
import { router } from './router.js';
import { useAuthStore } from './lib/auth-store.js';
import './index.css';

// Web Components'ın JWT'ye erişebilmesi için token'ı window'a yaz
// Token değiştiğinde güncelle
useAuthStore.subscribe((state) => {
  (window as unknown as Record<string, unknown>)['__CMS_TOKEN__'] = state.accessToken;
});
// İlk yüklemede mevcut token'ı set et
(window as unknown as Record<string, unknown>)['__CMS_TOKEN__'] =
  useAuthStore.getState().accessToken;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Admin'i build et ve hata kontrol et**

```bash
pnpm --filter @module-cms/admin build 2>&1 | tail -20
```

Beklenen: Build başarılı, içerik sayfalarına referans yok

- [ ] **Step 7: Commit**

```bash
git add packages/admin/src/
git commit -m "feat: rebuild admin shell — bare React + PluginOutlet, remove content pages"
```

---

## Task 4: Content Plugin Admin Web Components

**Files:** (hepsi `plugins/content/admin/` altında)
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/lib/api.ts`
- Create: `src/components/posts-page.ts`
- Create: `src/components/post-edit.ts`
- Create: `src/components/categories-page.ts`
- Modify: `plugins/content/plugin.manifest.ts`

- [ ] **Step 1: `admin/package.json` oluştur**

`plugins/content/admin/package.json`:

```json
{
  "name": "@module-cms/plugin-content-admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "esbuild src/index.ts --bundle --outfile=dist/index.js --format=iife --target=es2020 --minify",
    "dev": "esbuild src/index.ts --bundle --outfile=dist/index.js --format=iife --target=es2020 --watch"
  },
  "devDependencies": {
    "esbuild": "^0.20.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: `admin/tsconfig.json` oluştur**

`plugins/content/admin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `src/lib/api.ts` oluştur**

`plugins/content/admin/src/lib/api.ts`:

```typescript
function getToken(): string {
  return ((window as unknown as Record<string, unknown>)['__CMS_TOKEN__'] as string) ?? '';
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: `src/components/posts-page.ts` oluştur**

`plugins/content/admin/src/components/posts-page.ts`:

```typescript
import { apiFetch } from '../lib/api.js';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
}

export class ContentPostsPage extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = '<p style="color:#6b7280;font-size:14px">Loading posts...</p>';
    try {
      const { posts } = await apiFetch<{ posts: Post[] }>('/api/v1/content/posts');
      this.render(posts);
    } catch (e) {
      this.innerHTML = `<p style="color:red">Error: ${(e as Error).message}</p>`;
    }
  }

  render(posts: Post[]) {
    this.innerHTML = `
      <div style="font-family:system-ui,sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="font-size:20px;font-weight:600;margin:0">Posts</h2>
          <button id="new-post-btn" style="background:#111;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px">
            New Post
          </button>
        </div>
        <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase">Title</th>
                <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase">Status</th>
                <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase">Date</th>
                <th style="padding:10px 16px"></th>
              </tr>
            </thead>
            <tbody>
              ${posts.map((p) => `
                <tr style="border-top:1px solid #f3f4f6" data-id="${p.id}">
                  <td style="padding:12px 16px;font-size:14px;font-weight:500">${this.escape(p.title)}</td>
                  <td style="padding:12px 16px;font-size:13px">
                    <span style="padding:2px 8px;border-radius:12px;font-size:12px;background:${p.status === 'published' ? '#dcfce7' : '#f3f4f6'};color:${p.status === 'published' ? '#15803d' : '#6b7280'}">
                      ${p.status}
                    </span>
                  </td>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280">${new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style="padding:12px 16px;text-align:right">
                    <button class="edit-btn" data-id="${p.id}" style="font-size:12px;color:#4b5563;background:none;border:1px solid #d1d5db;padding:4px 10px;border-radius:4px;cursor:pointer">Edit</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${posts.length === 0 ? '<p style="text-align:center;padding:32px;color:#9ca3af;font-size:14px">No posts yet.</p>' : ''}
        </div>
      </div>
    `;

    this.querySelector('#new-post-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cms-navigate', { bubbles: true, detail: { path: '/content/new' } }));
    });

    this.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id'];
        this.dispatchEvent(new CustomEvent('cms-navigate', { bubbles: true, detail: { path: `/content/edit/${id}` } }));
      });
    });
  }

  private escape(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('content-posts-page', ContentPostsPage);
```

- [ ] **Step 5: `src/components/post-edit.ts` oluştur**

`plugins/content/admin/src/components/post-edit.ts`:

```typescript
import { apiFetch } from '../lib/api.js';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  status: string;
}

export class ContentPostEdit extends HTMLElement {
  private postId: string | null = null;

  async connectedCallback() {
    this.postId = this.getAttribute('post-id');
    let post: Post | null = null;

    if (this.postId) {
      try {
        const data = await apiFetch<{ post: Post }>(`/api/v1/content/posts/${this.postId}`);
        post = data.post;
      } catch {
        this.innerHTML = '<p style="color:red">Post not found.</p>';
        return;
      }
    }

    this.render(post);
  }

  render(post: Post | null) {
    const title = post?.title ?? '';
    const slug = post?.slug ?? '';
    const excerpt = post?.excerpt ?? '';
    const content = typeof post?.content === 'string' ? post.content : JSON.stringify(post?.content ?? '');
    const isNew = !post;

    this.innerHTML = `
      <div style="font-family:system-ui,sans-serif;max-width:720px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 style="font-size:20px;font-weight:600;margin:0">${isNew ? 'New Post' : 'Edit Post'}</h2>
          <div style="display:flex;gap:8px">
            ${!isNew && post?.status !== 'published' ? `
              <button id="publish-btn" style="border:1px solid #16a34a;color:#16a34a;background:none;padding:6px 14px;border-radius:6px;font-size:13px;cursor:pointer">Publish</button>
            ` : ''}
            <button id="save-btn" style="background:#111;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:13px;cursor:pointer">Save</button>
          </div>
        </div>
        <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:24px;display:flex;flex-direction:column;gap:16px">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Title
            <input id="f-title" value="${this.escape(title)}" style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Slug
            <input id="f-slug" value="${this.escape(slug)}" style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:13px;font-family:monospace" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Excerpt
            <input id="f-excerpt" value="${this.escape(excerpt)}" style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Content
            <textarea id="f-content" rows="16" style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:13px;font-family:monospace;resize:vertical">${this.escape(content)}</textarea>
          </label>
        </div>
        <p id="status-msg" style="font-size:13px;color:#6b7280;margin-top:8px"></p>
      </div>
    `;

    const titleInput = this.querySelector<HTMLInputElement>('#f-title')!;
    const slugInput  = this.querySelector<HTMLInputElement>('#f-slug')!;

    titleInput.addEventListener('input', () => {
      if (isNew) {
        slugInput.value = titleInput.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
    });

    this.querySelector('#save-btn')?.addEventListener('click', () => this.save(isNew));
    this.querySelector('#publish-btn')?.addEventListener('click', () => this.publish());
  }

  private async save(isNew: boolean) {
    const btn = this.querySelector<HTMLButtonElement>('#save-btn')!;
    const msg = this.querySelector<HTMLElement>('#status-msg')!;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const body = {
      title:   (this.querySelector<HTMLInputElement>('#f-title')!).value,
      slug:    (this.querySelector<HTMLInputElement>('#f-slug')!).value,
      excerpt: (this.querySelector<HTMLInputElement>('#f-excerpt')!).value,
      content: (this.querySelector<HTMLTextAreaElement>('#f-content')!).value,
    };

    try {
      if (isNew) {
        await apiFetch('/api/v1/content/posts', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/v1/content/posts/${this.postId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      msg.textContent = 'Saved.';
      msg.style.color = '#16a34a';
      this.dispatchEvent(new CustomEvent('cms-navigate', { bubbles: true, detail: { path: '/content' } }));
    } catch (e) {
      msg.textContent = `Error: ${(e as Error).message}`;
      msg.style.color = 'red';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  private async publish() {
    if (!this.postId) return;
    try {
      await apiFetch(`/api/v1/content/posts/${this.postId}/publish`, { method: 'POST' });
      this.dispatchEvent(new CustomEvent('cms-navigate', { bubbles: true, detail: { path: '/content' } }));
    } catch (e) {
      alert(`Publish failed: ${(e as Error).message}`);
    }
  }

  private escape(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

customElements.define('content-post-edit', ContentPostEdit);
```

- [ ] **Step 6: `src/components/categories-page.ts` oluştur**

`plugins/content/admin/src/components/categories-page.ts`:

```typescript
import { apiFetch } from '../lib/api.js';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export class ContentCategoriesPage extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = '<p style="color:#6b7280;font-size:14px">Loading...</p>';
    try {
      const categories = await apiFetch<Category[]>('/api/v1/content/categories');
      this.render(categories);
    } catch (e) {
      this.innerHTML = `<p style="color:red">Error: ${(e as Error).message}</p>`;
    }
  }

  render(categories: Category[]) {
    this.innerHTML = `
      <div style="font-family:system-ui,sans-serif">
        <h2 style="font-size:20px;font-weight:600;margin:0 0 16px">Categories</h2>
        <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:24px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase">Name</th>
                <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase">Slug</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map((c) => `
                <tr style="border-top:1px solid #f3f4f6">
                  <td style="padding:10px 16px;font-size:14px">${this.escape(c.name)}</td>
                  <td style="padding:10px 16px;font-size:13px;font-family:monospace;color:#6b7280">${this.escape(c.slug)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${categories.length === 0 ? '<p style="text-align:center;padding:24px;color:#9ca3af;font-size:14px">No categories yet.</p>' : ''}
        </div>

        <h3 style="font-size:16px;font-weight:600;margin:0 0 12px">New Category</h3>
        <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:16px;display:flex;gap:12px;align-items:flex-end">
          <label style="flex:1;display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Name
            <input id="cat-name" style="border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:14px" />
          </label>
          <label style="flex:1;display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151">
            Slug
            <input id="cat-slug" style="border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px;font-family:monospace" />
          </label>
          <button id="add-btn" style="background:#111;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap">Add</button>
        </div>
        <p id="cat-msg" style="font-size:13px;color:#6b7280;margin-top:6px"></p>
      </div>
    `;

    const nameInput = this.querySelector<HTMLInputElement>('#cat-name')!;
    const slugInput = this.querySelector<HTMLInputElement>('#cat-slug')!;

    nameInput.addEventListener('input', () => {
      slugInput.value = nameInput.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    });

    this.querySelector('#add-btn')?.addEventListener('click', async () => {
      const msg = this.querySelector<HTMLElement>('#cat-msg')!;
      try {
        await apiFetch('/api/v1/content/categories', {
          method: 'POST',
          body: JSON.stringify({ name: nameInput.value, slug: slugInput.value }),
        });
        // Sayfayı yenile
        await this.connectedCallback();
      } catch (e) {
        msg.textContent = `Error: ${(e as Error).message}`;
        msg.style.color = 'red';
      }
    });
  }

  private escape(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('content-categories-page', ContentCategoriesPage);
```

- [ ] **Step 7: `src/index.ts` oluştur**

`plugins/content/admin/src/index.ts`:

```typescript
import './components/posts-page.js';
import './components/post-edit.js';
import './components/categories-page.js';
```

- [ ] **Step 8: `plugin.manifest.ts`'e `adminPages` ekle**

`plugins/content/plugin.manifest.ts` içindeki manifest objesine `adminPages` alanı ekle:

```typescript
import type { PluginManifest } from '@module-cms/sdk';

const manifest: PluginManifest = {
  name:    'content',
  version: '1.0.0',
  runtime: 'in-process',
  communication: {
    external: 'event-or-core-api-only',
    internal: 'direct-call',
  },
  subscribes: ['core:user:updated:v1'],
  publishes:  ['content:post:saved:v1', 'content:post:published:v1'],
  adminPages: [
    { path: '/content',          component: 'content-posts-page',     label: 'Posts'      },
    { path: '/content/new',      component: 'content-post-edit',      label: 'New Post'   },
    { path: '/categories',       component: 'content-categories-page', label: 'Categories' },
  ],
};

export default manifest;
```

- [ ] **Step 9: Admin bundle'ı build et**

```bash
cd /home/mehmet/Documents/moduleCMS/plugins/content/admin
pnpm install
pnpm build
ls -lh dist/index.js
```

Beklenen: `dist/index.js` dosyası oluşmuş (~50-200KB)

- [ ] **Step 10: Canlı test — Web Component admin'de görünüyor mu?**

```bash
# Core restart
pkill -f "tsx watch" 2>/dev/null; sleep 1
pnpm --filter @module-cms/core dev > /tmp/core.log 2>&1 &
sleep 5

# navigation endpoint test
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@modulecms.dev","password":"admin123"}' | jq -r '.accessToken')

curl -s http://localhost:3000/api/v1/admin/navigation \
  -H "Authorization: Bearer $TOKEN" | jq .

# plugin bundle test
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/plugins/content/admin.js
```

Beklenen:
```json
[
  { "path": "/content", "component": "content-posts-page", "label": "Posts", "bundleUrl": "/plugins/content/admin.js" },
  ...
]
200
```

- [ ] **Step 11: Admin frontend'i başlat ve manuel test et**

```bash
pnpm --filter @module-cms/admin dev &
# http://localhost:5174 aç
# Login → Plugins → content listesinde "Posts" linkine tıkla
# content-posts-page Web Component mount olmalı
```

- [ ] **Step 12: Content plugin reposuna commit et ve push et**

```bash
cd /home/mehmet/Documents/moduleCMS/plugins/content
git add admin/ plugin.manifest.ts
git commit -m "feat: add admin Web Components (posts, post-edit, categories)"
git push origin main
```

- [ ] **Step 13: Ana repoya submodule güncelleme commit et**

```bash
cd /home/mehmet/Documents/moduleCMS
git add plugins/content
git commit -m "chore: update content plugin submodule (admin Web Components)"
```

---

## Task 5: Next.js Starter Tema

**Files:** (hepsi `themes/module-theme-nextjs/` altında)

- [ ] **Step 1: `package.json` oluştur**

`themes/module-theme-nextjs/package.json`:

```json
{
  "name": "module-theme-nextjs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json` ve `next.config.ts` oluştur**

`themes/module-theme-nextjs/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`themes/module-theme-nextjs/next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  // CMS API sunucusuna proxy — CORS sorunlarını önler
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.CMS_API_URL ?? 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
};

export default config;
```

- [ ] **Step 3: `theme.manifest.json` oluştur**

`themes/module-theme-nextjs/theme.manifest.json`:

```json
{
  "name": "module-theme-nextjs",
  "version": "1.0.0",
  "framework": "nextjs",
  "requires": ["content"]
}
```

- [ ] **Step 4: `lib/cms-client.ts` oluştur**

`themes/module-theme-nextjs/lib/cms-client.ts`:

```typescript
const CMS_API_URL = process.env.CMS_API_URL ?? 'http://localhost:3000';

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  excerpt: string | null;
  status: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export async function getActivePlugins(): Promise<string[]> {
  const res = await fetch(`${CMS_API_URL}/api/v1/plugins/active`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getPosts(params: { page?: number; perPage?: number } = {}): Promise<{ posts: Post[]; total: number }> {
  const q = new URLSearchParams();
  if (params.page)    q.set('page', String(params.page));
  if (params.perPage) q.set('perPage', String(params.perPage));
  q.set('status', 'published');

  const res = await fetch(`${CMS_API_URL}/api/v1/content/posts?${q}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return { posts: [], total: 0 };
  return res.json();
}

export async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`${CMS_API_URL}/api/v1/content/posts/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.post as Post;
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${CMS_API_URL}/api/v1/content/categories`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getCategory(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}
```

- [ ] **Step 5: `lib/route-matcher.ts` oluştur**

`themes/module-theme-nextjs/lib/route-matcher.ts`:

```typescript
export interface RouteDefinition {
  path: string;
  controller: Record<string, (params: Record<string, string>) => Promise<ControllerResult>>;
  action: string;
  requires: string | null;
}

export type ControllerResult =
  | { view: string; data: Record<string, unknown> }
  | null;

export interface MatchResult {
  route: RouteDefinition;
  params: Record<string, string>;
}

export function matchRoute(segments: string[], routes: RouteDefinition[]): MatchResult | null {
  const path = '/' + segments.join('/');

  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts    = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const lp = pathParts[i]!;
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = lp;
    } else if (pp !== lp) {
      return null;
    }
  }
  return params;
}
```

- [ ] **Step 6: Controllers oluştur**

`themes/module-theme-nextjs/controllers/HomeController.ts`:

```typescript
import { getPosts } from '../lib/cms-client.js';
import type { ControllerResult } from '../lib/route-matcher.js';

export const HomeController = {
  async index(_params: Record<string, string>): Promise<ControllerResult> {
    const { posts, total } = await getPosts({ perPage: 10 });
    return { view: 'home', data: { posts, total } };
  },
};
```

`themes/module-theme-nextjs/controllers/PostController.ts`:

```typescript
import { getPost } from '../lib/cms-client.js';
import type { ControllerResult } from '../lib/route-matcher.js';

export const PostController = {
  async show(params: Record<string, string>): Promise<ControllerResult> {
    const post = await getPost(params['slug']!);
    if (!post) return null;
    return { view: 'post', data: { post } };
  },
};
```

`themes/module-theme-nextjs/controllers/CategoryController.ts`:

```typescript
import { getCategory, getPosts } from '../lib/cms-client.js';
import type { ControllerResult } from '../lib/route-matcher.js';

export const CategoryController = {
  async index(params: Record<string, string>): Promise<ControllerResult> {
    const category = await getCategory(params['slug']!);
    if (!category) return null;
    const { posts } = await getPosts({ perPage: 20 });
    return { view: 'category', data: { category, posts } };
  },
};
```

- [ ] **Step 7: `routes/web.ts` oluştur**

`themes/module-theme-nextjs/routes/web.ts`:

```typescript
import { HomeController }     from '../controllers/HomeController.js';
import { PostController }     from '../controllers/PostController.js';
import { CategoryController } from '../controllers/CategoryController.js';
import type { RouteDefinition } from '../lib/route-matcher.js';

export const routes: RouteDefinition[] = [
  { path: '/',           controller: HomeController,     action: 'index', requires: null      },
  { path: '/blog/:slug', controller: PostController,     action: 'show',  requires: 'content' },
  { path: '/cat/:slug',  controller: CategoryController, action: 'index', requires: 'content' },
];
```

- [ ] **Step 8: Views oluştur**

`themes/module-theme-nextjs/views/home.tsx`:

```typescript
import type { Post } from '../lib/cms-client.js';

export default function HomeView({ posts }: { posts: Post[] }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Blog</h1>
      {posts.length === 0 && <p>No posts yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {posts.map((post) => (
          <li key={post.id} style={{ marginBottom: 32, borderBottom: '1px solid #eee', paddingBottom: 24 }}>
            <a href={`/blog/${post.slug}`} style={{ fontSize: 22, fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>
              {post.title}
            </a>
            {post.excerpt && <p style={{ color: '#666', marginTop: 8 }}>{post.excerpt}</p>}
            <time style={{ fontSize: 13, color: '#999' }}>
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`themes/module-theme-nextjs/views/post.tsx`:

```typescript
import type { Post } from '../lib/cms-client.js';

export default function PostView({ post }: { post: Post }) {
  const content = typeof post.content === 'string' ? post.content : JSON.stringify(post.content);
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <a href="/" style={{ fontSize: 13, color: '#666' }}>← Back</a>
      <h1 style={{ marginTop: 16 }}>{post.title}</h1>
      {post.excerpt && <p style={{ color: '#666', fontSize: 16 }}>{post.excerpt}</p>}
      <time style={{ fontSize: 13, color: '#999' }}>
        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
      </time>
      <article style={{ marginTop: 32, lineHeight: 1.7 }}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
      </article>
    </main>
  );
}
```

`themes/module-theme-nextjs/views/category.tsx`:

```typescript
import type { Category, Post } from '../lib/cms-client.js';

export default function CategoryView({ category, posts }: { category: Category; posts: Post[] }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <a href="/" style={{ fontSize: 13, color: '#666' }}>← Back</a>
      <h1 style={{ marginTop: 16 }}>{category.name}</h1>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
        {posts.map((post) => (
          <li key={post.id} style={{ marginBottom: 16 }}>
            <a href={`/blog/${post.slug}`} style={{ fontWeight: 500, textDecoration: 'none', color: 'inherit' }}>
              {post.title}
            </a>
          </li>
        ))}
      </ul>
      {posts.length === 0 && <p style={{ color: '#666' }}>No posts in this category.</p>}
    </main>
  );
}
```

`themes/module-theme-nextjs/views/not-found.tsx`:

```typescript
export default function NotFoundView() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 64, margin: 0, color: '#ddd' }}>404</h1>
      <p style={{ color: '#666' }}>Page not found.</p>
      <a href="/" style={{ color: '#333' }}>← Home</a>
    </main>
  );
}
```

- [ ] **Step 9: `app/layout.tsx` ve `app/globals.css` oluştur**

`themes/module-theme-nextjs/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Module CMS',
  description: 'Powered by Module CMS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`themes/module-theme-nextjs/app/globals.css`:

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1a1a1a;
  background: #fff;
}

h1, h2, h3 { line-height: 1.2; }
a { color: inherit; }
img { max-width: 100%; }
```

- [ ] **Step 10: Front controller oluştur**

`themes/module-theme-nextjs/app/[[...slug]]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { routes } from '../../routes/web.js';
import { matchRoute } from '../../lib/route-matcher.js';
import { getActivePlugins } from '../../lib/cms-client.js';
import HomeView     from '../../views/home.js';
import PostView     from '../../views/post.js';
import CategoryView from '../../views/category.js';
import NotFoundView from '../../views/not-found.js';

const views: Record<string, React.ComponentType<Record<string, unknown>>> = {
  home:     HomeView     as React.ComponentType<Record<string, unknown>>,
  post:     PostView     as React.ComponentType<Record<string, unknown>>,
  category: CategoryView as React.ComponentType<Record<string, unknown>>,
};

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function FrontController({ params }: Props) {
  const { slug = [] } = await params;
  const activePlugins = await getActivePlugins();

  const match = matchRoute(slug, routes);
  if (!match) return <NotFoundView />;

  // Plugin bağımlılığı kontrolü
  if (match.route.requires && !activePlugins.includes(match.route.requires)) {
    return <NotFoundView />;
  }

  const result = await match.route.controller[match.route.action]!(match.params);
  if (!result) return <NotFoundView />;

  const View = views[result.view];
  if (!View) notFound();

  return <View {...result.data} />;
}
```

- [ ] **Step 11: Bağımlılıkları yükle ve dev server'ı başlat**

```bash
cd /home/mehmet/Documents/moduleCMS/themes/module-theme-nextjs
pnpm install
CMS_API_URL=http://localhost:3000 pnpm dev
```

Beklenen: `http://localhost:3001` açılıyor, ana sayfa post listesini gösteriyor

- [ ] **Step 12: Canlı test**

```bash
# Ana sayfa
curl -s http://localhost:3001 | grep -o '<h1>.*</h1>' | head -3

# Blog post (önceki adımda oluşturulan 'Hello World' postu)
curl -s http://localhost:3001/blog/hello-world | grep -o '<h1.*>.*</h1>'

# Var olmayan route → 404 view
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/nonexistent
```

Beklenen: Ana sayfa HTML döner, post başlığı görünür, 404 route NotFoundView gösterir (HTTP 200, içerikte 404)

- [ ] **Step 13: Tema reposuna commit et ve push et**

```bash
cd /home/mehmet/Documents/moduleCMS/themes/module-theme-nextjs
git init
git add .
git commit -m "feat: Next.js 15 starter theme with MVC routes and plugin-aware front controller"
git remote add origin https://github.com/YOUR_USERNAME/module-theme-nextjs.git
git push -u origin main
```

- [ ] **Step 14: Ana repoya tema submodule güncelleme commit et**

```bash
cd /home/mehmet/Documents/moduleCMS
git add themes/module-theme-nextjs
git commit -m "chore: add module-theme-nextjs submodule"
```

---

## Self-Review

**Spec coverage kontrolü:**

| Spec gereksinimi | Task |
|---|---|
| Plugin submodule repo yapısı | Task 1 |
| `GET /api/v1/admin/navigation` | Task 2 |
| `GET /api/v1/plugins/active` | Task 2 |
| `GET /plugins/:name/admin.js` static serving | Task 2 |
| `POST /api/v1/themes/:name/activate` | Task 2 |
| Admin shell bare rebuild | Task 3 |
| `PluginOutlet` — script inject + custom element mount | Task 3 |
| `window.__CMS_TOKEN__` JWT iletimi | Task 3 |
| Content plugin admin Web Components | Task 4 |
| `plugin.manifest.ts` adminPages | Task 4 |
| Next.js tema MVC yapısı | Task 5 |
| Plugin-aware route sistemi (requires) | Task 5 |
| `theme.manifest.json` + tema aktivasyon kontrolü | Task 2 + Task 5 |

**Type consistency:**
- `ControllerResult` → `lib/route-matcher.ts`'te tanımlı, controllers ve front controller'da import edilir
- `RouteDefinition.controller` → `Record<string, (params) => Promise<ControllerResult>>` — HomeController, PostController, CategoryController bu interface'e uyuyor
- `AdminPage` interface → `admin.routes.ts`'te local tanımlı, `plugin.manifest.ts`'teki `adminPages` array'iyle uyumlu
- `apiFetch` → `admin/src/lib/api.ts`'te tanımlı, tüm component'ler import ediyor

**Placeholder scan:** TBD/TODO yok. Tüm code block'lar tam.

**Kapsam:** Task 1 GitHub repo oluşturma MANUAL adım içeriyor — plan'da açıkça belirtildi.
