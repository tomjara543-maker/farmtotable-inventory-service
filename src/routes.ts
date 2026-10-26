import { Router } from "express";
import { AuthUser, requireUser, userOf } from "./auth";
import { prisma } from "./db";
import { callService, HttpError, round2 } from "./http";
import { release } from "./stock";

const PRODUCER_URL = process.env.PRODUCER_SERVICE_URL;
const ORDER_URL = process.env.ORDER_SERVICE_URL;

async function visibleProducers(user: AuthUser) {
  if (user.role === "ADMIN") return null;
  const mine = await callService<{ id: string }[]>(PRODUCER_URL, `/producers?ownerId=${encodeURIComponent(user.id)}`);
  return mine.map((p) => p.id);
}

const toReservation = (r: {
  orderId: string;
  status: string;
  createdAt: Date;
  allocations: { batchId: string; productId: string; producerId: string; quantityKg: number }[];
}) => ({
  orderId: r.orderId,
  status: r.status,
  createdAt: r.createdAt,
  allocations: r.allocations.map(({ batchId, productId, producerId, quantityKg }) => ({ batchId, productId, producerId, quantityKg })),
});

export function inventoryRoutes() {
  const router = Router();

  router.get("/stock", requireUser("PRODUCER"), async (req, res) => {
    const producers = await visibleProducers(userOf(res));
    const filter = typeof req.query.producerId === "string" ? req.query.producerId : undefined;
    const stock = await prisma.stockByBatch.findMany({
      where: {
        AND: [producers ? { producerId: { in: producers } } : {}, filter ? { producerId: filter } : {}],
      },
      orderBy: { expiryEstimate: "asc" },
    });
    res.json(
      stock.map(({ batchId, productId, producerId, quantityAvailable, expiryEstimate }) => ({
        batchId,
        productId,
        producerId,
        quantityAvailable: round2(quantityAvailable),
        expiryEstimate,
      })),
    );
  });

  router.get("/reservations", requireUser("PRODUCER"), async (_req, res) => {
    const producers = await visibleProducers(userOf(res));
    const list = await prisma.reservation.findMany({ include: { allocations: true }, orderBy: { createdAt: "desc" } });
    const result = list
      .map((r) => (producers ? { ...r, allocations: r.allocations.filter((a) => producers.includes(a.producerId)) } : r))
      .filter((r) => r.allocations.length > 0);
    res.json(result.map(toReservation));
  });

  router.post("/reservations/:orderId/release", requireUser("ADMIN"), async (req, res) => {
    const orderId = String(req.params.orderId);
    const order = await callService<{ status: string }>(ORDER_URL, `/orders/${encodeURIComponent(orderId)}`).catch((err) => {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    });
    if (order && order.status !== "CONFIRMED") {
      throw new HttpError(409, "Solo se liberan reservas de pedidos sin pagar; para los demás cancela el pedido");
    }
    if (!(await release(orderId, "manual"))) throw new HttpError(404, "No hay una reserva activa para ese pedido");
    const r = await prisma.reservation.findUnique({ where: { orderId }, include: { allocations: true } });
    res.json(toReservation(r!));
  });

  return router;
}
