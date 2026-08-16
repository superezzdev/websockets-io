import { db, pool } from './db.js'
import { posts } from './schema.js'
import { eq } from 'drizzle-orm'

async function run() {
  try {
    // CREATE
    const [created] = await db.insert(posts).values({ title: 'Hello', content: 'First post' }).returning()
    console.log('Created:', created)

    // READ
    const all = await db.select().from(posts)
    console.log('All rows:', all)

    // UPDATE
    await db.update(posts).set({ content: 'Updated content' }).where(eq(posts.id, created.id))
    const updated = await db.select().from(posts).where(eq(posts.id, created.id))
    console.log('Updated row:', updated)

    // DELETE
    await db.delete(posts).where(eq(posts.id, created.id))
    console.log('Deleted created row')
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()
