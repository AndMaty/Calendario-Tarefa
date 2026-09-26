from datetime import datetime, timedelta
from flask import Blueprint, jsonify, g
from auth import token_required
from database import query_all, query_one

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("/stats", methods=["GET"])
@token_required
def stats():
    by_status_rows = query_all(
        "SELECT status, COUNT(*) AS total FROM tasks WHERE user_id = ? GROUP BY status",
        (g.user_id,),
    )
    by_status = {"todo": 0, "doing": 0, "done": 0}
    for row in by_status_rows:
        by_status[row["status"]] = row["total"]
    since = (datetime.now().date() - timedelta(days=29)).isoformat()
    completed_rows = query_all(
        """
        SELECT task_date AS date, COUNT(*) AS total
        FROM tasks
        WHERE user_id = ? AND status = 'done' AND task_date >= ?
        GROUP BY task_date
        ORDER BY task_date ASC
        """,
        (g.user_id, since),
    )
    completed_map = {r["date"]: r["total"] for r in completed_rows}
    completed_series = []
    for i in range(30):
        day = (datetime.now().date() - timedelta(days=29 - i)).isoformat()
        completed_series.append({"date": day, "total": completed_map.get(day, 0)})
    top_tags = query_all(
        """
        SELECT tg.name, tg.color, COUNT(*) AS total
        FROM task_tags tt
        JOIN tags tg ON tg.id = tt.tag_id
        JOIN tasks t ON t.id = tt.task_id
        WHERE t.user_id = ? AND t.status = 'done'
        GROUP BY tg.id
        ORDER BY total DESC
        LIMIT 8
        """,
        (g.user_id,),
    )
    total_tasks = sum(by_status.values())
    completion_rate = round((by_status["done"] / total_tasks) * 100, 1) if total_tasks else 0
    return jsonify({
        "by_status": by_status,
        "total_tasks": total_tasks,
        "completion_rate": completion_rate,
        "completed_last_30_days": completed_series,
        "top_tags": top_tags,
    }), 200