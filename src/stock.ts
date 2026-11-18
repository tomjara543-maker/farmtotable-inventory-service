import { prisma } from "./db";
import { publish } from "./events";
import { round2, today } from "./http";

export interface OrderItem {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface LockedBatch {
  batch_id: string;
  product_id: string;
  producer_id: string;
  quantity_available: number;
}

const publicAllocation = (a: { batchId: string; productId: string; producerId: string; quantityKg: number }) => ({
  batchId: a.batchId,
  productId: a.productId,
  producerId: a.producerId,
  quantityKg: a.quantityKg,
});

export function planAllocation(items: OrderItem[], batches: LockedBatch[]) {
  const remaining = new Map(batches.map((b) => [b.batch_id, b.quantity_available]));
  const missing: { productId: string; productName?: string; requested: number; available: number }[] = [];
  const plan: { batchId: string; productId: string; producerId: string; quantityKg: number }[] = [];

  for (const item of items) {
    const own = batches.filter((b) => b.product_id === item.productId);
    const available = round2(own.reduce((s, b) => s + remaining.get(b.batch_id)!, 0));
    if (available < item.quantity) {
      missing.push({ productId: item.productId, productName: item.productName, requested: item.quantity, available });
      continue;
    }
    let pending = item.quantity;
    for (const b of own) {
      if (pending <= 0) break;
      const left = remaining.get(b.batch_id)!;
      const take = round2(Math.min(pending, left));
      if (take <= 0) continue;
      plan.push({ batchId: b.batch_id, productId: b.product_id, producerId: b.producer_id, quantityKg: take });
      remaining.set(b.batch_id, round2(left - take));
      pending = round2(pending - take);
    }
  }
  return { missing, plan };
}

export async function reserve(orderId: string, buyerId: string, items: OrderItem[]) {
  const result = await prisma.$transaction(async (tx) => {
    if (await tx.reservation.findUnique({ where: { orderId } })) return null;

    const productIds = [...new Set(items.map((i) => i.productId))];
    const batches = await tx.$queryRaw<LockedBatch[]>`
      SELECT batch_id, product_id, producer_id, quantity_available
      FROM stock_by_batch
      WHERE product_id = ANY(${productIds}) AND quantity_available > 0 AND expiry_estimate >= ${today()}
      ORDER BY expiry_estimate ASC, created_at ASC
      FOR UPDATE`;

    const { missing, plan } = planAllocation(items, batches);

    if (missing.length) return { ok: false as const, missing };

    for (const a of plan) {
      await tx.stockByBatch.update({ where: { batchId: a.batchId }, data: { quantityAvailable: { decrement: a.quantityKg } } });
    }
    await tx.reservation.create({ data: { orderId, buyerId, allocations: { create: plan } } });
    return { ok: true as const, plan };
  });

  if (!result) return;
  if (result.ok) publish("inventory.reserved", { orderId, buyerId, allocations: result.plan.map(publicAllocation) });
  else publish("inventory.insufficient", { orderId, buyerId, missing: result.missing });
}

export async function release(orderId: string, cause: "order.cancelled" | "manual") {
  const released = await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { orderId }, include: { allocations: true } });
    if (!r || r.status !== "RESERVED") return null;
    for (const a of r.allocations) {
      await tx.stockByBatch.updateMany({ where: { batchId: a.batchId }, data: { quantityAvailable: { increment: a.quantityKg } } });
    }
    await tx.reservation.update({ where: { orderId }, data: { status: "RELEASED" } });
    return r;
  });
  if (!released) return false;
  publish("inventory.released", { orderId, buyerId: released.buyerId, cause, allocations: released.allocations.map(publicAllocation) });
  return true;
}
