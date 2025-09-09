const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');
const refreshRepo = require('../repositories/refreshTokenRepository');
require('dotenv').config();

class AuthService {
    static async register({ name, email, password, role }) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email invalide');

        if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password)) {
            throw new Error('Mot de passe trop faible');
        }

        const exists = await userRepo.findByEmail(email);
        if (exists) throw new Error('Email déjà utilisé');

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await userRepo.create({ name, email, password: hashedPassword, role: role || 'user' });
        const userObj = { ...user };
        delete userObj.password;
        return userObj;
    }

    static async login({ email, password }) {
        const user = await userRepo.findByEmail(email);
        if (!user) throw new Error('Utilisateur non trouvé');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error('Mot de passe incorrect');

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('Configuration JWT manquante');

        const accessToken = jwt.sign(
            {
                id: user.id || user._id,
                email: user.email,
                role: user.role,
                name: user.name,
            },
            secret,
            { expiresIn: '15m' }
        );
        // Refresh token (opaque, stocké hashé)
        const refreshTokenPlain = crypto.randomBytes(48).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(refreshTokenPlain).digest('hex');
        const refreshTtlDays = parseInt(process.env.REFRESH_TTL_DAYS || '7', 10);
        const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
        await refreshRepo.create({ user: user.id || user._id, tokenHash, expiresAt });

        const userObj = { ...user };
        delete userObj.password;
        return { user: userObj, accessToken, refreshToken: refreshTokenPlain };
    }

    static async refresh({ refreshToken }) {
        if (!refreshToken) throw new Error('Refresh token manquant');
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const stored = await refreshRepo.findValidByHash(tokenHash);
        if (!stored) throw new Error('Refresh token invalide');
        if (stored.expiresAt < new Date()) throw new Error('Refresh token expiré');

        const user = await userRepo.findById(stored.user || stored.user_id);
        if (!user) throw new Error('Utilisateur non trouvé');

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('Configuration JWT manquante');

        const accessToken = jwt.sign({ id: user.id || user._id, email: user.email, role: user.role, name: user.name }, secret, { expiresIn: '15m' });

        // Rotation: révoquer l'ancien et émettre un nouveau refresh token
        const newPlain = crypto.randomBytes(48).toString('hex');
        const newHash = crypto.createHash('sha256').update(newPlain).digest('hex');
        const refreshTtlDays = parseInt(process.env.REFRESH_TTL_DAYS || '7', 10);
        await refreshRepo.revokeAndReplace(stored, { user: user.id || user._id, tokenHash: newHash, expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000) });

        return { accessToken, refreshToken: newPlain };
    }

    static async logout({ refreshToken }) {
        if (!refreshToken) return { success: true };
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await refreshRepo.revokeByHash(tokenHash);
        return { success: true };
    }
}

module.exports = AuthService;
