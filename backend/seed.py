import secrets
from backend.extensions import db
from backend.models import User, Scale, Firm, Recipe, RecipeItem, Order, Batch, WeighingLog

def seed_database():
    if User.query.first() is not None:
        return

    admin = User(name="Üretim Müdürü", role="admin", password="1234", api_token=secrets.token_hex(32))
    op1 = User(name="Ahmet Usta", role="operator", password="1111", api_token=secrets.token_hex(32))
    op2 = User(name="Mehmet Usta", role="operator", password="2222", api_token=secrets.token_hex(32))
    db.session.add_all([admin, op1, op2])

    scale1 = Scale(name="Hassas Baharat Terazisi (Fiziksel)", ip="10.10.100.254", port=8899, status=True, is_simulator=False)
    scale2 = Scale(name="Hassas Baharat Terazisi (Simülasyon)", ip="127.0.0.1", port=5000, status=True, is_simulator=True)
    db.session.add_all([scale1, scale2])

    f1 = Firm(name="Lezzet Et Dünyası")
    f2 = Firm(name="Tavukçum Gıda")
    f3 = Firm(name="Anadolu Gurme")
    db.session.add_all([f1, f2, f3])
    db.session.commit()

    r1 = Recipe(firm_id=f1.id, name="Özel Kasap Köfte Harcı", base_amount=1.0, price_per_kg=125.0)
    db.session.add(r1)
    db.session.commit()

    ri1 = RecipeItem(recipe_id=r1.id, name="Galeta Unu (Baz)", amount=60.0, tolerance=0.5)
    ri2 = RecipeItem(recipe_id=r1.id, name="Tuz", amount=15.0, tolerance=0.2)
    ri3 = RecipeItem(recipe_id=r1.id, name="Kimyon", amount=10.0, tolerance=0.1)
    ri4 = RecipeItem(recipe_id=r1.id, name="Karabiber", amount=5.0, tolerance=0.05)
    db.session.add_all([ri1, ri2, ri3, ri4])

    r2 = Recipe(firm_id=f2.id, name="Acı Cajun Çeşnisi (Tavuk)", base_amount=1.0, price_per_kg=240.0)
    db.session.add(r2)
    db.session.commit()

    ri5 = RecipeItem(recipe_id=r2.id, name="Paprika", amount=40.0, tolerance=0.2)
    ri6 = RecipeItem(recipe_id=r2.id, name="Sarımsak Tozu", amount=20.0, tolerance=0.1)
    ri7 = RecipeItem(recipe_id=r2.id, name="Acı Pul Biber", amount=10.0, tolerance=0.1)
    db.session.add_all([ri5, ri6, ri7])
    db.session.commit()

    order1 = Order(customer_name="Lezzet Et Dünyası", recipe_name="Özel Kasap Köfte Harcı", total_amount=300.0, bag_weight=20.0)
    db.session.add(order1)
    db.session.commit()

    b1_1 = Batch(id="B_DEMO_1", order_id=order1.id, no=1, total_batches=3, target_amount=100.0, status="tamamlandı", operator="Ahmet Usta")
    b1_2 = Batch(id="B_DEMO_2", order_id=order1.id, no=2, total_batches=3, target_amount=100.0, status="tartımda", operator="Ahmet Usta")
    b1_3 = Batch(id="B_DEMO_3", order_id=order1.id, no=3, total_batches=3, target_amount=100.0, status="beklemede")
    db.session.add_all([b1_1, b1_2, b1_3])
    db.session.commit()

    log1 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Galeta Unu (Baz)", target=60.0, actual=60.1, status="Başarılı")
    log2 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Tuz", target=15.0, actual=15.0, status="Başarılı")
    log3 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Kimyon", target=10.0, actual=10.05, status="Başarılı")
    log4 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Karabiber", target=5.0, actual=4.98, status="Başarılı")
    log5 = WeighingLog(batch_id=b1_2.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Galeta Unu (Baz)", target=60.0, actual=60.0, status="Başarılı")
    db.session.add_all([log1, log2, log3, log4, log5])
    db.session.commit()

    order2 = Order(customer_name="Tavukçum Gıda", recipe_name="Acı Cajun Çeşnisi (Tavuk)", total_amount=200.0, bag_weight=25.0)
    db.session.add(order2)
    db.session.commit()

    b2_1 = Batch(id="B_DEMO_4", order_id=order2.id, no=1, total_batches=2, target_amount=100.0, status="beklemede")
    b2_2 = Batch(id="B_DEMO_5", order_id=order2.id, no=2, total_batches=2, target_amount=100.0, status="beklemede")
    db.session.add_all([b2_1, b2_2])
    db.session.commit()
