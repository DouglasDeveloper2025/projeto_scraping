import fs from 'fs/promises';
import fsSync from 'fs';
import * as cheerio from "cheerio";
import pLimit from 'p-limit';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ScrapingPayloadDto } from 'src/rabbitmq/dto/scraping.dto';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function loadJSON<T>(path: string, def: T): Promise<T> {
  try {
    if (!fsSync.existsSync(path)) return def;
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    return def;
  }
}

class ProxyManager {
  proxy?: string;
  bad = false;
  badProxies: Set<string> = new Set();

  constructor(proxy?: string) {
    this.proxy = proxy;
  }

  async init() {
    const list = await loadJSON<string[]>(PROXY_BAD_FILE, []);
    this.badProxies = new Set(list);
    if (this.proxy) {
      this.bad = this.badProxies.has(this.proxy);
    }
  }

  get(): string | null {
    if (!this.proxy || this.bad) return null;
    return this.proxy;
  }

  async markBad() {
    if (!this.proxy) return;
    this.bad = true;
    this.badProxies.add(this.proxy);
    await fs.writeFile(
      PROXY_BAD_FILE,
      JSON.stringify([...this.badProxies], null, 2),
    );
  }
}

async function fetchPage(
  url: string,
  pagina: number,
  cookies: Record<string, string>,
  proxyManager: ProxyManager,
  stats: { req: number; erro: number },
  limit: ReturnType<typeof pLimit>,
) {
  return limit(async () => {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const proxy = proxyManager.get();
      const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), TIMEOUT);

        const res = await fetch(
          url,
          {
            headers: {
              'User-Agent':
                USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
              Cookie: Object.entries(cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; '),
            },
            signal: controller.signal,
            ...(agent ? { agent } : {}),
          } as any, // ← fetch do Node não tipa agent
        );

        stats.req++;

        if (res.status === 403 || res.status === 429) {
          await proxyManager.markBad();
          continue;
        }

        if (res.status !== 200) return null;

        const html = await res.text();
        return parsePage(html, url, pagina);
      } catch (err) {
        console.error('Erro no fetch:', err);

        stats.erro++;
        await proxyManager.markBad();
        await sleep(1000);
      }
    }
    return null;
  });
}

function parsePage(html: string, url: string, pagina: number) {
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

  const anuncios: any[] = [];

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

    const dados_components: any = {
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
    } else if (typeof adsPromotions === 'object') {
      alt_text = adsPromotions?.alt_text;
    }

    for (const comp of polycard.components ?? []) {
      const type = comp.type;

      // REVIEW
      if (type === 'review_compacted') {
        dados_components.review_compacted =
          comp.alt_text ?? comp.review_compacted?.alt_text;
      }

      // TITLE
      if (!dados_components.title) {
        dados_components.title =
          comp.text ??
          comp.title?.text ??
          comp.title?.label ??
          comp.title?.value;
      }

      // PRICE
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

      // SHIPPING
      if (type === 'shipping' || comp.shipping) {
        dados_components.shipping = comp.shipping;
      }

      // SHIPPED FROM
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

  // PAGINAÇÃO
  const pagination = initial.pagination ?? {};
  const analytics = initial.analytics_track ?? {};
  const dimensions = analytics.dimensions ?? {};
  const results_all = dimensions.searchResults;

  const qtd = Number.isInteger(pagination.per_page)
    ? pagination.per_page
    : ITENS_POR_PAGINA;

  const totalPaginas =
    pagination.page_count ??
    pagination.last_page ??
    (results_all ? Math.ceil(results_all / qtd) : 1);

  const productMap = new Map(
    anuncios.filter(a => a.id).map(a => [a.id, a])
  );

  const seo = initial.seo ?? {};
  const schema = seo.schema ?? {};
  const product_list_seo = schema.product_list ?? [];

  const product_list: any[] = [];

  for (const item of product_list_seo) {
    const anuncio = productMap.get(item.id);
    if (!anuncio) continue;

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

export async function run(payload: ScrapingPayloadDto) {
  const termos = payload?.payload?.termos;
  const proxy = payload?.payload?.proxy;

  if (!termos) {
    throw new Error('Termos de busca não informados');
  }

  const encoded = encodeURIComponent(termos);
  const baseUrl = `https://lista.mercadolivre.com.br/${encoded}`;

  const cookies = await loadJSON<Record<string, string>>(COOKIE_FILE, {});
  const proxyManager = new ProxyManager(proxy);
  await proxyManager.init();

  const limit = pLimit(MAX_CONCURRENCY);

  const stats = {
    req: 0,
    erro: 0,
  };

  const pages: any[] = [];
  let totalPaginas = 1;

  for (let pagina = 1; pagina <= totalPaginas && pagina <= MAX_PAGES; pagina++) {
    const url =
      pagina === 1 ? baseUrl : `${baseUrl}_Desde_${(pagina - 1) * ITENS_POR_PAGINA + 1}`;

    const page = await fetchPage(
      url,
      pagina,
      cookies,
      proxyManager,
      stats,
      limit,
    );

    if (!page) continue;

    pages.push(page);

    if (pagina === 1) {
      totalPaginas = page?.paginacao?.paginas ?? 1;
    }
  }
  /*const output =  {
    termo: termos,
    total_paginas: totalPaginas,
    paginas_processadas: pages.length,
    requisicoes: stats.req,
    erros: stats.erro,
    dados: pages,
  };
  await fs.writeFile(
  'arquivos/output.json',
  JSON.stringify(output, null, 2),
  'utf-8',
);*/
  return console.log('Ok!')
}
