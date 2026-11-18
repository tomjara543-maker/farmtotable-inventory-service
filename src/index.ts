import { createApp } from "./app";
import { registerConsumers } from "./consumers";
import { connectEvents } from "./events";

const PORT = Number(process.env.PORT ?? 4004);

async function main() {
  await registerConsumers();
  await connectEvents();

  createApp().listen(PORT, () => console.log(`inventory-service escuchando en http://localhost:${PORT}`));
}

main();
