import { neon } from "@netlify/neon";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  const sql = neon();  // @netlify/neon auto-configures, no connection string needed at runtime
  return drizzle(sql, { schema });
}
