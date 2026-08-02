import { pgPool } from "../config/db.js";

async function seed() {
  try {
    const queryText = `
      INSERT INTO users (email) 
      VALUES ($1) 
      ON CONFLICT (email) 
      DO UPDATE SET email = EXCLUDED.email 
      RETURNING id, email;
    `;

    const res = await pgPool.query(queryText, ['dev@example.com']);

    console.log('👤 Test User Created Successfully!');
    console.log('-----------------------------------');
    console.log('User ID:', res.rows[0].id);
    console.log('Email:  ', res.rows[0].email);
    console.log('-----------------------------------');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pgPool.end();
  }
}

seed();