import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isTestEnv = process.env.NODE_ENV === 'test';

export const pgPool = new Pool({
   connectionString: process.env.DATABASE_URL || 'postgresql://postgres_user:postgres_password@localhost:5432/financial_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    ssl: {
    rejectUnauthorized: false, // Required for secure cloud connections like Supabase
  },
})


export const redisPool = isTestEnv ? new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
}) : new Redis(process.env.REDIS_URL || 'redis://default:password@localhost:6379',{
  maxRetriesPerRequest: null // Required by BullMQ 
});


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