import mysql from 'mysql2/promise';

const g = globalThis;
export const pool =
  g._mysqlPool ??
  (g._mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true
  }));

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Runs fn(conn) inside a transaction; commits on success, rolls back on error.
export async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Maps MySQL errors to HTTP-friendly messages (database-level validation surfaces here).
export function dbError(e) {
  const map = {
    ER_DUP_ENTRY: [409, 'That value already exists (duplicate username or e-mail).'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'A value breaks a database rule (check constraint).'],
    ER_NO_REFERENCED_ROW_2: [400, 'Referenced record does not exist.'],
    ER_SIGNAL_EXCEPTION: [422, e.sqlMessage]
  };
  const [status, message] = map[e.code] || [500, 'Database error'];
  if (status === 500) console.error(e);
  return { status, message };
}
