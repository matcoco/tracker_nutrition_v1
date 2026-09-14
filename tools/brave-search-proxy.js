const http = require('http');
const https = require('https');

const PORT = Number(process.env.BRAVE_PROXY_PORT || 8787);
const HOST = '127.0.0.1';
// URL amont configurable : permet de pointer un serveur de test (et de changer
// de fournisseur sans toucher au code).
const BRAVE_URL = process.env.BRAVE_API_URL || 'https://api.search.brave.com/res/v1/web/search';

// Origines autorisées à appeler ce proxy depuis un navigateur.
// `*` permettrait à n'importe quelle page web visitée d'utiliser la clé
// Brave configurée sur la machine (quota consommé, voire proxy ouvert).
// Par défaut : uniquement les ports de boucle locale sur lesquels
// `tools/nutrition-app-server.js` peut servir l'application.
const DEFAULT_ORIGINS = Array.from({ length: 10 }, (_, i) => 5501 + i)
    .flatMap(port => [`http://127.0.0.1:${port}`, `http://localhost:${port}`])
    .join(',');

const ALLOWED_ORIGINS = (process.env.BRAVE_ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 Mo

function resolveAllowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return null;
    return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function send(req, res, status, body, contentType = 'application/json') {
    const headers = {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Origin',
    };

    if (req.method === 'OPTIONS') {
        const allowed = resolveAllowedOrigin(req);
        if (allowed) {
            headers['Access-Control-Allow-Origin'] = allowed;
            headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
            headers['Access-Control-Allow-Headers'] = 'Content-Type';
        }
    } else {
        // On ne renvoie l'en-tête CORS qu'aux origines explicitement autorisées.
        const allowed = resolveAllowedOrigin(req);
        if (allowed) headers['Access-Control-Allow-Origin'] = allowed;
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

        const client = url.protocol === 'https:' ? https : http;

        const request = client.request(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': apiKey
            }
        }, response => {
            let body = '';
            let tooLarge = false;
            response.on('data', chunk => {
                if (tooLarge) return;
                body += chunk;
                if (body.length > MAX_RESPONSE_BYTES) {
                    tooLarge = true;
                    response.destroy();
                    reject(new Error('Réponse Brave trop volumineuse.'));
                }
            });
            response.on('end', () => {
                if (tooLarge) return;
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

http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        send(req, res, 204, '');
        return;
    }

    let pathname = req.url;
    try {
        pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
    } catch (_) {
        // URL malformée : on retombe sur la valeur brute.
    }

    if (req.method === 'GET' && pathname === '/health') {
        send(req, res, 200, { ok: true });
        return;
    }

    if (req.method !== 'POST' || pathname !== '/brave-search') {
        send(req, res, 404, { error: 'Not found' });
        return;
    }

    try {
        const rawBody = await readBody(req);
        let payload;
        try {
            payload = JSON.parse(rawBody || '{}');
        } catch (_) {
            // Un corps illisible est une erreur du client, pas du serveur.
            send(req, res, 400, { error: 'Corps de requête JSON invalide.' });
            return;
        }

        if (!payload || typeof payload !== 'object') {
            send(req, res, 400, { error: 'Corps de requête invalide.' });
            return;
        }

        const apiKey = String(payload.apiKey || process.env.BRAVE_SEARCH_API_KEY || '').trim();
        if (!apiKey) {
            send(req, res, 400, { error: 'Clé Brave Search manquante.' });
            return;
        }

        const data = await braveSearch(apiKey, payload.params || {});
        send(req, res, 200, data);
    } catch (error) {
        send(req, res, 502, { error: error.message || 'Erreur proxy Brave.' });
    }
}).listen(PORT, HOST, () => {
    console.log(`Brave Search proxy: http://${HOST}:${PORT}/health`);
    console.log(`Origines autorisées : ${ALLOWED_ORIGINS.join(', ')}`);
});
