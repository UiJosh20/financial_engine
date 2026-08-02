import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pgPool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('⏳ Running database migration...');
    const sqlPath = path.join(__dirname, '../config/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pgPool.query(sql);
    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pgPool.end();
  }
}

runMigration();