import { pgPool } from "../config/db.js";


export async function createSchema() {
    const query =`
    CREATE TABLE IF NOT EXISTS market_events(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    price NUMERIC(12,4) NOT NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority VARCHAR(10) DEFAULT 'LOW'
    );

    CREATE INDEX IF NOT EXISTS idx_market_events_event_type ON market_events(event_type);
    `

    try{
        console.log("Initializing database schema...");
        await pgPool.query(query);
        console.log('Table market_events created successfully');
    }catch(err){
        console.error('Error creating database schema', err);
    }
    finally{
       pgPool.end();
    }
}


createSchema();