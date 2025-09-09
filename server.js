const express = require('express');
require('dotenv').config();

const connectDB = require('./src/config/db');
const { initPostgres } = require('./src/config/pgInit');
const AuthService = require('./src/services/authService');
const { authenticateToken, authorizeRoles } = require('./src/middleware/authMiddleware');

const usersRouter = require('./src/routes/users');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./src/utils/logger');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { requestId, logRequests, mongoSanitize, hpp } = require('./src/middleware/securityMiddleware');
const { body, validationResult } = require('express-validator');
const errorHandler = require('./src/middleware/errorMiddleware');
const User = require('./src/models/User');
const RefreshToken = require('./src/models/RefreshToken');
const { connectPG } = require('./src/config/pg');
const { authorizePermissions } = require('./src/middleware/permissionsMiddleware');
const permRepo = require('./src/repositories/permissionRepository');
const crypto = require('crypto');
const { runUpdate } = require('./src/utils/updater');
const { startReleasePoller } = require('./src/utils/releasePoller');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(requestId);
app.use(logRequests);
app.use(express.json({ limit: '1mb' }));
app.use(hpp());
app.use(mongoSanitize());
app.use(helmet());
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info('HTTP', { message: message.trim() })
    }
}));
app.use(cors({
    origin: (origin, cb) => {
        const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
        cb(new Error('CORS non autorisé'));
    },
    credentials: true
}));

// Frontend de test servi statiquement sous /test
app.use('/test', express.static(require('path').join(__dirname, 'test-frontend')));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit global
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
});
app.use(generalLimiter);

// Anti-DDoS: ralentissement progressif
const speedLimiter = slowDown({
    windowMs: 60 * 1000,
    delayAfter: 100,
    delayMs: 250
});
app.use(speedLimiter);

// Blocage basique de bots connus via User-Agent
app.use((req, res, next) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const deny = ['bot', 'crawler', 'spider', 'curl/', 'wget/', 'postmanruntime'];
    if (ua && deny.some(sig => ua.includes(sig))) {
        return res.status(403).json({ message: 'Accès interdit', code: 'BOT_BLOCKED' });
    }
    next();
});

// Connexion DB
connectDB().catch((err) => {
    console.error('Erreur connexion MongoDB:', err.message);
    process.exit(1);
});

// Init Postgres si activé
if ((process.env.DB_DRIVER || 'mongo').toLowerCase() === 'postgres') {
    initPostgres().catch((err) => {
        console.error('Erreur init Postgres:', err.message);
        process.exit(1);
    });
}

// Route test serveur
app.get('/', (req, res) => {
    res.send('Devosphere-Core API fonctionne !');
});

// robots.txt pour désindexer l'API
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /');
});

// Base path API
const apiBase = '/api/v1';
// Webhook GitHub pour mise à jour automatique
app.post(`${apiBase}/admin/webhook/github`, express.raw({ type: '*/*' }), (req, res) => {
    try {
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!secret) return res.status(500).json({ message: 'Secret webhook manquant' });
        const sig = req.headers['x-hub-signature-256'];
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(req.body).digest('hex');
        if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) {
            return res.status(401).json({ message: 'Signature invalide' });
        }
        // Détecter release
        let tag = undefined;
        try {
            const body = JSON.parse(req.body.toString('utf8'));
            if (body.action === 'published' && body.release && body.release.tag_name) {
                tag = body.release.tag_name;
            }
        } catch {}
        res.json({ ok: true, tag });
        // lancer en arrière-plan sur tag si présent
        runUpdate(tag).catch(err => {
            const logger = require('./src/utils/logger');
            logger.error('UPDATE_FAILED', { message: err.message });
        });
    } catch (e) {
        return res.status(400).json({ message: 'Erreur webhook' });
    }
});

// Auth
app.post(
    `${apiBase}/auth/register`,
    authLimiter,
    body('name').isString().trim().notEmpty().withMessage('Nom affiché requis'),
    body('firstName').isString().trim().notEmpty().withMessage('Prénom requis'),
    body('lastName').isString().trim().notEmpty().withMessage('Nom requis'),
    body('username').isString().trim().isLength({ min: 3, max: 32 }).withMessage('Pseudo requis (3-32)'),
    body('phone').optional().isString().isLength({ min: 6, max: 32 }).withMessage('Téléphone invalide'),
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password')
        .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
        .withMessage('Mot de passe trop faible'),
    body('role').optional().isIn(['user','manager','admin']).withMessage('Rôle invalide'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
        try {
            const { name, firstName, lastName, username, phone, email, password, role } = req.body;
            const user = await AuthService.register({ name, firstName, lastName, username, phone, email, password, role });
            res.status(201).json({ message: 'Inscription réussie', code: 'AUTH_REGISTER_OK', user });
        } catch (err) {
            res.status(400).json({ message: err.message, code: 'AUTH_REGISTER_ERROR' });
        }
    }
);

app.post(
    `${apiBase}/auth/login`,
    authLimiter,
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Mot de passe requis'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
        try {
            const { email, password } = req.body;
            const data = await AuthService.login({ email, password });
            res.json({ message: 'Connexion réussie', code: 'AUTH_LOGIN_OK', ...data });
        } catch (err) {
            res.status(400).json({ message: err.message, code: 'AUTH_LOGIN_ERROR' });
        }
    }
);

// Dashboard (stats simples) — admin/manager
app.get(
    `${apiBase}/dashboard`,
    authenticateToken,
    authorizeRoles('admin', 'manager'),
    async (req, res) => {
        try {
            const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();
            let userCount = 0;
            let tokenCount = 0;
            if (driver === 'postgres') {
                const pool = await connectPG();
                const uc = await pool.query('SELECT COUNT(*)::int AS count FROM users');
                const tc = await pool.query('SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE revoked_at IS NULL');
                userCount = uc.rows[0]?.count || 0;
                tokenCount = tc.rows[0]?.count || 0;
            } else {
                userCount = await User.countDocuments();
                tokenCount = await RefreshToken.countDocuments({ revokedAt: { $exists: false } });
            }
            res.json({ message: 'Dashboard OK', code: 'DASHBOARD_OK', data: { userCount, activeRefreshTokens: tokenCount } });
        } catch (err) {
            res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
        }
    }
);

// Exemple de route protégée par permission spécifique
app.get(
    `${apiBase}/reports/daily`,
    authenticateToken,
    authorizePermissions('reports.read'),
    (req, res) => {
        res.json({ code: 'REPORT_DAILY_OK', data: { date: new Date().toISOString().slice(0,10) } });
    }
);

// Exemples protégés
app.get(`${apiBase}/admin`, authenticateToken, authorizeRoles('admin'), (req, res) => {
    res.send('Bienvenue admin !');
});

app.get(`${apiBase}/profile`, authenticateToken, authorizeRoles('user', 'admin'), (req, res) => {
    res.json({ message: `Bienvenue ${req.user.name}`, user: req.user });
});

// Token refresh & logout
app.post(
    `${apiBase}/auth/refresh`,
    body('refreshToken').isString().isLength({ min: 16 }).withMessage('Refresh token invalide'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
        try {
            const { refreshToken } = req.body;
            const data = await AuthService.refresh({ refreshToken });
            res.json(data);
        } catch (err) {
            res.status(400).json({ message: err.message, code: 'AUTH_REFRESH_ERROR' });
        }
    }
);

app.post(
    `${apiBase}/auth/logout`,
    body('refreshToken').optional().isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
        try {
            const { refreshToken } = req.body || {};
            const data = await AuthService.logout({ refreshToken });
            res.json(data);
        } catch (err) {
            res.status(400).json({ message: err.message, code: 'AUTH_LOGOUT_ERROR' });
        }
    }
);

// Routes utilisateurs (admin only pour listing/modif/suppression)
app.use(`${apiBase}/users`, usersRouter);

// Endpoints admin pour permissions
app.get(`${apiBase}/admin/users/:id/permissions`, authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
        const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();
        let user;
        if (driver === 'postgres') {
            const pool = await connectPG();
            const r = await pool.query('SELECT id, name, first_name, last_name, username, phone, email, role, permissions FROM users WHERE id=$1', [req.params.id]);
            user = r.rows[0];
        } else {
            user = await User.findById(req.params.id).select('name firstName lastName username phone email role permissions');
        }
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
        res.json({ code: 'USER_PERMS_OK', permissions: user.permissions || [] });
    } catch (e) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

// Catalogue de permissions (admin)
app.get(`${apiBase}/admin/permissions`, authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const items = await permRepo.list();
        res.json({ code: 'PERMS_CATALOG_OK', data: items });
    } catch (e) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

app.post(`${apiBase}/admin/permissions`, authenticateToken, authorizeRoles('admin'), body('key').isString().trim().notEmpty(), body('label').isString().trim().notEmpty(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
    try {
        const { key, label, description } = req.body;
        const created = await permRepo.create({ key, label, description });
        res.status(201).json({ code: 'PERM_CREATED', data: created });
    } catch (e) {
        res.status(400).json({ message: e.message, code: 'PERM_CREATE_ERROR' });
    }
});

app.delete(`${apiBase}/admin/permissions/:key`, authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const ok = await permRepo.removeByKey(req.params.key);
        res.json({ code: 'PERM_DELETED', deleted: ok });
    } catch (e) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

app.put(`${apiBase}/admin/users/:id/permissions`, authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const perms = Array.isArray(req.body.permissions) ? req.body.permissions : null;
        if (!perms) return res.status(400).json({ message: 'permissions doit être un tableau', code: 'VALIDATION_ERROR' });
        const driver = (process.env.DB_DRIVER || 'mongo').toLowerCase();
        let updated;
        if (driver === 'postgres') {
            const pool = await connectPG();
            const r = await pool.query('UPDATE users SET permissions=$1, updated_at=NOW() WHERE id=$2 RETURNING id, permissions', [perms, req.params.id]);
            updated = r.rows[0];
        } else {
            updated = await User.findByIdAndUpdate(req.params.id, { permissions: perms }, { new: true }).select('id permissions');
        }
        if (!updated) return res.status(404).json({ message: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
        res.json({ code: 'USER_PERMS_UPDATED', permissions: updated.permissions || perms });
    } catch (e) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

// Catch-all: bloquer l'accès aux routes hors /api/* et /test (et garder /)
app.use((req, res, next) => {
    const path = req.path || '';
    if (path === '/' || path.startsWith('/api/') || path.startsWith('/test')) return next();
    return res.status(404).json({ message: 'Route introuvable. Utilisez /api/v1', code: 'NOT_FOUND' });
});

// Middleware d'erreurs
app.use((err, req, res, next) => {
    const logger = require('./src/utils/logger');
    logger.error('UNCAUGHT_API_ERROR', { err: { message: err.message, stack: err.stack }, path: req && req.originalUrl });
    errorHandler(err, req, res, next);
});

// Export pour les tests, démarrage si fichier principal
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
    if (String(process.env.RELEASE_POLL_ENABLED || 'true').toLowerCase() === 'true') {
        startReleasePoller();
    }
}

module.exports = app;
