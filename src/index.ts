import cors from "cors";
import express from "express";
import { registerConsumers } from "./consumers";
import { connectEvents } from "./events";
import { errorHandler } from "./http";
import { inventoryRoutes } from "./routes";

const PORT = Number(process.env.PORT ?? 4004);

async function main() {
  await registerConsumers();
  await connectEvents();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ service: "inventory-service", status: "ok" }));
  app.use("/inventory", inventoryRoutes());
  app.use(errorHandler);

  app.listen(PORT, () => console.log(`inventory-service escuchando en http://localhost:${PORT}`));
}

main();
