from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from auth import token_required
from database import query_all, query_one, execute, get_db

tasks_bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")

VALID_STATUSES = {"todo", "doing", "done"}

def _date_range_for_view(view, ref_date_str):
    try:
        ref = datetime.strptime(ref_date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        ref = datetime.now().date()
    if view == "day":
        return ref.isoformat(), ref.isoformat()
    if view == "week":
        start = ref - timedelta(days=ref.weekday())
        end = start + timedelta(days=6)
        return start.isoformat(), end.isoformat()
    if view == "month":
        start = ref.replace(day=1)
        if start.month == 12:
            next_month = start.replace(year=start.year + 1, month=1)
        else:
            next_month = start.replace(month=start.month + 1)
        end = next_month - timedelta(days=1)
        return start.isoformat(), end.isoformat()
    return None, None  # "all" ou visão não reconhecida

def _attach_tags(tasks):
    if not tasks:
        return tasks
    ids = [t["id"] for t in tasks]
    placeholders = ",".join("?" * len(ids))
    rows = query_all(
        f"""
        SELECT tt.task_id, tg.id, tg.name, tg.color
        FROM task_tags tt
        JOIN tags tg ON tg.id = tt.tag_id
        WHERE tt.task_id IN ({placeholders})
        """,
        ids,
    )
    by_task = {}
    for r in rows:
        by_task.setdefault(r["task_id"], []).append(
            {"id": r["id"], "name": r["name"], "color": r["color"]}
        )
    for t in tasks:
        t["tags"] = by_task.get(t["id"], [])
    return tasks

def _set_task_tags(task_id, tag_ids):
    db = get_db()
    db.execute("DELETE FROM task_tags WHERE task_id = ?", (task_id,))
    for tag_id in set(tag_ids or []):
        owned = db.execute(
            "SELECT id FROM tags WHERE id = ? AND user_id = ?", (tag_id, g.user_id)
        ).fetchone()
        if owned:
            db.execute(
                "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
                (task_id, tag_id),
            )
    db.commit()

def _serialize_input(data):
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    task_date = (data.get("task_date") or "").strip()
    task_time = (data.get("task_time") or "").strip()
    duration_minutes = data.get("duration_minutes", 30)
    status = (data.get("status") or "todo").strip()
    tag_ids = data.get("tags") or []

    errors = []
    if not title:
        errors.append("O título é obrigatório.")
    try:
        datetime.strptime(task_date, "%Y-%m-%d")
    except ValueError:
        errors.append("Data inválida (use o formato AAAA-MM-DD).")
    try:
        datetime.strptime(task_time, "%H:%M")
    except ValueError:
        errors.append("Hora inválida (use o formato HH:MM).")
    try:
        duration_minutes = int(duration_minutes)
        if duration_minutes <= 0:
            raise ValueError
    except (ValueError, TypeError):
        errors.append("A duração deve ser um número de minutos maior que zero.")
    if status not in VALID_STATUSES:
        errors.append("Status inválido.")
    return {
        "title": title,
        "description": description,
        "task_date": task_date,
        "task_time": task_time,
        "duration_minutes": duration_minutes,
        "status": status,
        "tag_ids": tag_ids,
        "errors": errors
    }, errors

@tasks_bp.route("", methods=["GET"])
@token_required
def list_tasks():
    view = request.args.get("view", "all")
    ref_date = request.args.get("date") or datetime.now().date().isoformat()
    search = (request.args.get("q") or "").strip()
    tags_param = (request.args.get("tags") or "").strip()
    status_filter = (request.args.get("status") or "").strip()

    start, end = _date_range_for_view(view, ref_date)

    query = "SELECT DISTINCT t.* FROM tasks t"
    conditions = ["t.user_id = ?"]
    params = [g.user_id]

    if tags_param:
        tag_ids = [int(x) for x in tags_param.split(",") if x.strip().isdigit()]
        if tag_ids:
            query += " JOIN task_tags tt ON tt.task_id = t.id"
            placeholders = ",".join("?" * len(tag_ids))
            conditions.append(f"tt.tag_id IN ({placeholders})")
            params.extend(tag_ids)
    if start and end:
        conditions.append("t.task_date BETWEEN ? AND ?")
        params.extend([start, end])
    if search:
        conditions.append("t.title LIKE ?")
        params.append(f"%{search}%")
    if status_filter in VALID_STATUSES:
        conditions.append("t.status = ?")
        params.append(status_filter)
    query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY t.task_date ASC, t.task_time ASC"
    tasks = query_all(query, params)
    tasks = _attach_tags(tasks)
    return jsonify(tasks), 200

@tasks_bp.route("/<int:task_id>", methods=["GET"])
@token_required
def get_task(task_id):
    task = query_one("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, g.user_id))
    if not task:
        return jsonify({"error": "Tarefa não encontrada."}), 404
    task = _attach_tags([task])[0]
    return jsonify(task), 200

@tasks_bp.route("", methods=["POST"])
@token_required
def create_task():
    data = request.get_json(silent=True) or {}
    clean, errors = _serialize_input(data)
    if errors:
        return jsonify({"error": " ".join(errors)}), 400
    task_id = execute(
        """
        INSERT INTO tasks (user_id, title, description, task_date, task_time,
                           duration_minutes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            g.user_id, clean["title"], clean["description"], clean["task_date"],
            clean["task_time"], clean["duration_minutes"], clean["status"],
        ),
    )
    _set_task_tags(task_id, clean["tag_ids"])
    task = _attach_tags([query_one("SELECT * FROM tasks WHERE id = ?", (task_id,))])[0]
    return jsonify(task), 201


@tasks_bp.route("/<int:task_id>", methods=["PUT"])
@token_required
def update_task(task_id):
    existing = query_one("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, g.user_id))
    if not existing:
        return jsonify({"error": "Tarefa não encontrada."}), 404
    data = request.get_json(silent=True) or {}
    clean, errors = _serialize_input(data)
    if errors:
        return jsonify({"error": " ".join(errors)}), 400
    execute(
        """
        UPDATE tasks
        SET title = ?, description = ?, task_date = ?, task_time = ?,
            duration_minutes = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (
            clean["title"], clean["description"], clean["task_date"], clean["task_time"],
            clean["duration_minutes"], clean["status"], task_id,
        ),
    )
    _set_task_tags(task_id, clean["tag_ids"])
    task = _attach_tags([query_one("SELECT * FROM tasks WHERE id = ?", (task_id,))])[0]
    return jsonify(task), 200


@tasks_bp.route("/<int:task_id>/status", methods=["PATCH"])
@token_required
def update_status(task_id):
    """Endpoint leve usado pelo Kanban ao arrastar um cartão entre colunas."""
    existing = query_one("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, g.user_id))
    if not existing:
        return jsonify({"error": "Tarefa não encontrada."}), 404
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip()
    if status not in VALID_STATUSES:
        return jsonify({"error": "Status inválido."}), 400
    execute(
        "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (status, task_id),
    )
    task = _attach_tags([query_one("SELECT * FROM tasks WHERE id = ?", (task_id,))])[0]
    return jsonify(task), 200

@tasks_bp.route("/<int:task_id>", methods=["DELETE"])
@token_required
def delete_task(task_id):
    existing = query_one("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, g.user_id))
    if not existing:
        return jsonify({"error": "Tarefa não encontrada."}), 404
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return jsonify({"message": "Tarefa removida com sucesso."}), 200