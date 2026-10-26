-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'RELEASED');

-- CreateTable
CREATE TABLE "stock_by_batch" (
    "batch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "quantity_kg" DOUBLE PRECISION NOT NULL,
    "quantity_available" DOUBLE PRECISION NOT NULL,
    "expiry_estimate" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_by_batch_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "order_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "quantity_kg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "stock_by_batch_expiry_estimate_idx" ON "stock_by_batch"("expiry_estimate");

-- CreateIndex
CREATE INDEX "stock_by_batch_product_id_expiry_estimate_idx" ON "stock_by_batch"("product_id", "expiry_estimate");

-- CreateIndex
CREATE INDEX "allocations_order_id_idx" ON "allocations"("order_id");

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "reservations"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;
