const { Pool } = require('pg');

let pool;

const connectPG = async () => {
    if (pool) return pool;
    const connectionString = process.env.PG_URI;
    if (!connectionString) throw new Error('PG_URI manquant');
    pool = new Pool({ connectionString });
    await pool.query('SELECT 1');
    return pool;
};

module.exports = { connectPG };

