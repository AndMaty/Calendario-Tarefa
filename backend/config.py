import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    DATABASE_PATH = os.path.join(BASE_DIR, "database.db")
    SCHEMA_PATH = os.path.join(BASE_DIR, "banco.sql")

    JWT_SECRET_KEY = os.environ.get(
        "JWT_SECRET_KEY", "chave-secreta-dev-troque-em-producao-9f8a7d6c"
    )

    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24 * 7  # válido por 7 dias

    # API disponibilizada (Feriados do Brasil)
    HOLIDAYS_API_BASE = "https://date.nager.at/api/v3"
    DEFAULT_COUNTRY_CODE = "BR"

    # Porta padrão do servidor Flask(API's)
    PORT = int(os.environ.get("PORT", 5000))
