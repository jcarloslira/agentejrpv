import pg from "pg";
import { config } from "./config.js";

// Conecta com o usuário paloma_app: escreve só no schema paloma e só lê as tabelas jrpv_*.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 8,
  ssl: { rejectUnauthorized: false },
});

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function um<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(sql, params))[0] ?? null;
}
