// tests/integration/brave-proxy.test.js
// Test d'intégration du proxy Brave Search (tools/brave-search-proxy.js).
//
// Le proxy est lancé avec une URL amont pointant vers un serveur factice local :
// aucun appel réseau réel vers l'API Brave n'est effectué.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const HOST = '127.0.0.1';
const PROXY_PORT = 6100 + Math.floor(Math.random() * 200);
const UPSTREAM_PORT = 6400 + Math.floor(Math.random() * 200);

const ALLOWED_ORIGIN = 'http://127.0.0.1:5501';
const FORBIDDEN_ORIGIN = 'http://evil.example';

let child;
let upstream;
let proxyOutput = '';
let lastUpstreamRequest = null;
let upstreamResponder = null;

function request(port, requestPath, { method = 'GET', body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
        const req = http.request({
            host: HOST,
            port,
            path: requestPath,
            method,
            headers: {
                ...headers,
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        }, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function json(response) {
    try { return JSON.parse(response.body); } catch (_) { return null; }
}

async function waitForProxy(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const response = await request(PROXY_PORT, '/health');
            if (response.status === 200) return;
        } catch (_) { /* pas encore prêt */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Proxy non démarré\n${proxyOutput}`);
}

beforeAll(async () => {
    // Serveur amont factice qui remplace l'API Brave.
    upstream = http.createServer((req, res) => {
        lastUpstreamRequest = { url: req.url, headers: req.headers };
        const { status, body } = upstreamResponder
            ? upstreamResponder(req)
            : { status: 200, body: { web: { results: [{ title: 'Poulet', url: 'https://exemple.test/poulet' }] } } };
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
    });
    await new Promise((resolve) => upstream.listen(UPSTREAM_PORT, HOST, resolve));

    child = spawn(process.execPath, [path.join(ROOT, 'tools/brave-search-proxy.js')], {
        cwd: ROOT,
        env: {
            ...process.env,
            BRAVE_PROXY_PORT: String(PROXY_PORT),
            BRAVE_API_URL: `http://${HOST}:${UPSTREAM_PORT}/res/v1/web/search`,
            BRAVE_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
            BRAVE_SEARCH_API_KEY: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { proxyOutput += String(chunk); });
    child.stderr.on('data', (chunk) => { proxyOutput += String(chunk); });

    await waitForProxy();
}, 20000);

afterAll(async () => {
    if (child && !child.killed) child.kill();
    if (upstream) await new Promise((resolve) => upstream.close(resolve));
});

describe('proxy Brave — points d’entrée', () => {
    it('répond 200 sur /health', async () => {
        const response = await request(PROXY_PORT, '/health');
        expect(response.status).toBe(200);
        expect(json(response)).toEqual({ ok: true });
    });

    it('répond 200 sur /health même avec une query string', async () => {
        const response = await request(PROXY_PORT, '/health?cache=0');
        expect(response.status).toBe(200);
    });

    it('répond 404 sur une route inconnue', async () => {
        expect((await request(PROXY_PORT, '/')).status).toBe(404);
        expect((await request(PROXY_PORT, '/autre')).status).toBe(404);
    });

    it('répond 404 sur GET /brave-search (méthode incorrecte)', async () => {
        expect((await request(PROXY_PORT, '/brave-search')).status).toBe(404);
    });
});

describe('proxy Brave — validation des requêtes', () => {
    it('répond 400 quand aucune clé API n’est fournie', async () => {
        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: { params: { q: 'poulet' } },
        });
        expect(response.status).toBe(400);
        expect(json(response).error).toMatch(/Clé Brave Search manquante/);
    });

    it('répond 400 sur un corps JSON invalide (et non 500)', async () => {
        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: '{ ceci n est pas du json',
            headers: { 'Content-Type': 'application/json' },
        });
        expect(response.status).toBe(400);
        expect(json(response).error).toMatch(/JSON invalide/);
    });

    it('répond 400 sur un corps JSON valide mais non-objet', async () => {
        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: '"juste une chaîne"',
            headers: { 'Content-Type': 'application/json' },
        });
        expect(response.status).toBe(400);
    });
});

describe('proxy Brave — sécurité CORS', () => {
    it('n’autorise plus les origines arbitraires', async () => {
        // Avant correction, l'en-tête valait « * » sur toutes les réponses.
        const response = await request(PROXY_PORT, '/health', {
            headers: { Origin: FORBIDDEN_ORIGIN },
        });
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('renvoie l’origine autorisée telle quelle', async () => {
        const response = await request(PROXY_PORT, '/health', {
            headers: { Origin: ALLOWED_ORIGIN },
        });
        expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    it('n’accorde le pré-vol qu’aux origines autorisées', async () => {
        const allowed = await request(PROXY_PORT, '/brave-search', {
            method: 'OPTIONS',
            headers: { Origin: ALLOWED_ORIGIN },
        });
        expect(allowed.status).toBe(204);
        expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
        expect(allowed.headers['access-control-allow-methods']).toContain('POST');

        const forbidden = await request(PROXY_PORT, '/brave-search', {
            method: 'OPTIONS',
            headers: { Origin: FORBIDDEN_ORIGIN },
        });
        expect(forbidden.status).toBe(204);
        expect(forbidden.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('ajoute l’en-tête nosniff', async () => {
        const response = await request(PROXY_PORT, '/health');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
});

describe('proxy Brave — transmission à l’amont', () => {
    it('relaie la requête et renvoie la réponse de l’amont', async () => {
        lastUpstreamRequest = null;
        upstreamResponder = null;

        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: { apiKey: 'cle-de-test', params: { q: 'poulet', count: 5, country: 'fr' } },
        });

        expect(response.status).toBe(200);
        expect(json(response).web.results[0].title).toBe('Poulet');

        // La clé part dans l'en-tête attendu par Brave...
        expect(lastUpstreamRequest.headers['x-subscription-token']).toBe('cle-de-test');
        // ...et les paramètres sont bien transmis en query string.
        expect(lastUpstreamRequest.url).toContain('q=poulet');
        expect(lastUpstreamRequest.url).toContain('count=5');
        expect(lastUpstreamRequest.url).toContain('country=fr');
    });

    it('ignore les paramètres nuls ou indéfinis', async () => {
        lastUpstreamRequest = null;
        await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: { apiKey: 'cle', params: { q: 'riz', vide: null, absent: undefined } },
        });
        expect(lastUpstreamRequest.url).toContain('q=riz');
        expect(lastUpstreamRequest.url).not.toContain('vide');
        expect(lastUpstreamRequest.url).not.toContain('absent');
    });

    it('remonte l’erreur de l’amont en 502', async () => {
        upstreamResponder = () => ({ status: 429, body: { error: 'quota dépassé' } });
        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: { apiKey: 'cle', params: { q: 'x' } },
        });
        expect(response.status).toBe(502);
        expect(json(response).error).toMatch(/Brave 429/);
        upstreamResponder = null;
    });

    it('remonte une erreur si l’amont renvoie du JSON invalide', async () => {
        upstreamResponder = () => ({ status: 200, body: '<html>erreur</html>' });
        const response = await request(PROXY_PORT, '/brave-search', {
            method: 'POST',
            body: { apiKey: 'cle', params: { q: 'x' } },
        });
        expect(response.status).toBe(502);
        expect(json(response).error).toMatch(/Réponse Brave invalide/);
        upstreamResponder = null;
    });

    it('survit à une erreur amont et reste disponible', async () => {
        const health = await request(PROXY_PORT, '/health');
        expect(health.status).toBe(200);
    });
});
