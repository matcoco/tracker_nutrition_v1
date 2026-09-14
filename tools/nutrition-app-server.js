const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const HOST = '127.0.0.1';
const START_PORT = Number(process.env.NUTRITION_APP_PORT || 5501);
const ROOT = path.resolve(__dirname, '..');
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function send(res, status, body, contentType = 'application/json; charset=utf-8', allowCors = false) {
    const headers = {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
    };
    // CORS n'est nécessaire que pour le proxy Brave (appelé depuis une autre
    // origine). Les fichiers statiques sont servis en same-origin : ouvrir
    // `*` permettrait à n'importe quelle page web de lire les données locales.
    if (allowCors) {
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
    }
    res.writeHead(status, headers);
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let settled = false;
        const fail = (message) => {
            if (settled) return;
            settled = true;
            reject(new Error(message));
        };
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1_000_000) {
                req.destroy();
                fail('Payload trop volumineux.');
            }
        });
        req.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(body);
        });
        req.on('error', error => fail(error.message));
    });
}

function braveSearch(apiKey, params) {
    return new Promise((resolve, reject) => {
        const url = new URL(BRAVE_URL);
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        });

        const request = https.request(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': apiKey
            }
        }, response => {
            let body = '';
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Brave ${response.statusCode}: ${body.slice(0, 300)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Réponse Brave invalide.'));
                }
            });
        });
        request.on('error', reject);
        request.end();
    });
}

async function handleBraveSearch(req, res) {
    try {
        const payload = JSON.parse(await readBody(req) || '{}');
        const apiKey = String(payload.apiKey || process.env.BRAVE_SEARCH_API_KEY || '').trim();
        if (!apiKey) {
            send(res, 400, { error: 'Clé Brave Search manquante.' });
            return;
        }

        const data = await braveSearch(apiKey, payload.params || {});
        send(res, 200, data);
    } catch (error) {
        send(res, 500, { error: error.message || 'Erreur proxy Brave.' });
    }
}

// Fichiers et dossiers qui ne doivent JAMAIS être servis : le serveur écoute sur
// la boucle locale avec CORS ouvert, une page web tierce pourrait sinon lire
// l'historique Git ou les sauvegardes JSON de l'utilisateur.
const FORBIDDEN_PATTERNS = [
    /(^|\/)\.git(\/|$)/i,
    /(^|\/)\.vscode(\/|$)/i,
    /(^|\/)__pycache__(\/|$)/i,
    /(^|\/)node_modules(\/|$)/i,
    /(^|\/)divers(\/|$)/i,
    /(^|\/)tests(\/|$)/i,
    /backup/i,
    /\.json$/i,
];

function isForbiddenPath(requestedPath) {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(requestedPath));
}

function serveStatic(req, res) {
    let requestedPath;
    try {
        const requestUrl = new URL(req.url, `http://${HOST}`);
        requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
        // decodeURIComponent('%') lève une URIError : sans ce garde-fou, le
        // process Node mourait sur une simple requête malformée.
        requestedPath = decodeURIComponent(requestedPath);
    } catch (error) {
        send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
        return;
    }

    if (isForbiddenPath(requestedPath)) {
        send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
        return;
    }

    const filePath = path.resolve(ROOT, `.${requestedPath}`);
    // Comparaison par chemin relatif : un simple startsWith() laissait passer
    // tout dossier frère partageant le même préfixe (ex. nutrition-tracker-backup).
    const relative = path.relative(ROOT, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            send(res, 404, 'Not found', 'text/plain; charset=utf-8');
            return;
        }

        const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        send(res, 200, content, type);
    });
}

function createServer() {
    return http.createServer(async (req, res) => {
        try {
            if (req.method === 'OPTIONS') {
                send(res, 204, '');
                return;
            }

            const { pathname } = new URL(req.url, `http://${HOST}`);

            if (req.method === 'GET' && pathname === '/health') {
                send(res, 200, { ok: true });
                return;
            }

            if (req.method === 'POST' && pathname === '/brave-search') {
                await handleBraveSearch(req, res);
                return;
            }

            if (req.method === 'GET' || req.method === 'HEAD') {
                serveStatic(req, res);
                return;
            }

            send(res, 405, { error: 'Method not allowed' });
        } catch (error) {
            try { send(res, 500, { error: error.message || 'Erreur serveur' }); } catch (_) { /* socket déjà fermé */ }
        }
    });
}

function openBrowser(url) {
    if (process.env.NO_BROWSER === '1') return;
    const command = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    childProcess.exec(command, error => {
        if (error) console.warn(`Ouverture du navigateur impossible : ${error.message}`);
    });
}

function listen(port) {
    const server = createServer();
    server.on('error', error => {
        if (error.code === 'EADDRINUSE' && port < START_PORT + 10) {
            server.close(() => listen(port + 1));
            return;
        }
        console.error(`Impossible d'écouter sur ${HOST}:${port} — ${error.message}`);
        process.exitCode = 1;
    });
    server.listen(port, HOST, () => {
        const url = `http://${HOST}:${port}/`;
        console.log(`Nutrition Tracker: ${url}`);
        console.log('Brave Search proxy intégré: /brave-search');
        openBrowser(url);
    });
}

listen(START_PORT);
