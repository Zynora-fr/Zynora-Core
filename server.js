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
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const errorHandler = require('./src/middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(helmet());
app.use(morgan('combined'));
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

// Base path API
const apiBase = '/api/v1';

// Auth
app.post(
    `${apiBase}/auth/register`,
    authLimiter,
    body('name').isString().trim().notEmpty().withMessage('Nom requis'),
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password')
        .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
        .withMessage('Mot de passe trop faible'),
    body('role').optional().isIn(['user','manager','admin']).withMessage('Rôle invalide'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
        try {
            const { name, email, password, role } = req.body;
            const user = await AuthService.register({ name, email, password, role });
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

// Catch-all: bloquer l'accès aux routes hors /api/* et /test (et garder /)
app.use((req, res, next) => {
    const path = req.path || '';
    if (path === '/' || path.startsWith('/api/') || path.startsWith('/test')) return next();
    return res.status(404).json({ message: 'Route introuvable. Utilisez /api/v1', code: 'NOT_FOUND' });
});

// Middleware d'erreurs
app.use(errorHandler);

// Export pour les tests, démarrage si fichier principal
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
}

module.exports = app;
