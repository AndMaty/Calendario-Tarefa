from flask import Blueprint, request, jsonify, g

from auth import token_required
from database import query_all, query_one, execute, get_db

tags_bp = Blueprint("tags", __name__, url_prefix="/api/tags")

@tags_bp.route("", methods=["GET"])
@token_required
def list_tags():
    tags = query_all(
        """
        SELECT t.id, t.name, t.color,
               COUNT(tt.task_id) AS task_count
        FROM tags t
        LEFT JOIN task_tags tt ON tt.tag_id = t.id
        WHERE t.user_id = ?
        GROUP BY t.id
        ORDER BY t.name COLLATE NOCASE
        """,
        (g.user_id,),
    )
    return jsonify(tags), 200

@tags_bp.route("", methods=["POST"])
@token_required
def create_tag():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    color = (data.get("color") or "#2F6F63").strip()
    if not name:
        return jsonify({"error": "O nome da tag é obrigatório."}), 400
    if query_one("SELECT id FROM tags WHERE user_id = ? AND name = ?", (g.user_id, name)):
        return jsonify({"error": "Você já possui uma tag com esse nome."}), 409
    tag_id = execute(
        "INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)",
        (g.user_id, name, color),
    )
    return jsonify({"id": tag_id, "name": name, "color": color, "task_count": 0}), 201

@tags_bp.route("/<int:tag_id>", methods=["PUT"])
@token_required
def update_tag(tag_id):
    tag = query_one("SELECT * FROM tags WHERE id = ? AND user_id = ?", (tag_id, g.user_id))
    if not tag:
        return jsonify({"error": "Tag não encontrada."}), 404
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or tag["name"]).strip()
    color = (data.get("color") or tag["color"]).strip()

    execute("UPDATE tags SET name = ?, color = ? WHERE id = ?", (name, color, tag_id))
    return jsonify({"id": tag_id, "name": name, "color": color}), 200

@tags_bp.route("/<int:tag_id>", methods=["DELETE"])
@token_required
def delete_tag(tag_id):
    tag = query_one("SELECT * FROM tags WHERE id = ? AND user_id = ?", (tag_id, g.user_id))
    if not tag:
        return jsonify({"error": "Tag não encontrada."}), 404
    db = get_db()
    db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    db.commit()
    return jsonify({"message": "Tag removida com sucesso."}), 200