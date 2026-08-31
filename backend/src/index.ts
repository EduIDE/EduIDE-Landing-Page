import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { config } from "./config.ts";

const app = createApp();

serve({
    ...app,
    port: config.port,
    hostname: "0.0.0.0",
});

console.log(`[INFO]  [${new Date().toISOString()}] Landing backend started on http://0.0.0.0:${config.port}`);
