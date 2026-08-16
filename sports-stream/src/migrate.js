import { pool } from './db.js'

const sql = `
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`

async function run() {
  try {
    await pool.query(sql)
    console.log('Migration applied: posts table')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()
