const { spawn } = require('child_process');
const logger = require('./logger');

function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        logger.info('UPDATE_CMD_START', { command });
        const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
        child.stdout.on('data', (d) => logger.info('UPDATE_OUT', { chunk: d.toString() }));
        child.stderr.on('data', (d) => logger.error('UPDATE_ERR', { chunk: d.toString() }));
        child.on('close', (code) => {
            logger.info('UPDATE_CMD_END', { command, code });
            code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${command}`));
        });
    });
}

async function runUpdate(tagOrRef) {
    const custom = process.env.UPDATE_COMMAND;
    if (custom) {
        await runCommand(custom);
        return;
    }
    // Par défaut: pull + install + rebuild docker (si présent) sinon restart simple
    try {
        await runCommand('git fetch --all --tags');
        if (tagOrRef) {
            await runCommand(`git checkout -f "${tagOrRef}"`);
            await runCommand('git reset --hard');
        } else {
            await runCommand('git reset --hard origin/$(git rev-parse --abbrev-ref HEAD)');
        }
    } catch (e) {
        logger.warn('UPDATE_GIT_WARN', { message: e.message });
    }
    try {
        await runCommand('npm ci');
    } catch (e) {
        logger.warn('UPDATE_NPM_WARN', { message: e.message });
    }
    try {
        await runCommand('docker compose pull');
        await runCommand('docker compose up -d --build');
    } catch (e) {
        logger.warn('UPDATE_DOCKER_WARN', { message: e.message });
    }
}

module.exports = { runUpdate };


