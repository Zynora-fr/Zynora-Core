const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { connectPG } = require('../config/pg');

const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();

const mongoRepo = {
    async create({ name, firstName, lastName, username, phone, email, password, role, permissions }) {
        const user = await User.create({ name, firstName, lastName, username, phone, email, password, role, permissions: permissions || [] });
        return user.toObject();
    },
    async findByEmail(email) {
        const user = await User.findOne({ email });
        return user ? user.toObject() : null;
    },
    async findById(id) {
        const user = await User.findById(id);
        return user ? user.toObject() : null;
    },
    async updateById(id, updates) {
        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
        return user ? user.toObject() : null;
    },
    async deleteById(id) {
        const u = await User.findByIdAndDelete(id);
        return !!u;
    },
    async list() {
        const users = await User.find().select('-password');
        return users.map(u => u.toObject());
    }
};

const pgRepo = {
    async create({ name, firstName, lastName, username, phone, email, password, role, permissions }) {
        const pool = await connectPG();
        const res = await pool.query(
            'INSERT INTO users(name, first_name, last_name, username, phone, email, password, role, permissions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name, first_name, last_name, username, phone, email, role, permissions, created_at, updated_at',
            [name, firstName, lastName, username, phone || null, email, password, role, permissions || []]
        );
        return res.rows[0];
    },
    async findByEmail(email) {
        const pool = await connectPG();
        const res = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        return res.rows[0] || null;
    },
    async findById(id) {
        const pool = await connectPG();
        const res = await pool.query('SELECT id, name, first_name, last_name, username, phone, email, role, permissions, created_at, updated_at FROM users WHERE id=$1', [id]);
        return res.rows[0] || null;
    },
    async updateById(id, updates) {
        const pool = await connectPG();
        const fields = [];
        const values = [];
        let idx = 1;
        for (const [k, v] of Object.entries(updates)) {
            fields.push(`${k}=$${idx++}`);
            values.push(v);
        }
        values.push(id);
        const res = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, name, email, role, created_at, updated_at`, values);
        return res.rows[0] || null;
    },
    async deleteById(id) {
        const pool = await connectPG();
        const res = await pool.query('DELETE FROM users WHERE id=$1', [id]);
        return res.rowCount > 0;
    },
    async list() {
        const pool = await connectPG();
        const res = await pool.query('SELECT id, name, first_name, last_name, username, phone, email, role, permissions, created_at, updated_at FROM users ORDER BY created_at DESC');
        return res.rows;
    }
};

module.exports = driver === 'postgres' ? pgRepo : mongoRepo;

