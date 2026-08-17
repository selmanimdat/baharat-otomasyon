import secrets
from backend.extensions import db
from backend.models import User, Scale, Firm, Recipe, RecipeItem, Order, Batch, WeighingLog

def seed_database():
    if User.query.first() is not None:
        return

    admin = User(name="Üretim Müdürü", role="admin", password="1234", api_token=secrets.token_hex(32))

    db.session.add_all([admin])

