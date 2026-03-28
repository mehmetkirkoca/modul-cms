# Faz 2 Yeniden Tasarım — Design Spec

**Tarih:** 2026-03-28
**Durum:** Onaylandı

---

## Özet

Faz 1'de oluşturulan Core Foundation üzerine Faz 2, üç bağımsız bileşeni tamamlar:
1. Admin shell yeniden yazılır (bare React + Web Components outlet)
2. Content plugin ayrı repo olarak submodule'e taşınır, admin Web Components'ı eklenir
3. Next.js starter tema ayrı repo olarak submodule'e eklenir (plugin-aware, MVC)

---

## 1. Repo & Submodule Yapısı

### Karar
Her plugin ve tema ayrı git reposudur. Ana monorepo bunları `git submodule` olarak barındırır.
Plugin developer sadece `@module-cms/sdk` bağımlılığına ihtiyaç duyar, ana repoya bağımlı değildir.

### Yapı

```
moduleCMS/                          # ana monorepo
├── packages/
│   ├── core/
│   └── sdk/
├── plugins/
│   └── content/                    # git submodule → module-plugin-content
├── themes/
│   └── module-theme-nextjs/        # git submodule → module-theme-nextjs
└── .gitmodules
```

### Submodule Repoları

| Repo | İçerik |
|------|---------|
| `module-plugin-content` | mevcut backend + yeni admin/ Web Components |
| `module-theme-nextjs` | Next.js 15 MVC tema |

### Mevcut `plugins/content/` Taşıma Adımları
1. GitHub'da `module-plugin-content` reposu oluşturulur
2. Mevcut `plugins/content/` içeriği push edilir
3. Ana repodan `plugins/content/` silinir
4. `git submodule add <url> plugins/content`

---

## 2. Admin Shell Yeniden Tasarımı

### Karar
React SPA (framework seçimi: MVP hızı). Core sayfalar minimal — sadece Dashboard, Users, Plugins.
Plugin UI'ları Web Component olarak `<cms-plugin-outlet>` içine mount edilir.

### MVP Kapsamındaki Core Sayfalar

| Sayfa | İçerik |
|-------|---------|
| `/admin` | Dashboard — aktif plugin sayısı, sistem durumu |
| `/admin/users` | Kullanıcı listesi + CRUD |
| `/admin/plugins` | Yüklü pluginler + plugin UI outlet |

Permissions, Settings, Logs → Faz 3.

### Plugin UI Yüklenme Akışı

```
1. Kullanıcı /admin/plugins/content adresine gider
2. Shell → GET /api/v1/admin/navigation
   ← [{ path: '/content', component: 'content-posts-page', bundleUrl: '/plugins/content/admin.js' }]
3. Shell <script src="/plugins/content/admin.js"> inject eder
4. <content-posts-page> custom element mount edilir
```

### Plugin Bundle Serving
Core, plugin'in `admin/dist/index.js` dosyasını statik olarak serve eder:
```
GET /plugins/content/admin.js → plugins/content/admin/dist/index.js
```

### Yeni Core Endpoint
```
GET /api/v1/admin/navigation
→ plugin_registry.admin_pages JSONB kolonundan okur
→ bundleUrl alanını ekleyerek döner
```

### `packages/admin/` Değişiklikleri
**Silinecek:**
- `src/pages/content/` (PostsPage, CategoriesPage, PostEditPage)

**Kalacak:**
- `src/pages/login/LoginPage.tsx`
- `src/pages/dashboard/DashboardPage.tsx`
- `src/pages/users/UsersPage.tsx`
- `src/pages/plugins/PluginsPage.tsx`

**Eklenecek:**
- `src/components/PluginOutlet.tsx` — bundleUrl'den script inject, custom element mount

---

## 3. Content Plugin Admin Web Components

### Karar
Content plugin kendi admin UI'ını vanilla TypeScript Web Components olarak yazar.
Framework bağımlılığı yoktur. esbuild ile tek bundle'a derlenir.

### Klasör Yapısı (`module-plugin-content` reposunda)

```
admin/
├── src/
│   ├── index.ts                  # custom elements register entry
│   ├── components/
│   │   ├── posts-page.ts         # <content-posts-page>
│   │   ├── post-edit.ts          # <content-post-edit>
│   │   └── categories-page.ts   # <content-categories-page>
│   └── lib/
│       └── api.ts                # fetch wrapper → /api/v1/content/*
├── package.json                  # build: esbuild → dist/index.js
└── tsconfig.json
```

### Auth
Admin shell, JWT token'ı `window.__CMS_TOKEN__` üzerinden Web Component'e iletir.
Web Component her fetch'te `Authorization: Bearer` header'ı ekler.

### `plugin.manifest.ts` Güncellemesi
```ts
adminPages: [
  { path: '/content',     component: 'content-posts-page',     label: 'Posts'      },
  { path: '/content/new', component: 'content-post-edit',      label: 'New Post'   },
  { path: '/categories',  component: 'content-categories-page', label: 'Categories' },
]
```

---

## 4. Next.js Starter Tema (module-theme-nextjs)

### Karar
Ayrı git reposu, monorepo'ya submodule olarak eklenir.
Laravel-style MVC: routes dosyası → controller → view.
Plugin-aware: aktif plugin listesini API'den çeker, requires kontrolü yapar.

### Klasör Yapısı

```
module-theme-nextjs/
├── app/
│   ├── layout.tsx
│   ├── globals.css               # minimal reset + tipografi, framework yok
│   └── [[...slug]]/
│       └── page.tsx              # front controller
├── routes/
│   └── web.ts                    # URL pattern → controller+action+requires
├── controllers/
│   ├── HomeController.ts
│   ├── PostController.ts
│   └── CategoryController.ts
├── views/
│   ├── home.tsx
│   ├── post.tsx
│   ├── category.tsx
│   └── not-found.tsx
├── lib/
│   └── cms-client.ts             # fetch → CMS_API_URL, getActivePlugins()
├── theme.manifest.ts             # requires: ['content']
├── package.json                  # next@15, react@19, typescript — başka yok
└── next.config.ts
```

### Route Sistemi

```ts
// routes/web.ts
export const routes = [
  { path: '/',           controller: HomeController,     action: 'index', requires: null      },
  { path: '/blog/:slug', controller: PostController,     action: 'show',  requires: 'content' },
  { path: '/cat/:slug',  controller: CategoryController, action: 'index', requires: 'content' },
];
```

### Plugin-Aware Çalışma

```ts
// app/[[...slug]]/page.tsx
const activePlugins = await getActivePlugins(); // GET /api/v1/plugins/active, revalidate: 300

const match = matchRoute(slug, routes);
if (!match) return <NotFoundView />;
if (match.requires && !activePlugins.includes(match.requires)) return <NotFoundView />;

const result = await match.controller[match.action](match.params);
if (!result) return <NotFoundView />;

return renderView(result.view, result.data);
```

### Plugin Bağımlılığı Kontrolü

`theme.manifest.ts`:
```ts
export default {
  name: 'module-theme-nextjs',
  version: '1.0.0',
  requires: ['content'],
};
```

Tema startup'ta ve `POST /api/v1/themes/{name}/activate` çağrısında:
- `requires` listesi `plugin_registry` ile karşılaştırılır
- Eksik plugin varsa: `400 { error: 'MISSING_PLUGINS', missing: ['content'] }`

### Yeni Core Endpoint
```
GET /api/v1/plugins/active  →  ['content', 'seo', ...]
POST /api/v1/themes/{name}/activate  →  requires kontrolü yapar
```

---

## 5. Faz 2 Done Kriterleri

- [ ] Admin shell: login → dashboard → users → plugins sayfası çalışıyor
- [ ] Content plugin Web Component admin'de mount oluyor (posts listesi görünüyor)
- [ ] Next.js tema ayağa kalkıyor, `/` ve `/blog/:slug` çalışıyor
- [ ] Content plugin yokken tema route'ları 404 dönüyor
- [ ] Content plugin submodule olarak ana repoya bağlı

---

## 6. Kapsam Dışı (Faz 3'e Ertelendi)

- Tiptap block editör
- Plugin settings JSON Schema form render
- CSS variable customizer
- Permissions, Settings, Logs admin sayfaları
- Marketplace / otomatik plugin indirme
- Astro starter tema
