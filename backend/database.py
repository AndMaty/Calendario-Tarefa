import sqlite3
from flask import g
from config import Config

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(Config.DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()
def init_db(app):
    with app.app_context():
        conn = sqlite3.connect(Config.DATABASE_PATH)
        with open(Config.SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()
    app.teardown_appcontext(close_db)
def query_all(query, args=()):
    db = get_db()
    rows = db.execute(query, args).fetchall()
    return [dict(row) for row in rows]
def query_one(query, args=()):
    db = get_db()
    row = db.execute(query, args).fetchone()
    return dict(row) if row else None
def execute(query, args=()):
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    return cur.lastrowid