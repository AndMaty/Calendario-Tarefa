import re
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from database import query_one, execute

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def generate_token(user_id, username):
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token de autenticação ausente."}), 401
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token, Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM]
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Sessão expirada. Faça login novamente."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido."}), 401
        g.user_id = payload["user_id"]
        g.username = payload["username"]
        return f(*args, **kwargs)

    return decorated

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"error": "Preencha usuário, e-mail e senha."}), 400
    if not EMAIL_REGEX.match(email):
        return jsonify({"error": "E-mail inválido."}), 400
    if len(password) < 6:
        return jsonify({"error": "A senha deve ter pelo menos 6 caracteres."}), 400
    if query_one("SELECT id FROM users WHERE username = ?", (username,)):
        return jsonify({"error": "Este nome de usuário já está em uso."}), 409
    if query_one("SELECT id FROM users WHERE email = ?", (email,)):
        return jsonify({"error": "Este e-mail já está cadastrado."}), 409
    password_hash = generate_password_hash(password)
    user_id = execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, password_hash),
    )
    token = generate_token(user_id, username)
    return jsonify({
        "token": token,
        "user": {"id": user_id, "username": username, "email": email},
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username") or data.get("email") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Informe usuário/e-mail e senha."}), 400
    user = query_one(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        (identifier, identifier.lower()),
    )
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Usuário ou senha incorretos."}), 401
    token = generate_token(user["id"], user["username"])
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
    }), 200

@auth_bp.route("/me", methods=["GET"])
@token_required
def me():
    user = query_one(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        (g.user_id,),
    )
    if not user:
        return jsonify({"error": "Usuário não encontrado."}), 404
    return jsonify(user), 200