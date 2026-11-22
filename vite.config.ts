import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		nitro({
			preset: "vercel",
			// Keep the function next to Neon and S3 (ap-southeast-1). The Vercel default, iad1, adds a US round trip to every query.
			vercel: { functions: { regions: ["sin1"] } },
			serverAssets: [{ baseName: "templates", dir: "./docs/templates" }],
		}),
		viteReact(),
	],
});
