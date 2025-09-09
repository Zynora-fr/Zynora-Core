const https = require('https');
const logger = require('./logger');
const { runUpdate } = require('./updater');

function fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'GET', headers: { 'User-Agent': 'Devosphere-Core', ...headers } }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function checkLatestRelease(repo) {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const json = await fetchJson(url);
    return json && json.tag_name ? json.tag_name : null;
}

function startReleasePoller() {
    const repo = process.env.GITHUB_REPO || 'Devosphere-fr/Devosphere-Core';
    const intervalSec = parseInt(process.env.RELEASE_POLL_INTERVAL_SEC || '300', 10);
    let lastTag = process.env.CURRENT_RELEASE_TAG || null;
    logger.info('RELEASE_POLLER_START', { repo, intervalSec, lastTag });
    const timer = setInterval(async () => {
        try {
            const tag = await checkLatestRelease(repo);
            if (tag && tag !== lastTag) {
                logger.info('RELEASE_NEW_TAG', { tag, lastTag });
                lastTag = tag;
                runUpdate(tag).catch(err => logger.error('RELEASE_UPDATE_FAIL', { message: err.message }));
            }
        } catch (e) {
            logger.warn('RELEASE_POLLER_ERR', { message: e.message });
        }
    }, intervalSec * 1000);
    return () => clearInterval(timer);
}

module.exports = { startReleasePoller };


