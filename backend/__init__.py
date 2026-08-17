import os
from flask import Flask, render_template
from backend.extensions import db
from backend.services.websocket_notifier import notify_websocket

def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.secret_key = 'baharat-secret-key-12345'
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.jinja_env.auto_reload = True
    
    db_path = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    from backend.routes.auth import auth_bp
    from backend.routes.admin import admin_bp
    from backend.routes.operator import operator_bp
    from backend.routes.system import system_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(operator_bp, url_prefix='/api')
    app.register_blueprint(system_bp, url_prefix='/api/system')

    @app.after_request
    def add_header(response):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        return response

    @app.route('/')
    def index():
        from flask import make_response
        response = make_response(render_template('index.html'))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response

    from sqlalchemy import event
    @event.listens_for(db.session, 'after_commit')
    def receive_after_commit(session):
        notify_websocket({"type": "db_updated"})

    with app.app_context():
        # NOT: Buradaki eski "DROP TABLE IF EXISTS scale" satiri kaldirildi; her
        # uygulama basladiginda kaydedilmis tum terazi ayarlarini siliyordu.
        # Sema degisiklikleri artik ./make_migrate ile uygulanir.
        db.create_all()
        try:
            db.session.execute(db.text("ALTER TABLE user ADD COLUMN can_view_sales BOOLEAN DEFAULT 1"))
            db.session.commit()
        except Exception:
            db.session.rollback()
        
        try:
            db.session.execute(db.text("ALTER TABLE recipe ADD COLUMN price_per_kg FLOAT DEFAULT 150.0"))
            db.session.commit()
        except Exception:
            db.session.rollback()


        try:
            db.session.execute(db.text("ALTER TABLE user ADD COLUMN api_token VARCHAR(100)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        for col_stmt in [
            "ALTER TABLE firm ADD COLUMN phone VARCHAR(50)",
            "ALTER TABLE firm ADD COLUMN email VARCHAR(100)",
            "ALTER TABLE firm ADD COLUMN address TEXT",
            "ALTER TABLE firm ADD COLUMN tax_id VARCHAR(50)",
            "ALTER TABLE firm ADD COLUMN contact_person VARCHAR(100)",
            "ALTER TABLE firm ADD COLUMN notes TEXT",
            "ALTER TABLE batch ADD COLUMN bag_weight FLOAT",
            "ALTER TABLE `order` ADD COLUMN packaging_segments TEXT",
            "ALTER TABLE recipe ADD COLUMN is_active BOOLEAN DEFAULT 1"
        ]:
            try:
                db.session.execute(db.text(col_stmt))
                db.session.commit()
            except Exception:
                db.session.rollback()

        try:
            db.session.execute(db.text("UPDATE recipe SET is_active = 1 WHERE is_active IS NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(db.text(
                "UPDATE batch SET bag_weight = (SELECT bag_weight FROM `order` WHERE `order`.id = batch.order_id) WHERE bag_weight IS NULL"
            ))
            db.session.commit()
        except Exception:
            db.session.rollback()
            
        from backend.seed import seed_database
        seed_database()

    return app
