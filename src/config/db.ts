import pkg from 'pg';
const { Pool } = pkg;

export const pgPool = new Pool({
    user: 'postgres_user',
    password: 'postgres_password',
    host: 'localhost',
    port: 5432,
    database: 'financial_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})


pgPool.on('error', (err, client) => {
    console.error('Idle client error', err);
    client.release();
});
