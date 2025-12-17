import os
import sys
import json
import time
import math
import random
import asyncio
import aiohttp
import traceback
from datetime import datetime
from bs4 import BeautifulSoup
from typing import List, Optional

MAX_CONCURRENCY = 3
TIMEOUT = 40
MAX_RETRIES = 10
BATCH_SIZE = 50
BATCH_DELAY = 15
ITENS_POR_PAGINA = 48
MAX_PAGES = 42

COOKIE_FILE = "./json/cookies.json"

PROXY_BAD_FILE = "json/proxys_bad.json"
RESULTADOS_DIR = "Arquivos"
ERRORS_DIR = "errors"

os.makedirs(RESULTADOS_DIR, exist_ok=True)
# os.makedirs(ERRORS_DIR, exist_ok=True)
os.makedirs("json", exist_ok=True)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
]


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def log_error(msg: str, url: str = ""):
    with open(os.path.join(ERRORS_DIR, "erros.txt"), "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()} | {url} | {msg}\n")


class ProxyManager:
    def __init__(self, proxy: Optional[str]):
        self.proxy = proxy
        self.bad_proxies = set(load_json(PROXY_BAD_FILE, []))
        self.bad = proxy in self.bad_proxies if proxy else False

    def get_persistent(self, termo: str):
        if not self.proxy or self.bad:
            return None
        return self.proxy

    def mark_bad(self, proxy):
        if proxy and proxy == self.proxy:
            self.bad = True
            self.bad_proxies.add(proxy)
            save_json(PROXY_BAD_FILE, list(self.bad_proxies))


async def run(payload: dict):
    data = payload.get("payload", {})
    termos = data.get("termos")
    proxy = data.get("proxy")

    try:
        proxy_manager = ProxyManager(proxy)

        if not termos:
            print("Nenhum termo informado", file=sys.stderr)
            return

        print(f"Iniciando scraper para: {termos}", file=sys.stderr)

        if isinstance(COOKIE_FILE, dict):
            cookies_raw = COOKIE_FILE
        else:
            cookies_raw = load_json(COOKIE_FILE, {})

        cookies = (
            {c["name"]: c["value"] for c in cookies_raw}
            if isinstance(cookies_raw, list)
            else cookies_raw
        )

        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

        stats = {"req": 0, "200": 0, "403": 0, "429": 0, "erro": 0}

        async def fetch_page(session, url: str, termo: str, pagina: int, cookies: dict):
            async with semaphore:
                for _ in range(MAX_RETRIES):
                    proxy = proxy_manager.get_persistent(termo)

                    try:
                        async with session.get(
                            url,
                            timeout=TIMEOUT,
                            proxy=proxy,
                            headers={"User-Agent": random.choice(USER_AGENTS)},
                        ) as resp:

                            stats["req"] += 1
                            stats[str(resp.status)] = stats.get(str(resp.status), 0) + 1

                            if resp.status in (403, 429):
                                proxy_manager.mark_bad(proxy)
                                continue

                            if resp.status != 200:
                                print(
                                    f"Erro HTTP {resp.status} em {url}", file=sys.stderr
                                )
                                return None

                            html = await resp.text()

                            dados = parse_page(html, url, pagina, cookies)

                            if not dados:
                                return None

                            return dados

                    except Exception as e:
                        proxy_manager.mark_bad(proxy)
                        stats["erro"] += 1
                        print(f"[ERRO] {e}")
                        await asyncio.sleep(1)

                return None

        def parse_page(html: str, url: str, pagina: int, cookies: dict):
            try:
                soup = BeautifulSoup(html, "html.parser")

                # Debug: Salvar HTML formatado se necessário, mas em variavel separada
                html_debug = soup.prettify()
                save_json(
                    "soup_debug.json", html_debug
                )  # Isso ainda pode falhar se save_json esperar dict

                if "suspicious-traffic" in html or "all/catch_all" in html:
                    print(
                        "BLOQUEIO DETECTADO: Mercado Livre retornou pagina de 'suspicious traffic' ou CAPTCHA.",
                        file=sys.stderr,
                    )
                    print(
                        "SUGESTAO: Atualize os cookies no arquivo 'cookies.json' ou troque o Proxy.",
                        file=sys.stderr,
                    )
                    return None

                script = soup.find("script", id="__PRELOADED_STATE__")

                if not script or not script.string:
                    print(
                        "Script __PRELOADED_STATE__ nao encontrado ou vazio.",
                        file=sys.stderr,
                    )
                    return None

                raw = script.string
                start = raw.find("{")
                end = raw.rfind("}")
                if start == -1 or end == -1 or end <= start:
                    print(
                        "__PRELOADED_STATE__ nao encontrado ou vazio.",
                        file=sys.stderr,
                    )
                    return None

                data = json.loads(raw[start : end + 1])
                initial = data.get("pageState", {}).get("initialState", {}) or {}

                adult_info = initial.get("adult_info", {})
                results = initial.get("results", []) or []

                anuncios = []
                for result in results:
                    polycard = result.get("polycard") or {}
                    meta = polycard.get("metadata") or {}

                    dados_metadata = {
                        "id": meta.get("id"),
                        "product_id": meta.get("product_id"),
                        "user_product_id": meta.get("user_product_id"),
                        "url_fragments": meta.get("url_fragments"),
                        "url_params": meta.get("url_params"),
                        "domain_id": meta.get("domain_id"),
                        "bulk_sale": meta.get("bulk_sale"),
                        "url": meta.get("url"),
                        "category_id": meta.get("category_id"),
                    }

                    dados_components = {
                        "title": None,
                        "current_price": None,
                        "current_price_currency": None,
                        "previous_price": None,
                        "previous_price_currency": None,
                        "shipping": None,
                        "shipped_from": None,
                        "review_compacted": None,
                    }

                    ads_promotions_data = polycard.get("ads_promotions", [])
                    alt_text_data = None

                    if isinstance(ads_promotions_data, list) and ads_promotions_data:
                        alt_text_data = ads_promotions_data[0].get("alt_text")
                    elif isinstance(ads_promotions_data, dict):
                        alt_text_data = ads_promotions_data.get("alt_text")

                    for comp in polycard.get("components") or []:
                        c_type = comp.get("type")

                        # REVIEW
                        if c_type == "review_compacted":
                            r_text = comp.get("alt_text")
                            if not r_text and isinstance(
                                comp.get("review_compacted"), dict
                            ):
                                r_text = comp["review_compacted"].get("alt_text")
                            dados_components["review_compacted"] = r_text

                        # TITLE
                        if not dados_components["title"]:
                            dados_components["title"] = comp.get("text")

                        if not dados_components["title"] and isinstance(
                            comp.get("title"), dict
                        ):
                            t = comp["title"]
                            dados_components["title"] = (
                                t.get("text") or t.get("label") or t.get("value")
                            )

                        # PRICE
                        if isinstance(comp.get("price"), dict):
                            price = comp["price"]

                            cur = price.get("current_price") or {}
                            if cur.get("value") is not None:
                                dados_components["current_price"] = cur.get("value")
                                dados_components["current_price_currency"] = cur.get(
                                    "currency"
                                )

                            prev = price.get("previous_price") or {}
                            if prev.get("value") is not None:
                                dados_components["previous_price"] = prev.get("value")
                                dados_components["previous_price_currency"] = prev.get(
                                    "currency"
                                )

                        # SHIPPING
                        if c_type == "shipping" or "shipping" in comp:
                            dados_components["shipping"] = comp.get("shipping")

                        # FULL
                        if c_type == "shipped_from":
                            dados_components["shipped_from"] = comp.get("shipped_from")

                    if not dados_components["title"]:
                        dados_components["title"] = (
                            meta.get("title")
                            or meta.get("name")
                            or meta.get("product_name")
                        )

                    anuncios.append(
                        {
                            **dados_metadata,
                            **dados_components,
                            "ads_promotions": ads_promotions_data,
                            "alt_text": alt_text_data,
                        }
                    )

                # PAGINAÇÃO
                pagination = initial.get("pagination", {}) or {}

                analytics = initial.get("analytics_track", {}) or {}
                dimensions = analytics.get("dimensions", {}) or {}
                results_all = dimensions.get("searchResults")

                qtd = pagination.get("per_page")
                if not isinstance(qtd, int) or qtd <= 0:
                    qtd = ITENS_POR_PAGINA
                pagination["itens_por_pagina"] = qtd

                total_p = pagination.get("page_count") or pagination.get("last_page")
                if not total_p:
                    if results_all:
                        try:
                            total_p = math.ceil(int(results_all) / qtd)
                        except:
                            total_p = 1
                    else:
                        total_p = 1
                pagination["paginas"] = total_p

                pagination.pop("previous_page", None)
                pagination.pop("pagination_nodes_url", None)
                pagination.pop("next_page", None)
                pagination.pop("show_pagination", None)

                seo = initial.get("seo", {}) or {}
                schema = seo.get("schema", {}) or {}
                product_lists_seo = schema.get("product_list", []) or []

                anuncios_map = {a.get("id"): a for a in anuncios if a.get("id")}
                product_list_final = []

                for item in product_lists_seo:
                    anuncio = anuncios_map.get(item.get("id"))
                    if not anuncio:
                        continue

                    product_list_final.append(
                        {
                            "id": item.get("id"),
                            "product_id": anuncio.get("product_id"),
                            "user_product_id": anuncio.get("user_product_id"),
                            "title": anuncio.get("title"),
                            "brand": item.get("brand_attribute", {}).get("name"),
                            "url": item.get("item_offered", {}).get("url"),
                            "url_fragments": anuncio.get("url_fragments"),
                            "url_params": anuncio.get("url_params"),
                            "domain_id": anuncio.get("domain_id"),
                            "bulk_sale": anuncio.get("bulk_sale"),
                            "category_id": anuncio.get("category_id"),
                            "image": item.get("image"),
                            "ads_promotions": anuncio.get("alt_text"),
                            "review_compacted": anuncio.get("review_compacted"),
                            "price": {
                                "previous_price": anuncio.get("previous_price"),
                                "previous_price_currency": anuncio.get(
                                    "previous_price_currency"
                                ),
                                "current_price": anuncio.get("current_price"),
                                "current_price_currency": anuncio.get(
                                    "current_price_currency"
                                ),
                            },
                            "shipping": anuncio.get("shipping"),
                            "shipped_from": anuncio.get("shipped_from"),
                        }
                    )

                return {
                    "pagina": pagina,
                    "url": url,
                    "qtd_itens_pagina": len(results),
                    "results_all": results_all,
                    "paginacao": pagination,
                    "adult_info": adult_info,
                    "product_list": product_list_final,
                }

            except Exception as e:
                print(f"[ERRO][parse_page] {e}")
                print(traceback.format_exc())
                return None

        async with aiohttp.ClientSession(cookies=cookies) as session:
            inicio = time.time()
            termo_slug = termos.replace(" ", "-")
            primeira_url = f"https://lista.mercadolivre.com.br/{termo_slug}"

            primeira = await fetch_page(session, primeira_url, termos, 1, cookies)

            if not primeira:
                print(f"Falha ao obter primeira pagina para: {termos}", file=sys.stderr)
                return

            total_paginas = min(primeira["paginacao"]["paginas"], MAX_PAGES)
            todas_paginas = [primeira]

            tasks = []
            for p in range(2, total_paginas + 1):
                offset = 1 + (p - 1) * primeira["paginacao"]["itens_por_pagina"]
                url = f"{primeira_url}_Desde_{offset}_NoIndex_True"
                tasks.append(fetch_page(session, url, termos, p, cookies))

            for r in await asyncio.gather(*tasks):
                if r:
                    todas_paginas.append(r)

            produtos = [p for pg in todas_paginas for p in pg["product_list"]]

            # aqui pega os dados estatísticos da primeira página
            primeira_pagina_ref = todas_paginas[0] if todas_paginas else {}

            estatisticas = {
                "qtd_itens_pagina": primeira_pagina_ref.get("qtd_itens_pagina", 0),
                "results_all": primeira_pagina_ref.get("results_all", "0"),
                "total_produtos": len(produtos),
                "total_paginas": len(todas_paginas),
                "tempo": round(time.time() - inicio, 2),
                "requisições": len(todas_paginas),
                "proxy_usado": proxy,
                "url": primeira_url,
            }

            # de dentro de cada objeto em 'todas_paginas' para limpar a saída 'dados'
            keys_to_remove = ["url", "qtd_itens_pagina", "results_all"]
            for pagina_data in todas_paginas:
                for key in keys_to_remove:
                    pagina_data.pop(key, None)

            output = {
                "termo": termos,
                "estatisticas": estatisticas,
                "dados": todas_paginas,
            }

            with open("arquivos/output.json", "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)

            return output

    except Exception as e:
        print(f"[ERRO][scraper_mercadolivre] {e}", file=sys.stderr)
        log_error(str(e), "Scraper Mercado Livre")
        return None


if __name__ == "__main__":
    payload = json.loads(sys.argv[1])
    result = asyncio.run(run(payload))
    print(json.dumps(result))
