"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const cheerio = __importStar(require("cheerio"));
const p_limit_1 = __importDefault(require("p-limit"));
const https_proxy_agent_1 = require("https-proxy-agent");
const MAX_CONCURRENCY = 3;
const TIMEOUT = 40_000;
const MAX_RETRIES = 10;
const ITENS_POR_PAGINA = 48;
const MAX_PAGES = 42;
const COOKIE_FILE = './json/cookies.json';
const PROXY_BAD_FILE = './json/proxys_bad.json';
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function loadJSON(path, def) {
    try {
        if (!fs_1.default.existsSync(path))
            return def;
        return JSON.parse(await promises_1.default.readFile(path, 'utf8'));
    }
    catch {
        return def;
    }
}
class ProxyManager {
    proxy;
    bad = false;
    badProxies = new Set();
    constructor(proxy) {
        this.proxy = proxy;
    }
    async init() {
        const list = await loadJSON(PROXY_BAD_FILE, []);
        this.badProxies = new Set(list);
        if (this.proxy) {
            this.bad = this.badProxies.has(this.proxy);
        }
    }
    get() {
        if (!this.proxy || this.bad)
            return null;
        return this.proxy;
    }
    async markBad() {
        if (!this.proxy)
            return;
        this.bad = true;
        this.badProxies.add(this.proxy);
        await promises_1.default.writeFile(PROXY_BAD_FILE, JSON.stringify([...this.badProxies], null, 2));
    }
}
async function fetchPage(url, pagina, cookies, proxyManager, stats, limit) {
    return limit(async () => {
        for (let i = 0; i < MAX_RETRIES; i++) {
            const proxy = proxyManager.get();
            const agent = proxy ? new https_proxy_agent_1.HttpsProxyAgent(proxy) : undefined;
            try {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), TIMEOUT);
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                        Cookie: Object.entries(cookies)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('; '),
                    },
                    signal: controller.signal,
                    ...(agent ? { agent } : {}),
                });
                stats.req++;
                if (res.status === 403 || res.status === 429) {
                    await proxyManager.markBad();
                    continue;
                }
                if (res.status !== 200)
                    return null;
                const html = await res.text();
                return parsePage(html, url, pagina);
            }
            catch (err) {
                console.error('Erro no fetch:', err);
                stats.erro++;
                await proxyManager.markBad();
                await sleep(1000);
            }
        }
        return null;
    });
}
function parsePage(html, url, pagina) {
    const $ = cheerio.load(html);
    if (html.includes('suspicious-traffic') || html.includes('all/catch_all')) {
        console.error('BLOQUEIO DETECTADO (CAPTCHA / suspicious traffic)');
        return null;
    }
    const script = $('#__PRELOADED_STATE__').html();
    if (!script) {
        console.error('__PRELOADED_STATE__ não encontrado');
        return null;
    }
    const start = script.indexOf('{');
    const end = script.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        console.error('__PRELOADED_STATE__ inválido');
        return null;
    }
    const data = JSON.parse(script.slice(start, end + 1));
    const initial = data?.pageState?.initialState ?? {};
    const adult_info = initial.adult_info ?? {};
    const results = initial.results ?? [];
    const anuncios = [];
    for (const result of results) {
        const polycard = result?.polycard ?? {};
        const meta = polycard?.metadata ?? {};
        const dados_metadata = {
            id: meta.id,
            product_id: meta.product_id,
            user_product_id: meta.user_product_id,
            url_fragments: meta.url_fragments,
            url_params: meta.url_params,
            domain_id: meta.domain_id,
            bulk_sale: meta.bulk_sale,
            url: meta.url,
            category_id: meta.category_id,
        };
        const dados_components = {
            title: null,
            current_price: null,
            current_price_currency: null,
            previous_price: null,
            previous_price_currency: null,
            shipping: null,
            shipped_from: null,
            review_compacted: null,
        };
        const adsPromotions = polycard.ads_promotions ?? [];
        let alt_text = null;
        if (Array.isArray(adsPromotions) && adsPromotions.length) {
            alt_text = adsPromotions[0]?.alt_text;
        }
        else if (typeof adsPromotions === 'object') {
            alt_text = adsPromotions?.alt_text;
        }
        for (const comp of polycard.components ?? []) {
            const type = comp.type;
            if (type === 'review_compacted') {
                dados_components.review_compacted =
                    comp.alt_text ?? comp.review_compacted?.alt_text;
            }
            if (!dados_components.title) {
                dados_components.title =
                    comp.text ??
                        comp.title?.text ??
                        comp.title?.label ??
                        comp.title?.value;
            }
            if (comp.price) {
                const cur = comp.price.current_price;
                if (cur?.value != null) {
                    dados_components.current_price = cur.value;
                    dados_components.current_price_currency = cur.currency;
                }
                const prev = comp.price.previous_price;
                if (prev?.value != null) {
                    dados_components.previous_price = prev.value;
                    dados_components.previous_price_currency = prev.currency;
                }
            }
            if (type === 'shipping' || comp.shipping) {
                dados_components.shipping = comp.shipping;
            }
            if (type === 'shipped_from') {
                dados_components.shipped_from = comp.shipped_from;
            }
        }
        if (!dados_components.title) {
            dados_components.title =
                meta.title ?? meta.name ?? meta.product_name;
        }
        anuncios.push({
            ...dados_metadata,
            ...dados_components,
            ads_promotions: adsPromotions,
            alt_text,
        });
    }
    const pagination = initial.pagination ?? {};
    const analytics = initial.analytics_track ?? {};
    const dimensions = analytics.dimensions ?? {};
    const results_all = dimensions.searchResults;
    const qtd = Number.isInteger(pagination.per_page)
        ? pagination.per_page
        : ITENS_POR_PAGINA;
    const totalPaginas = pagination.page_count ??
        pagination.last_page ??
        (results_all ? Math.ceil(results_all / qtd) : 1);
    const productMap = new Map(anuncios.filter(a => a.id).map(a => [a.id, a]));
    const seo = initial.seo ?? {};
    const schema = seo.schema ?? {};
    const product_list_seo = schema.product_list ?? [];
    const product_list = [];
    for (const item of product_list_seo) {
        const anuncio = productMap.get(item.id);
        if (!anuncio)
            continue;
        product_list.push({
            id: item.id,
            product_id: anuncio.product_id,
            user_product_id: anuncio.user_product_id,
            title: anuncio.title,
            brand: item.brand_attribute?.name,
            url: item.item_offered?.url,
            url_fragments: anuncio.url_fragments,
            url_params: anuncio.url_params,
            domain_id: anuncio.domain_id,
            bulk_sale: anuncio.bulk_sale,
            category_id: anuncio.category_id,
            image: item.image,
            ads_promotions: anuncio.alt_text,
            review_compacted: anuncio.review_compacted,
            price: {
                previous_price: anuncio.previous_price,
                previous_price_currency: anuncio.previous_price_currency,
                current_price: anuncio.current_price,
                current_price_currency: anuncio.current_price_currency,
            },
            shipping: anuncio.shipping,
            shipped_from: anuncio.shipped_from,
        });
    }
    return {
        pagina,
        url,
        qtd_itens_pagina: results.length,
        results_all,
        paginacao: {
            paginas: totalPaginas,
            itens_por_pagina: qtd,
        },
        adult_info,
        product_list,
    };
}
async function run(payload) {
    const termos = payload?.payload?.termos;
    const proxy = payload?.payload?.proxy;
    if (!termos) {
        throw new Error('Termos de busca não informados');
    }
    const encoded = encodeURIComponent(termos);
    const baseUrl = `https://lista.mercadolivre.com.br/${encoded}`;
    const cookies = await loadJSON(COOKIE_FILE, {});
    const proxyManager = new ProxyManager(proxy);
    await proxyManager.init();
    const limit = (0, p_limit_1.default)(MAX_CONCURRENCY);
    const stats = {
        req: 0,
        erro: 0,
    };
    const pages = [];
    let totalPaginas = 1;
    for (let pagina = 1; pagina <= totalPaginas && pagina <= MAX_PAGES; pagina++) {
        const url = pagina === 1 ? baseUrl : `${baseUrl}_Desde_${(pagina - 1) * ITENS_POR_PAGINA + 1}`;
        const page = await fetchPage(url, pagina, cookies, proxyManager, stats, limit);
        if (!page)
            continue;
        pages.push(page);
        if (pagina === 1) {
            totalPaginas = page?.paginacao?.paginas ?? 1;
        }
    }
    return console.log('Ok!');
}
//# sourceMappingURL=scraper.js.map