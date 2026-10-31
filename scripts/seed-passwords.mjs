// Sets a bcrypt password hash for every seeded user (run once after db/03_seed.sql).
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pw = process.env.SEED_PASSWORD || 'Passw0rd!';
const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const hash = await bcrypt.hash(pw, 10);
const [res] = await conn.query('UPDATE user_account SET password_hash = ? WHERE password_hash IS NULL', [hash]);
console.log(`Password set for ${res.affectedRows} user(s).`);
await conn.end();
