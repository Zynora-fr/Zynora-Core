const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Erreur serveur';
    logger.error('API_ERROR', { code, status, message, stack: err.stack });
    res.status(status).json({ message, code });
};

module.exports = errorHandler;

