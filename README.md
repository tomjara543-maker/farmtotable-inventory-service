# inventory-service

Stock por lote con reserva FEFO y control de vencimientos. Parte de **FarmToTable** (marketplace agrícola con microservicios orientados a eventos).

Estado: **Implementado** con PostgreSQL (Prisma) y RabbitMQ. Probado de punta a punta a través del API Gateway.

- Puerto local: `4004` · Ruta pública en el API Gateway: `/api/inventory`
- Base de datos propia (`DATABASE_URL`), nunca compartida con otro servicio
- Eventos por RabbitMQ (exchange topic `farmtotable.events`, ver `src/events.ts`)

## Contrato REST

Es lo que ya consume el frontend (y lo que simula su modo demo en `src/lib/mock/server.ts` del repo del frontend).
El API Gateway valida el JWT y reenvía `x-user-id` / `x-user-role`; usa `requireUser()` de `src/auth.ts`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/inventory/stock?producerId=` | PRODUCER (los suyos) / ADMIN | Lotes ordenados por `expiryEstimate` (FEFO) |
| `GET` | `/inventory/reservations` | PRODUCER / ADMIN | Reservas por pedido |
| `POST` | `/inventory/reservations/:orderId/release` | ADMIN | Libera la reserva de un pedido CONFIRMED (compensación) → `inventory.released` |

Errores: `{ "error": "mensaje" }` con 400 (validación zod), 401, 403, 404, 409 (estado inválido) o 422 (regla de negocio).

## Eventos

Publica:
- `inventory.reserved`
- `inventory.insufficient`
- `inventory.released`

Consume:
- `product.available` → crea el lote
- `order.created` → reserva FEFO todo-o-nada
- `order.cancelled` → libera la reserva

Todo consumidor debe envolverse en `idempotent()` (`src/db.ts`).

## Modelo de datos (Prisma)

- `StockByBatch` (batchId, productId, producerId, quantityAvailable, expiryEstimate) — **índice por expiryEstimate**
- `Reservation` (orderId, status RESERVED|RELEASED) + `Allocation` (batchId, productId, quantityKg)
- La reserva se hace en una transacción con `SELECT … FOR UPDATE`

## Desarrollo

```bash
cp .env.example .env    # ajusta DATABASE_URL
npm install
npm run db:migrate      # crea/aplica migraciones
npm run dev
```

## Despliegue

`Dockerfile` + `render.yaml` (Render) y `.github/workflows/ci.yml`: compila en cada push/PR y, en `main`,
publica la imagen en GHCR y dispara el deploy hook de Render si existe el secreto `RENDER_DEPLOY_HOOK_URL`.
