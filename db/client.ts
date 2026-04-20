import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// Max 1 connection for serverless environments (Vercel)
const sql = postgres(connectionString, { max: 1 });

export const db = drizzle(sql, { schema });
