# Next.js Starter Tema — Design Spec

**Tarih:** 2026-03-28
**Faz:** 2 — MVP
**Hedef:** Post yaz, yayınla, tema ile görüntüle

---

## Kapsam

Sadece CMS REST API'yi tüketen, DB bağlantısı olmayan, bağımsız bir Next.js 15 frontend teması.
URL yapısı dosya sistemine değil, routes config dosyasına bağlıdır (Laravel-style MVC).

---

## Klasör Yapısı

```
themes/module-theme-nextjs/
├── app/
│   └── [[...slug]]/
│       └── page.tsx          # Front controller — route match → controller → view
├── routes/
│   └── web.ts                # URL pattern → controller+action mapping
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
│   └── cms-client.ts         # Typed fetch wrapper, CMS_API_URL env
├── public/
├── app/
│   ├── layout.tsx
│   └── globals.css           # Minimal reset + tipografi, renk değişkeni yok
├── package.json
├── next.config.ts
└── tsconfig.json
```

---

## Route Sistemi

`routes/web.ts` URL pattern'larını tanımlar. URL değişince sadece bu dosyaya dokunulur.

```ts
// routes/web.ts
import { HomeController }     from '../controllers/HomeController';
import { PostController }     from '../controllers/PostController';
import { CategoryController } from '../controllers/CategoryController';

export const routes = [
  { path: '/',              controller: HomeController,     action: 'index' },
  { path: '/blog/:slug',    controller: PostController,     action: 'show'  },
  { path: '/cat/:slug',     controller: CategoryController, action: 'index' },
];
```

`app/[[...slug]]/page.tsx` her isteği yakalar, route'ları sırayla eşleştirir, ilk eşleşen controller'a delege eder.

---

## Controller Kontratı

Her controller aksiyonu şu şekilde dönmelidir:

```ts
type ControllerResult =
  | { view: string; data: Record<string, unknown> }
  | null; // 404
```

Controller'lar sadece `cms-client.ts` fonksiyonlarını çağırır. DB bağlantısı, Prisma veya doğrudan SQL yoktur.

```ts
// controllers/PostController.ts
export async function show(params: { slug: string }): Promise<ControllerResult> {
  const post = await cmsClient.getPost(params.slug);
  if (!post) return null;
  return { view: 'post', data: { post } };
}
```

---

## API Client

```ts
// lib/cms-client.ts
const BASE = process.env.CMS_API_URL ?? 'http://localhost:3000';

export async function getPosts(params?: { page?: number; perPage?: number }) { ... }
export async function getPost(slug: string) { ... }
export async function getCategory(slug: string) { ... }
export async function getCategoryPosts(slug: string, params?: { page?: number }) { ... }
```

Tüm fetch'ler `{ next: { revalidate: 60 } }` ile ISR kullanır.
API yanıtları TypeScript tiplerine cast edilir, runtime validation yoktur (MVP kapsamı dışı).

---

## View Katmanı

View'lar pure React server component'leridir. Controller'dan gelen `data` prop'u alırlar, veri fetch etmezler.

```ts
// views/post.tsx
export default function PostView({ post }: { post: Post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
```

---

## Stil

`globals.css`: CSS reset + okunaklı tipografi. Framework yok, CSS değişkeni yok.
Tema geliştirici kendi stil sistemini getirir.

---

## Sayfalar

| URL Pattern    | Controller       | Action  | View        |
|----------------|------------------|---------|-------------|
| `/`            | HomeController   | `index` | `home.tsx`  |
| `/blog/:slug`  | PostController   | `show`  | `post.tsx`  |
| `/cat/:slug`   | CategoryController | `index` | `category.tsx` |
| (eşleşmez)     | —                | —       | `not-found.tsx` |

---

## Kapsam Dışı (MVP)

- Arama sayfası
- Sayfalama UI
- CSS framework
- Tema manifest / customizer
- GraphQL (REST yeterli)
- Authentication

---

## Bağımlılıklar

- `next@15`
- `react@19`
- `typescript`

Başka bağımlılık yoktur.
