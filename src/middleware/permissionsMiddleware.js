const logger = require('../utils/logger');

const authorizePermissions = (...requiredPermissions) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const ok = requiredPermissions.every(p => userPermissions.includes(p));
    if (!ok) {
        logger.warn('PERM_DENY', { uid: String(req.user._id || req.user.id), need: requiredPermissions, has: userPermissions, path: req.originalUrl });
        return res.status(403).json({ message: 'Permission manquante', code: 'PERMISSION_DENIED' });
    }
    next();
};

module.exports = { authorizePermissions };


