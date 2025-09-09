const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new DailyRotateFile({
            dirname: logsDir,
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: false,
            maxSize: '50m',
            maxFiles: '30d',
            level: 'info'
        }),
        new DailyRotateFile({
            dirname: logsDir,
            filename: '%DATE%.error.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: false,
            maxSize: '50m',
            maxFiles: '60d',
            level: 'error'
        }),
        new transports.Console({ format: format.combine(format.colorize(), format.simple()) })
    ]
});

module.exports = logger;

