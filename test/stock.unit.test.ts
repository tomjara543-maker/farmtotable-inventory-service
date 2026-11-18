import assert from "node:assert/strict";
import { test } from "node:test";
import { LockedBatch, planAllocation } from "../src/stock";

const batch = (batch_id: string, product_id: string, quantity_available: number): LockedBatch => ({
  batch_id,
  product_id,
  producer_id: `prod-${product_id}`,
  quantity_available,
});

test("planAllocation reserva FEFO: agota primero el lote que vence antes y reparte entre lotes", () => {
  const batches = [batch("b-vence-hoy", "tomate", 3), batch("b-vence-luego", "tomate", 10)];

  const { missing, plan } = planAllocation([{ productId: "tomate", quantity: 4.5 }], batches);

  assert.deepEqual(missing, []);
  assert.deepEqual(plan, [
    { batchId: "b-vence-hoy", productId: "tomate", producerId: "prod-tomate", quantityKg: 3 },
    { batchId: "b-vence-luego", productId: "tomate", producerId: "prod-tomate", quantityKg: 1.5 },
  ]);
  assert.equal(batches[0].quantity_available, 3);
});

test("planAllocation reporta faltantes con lo disponible y no asigna ese producto", () => {
  const batches = [batch("b1", "papa", 2.25), batch("b2", "papa", 0.5), batch("b3", "fresa", 5)];

  const { missing, plan } = planAllocation(
    [
      { productId: "papa", productName: "Papa criolla", quantity: 3 },
      { productId: "fresa", quantity: 1 },
    ],
    batches,
  );

  assert.deepEqual(missing, [{ productId: "papa", productName: "Papa criolla", requested: 3, available: 2.75 }]);
  assert.deepEqual(plan.map((a) => a.batchId), ["b3"]);
});
