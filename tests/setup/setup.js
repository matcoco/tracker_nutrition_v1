// tests/setup/setup.js
// Environnement global pour tous les tests : IndexedDB en mémoire, stub Chart.js,
// APIs navigateur manquantes dans jsdom.

import 'fake-indexeddb/auto';
import { vi, beforeEach, afterEach } from 'vitest';

// --- Chart.js : l'application le charge depuis un CDN, on fournit un double de test ---
class ChartStub {
    static instances = [];
    static defaults = { font: { family: '', size: 12 }, color: '#000', plugins: {} };
    static register() {}
    static unregister() {}
    static getChart() { return null; }

    constructor(ctx, config = {}) {
        this.ctx = ctx;
        this.config = config;
        this.data = config.data || { labels: [], datasets: [] };
        this.options = config.options || {};
        this.type = config.type;
        this.destroyed = false;
        this.updateCount = 0;
        ChartStub.instances.push(this);
    }

    update() { this.updateCount += 1; }
    destroy() { this.destroyed = true; }
    resize() {}
    reset() {}
    render() {}
    stop() {}
    toBase64Image() { return 'data:image/png;base64,'; }
}

globalThis.Chart = ChartStub;

// --- APIs navigateur absentes ou non implémentées dans jsdom ---
if (!globalThis.matchMedia) {
    globalThis.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => 'blob:mock-url';
}
if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = () => {};
}

if (!globalThis.HTMLCanvasElement.prototype.getContext) {
    globalThis.HTMLCanvasElement.prototype.getContext = () => null;
} else {
    // jsdom lève "Not implemented" : on renvoie un contexte factice.
    globalThis.HTMLCanvasElement.prototype.getContext = () => ({
        canvas: {}, fillRect: () => {}, clearRect: () => {}, getImageData: () => ({ data: [] }),
        putImageData: () => {}, createImageData: () => ({ data: [] }), setTransform: () => {},
        drawImage: () => {}, save: () => {}, restore: () => {}, beginPath: () => {},
        moveTo: () => {}, lineTo: () => {}, closePath: () => {}, stroke: () => {}, fill: () => {},
        measureText: () => ({ width: 0 }), fillText: () => {}, strokeText: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
    });
}

// jsdom n'implémente pas scrollIntoView
if (!globalThis.Element.prototype.scrollIntoView) {
    globalThis.Element.prototype.scrollIntoView = () => {};
}

// confirm/alert/prompt : valeurs par défaut sûres, surchargées au besoin par les tests
globalThis.confirm = vi.fn(() => true);
globalThis.alert = vi.fn();
globalThis.prompt = vi.fn(() => null);

// Les fonctions globales exposées par index.html (labels dynamiques, profils d'objectifs)
globalThis.updatePriceLabel = globalThis.updatePriceLabel || (() => {});
globalThis.updateNutritionLabels = globalThis.updateNutritionLabels || (() => {});

// --- remise à zéro entre les tests ---
beforeEach(() => {
    ChartStub.instances.length = 0;
    if (globalThis.localStorage) globalThis.localStorage.clear();
    globalThis.confirm = vi.fn(() => true);
    globalThis.alert = vi.fn();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('fetch non mocké dans ce test')));
});

afterEach(() => {
    vi.restoreAllMocks();
});

export { ChartStub };
