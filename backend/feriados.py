import requests
from flask import Blueprint, request, jsonify
from auth import token_required
from config import Config

feriados_bp = Blueprint("feriados", __name__, url_prefix="/api/feriados")
_cache = {}

@feriados_bp.route("", methods=["GET"])
@token_required
def list_feriados():
    year = request.args.get("year", type=int)
    country = (request.args.get("country") or Config.DEFAULT_COUNTRY_CODE).upper()

    if not year:
        return jsonify({"error": "Informe o parâmetro 'year'."}), 400
    cache_key = f"{year}-{country}"
    if cache_key in _cache:
        return jsonify(_cache[cache_key]), 200
    url = f"{Config.HOLIDAYS_API_BASE}/PublicHolidays/{year}/{country}"
    try:
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()
        raw = resp.json()
    except requests.RequestException:
        return jsonify([]), 200
    feriados = [
        {
            "date": h.get("date"),
            "name": h.get("localName") or h.get("name"),
            "name_en": h.get("name"),
        }
        for h in raw
    ]
    _cache[cache_key] = feriados
    return jsonify(feriados), 200