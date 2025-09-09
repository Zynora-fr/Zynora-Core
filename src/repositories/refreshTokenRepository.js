const RefreshToken = require('../models/RefreshToken');
const { connectPG } = require('../config/pg');

const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();

const mongoRepo = {
    async create(doc) {
        const rt = await RefreshToken.create(doc);
        return rt.toObject();
    },
    async findValidByHash(tokenHash) {
        const rt = await RefreshToken.findOne({ tokenHash, revokedAt: { $exists: false } });
        return rt;
    },
    async revokeAndReplace(oldDoc, newDoc) {
        oldDoc.revokedAt = new Date();
        oldDoc.replacedBy = newDoc.tokenHash;
        await oldDoc.save();
        const created = await RefreshToken.create(newDoc);
        return created.toObject();
    },
    async revokeByHash(tokenHash) {
        await RefreshToken.updateMany({ tokenHash, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    }
};

const pgRepo = {
    async create(doc) {
        const pool = await connectPG();
        const res = await pool.query('INSERT INTO refresh_tokens(user_id, token_hash, expires_at, ip, user_agent) VALUES($1,$2,$3,$4,$5) RETURNING *', [doc.user, doc.tokenHash, doc.expiresAt, doc.ip || null, doc.userAgent || null]);
        return res.rows[0];
    },
    async findValidByHash(tokenHash) {
        const pool = await connectPG();
        const res = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked_at IS NULL', [tokenHash]);
        return res.rows[0] || null;
    },
    async revokeAndReplace(oldDoc, newDoc) {
        const pool = await connectPG();
        await pool.query('BEGIN');
        try {
            await pool.query('UPDATE refresh_tokens SET revoked_at=NOW(), replaced_by=$1 WHERE token_hash=$2', [newDoc.tokenHash, oldDoc.token_hash || oldDoc.tokenHash]);
            const res = await pool.query('INSERT INTO refresh_tokens(user_id, token_hash, expires_at, ip, user_agent) VALUES($1,$2,$3,$4,$5) RETURNING *', [newDoc.user, newDoc.tokenHash, newDoc.expiresAt, newDoc.ip || null, newDoc.userAgent || null]);
            await pool.query('COMMIT');
            return res.rows[0];
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }
    },
    async revokeByHash(tokenHash) {
        const pool = await connectPG();
        await pool.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL', [tokenHash]);
    }
};

module.exports = driver === 'postgres' ? pgRepo : mongoRepo;

