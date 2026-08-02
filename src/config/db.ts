import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pgPool = new Pool({
   connectionString: process.env.DATABASE_URL || 'postgresql://postgres_user:postgres_password@localhost:5432/financial_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

export async function initializeDatabase() {
  try {
    // Points to init.sql in your root directory (adjust relative path if needed)
    const sqlPath = path.join(__dirname, 'init.sql');
    
    if (fs.existsSync(sqlPath)) {
      const sqlQuery = fs.readFileSync(sqlPath, 'utf8');
      await pgPool.query(sqlQuery);
      console.log('📦 Database tables verified & initialized successfully from init.sql');
    } else {
      console.warn('⚠️ Warning: init.sql file not found at path:', sqlPath);
    }
  } catch (err) {
    console.error('❌ Failed to initialize database tables:', err);
    throw err;
  }
}