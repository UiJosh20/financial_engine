import { pgPool } from "./config/db.js";

pgPool.query('SELECT COUNT(*) FROM market_events').then(res => { console.log('Total Rows in DB:', res.rows[0].count); pgPool.end(); });