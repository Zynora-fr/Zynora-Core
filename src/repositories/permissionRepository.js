const Permission = require('../models/Permission');
const { connectPG } = require('../config/pg');

const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();

const mongoRepo = {
    async create({ key, label, description }) {
        const p = await Permission.create({ key, label, description });
        return p.toObject();
    },
    async list() {
        const items = await Permission.find().sort({ key: 1 });
        return items.map(i => i.toObject());
    },
    async removeByKey(key) {
        const res = await Permission.findOneAndDelete({ key });
        return !!res;
    }
};

const pgRepo = {
    async create({ key, label, description }) {
        const pool = await connectPG();
        const res = await pool.query('INSERT INTO permissions_catalog(key, label, description) VALUES($1,$2,$3) RETURNING id, key, label, description, created_at, updated_at', [key, label, description || null]);
        return res.rows[0];
    },
    async list() {
        const pool = await connectPG();
        const res = await pool.query('SELECT id, key, label, description, created_at, updated_at FROM permissions_catalog ORDER BY key ASC');
        return res.rows;
    },
    async removeByKey(key) {
        const pool = await connectPG();
        const res = await pool.query('DELETE FROM permissions_catalog WHERE key=$1', [key]);
        return res.rowCount > 0;
    }
};

module.exports = driver === 'postgres' ? pgRepo : mongoRepo;


