// tests/integration/server.test.js
// Test d'intégration du serveur local (tools/nutrition-app-server.js) :
// validation des correctifs de sécurité (traversée de chemin, exposition
// des sauvegardes/.git, résistance aux URL malformées).
//
// NB : on utilise node:http directement car le harnais de test remplace
// globalThis.fetch par un mock.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const PORT = 5700 + Math.floor(Math.random() * 200);
const HOST = '127.0.0.1';

let child;
let serverOutput = '';

function request(requestPath, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: HOST, port: PORT, path: requestPath, method }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function waitForServer(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const response = await request('/health');
            if (response.status === 200) return;
        } catch (_) { /* pas encore prêt */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Serveur non démarré sur ${HOST}:${PORT}\n${serverOutput}`);
}

beforeAll(async () => {
    child = spawn(process.execPath, [path.join(ROOT, 'tools/nutrition-app-server.js')], {
        cwd: ROOT,
        env: { ...process.env, NUTRITION_APP_PORT: String(PORT), NO_BROWSER: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { serverOutput += String(chunk); });
    child.stderr.on('data', (chunk) => { serverOutput += String(chunk); });
    await waitForServer();
}, 20000);

afterAll(() => {
    if (child && !child.killed) child.kill();
});

describe('serveur local — fichiers statiques', () => {
    it('sert index.html sur /', async () => {
        const response = await request('/');
        expect(response.status).toBe(200);
        expect(response.body).toContain('<!DOCTYPE html>');
        expect(response.body).toContain('Nutrition');
    });

    it('sert les modules JS avec le bon type MIME', async () => {
        const response = await request('/js/core/utils.js');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('javascript');
    });

    it('ajoute l’en-tête nosniff', async () => {
        const response = await request('/');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('n’ouvre pas le CORS sur les fichiers statiques', async () => {
        const response = await request('/');
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('retourne 404 pour un fichier inexistant', async () => {
        const response = await request('/fichier-inexistant.txt');
        expect(response.status).toBe(404);
    });
});

describe('serveur local — protection des données', () => {
    it('refuse l’accès au dossier .git', async () => {
        const response = await request('/.git/config');
        expect(response.status).toBe(403);
    });

    it('refuse l’accès aux sauvegardes JSON', async () => {
        const response = await request('/nutrition-tracker-backup-2026-05-18.json');
        expect(response.status).toBe(403);
    });

    it('refuse la traversée de chemin par dossier frère partageant le préfixe', async () => {
        // Le contrôle utilisait startsWith(ROOT) : un dossier frère nommé
        // « nutrition-tracker-secret » passait le test.
        const response = await request('/../nutrition-tracker-secret/x.txt');
        expect([403, 404]).toContain(response.status);
    });

    it('ne sert pas le dossier node_modules', async () => {
        const response = await request('/node_modules/vitest/package.json');
        expect(response.status).toBe(403);
    });
});

describe('serveur local — robustesse', () => {
    it('répond 400 à une URL mal encodée sans tuer le process', async () => {
        const response = await request('/%');
        expect(response.status).toBe(400);

        // Le serveur doit toujours répondre après l'erreur (il mourait avant).
        const health = await request('/health');
        expect(health.status).toBe(200);
    });

    it('répond 200 sur /health même avec une query string', async () => {
        const response = await request('/health?x=1');
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });

    it('refuse les méthodes non supportées', async () => {
        const response = await request('/', 'DELETE');
        expect(response.status).toBe(405);
    });
});
