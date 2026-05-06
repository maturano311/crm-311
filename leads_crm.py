"""
CRM de Leads — Sorvete
Busca estabelecimentos via Google Places API e cadastra no Notion automaticamente.
Evita duplicatas via Google Place ID.

Requisitos: pip install requests python-dotenv
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

TIPOS_BUSCA = {
    "1": {"label": "MERCADO",       "query": "mercado"},
    "2": {"label": "SUPERMERCADO",  "query": "supermercado"},
    "3": {"label": "PADARIA",       "query": "padaria"},
    "4": {"label": "Todos",         "query": None},
}


# ─────────────────────────────────────────────
# GOOGLE PLACES
# ─────────────────────────────────────────────

def geocodificar(cidade: str) -> tuple[float, float] | None:
    """Converte nome da cidade em coordenadas lat/lng."""
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    resp = requests.get(url, params={"address": cidade, "key": GOOGLE_API_KEY, "language": "pt-BR"})
    data = resp.json()
    if data.get("status") == "OK":
        loc = data["results"][0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None


def buscar_estabelecimentos(cidade: str, tipo_query: str) -> list[dict]:
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    resultados = []
    next_page_token = None

    coords = geocodificar(cidade)
    if coords:
        print(f"  📍 Coordenadas encontradas: {coords[0]:.4f}, {coords[1]:.4f}")
    else:
        print(f"  ⚠️  Não foi possível geocodificar '{cidade}'. Resultados podem ser imprecisos.")

    print(f"\n🔍 Buscando '{tipo_query}' em '{cidade}'...")

    while True:
        params = {
            "query": f"{tipo_query} em {cidade}",
            "key": GOOGLE_API_KEY,
            "language": "pt-BR",
        }
        if coords:
            params["location"] = f"{coords[0]},{coords[1]}"
            params["radius"] = "15000"  # 15km ao redor da cidade
        if next_page_token:
            params["pagetoken"] = next_page_token
            time.sleep(2)

        resp = requests.get(url, params=params)
        data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"  ⚠️  Erro Google: {data.get('status')} — {data.get('error_message', '')}")
            break

        resultados.extend(data.get("results", []))
        next_page_token = data.get("next_page_token")

        if not next_page_token:
            break

    print(f"  ✅ {len(resultados)} estabelecimentos encontrados.")
    return resultados


def calcular_prioridade(place: dict) -> str:
    """
    ALTA  → avaliação >= 4.0 e reviews >= 50
    BAIXA → avaliação < 3.5 ou reviews < 10
    MEDIA → demais casos
    """
    rating = place.get("rating", 0)
    reviews = place.get("user_ratings_total", 0)

    if rating >= 4.0 and reviews >= 50:
        return "ALTA"
    elif rating < 3.5 or reviews < 10:
        return "BAIXA"
    else:
        return "MEDIA"


def extrair_bairro_cidade(place: dict, cidade_input: str = "") -> tuple[str, str]:
    """Extrai bairro do formatted_address e usa cidade_input para CIDADE."""
    address = place.get("formatted_address", "")
    bairro = ""
    partes_traco = address.split("-")
    if len(partes_traco) >= 2:
        candidato = partes_traco[1].strip().split(",")[0].strip()
        if candidato and not candidato.isdigit() and len(candidato) > 2:
            bairro = candidato
    cidade = cidade_input.split("-")[0].strip() if cidade_input else ""
    return bairro, cidade


# ─────────────────────────────────────────────
# NOTION
# ─────────────────────────────────────────────

def buscar_place_ids_existentes() -> set[str]:
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query"
    place_ids = set()
    has_more = True
    start_cursor = None

    print("\n📋 Carregando base existente do Notion...")

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

        resp = requests.post(url, headers=NOTION_HEADERS, json=body)
        data = resp.json()

        if resp.status_code != 200:
            print(f"  ⚠️  Erro ao acessar Notion: {data.get('message')}")
            break

        for page in data.get("results", []):
            props = page.get("properties", {})
            rich_text = props.get("Google Place ID", {}).get("rich_text", [])
            if rich_text:
                place_ids.add(rich_text[0]["plain_text"])

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    print(f"  ✅ {len(place_ids)} registros já cadastrados.")
    return place_ids


def cadastrar_lead(place: dict, tipo_label: str, cidade_input: str = "") -> bool:
    url = "https://api.notion.com/v1/pages"

    nome = place.get("name", "Sem nome")
    endereco = place.get("formatted_address", "")
    telefone = place.get("formatted_phone_number", "")
    rating = place.get("rating", None)
    place_id = place.get("place_id", "")
    location = place.get("geometry", {}).get("location", {})
    lat = location.get("lat", "")
    lng = location.get("lng", "")
    prioridade = calcular_prioridade(place)
    bairro, cidade = extrair_bairro_cidade(place, cidade_input)

    body = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "NOME FANTASIA": {
                "title": [{"text": {"content": nome}}]
            },
            "TIPO": {
                "select": {"name": tipo_label}
            },
            "ENDEREÇO": {
                "rich_text": [{"text": {"content": endereco}}]
            },
            "BAIRRO": {
                "rich_text": [{"text": {"content": bairro}}]
            },
            "CIDADE": {
                "select": {"name": cidade}
            },
            "Status": {
                "status": {"name": "Não iniciada"}
            },
            "PRIORIDADE": {
                "status": {"name": prioridade}
            },
            "TIPO DE ENTRADA": {
                "status": {"name": "A PROSPECTAR"}
            },
            "Google Place ID": {
                "rich_text": [{"text": {"content": place_id}}]
            },
            "Waze": {
                "url": f"https://waze.com/ul?ll={lat},{lng}&navigate=yes" if lat and lng else ""
            },
        }
    }

    if telefone:
        body["properties"]["Telefone"] = {"phone_number": telefone}

    resp = requests.post(url, headers=NOTION_HEADERS, json=body)

    if resp.status_code != 200:
        erro = resp.json().get("message", resp.text)
        print(f"  ⚠️  Falha '{nome}': {erro}")
        return False

    return True


def listar_base(filtro_status: str = None):
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query"

    body = {
        "page_size": 50,
        "sorts": [{"property": "PRIORIDADE", "direction": "ascending"}]
    }
    if filtro_status:
        body["filter"] = {"property": "Status", "status": {"equals": filtro_status}}

    resp = requests.post(url, headers=NOTION_HEADERS, json=body)
    data = resp.json()

    if resp.status_code != 200:
        print(f"Erro: {data.get('message')}")
        return

    resultados = data.get("results", [])
    if not resultados:
        print("Nenhum lead encontrado.")
        return

    print(f"\n{'─'*75}")
    print(f"{'NOME':<30} {'TIPO':<14} {'STATUS':<14} {'PRIORIDADE':<8} {'CIDADE'}")
    print(f"{'─'*75}")

    for page in resultados:
        props = page["properties"]

        nome = props.get("NOME FANTASIA", {}).get("title", [{}])
        nome = nome[0].get("plain_text", "—") if nome else "—"

        tipo = (props.get("TIPO", {}).get("select") or {}).get("name", "—")
        status = (props.get("Status", {}).get("status") or {}).get("name", "—")
        prioridade = (props.get("PRIORIDADE", {}).get("status") or {}).get("name", "—")
        cidade = (props.get("CIDADE", {}).get("select") or {}).get("name", "—")

        print(f"{nome[:29]:<30} {tipo:<14} {status:<14} {prioridade:<8} {cidade}")

    print(f"{'─'*75}")
    print(f"Total: {len(resultados)} leads\n")


# ─────────────────────────────────────────────
# MENU PRINCIPAL
# ─────────────────────────────────────────────

def menu_buscar_leads():
    print("\n─── Buscar Novos Leads ───")
    cidade = input("Digite a cidade/região (ex: Teresópolis RJ): ").strip()
    if not cidade:
        print("Cidade não informada.")
        return

    print("\nTipo de estabelecimento:")
    for k, v in TIPOS_BUSCA.items():
        print(f"  {k}. {v['label']}")

    escolha = input("Escolha [1-4]: ").strip()
    if escolha not in TIPOS_BUSCA:
        print("Opção inválida.")
        return

    tipos_para_buscar = (
        [t for t in TIPOS_BUSCA.values() if t["query"]]
        if escolha == "4"
        else [TIPOS_BUSCA[escolha]]
    )

    ids_existentes = buscar_place_ids_existentes()
    total_novos = 0
    total_duplicatas = 0

    for tipo in tipos_para_buscar:
        places = buscar_estabelecimentos(cidade, tipo["query"])
        novos = 0
        duplicatas = 0

        for place in places:
            pid = place.get("place_id", "")
            if pid in ids_existentes:
                duplicatas += 1
                continue

            if cadastrar_lead(place, tipo["label"], cidade):
                ids_existentes.add(pid)
                novos += 1

        print(f"  → {tipo['label']}: {novos} cadastrados, {duplicatas} já existiam.")
        total_novos += novos
        total_duplicatas += duplicatas

    print(f"\n✅ Concluído! {total_novos} leads novos adicionados ao Notion.")
    if total_duplicatas:
        print(f"   {total_duplicatas} duplicatas ignoradas.")


def menu_visualizar():
    print("\n─── Visualizar Base ───")
    print("  1. Todos")
    print("  2. Não iniciada")
    print("  3. Em Andamento")
    print("  4. Concluído")

    opcao = input("Escolha [1-4]: ").strip()
    filtros = {"2": "Não iniciada", "3": "Em Andamento", "4": "Concluído"}
    listar_base(filtro_status=filtros.get(opcao))


def main():
    if not GOOGLE_API_KEY or not NOTION_TOKEN or not NOTION_DATABASE_ID:
        print("❌ Configure o arquivo .env antes de rodar.")
        return

    while True:
        print("\n╔══════════════════════════════╗")
        print("║    CRM Leads — Sorvete       ║")
        print("╠══════════════════════════════╣")
        print("║  1. Buscar novos leads       ║")
        print("║  2. Visualizar base          ║")
        print("║  0. Sair                     ║")
        print("╚══════════════════════════════╝")

        opcao = input("Escolha: ").strip()

        if opcao == "1":
            menu_buscar_leads()
        elif opcao == "2":
            menu_visualizar()
        elif opcao == "0":
            print("Até logo!")
            break
        else:
            print("Opção inválida.")


if __name__ == "__main__":
    main()
