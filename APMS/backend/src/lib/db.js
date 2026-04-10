import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "apms"
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

const RETRYABLE = new Set(["EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT"]);

/** Wait until Postgres accepts connections (handles Docker DNS / startup races). */
export async function waitUntilDbReady({
  maxAttempts = 40,
  delayMs = 1500
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      const code = err?.code;
      if (!RETRYABLE.has(code) || attempt === maxAttempts) {
        throw err;
      }
      console.warn(
        `[db] not ready (${code}, attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}