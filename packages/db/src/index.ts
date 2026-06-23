import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://databolsa:databolsa_dev@localhost:5433/databolsa";

// Single module-level pool. The serving DB is read-mostly: the API only SELECTs;
// writes come from the batch loader, not the API.
const client = postgres(DATABASE_URL);

export const db = drizzle(client, {
  schema,
  logger: process.env.LOG_SQL === "true",
});

export type Database = typeof db;
export { client, schema };
export * from "./schema";
