import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function apiRoomsFallbackPlugin() {
  return {
    name: "api-rooms-fallback",
    configureServer(server) {
      server.middlewares.use("/api/rooms", (req, res, next) => {
        if (req.method !== "GET") return next();
        const filePath = path.resolve(__dirname, "public/api/rooms.json");
        if (!fs.existsSync(filePath)) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(fs.readFileSync(filePath, "utf-8"));
      });
    },
  };
}

export default defineConfig({
  plugins: [apiRoomsFallbackPlugin()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:3001",
        ws: true,
      },
    },
  },
});
