import dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

export { pool, db }
