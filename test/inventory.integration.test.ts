import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { as, request, Running, startApp, startStub } from "./helpers";

let api: Running;
let orders: Awaited<ReturnType<typeof startStub>>;

before(async () => {
  orders = await startStub({
    "GET /orders/o-pagado": () => ({ body: { id: "o-pagado", status: "PAID" } }),
  });
  process.env.ORDER_SERVICE_URL = orders.url;
  const { createApp } = await import("../src/app");
  api = await startApp(createApp());
});

after(async () => {
  await api.close();
  await orders.close();
});

test("liberar una reserva consulta order-service y se bloquea si el pedido ya fue pagado", async () => {
  const res = await request(api.url, "/inventory/reservations/o-pagado/release", { method: "POST", headers: as("admin-1", "ADMIN") });

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Solo se liberan reservas de pedidos sin pagar/);
  assert.equal(orders.calls.length, 1);
  assert.equal(orders.calls[0].url, "/orders/o-pagado");
});

test("el inventario solo es visible para productores y administradores", async () => {
  const anonymous = await request(api.url, "/inventory/stock");
  assert.equal(anonymous.status, 401);

  const buyer = await request(api.url, "/inventory/stock", { headers: as("buyer-1", "BUYER") });
  assert.equal(buyer.status, 403);

  const producerRelease = await request(api.url, "/inventory/reservations/o-1/release", { method: "POST", headers: as("p-1", "PRODUCER") });
  assert.equal(producerRelease.status, 403);
});
