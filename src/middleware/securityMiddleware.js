const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
};

const logRequests = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    const rid = req.id;
    const ip = req.ip;
    logger.info('REQ', { rid, method, url: originalUrl, ip });
    const end = res.end;
    res.end = function (...args) {
        const durationMs = Date.now() - start;
        logger.info('RES', { rid, status: res.statusCode, durationMs });
        end.apply(this, args);
    };
    next();
};

module.exports = {
    requestId,
    logRequests,
    mongoSanitize: () => mongoSanitize({ allowDots: false, replaceWith: '_' }),
    hpp: () => hpp(),
};


