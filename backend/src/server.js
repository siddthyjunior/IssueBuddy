import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT || 8080);
const server = app.listen(port, "0.0.0.0", () => console.log(`IssueBuddy API listening on port ${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
