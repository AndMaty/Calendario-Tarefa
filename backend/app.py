from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db
from auth import auth_bp
from tasks import tasks_bp
from tags import tags_bp
from feriados import feriados_bp
from dashboard import dashboard_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    # totalmente isolados e se comunicam apenas via HTTP/JSON.
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_db(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(tags_bp)
    app.register_blueprint(feriados_bp)
    app.register_blueprint(dashboard_bp)

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "calendario-tarefas-api"}), 200
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Rota não encontrada."}), 404
    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Erro interno do servidor."}), 500
    return app
app = create_app()
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=True)
