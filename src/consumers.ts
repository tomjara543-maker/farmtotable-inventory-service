import { idempotent, prisma } from "./db";
import { subscribe } from "./events";
import { release, reserve } from "./stock";

export async function registerConsumers() {
  await subscribe(
    "inventory-service",
    ["product.available", "order.created", "order.cancelled"],
    idempotent(async ({ eventType, data }) => {
      if (eventType === "product.available") {
        await prisma.stockByBatch.upsert({
          where: { batchId: data.batchId },
          create: {
            batchId: data.batchId,
            productId: data.productId,
            producerId: data.producerId,
            quantityKg: data.quantityKg,
            quantityAvailable: data.quantityKg,
            expiryEstimate: data.expiryEstimate,
          },
          update: {},
        });
      }
      if (eventType === "order.created") await reserve(data.orderId, data.buyerId, data.items);
      if (eventType === "order.cancelled") await release(data.orderId, "order.cancelled");
    }),
  );
}
