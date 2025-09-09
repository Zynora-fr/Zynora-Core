const authorizePermissions = (...requiredPermissions) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const ok = requiredPermissions.every(p => userPermissions.includes(p));
    if (!ok) return res.status(403).json({ message: 'Permission manquante', code: 'PERMISSION_DENIED' });
    next();
};

module.exports = { authorizePermissions };


