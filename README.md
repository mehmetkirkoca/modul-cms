# moduleCMS

WordPress'in premium alternatifi. Docker-native, plugin-isolated, type-safe CMS.

> **Durum:** Faz 1 tamamlandı — Core Foundation çalışıyor.

---

## Neden moduleCMS?

| WordPress | moduleCMS |
|---|---|
| Global state (`$wpdb`, `$post`) | Her servis izole, sıfır global state |
| EAV abuse (`postmeta`) | Her plugin kendi typed DB şemasını yönetir |
| String-based hook'lar | Type-safe, versioned event sistemi |
| Plugin'ler birbirini doğrudan çağırır | Plugin→Plugin iletişim build-time'da yasak |
| Core DB şişer | Core DB: sadece 4 tablo, hiç değişmez |

---

## Mimari

```
┌─────────────────────────────────────────┐
│              CLIENT LAYER               │
│      Admin SPA      Frontend (Headless) │
│    REST / GraphQL     REST / GraphQL    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│              CORE LAYER                 │
│  API Gateway → Orchestrator → Core DB   │
│                    │                    │
│               EventBus                 │
│              (gRPC out)                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│             PLUGIN LAYER                │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  In-Process  │  │  Container   │    │
│  │   Plugin     │  │   Plugin     │    │
│  │   own DB     │  │   own DB     │    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

### Temel Kurallar

1. **Plugin → Plugin iletişim yoktur.** Plugin ya Core API'ye (gRPC) sorar ya da event snapshot'tan okur. Build CI'da enforce edilir.
2. **Core DB küçük ve sabit kalır.** `users`, `permissions`, `plugin_registry`, `system_config` — 4 tablo. `posts`, `categories` burada yoktur.
3. **Database-per-Plugin.** Plugin silinince DB'si de gider. Cross-DB FK yasak, snapshot UUID kullanılır.
4. **Docker-native.** Sadece Core dışa açık, plugin'ler ve DB'ler internal network'te.

---

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js 20 + TypeScript (strict) |
| HTTP Server | Fastify |
| ORM | Drizzle ORM |
| Veritabanı | PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| gRPC | @grpc/grpc-js |
| Validation | Zod |
| Test | Vitest |
| Monorepo | Turborepo + pnpm |
| Container | Docker + Docker Compose |

---

## Başlangıç

### Gereksinimler

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

### Kurulum

```bash
# 1. Bağımlılıkları yükle
pnpm install

# 2. DB ve Redis'i başlat (sadece geliştirme altyapısı)
docker compose -f docker-compose.dev.yml up -d

# 3. Environment değişkenlerini ayarla
cp packages/core/.env.example packages/core/.env
# .env dosyasını düzenle (JWT_SECRET mutlaka değiştir)

# 4. DB şemasını uygula
pnpm --filter @module-cms/core db:push

# 5. Varsayılan admin kullanıcısı ve permission'ları oluştur
pnpm --filter @module-cms/core db:seed

# 6. Core'u çalıştır
pnpm --filter @module-cms/core dev
```

### Hızlı Doğrulama

```bash
# Sağlık kontrolü
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@modulecms.dev","password":"admin123"}'
```

### Varsayılan Admin

| Alan | Değer |
|---|---|
| Email | `admin@modulecms.dev` |
| Şifre | `admin123` |
| Rol | `super_admin` |

> ⚠️ Production'da seed scriptindeki şifreyi mutlaka değiştir.

---

## API Referansı

### Auth

| Method | Endpoint | Auth | Açıklama |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | — | Email + şifre ile giriş, JWT döner |
| `POST` | `/api/v1/auth/refresh` | Cookie | Access token yenile |
| `POST` | `/api/v1/auth/logout` | JWT | Refresh token'ı iptal et |
| `GET` | `/api/v1/auth/me` | JWT | Giriş yapan kullanıcı bilgisi |

### Users

| Method | Endpoint | Auth | Açıklama |
|---|---|---|---|
| `GET` | `/api/v1/users` | admin+ | Kullanıcı listesi |
| `GET` | `/api/v1/users/:id` | admin+ | Tek kullanıcı |
| `POST` | `/api/v1/users` | admin+ | Yeni kullanıcı oluştur |
| `PATCH` | `/api/v1/users/:id` | JWT | Kullanıcı güncelle |

### Plugins

| Method | Endpoint | Auth | Açıklama |
|---|---|---|---|
| `GET` | `/api/v1/plugins` | admin+ | Kayıtlı plugin listesi |
| `GET` | `/api/v1/plugins/:name` | admin+ | Plugin detayı |
| `POST` | `/api/v1/plugins/register` | super_admin | Plugin'i hot-register et |
| `DELETE` | `/api/v1/plugins/:name` | super_admin | Plugin'i devre dışı bırak |
| `GET` | `/api/v1/plugins/:name/health` | admin+ | Plugin sağlık durumu |

### gRPC (port 50051)

```protobuf
service CoreAPI {
  rpc GetUser            (GetUserRequest)          returns (User);
  rpc ListUsers          (ListUsersRequest)         returns (UserList);
  rpc CheckPermission    (CheckPermissionRequest)   returns (PermissionResult);
  rpc GetUserRoles       (GetUserRolesRequest)      returns (RoleList);
  rpc GetPlugin          (GetPluginRequest)         returns (PluginInfo);
  rpc ListPlugins        (ListPluginsRequest)       returns (PluginList);
  rpc GetConfig          (GetConfigRequest)         returns (ConfigValue);
  rpc EmitEvent          (EmitEventRequest)         returns (EmitEventResponse);
}
```

---

## Plugin Geliştirme

### Manifest

```typescript
// plugin.manifest.ts
import { definePlugin } from '@module-cms/sdk';

export default definePlugin({
  name:    'my-plugin',
  version: '1.0.0',
  runtime: 'in-process', // veya 'container'

  subscribes: ['content:post:saved:v1'],
  publishes:  ['my-plugin:processed:v1'],

  adminPages: [
    { path: '/my-plugin', component: 'my-plugin-page', label: 'My Plugin' },
  ],
});
```

### Plugin Entry Point

```typescript
// src/index.ts
import type { Plugin, AppContext } from '@module-cms/sdk';

const plugin: Plugin = {
  name:    'my-plugin',
  version: '1.0.0',

  async register(ctx: AppContext) {
    ctx.eventBus.on('content:post:saved:v1', async (payload) => {
      ctx.logger.info('Post saved', { postId: payload.postId });
    });
  },
};

export default plugin;
```

### İletişim Kuralları

```typescript
// ✅ DOĞRU — Core API üzerinden kullanıcı bilgisi al
const user = await ctx.coreApi.getUser(userId);

// ✅ DOĞRU — Event snapshot ile başka plugin'in datasını oku
ctx.eventBus.on('content:post:saved:v1', async (event) => {
  await db.snapshots.upsert({ postId: event.postId, title: event.title });
});

// ❌ YANLIŞ — Başka plugin'e direkt çağrı (build CI fail eder)
// const post = await contentPlugin.getPost(id);
```

### Event Naming

```
{domain}:{entity}:{action}:{version}

core:user:created:v1
content:post:saved:v1
content:post:published:v1
ecommerce:order:created:v1
```

---

## Roller ve Permission'lar

| Rol | Kapsam |
|---|---|
| `super_admin` | Tüm sistem. Plugin yükle/sil, sistem config. |
| `admin` | İçerik + kullanıcı yönetimi. Plugin ayarları. |
| `editor` | Tüm içerikleri yaz, düzenle, yayınla. |
| `subscriber` | Sadece okuma. |

---

## Proje Yapısı

```
moduleCMS/
├── packages/
│   ├── core/               # Ana servis
│   │   ├── db/
│   │   │   ├── schema.ts   # Drizzle schema (4 tablo)
│   │   │   ├── seed.ts     # Varsayılan veriler
│   │   │   └── migrate.ts  # Production migration runner
│   │   ├── proto/
│   │   │   └── core.proto  # gRPC tanımları
│   │   └── src/
│   │       ├── api/
│   │       │   ├── grpc/   # gRPC server
│   │       │   └── rest/   # Fastify routes
│   │       ├── auth/       # JWT + permission middleware
│   │       ├── core/
│   │       │   ├── event-bus/       # Sync + Async event sistemi
│   │       │   └── plugin-registry/ # Manifest yükleme, hot-register
│   │       ├── db/
│   │       │   └── repositories/    # user, permission, plugin, config
│   │       └── errors/     # Typed error sınıfları
│   └── sdk/                # Plugin geliştirici paketi
│       └── src/
│           ├── types/       # Plugin, AppContext, EventBus tipleri
│           └── plugin/      # definePlugin() helper
├── plugins/                 # Plugin'ler buraya gelir
├── themes/                  # Tema'lar buraya gelir
├── docker-compose.yml       # Production
└── docker-compose.dev.yml   # Geliştirme (sadece DB + Redis)
```

---

## Faz Planı

| Faz | Durum | Kapsam |
|---|---|---|
| **1 — Core Foundation** | ✅ Tamamlandı | Auth, gRPC, EventBus, Plugin Registry, Docker |
| **2 — Content + Admin** | 🔲 Sırada | Content Plugin, Admin Shell, Next.js Starter Tema |
| **3 — Ekosistem** | 🔲 Bekliyor | Media/SEO Plugin, CLI, SDK yayını, v0.1.0 beta |
| **4 — Marketplace** | 🔲 Bekliyor | Plugin Marketplace, Ecommerce, Kubernetes, v1.0.0 |

---

## Environment Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL bağlantı URL'i |
| `REDIS_URL` | `redis://localhost:6379` | Redis bağlantı URL'i |
| `JWT_SECRET` | — | Access token imzalama anahtarı (min 32 karakter) |
| `HTTP_PORT` | `3000` | HTTP server portu |
| `GRPC_PORT` | `50051` | gRPC server portu |
| `NODE_ENV` | `development` | Ortam |
| `LOG_LEVEL` | `info` | Log seviyesi |

---

## Testler

```bash
# Tüm testler
pnpm test

# Sadece core
pnpm --filter @module-cms/core test

# Watch mode
pnpm --filter @module-cms/core test:watch
```

---

## Production Deploy

```bash
# Tüm sistemi Docker ile başlat
JWT_SECRET=<güçlü-secret> docker compose up -d

# Migration uygula
docker compose exec core npx tsx db/migrate.ts
```

---

## Lisans

MIT
