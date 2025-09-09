const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Pas de token, accès refusé' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ message: 'Configuration JWT manquante' });
        }
        const decoded = jwt.verify(token, secret);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) return res.status(401).json({ message: 'Utilisateur introuvable' });
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token invalide' });
    }
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
};

module.exports = { authenticateToken, authorizeRoles };
