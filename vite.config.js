import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function apiRoomsPlugin() {
	return {
		name: "api-rooms-middleware",
		configureServer(server) {
			server.middlewares.use("/api/rooms", (_req, res, next) => {
				const filePath = path.resolve("public/api/rooms.json");
				if (!fs.existsSync(filePath)) return next();
				res.setHeader("Content-Type", "application/json; charset=utf-8");
				res.end(fs.readFileSync(filePath, "utf-8"));
			});
		},
	};
}

export default defineConfig({
	plugins: [apiRoomsPlugin()],
});
