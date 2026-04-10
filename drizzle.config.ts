import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: { url: process.env.NETLIFY_DATABASE_URL! },
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  migrations: { prefix: "timestamp" },
});
