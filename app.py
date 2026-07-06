import os
from datetime import datetime, timezone
from flask import Flask, request, jsonify, session, render_template, send_file
from flask_sqlalchemy import SQLAlchemy
import json
import socket
import threading
import re

app = Flask(__name__)
app.secret_key = 'baharat-secret-key-12345'  # Simple secret key for session auth

# Configure SQLite Database
db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

def notify_websocket(msg_dict):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(json.dumps(msg_dict).encode('utf-8'), ("127.0.0.1", 5002))
    except Exception as e:
        print("Failed to send WebSocket notification:", e)

from sqlalchemy import event

@event.listens_for(db.session, 'after_commit')
def receive_after_commit(session):
    notify_websocket({"type": "db_updated"})

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    return response

# --- DATABASE MODELS ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'admin', 'manager', 'secretary', 'operator'
    password = db.Column(db.String(100), nullable=False)
    
    can_manage_recipes = db.Column(db.Boolean, default=True)
    can_manage_customers = db.Column(db.Boolean, default=True)
    can_manage_orders = db.Column(db.Boolean, default=True)
    can_manage_users = db.Column(db.Boolean, default=True)
    can_manage_scales = db.Column(db.Boolean, default=True)
    can_view_reports = db.Column(db.Boolean, default=True)
    can_view_sales = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'pass': self.password,
            'canManageRecipes': self.can_manage_recipes,
            'canManageCustomers': self.can_manage_customers,
            'canManageOrders': self.can_manage_orders,
            'canManageUsers': self.can_manage_users,
            'canManageScales': self.can_manage_scales,
            'canViewReports': self.can_view_reports,
            'canViewSales': self.can_view_sales
        }

class Scale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ip = db.Column(db.String(50), nullable=False)
    port = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Boolean, default=True)
    is_simulator = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ip': self.ip,
            'port': self.port,
            'status': self.status,
            'is_simulator': self.is_simulator
        }

class Firm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    firm_id = db.Column(db.Integer, db.ForeignKey('firm.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    base_amount = db.Column(db.Float, default=1.0)
    price_per_kg = db.Column(db.Float, default=150.0)
    
    firm = db.relationship('Firm', backref=db.backref('recipes', cascade='all, delete-orphan', passive_deletes=True))
    items = db.relationship('RecipeItem', backref='recipe', cascade='all, delete-orphan', order_by='RecipeItem.id')

    def to_dict(self):
        return {
            'id': self.id,
            'firmId': self.firm_id,
            'name': self.name,
            'baseAmount': self.base_amount,
            'pricePerKg': self.price_per_kg,
            'items': [item.to_dict() for item in self.items]
        }

class RecipeItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    tolerance = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'amount': self.amount,
            'tolerance': self.tolerance
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(200), nullable=False)
    recipe_name = db.Column(db.String(200), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    bag_weight = db.Column(db.Float, nullable=True, default=20.0)
    
    batches = db.relationship('Batch', backref='order', cascade='all, delete-orphan')

    def to_dict(self):
        # We need to include recipeItems (which can be derived from active batch metadata or current schema, but original react app copies them)
        # For compatibility, we can fetch recipe details or just copy what was ordered
        # We'll retrieve recipe items from the DB structure dynamically or store them.
        # Let's see: we can look up the recipe name under customer_name or get them
        # Let's save a list of ingredients ordered, or fetch items of the recipe with recipe_name of customer
        # To be simple and robust, let's find the matching recipe and return its items
        recipe_query = Recipe.query.filter_by(name=self.recipe_name).first()
        items_dict = [i.to_dict() for i in recipe_query.items] if recipe_query else []
        
        return {
            'id': self.id,
            'customer': self.customer_name,
            'recipeName': self.recipe_name,
            'recipeItems': items_dict,
            'totalAmount': self.total_amount,
            'bagWeight': self.bag_weight or 20.0,
            'batches': [b.to_dict() for b in self.batches]
        }

class Batch(db.Model):
    id = db.Column(db.String(100), primary_key=True)  # B<timestamp>-<no>
    order_id = db.Column(db.Integer, db.ForeignKey('order.id', ondelete='CASCADE'), nullable=False)
    no = db.Column(db.Integer, nullable=False)
    total_batches = db.Column(db.Integer, nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='beklemede')  # beklemede, tartımda, mikserde, paketlemede, fiş kesilmedi, tamamlandı
    operator = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'no': self.no,
            'totalBatches': self.total_batches,
            'targetAmount': self.target_amount,
            'status': self.status,
            'operator': self.operator,
            'orderId': self.order_id,
            'bagWeight': self.order.bag_weight if self.order else 20.0
        }

class WeighingLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(100), nullable=False)
    operator = db.Column(db.String(100), nullable=False)
    customer = db.Column(db.String(200), nullable=False)
    recipe = db.Column(db.String(200), nullable=False)
    item = db.Column(db.String(200), nullable=False)
    target = db.Column(db.Float, nullable=False)
    actual = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), nullable=False)  # Başarılı, Hatalı
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        # Apply local timezone formatting or isoformat
        return {
            'batchId': self.batch_id,
            'operator': self.operator,
            'customer': self.customer,
            'recipe': self.recipe,
            'item': self.item,
            'target': self.target,
            'actual': self.actual,
            'status': self.status,
            'timestamp': self.timestamp.isoformat() if self.timestamp else ''
        }

# --- DATABASE SEEDING ---

def seed_database():
    # Only seed if users table is empty
    if User.query.first() is not None:
        return

    # 1. Add Users
    admin = User(name="Üretim Müdürü", role="admin", password="1234")
    op1 = User(name="Ahmet Usta", role="operator", password="1111")
    op2 = User(name="Mehmet Usta", role="operator", password="2222")
    db.session.add_all([admin, op1, op2])

    # 2. Add Scales
    scale1 = Scale(name="Hassas Baharat Terazisi (Fiziksel)", ip="10.10.100.254", port=8899, status=True, is_simulator=False)
    scale2 = Scale(name="Hassas Baharat Terazisi (Simülasyon)", ip="127.0.0.1", port=5000, status=True, is_simulator=True)
    db.session.add_all([scale1, scale2])

    # 3. Add Firms
    f1 = Firm(name="Lezzet Et Dünyası")
    f2 = Firm(name="Tavukçum Gıda")
    f3 = Firm(name="Anadolu Gurme")
    db.session.add_all([f1, f2, f3])
    db.session.commit()  # commit to get firm IDs

    # 4. Add Recipes & Items
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

    # 5. Add Stream Demo Orders & Batches
    # Order 1: Özel Kasap Köfte Harcı for Lezzet Et Dünyası (300 kg total, 3 batches)
    order1 = Order(customer_name="Lezzet Et Dünyası", recipe_name="Özel Kasap Köfte Harcı", total_amount=300.0, bag_weight=20.0)
    db.session.add(order1)
    db.session.commit()

    # Batch 1: Completed
    b1_1 = Batch(id="B_DEMO_1", order_id=order1.id, no=1, total_batches=3, target_amount=100.0, status="tamamlandı", operator="Ahmet Usta")
    # Batch 2: In progress
    b1_2 = Batch(id="B_DEMO_2", order_id=order1.id, no=2, total_batches=3, target_amount=100.0, status="tartımda", operator="Ahmet Usta")
    # Batch 3: Pending
    b1_3 = Batch(id="B_DEMO_3", order_id=order1.id, no=3, total_batches=3, target_amount=100.0, status="beklemede")
    db.session.add_all([b1_1, b1_2, b1_3])
    db.session.commit()

    # Logs for Completed Batch 1
    log1 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Galeta Unu (Baz)", target=60.0, actual=60.1, status="Başarılı")
    log2 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Tuz", target=15.0, actual=15.0, status="Başarılı")
    log3 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Kimyon", target=10.0, actual=10.05, status="Başarılı")
    log4 = WeighingLog(batch_id=b1_1.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Karabiber", target=5.0, actual=4.98, status="Başarılı")

    # Logs for In-Progress Batch 2 (Ahmet has approved Galeta Unu (Baz))
    log5 = WeighingLog(batch_id=b1_2.id, operator="Ahmet Usta", customer="Lezzet Et Dünyası", recipe="Özel Kasap Köfte Harcı", item="Galeta Unu (Baz)", target=60.0, actual=60.0, status="Başarılı")
    
    db.session.add_all([log1, log2, log3, log4, log5])
    db.session.commit()

    # Order 2: Acı Cajun Çeşnisi (Tavuk) for Tavukçum Gıda (200 kg total, 2 batches)
    order2 = Order(customer_name="Tavukçum Gıda", recipe_name="Acı Cajun Çeşnisi (Tavuk)", total_amount=200.0, bag_weight=25.0)
    db.session.add(order2)
    db.session.commit()

    b2_1 = Batch(id="B_DEMO_4", order_id=order2.id, no=1, total_batches=2, target_amount=100.0, status="beklemede")
    b2_2 = Batch(id="B_DEMO_5", order_id=order2.id, no=2, total_batches=2, target_amount=100.0, status="beklemede")
    db.session.add_all([b2_1, b2_2])
    db.session.commit()

# --- ROUTES ---

@app.route('/')
def index():
    from flask import make_response
    response = make_response(render_template('index.html'))
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# --- AUTH ENDPOINTS ---

from functools import wraps

def require_permission(permission_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': 'Kullanıcı bulunamadı!'}), 401
            if user.role == 'admin':
                return f(*args, **kwargs)
            if not getattr(user, permission_name, False):
                return jsonify({'success': False, 'message': 'Bu işlem için yetkiniz yok!'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'success': False, 'message': 'Bu işlem sadece birincil yönetici tarafından yapılabilir!'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({'authenticated': True, 'user': user.to_dict()})
    return jsonify({'authenticated': False})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', '')

    if role == 'admin':
        # Manager login: find user by name and check if they have admin, manager, or secretary role
        user = User.query.filter(User.name == username, User.role.in_(['admin', 'manager', 'secretary'])).first()
    else:
        # Operator login: input name and check password
        user = User.query.filter(User.name.collate('NOCASE') == username, User.role == 'operator').first()

    if user and user.password == password:
        session['user_id'] = user.id
        return jsonify({'success': True, 'user': user.to_dict()})
    
    return jsonify({'success': False, 'message': 'Hatalı Kullanıcı Adı veya Şifre!'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.pop('user_id', None)
    return jsonify({'success': True})

# --- DATA ENDPOINTS ---

@app.route('/api/db', methods=['GET'])
def get_entire_db():
    users = User.query.all()
    scales = Scale.query.all()
    firms = Firm.query.all()
    recipes = Recipe.query.all()
    orders = Order.query.all()
    logs = WeighingLog.query.order_by(WeighingLog.timestamp.desc()).all()

    return jsonify({
        'users': [u.to_dict() for u in users],
        'scales': [s.to_dict() for s in scales],
        'firms': [f.to_dict() for f in firms],
        'recipes': [r.to_dict() for r in recipes],
        'orders': [o.to_dict() for o in orders],
        'logs': [l.to_dict() for l in logs]
    })

# --- USER MANAGEMENT ---

@app.route('/api/users', methods=['POST'])
def add_user():
    current_user_id = session.get('user_id')
    if not current_user_id:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
    current_user = User.query.get(current_user_id)
    if not current_user or (current_user.role != 'admin' and not current_user.can_manage_users):
        return jsonify({'success': False, 'message': 'Personel ekleme yetkiniz yok!'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'operator').strip()
    
    if not name or not password:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    if role not in ['manager', 'secretary', 'operator']:
        return jsonify({'success': False, 'message': 'Geçersiz rol seçimi!'}), 400

    # Prevent a manager from creating another manager
    if current_user.role == 'manager' and role == 'manager':
        return jsonify({'success': False, 'message': 'Yöneticiler başka bir yönetici oluşturamaz!'}), 403

    if User.query.filter_by(name=name).first():
        return jsonify({'success': False, 'message': 'Bu isimde bir personel zaten var!'}), 400
        
    # Set default permission flags based on role
    if role == 'manager':
        can_recipes = True
        can_customers = True
        can_orders = True
        can_users = True
        can_scales = True
        can_reports = True
        can_sales = True
    elif role == 'secretary':
        can_recipes = False
        can_customers = False
        can_orders = False
        can_users = False
        can_scales = False
        can_reports = True
        can_sales = False
    else: # operator
        can_recipes = False
        can_customers = False
        can_orders = False
        can_users = False
        can_scales = False
        can_reports = False
        can_sales = False

    new_user = User(
        name=name, 
        role=role, 
        password=password,
        can_manage_recipes=can_recipes,
        can_manage_customers=can_customers,
        can_manage_orders=can_orders,
        can_manage_users=can_users,
        can_manage_scales=can_scales,
        can_view_reports=can_reports,
        can_view_sales=can_sales
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'success': True, 'user': new_user.to_dict()})

@app.route('/api/users/<int:user_id>/permissions', methods=['PUT'])
def update_user_permissions(user_id):
    current_user_id = session.get('user_id')
    if not current_user_id:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
    current_user = User.query.get(current_user_id)
    if not current_user or (current_user.role != 'admin' and not current_user.can_manage_users):
        return jsonify({'success': False, 'message': 'Yetki düzenleme yetkiniz yok!'}), 403
        
    target_user = User.query.get_or_404(user_id)
    if target_user.role == 'admin':
        return jsonify({'success': False, 'message': 'Birincil yönetici yetkileri değiştirilemez!'}), 400
        
    # Managers cannot modify admin or other managers
    if current_user.role == 'manager' and target_user.role in ['admin', 'manager']:
        return jsonify({'success': False, 'message': 'Yöneticiler diğer yöneticilerin yetkilerini değiştiremez!'}), 403

    data = request.json or {}
    
    # Optional role update (prevent upgrading to admin)
    new_role = data.get('role')
    if new_role:
        if new_role == 'admin':
            return jsonify({'success': False, 'message': 'Birincil yönetici rolü atanamaz!'}), 400
        if current_user.role == 'manager' and new_role == 'manager':
            return jsonify({'success': False, 'message': 'Yöneticiler rol atamasını yönetici olarak değiştiremez!'}), 403
        target_user.role = new_role
        
    # Update permission flags
    if 'canManageRecipes' in data:
        target_user.can_manage_recipes = bool(data['canManageRecipes'])
    if 'canManageCustomers' in data:
        target_user.can_manage_customers = bool(data['canManageCustomers'])
    if 'canManageOrders' in data:
        target_user.can_manage_orders = bool(data['canManageOrders'])
    if 'canManageUsers' in data:
        target_user.can_manage_users = bool(data['canManageUsers'])
    if 'canManageScales' in data:
        target_user.can_manage_scales = bool(data['canManageScales'])
    if 'canViewReports' in data:
        target_user.can_view_reports = bool(data['canViewReports'])
    if 'canViewSales' in data:
        target_user.can_view_sales = bool(data['canViewSales'])
        
    db.session.commit()
    return jsonify({'success': True, 'user': target_user.to_dict()})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    current_user_id = session.get('user_id')
    if not current_user_id:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
    current_user = User.query.get(current_user_id)
    if not current_user or (current_user.role != 'admin' and not current_user.can_manage_users):
        return jsonify({'success': False, 'message': 'Personel silme yetkiniz yok!'}), 403
        
    user = User.query.get_or_404(user_id)
    if user.role == 'admin':
        return jsonify({'success': False, 'message': 'Birincil yönetici hesabı silinemez!'}), 400
        
    if current_user.role == 'manager' and user.role in ['admin', 'manager']:
        return jsonify({'success': False, 'message': 'Yöneticiler diğer yöneticileri veya birincil yöneticiyi silemez!'}), 403
        
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})

class ScaleConnectionManager:
    def __init__(self):
        self.connections = {}  # scale_id -> { "socket": socket, "thread": thread, "last_weight": float, "active": bool, "is_simulator": bool }
        self.lock = threading.Lock()

    def connect_scale(self, scale_id, ip, port, is_simulator=False):
        with self.lock:
            self.disconnect_scale_unlocked(scale_id)

            if is_simulator:
                self.connections[scale_id] = {
                    "socket": None,
                    "thread": None,
                    "last_weight": 0.0,
                    "active": True,
                    "is_simulator": True
                }
                return True

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.0)
                sock.connect((ip, int(port)))
                sock.settimeout(None)
                
                state = {
                    "socket": sock,
                    "active": True,
                    "last_weight": 0.0,
                    "is_simulator": False
                }
                
                thread = threading.Thread(
                    target=self._read_loop, 
                    args=(scale_id, state), 
                    daemon=True
                )
                state["thread"] = thread
                self.connections[scale_id] = state
                thread.start()
                return True
            except Exception as e:
                print(f"Failed to connect to scale {scale_id} ({ip}:{port}): {e}")
                return False

    def disconnect_scale(self, scale_id):
        with self.lock:
            self.disconnect_scale_unlocked(scale_id)

    def disconnect_scale_unlocked(self, scale_id):
        if scale_id in self.connections:
            state = self.connections[scale_id]
            state["active"] = False
            if state["socket"]:
                try:
                    state["socket"].close()
                except Exception:
                    pass
            del self.connections[scale_id]

    def _read_loop(self, scale_id, state):
        sock = state["socket"]
        buffer = ""
        while state["active"]:
            try:
                data = sock.recv(1024)
                if not data:
                    break
                buffer += data.decode('ascii', errors='ignore')
                
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    match = re.search(r'([+\-]?\s*\d+\.?\d*)\s*(?:k?g|gr?)', line, re.IGNORECASE)
                    if match:
                        weight_str = match.group(1).replace(" ", "")
                        try:
                            val = float(weight_str)
                            state["last_weight"] = val
                            notify_websocket({
                                "type": "weight_update",
                                "scale_id": scale_id,
                                "weight": val
                            })
                        except ValueError:
                            pass
            except Exception:
                break
        state["active"] = False
        if sock:
            try:
                sock.close()
            except Exception:
                pass

    def get_weight(self, scale_id):
        with self.lock:
            if scale_id in self.connections:
                return self.connections[scale_id]["last_weight"], self.connections[scale_id]["active"]
            return 0.0, False

    def set_simulated_weight(self, scale_id, weight):
        with self.lock:
            if scale_id in self.connections and self.connections[scale_id].get("is_simulator"):
                val = float(weight)
                self.connections[scale_id]["last_weight"] = val
                notify_websocket({
                    "type": "weight_update",
                    "scale_id": scale_id,
                    "weight": val
                })
                return True
            return False

scale_manager = ScaleConnectionManager()

# --- SCALE MANAGEMENT ---

@app.route('/api/scales', methods=['POST'])
@require_permission('can_manage_scales')
def add_scale():
    data = request.json or {}
    name = data.get('name', '').strip()
    ip = data.get('ip', '').strip()
    port = data.get('port')
    is_simulator = data.get('is_simulator', False)
    
    if not name or not ip or not port:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    new_scale = Scale(name=name, ip=ip, port=int(port), status=True, is_simulator=bool(is_simulator))
    db.session.add(new_scale)
    db.session.commit()
    return jsonify({'success': True, 'scale': new_scale.to_dict()})

@app.route('/api/scales/test-connection', methods=['POST'])
def test_scale_connection():
    data = request.json or {}
    ip = data.get('ip', '').strip()
    port = data.get('port')
    is_simulator = data.get('is_simulator', False)
    
    if is_simulator:
        return jsonify({'success': True, 'message': 'Simülasyon Modu Aktif (Bağlantı başarılı kabul edildi)'})
    
    if not ip or not port:
        return jsonify({'success': False, 'message': 'IP ve port belirtilmelidir!'}), 400
        
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        sock.connect((ip, int(port)))
        sock.close()
        return jsonify({'success': True, 'message': 'Bağlantı Başarılı!'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Bağlantı başarısız: {str(e)}'}), 400

@app.route('/api/scales/<int:scale_id>/connect', methods=['POST'])
def connect_scale(scale_id):
    scale = Scale.query.get_or_404(scale_id)
    success = scale_manager.connect_scale(scale.id, scale.ip, scale.port, scale.is_simulator)
    if success:
        return jsonify({'success': True, 'message': f'{scale.name} terazisine bağlanıldı.'})
    else:
        return jsonify({'success': False, 'message': f'{scale.name} terazisine bağlantı kurulamadı!'}), 400

@app.route('/api/scales/<int:scale_id>/disconnect', methods=['POST'])
def disconnect_scale(scale_id):
    scale_manager.disconnect_scale(scale_id)
    return jsonify({'success': True, 'message': 'Bağlantı kesildi.'})

@app.route('/api/scales/<int:scale_id>/weight', methods=['GET'])
def get_scale_weight(scale_id):
    weight, active = scale_manager.get_weight(scale_id)
    return jsonify({'success': True, 'weight': weight, 'connected': active})

@app.route('/api/scales/<int:scale_id>/weight', methods=['POST'])
def set_scale_weight(scale_id):
    data = request.json or {}
    weight = data.get('weight', 0.0)
    success = scale_manager.set_simulated_weight(scale_id, weight)
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'message': 'Sadece simülasyon modundaki terazilerin ağırlığı güncellenebilir!'}), 400

@app.route('/api/scales/<int:scale_id>', methods=['DELETE'])
@require_permission('can_manage_scales')
def delete_scale(scale_id):
    scale = Scale.query.get_or_404(scale_id)
    db.session.delete(scale)
    db.session.commit()
    return jsonify({'success': True})

# --- FIRM MANAGEMENT ---

@app.route('/api/firms', methods=['POST'])
@require_permission('can_manage_customers')
def add_firm():
    data = request.json or {}
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'success': False, 'message': 'Firma adı boş olamaz!'}), 400
        
    if Firm.query.filter_by(name=name).first():
        return jsonify({'success': False, 'message': 'Bu firma zaten kayıtlı!'}), 400
        
    new_firm = Firm(name=name)
    db.session.add(new_firm)
    db.session.commit()
    return jsonify({'success': True, 'firm': new_firm.to_dict()})

@app.route('/api/firms/<int:firm_id>', methods=['DELETE'])
@require_permission('can_manage_customers')
def delete_firm(firm_id):
    firm = Firm.query.get_or_404(firm_id)
    db.session.delete(firm)
    db.session.commit()
    return jsonify({'success': True})

# --- RECIPE MANAGEMENT ---

@app.route('/api/recipes', methods=['POST'])
@require_permission('can_manage_recipes')
def add_recipe():
    data = request.json or {}
    firm_id = data.get('firmId')
    name = data.get('name', '').strip()
    
    if not firm_id or not name:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    new_recipe = Recipe(firm_id=int(firm_id), name=name, base_amount=1.0)
    db.session.add(new_recipe)
    db.session.commit()
    return jsonify({'success': True, 'recipe': new_recipe.to_dict()})

@app.route('/api/recipes/<int:recipe_id>', methods=['DELETE'])
@require_permission('can_manage_recipes')
def delete_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/recipes/<int:recipe_id>/items', methods=['POST'])
@require_permission('can_manage_recipes')
def add_recipe_item(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.json or {}
    name = data.get('name', '').strip()
    amount = data.get('amount')
    tolerance = data.get('tolerance')
    
    if not name or amount is None or tolerance is None:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    new_item = RecipeItem(recipe_id=recipe.id, name=name, amount=float(amount), tolerance=float(tolerance))
    db.session.add(new_item)
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})

@app.route('/api/recipes/<int:recipe_id>/items/<int:item_id>', methods=['DELETE'])
@require_permission('can_manage_recipes')
def delete_recipe_item(recipe_id, item_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    item = RecipeItem.query.get_or_404(item_id)
    if item.recipe_id != recipe.id:
        return jsonify({'success': False, 'message': 'Hatalı işlem!'}), 400
        
    db.session.delete(item)
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})

# --- ORDER MANAGEMENT ---

@app.route('/api/orders', methods=['POST'])
@require_permission('can_manage_orders')
def create_order():
    data = request.json or {}
    firm_id = data.get('firmId')
    recipe_id = data.get('recipeId')
    total_amount = data.get('totalAmount')
    bag_weight = data.get('bagWeight')
    batch_count = data.get('batches')
    
    if not firm_id or not recipe_id or not total_amount or not batch_count or not bag_weight:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    firm = Firm.query.get_or_404(int(firm_id))
    recipe = Recipe.query.get_or_404(int(recipe_id))
    
    total_amount = float(total_amount)
    batch_count = int(batch_count)
    bag_weight = float(bag_weight)
    
    if batch_count <= 0:
        return jsonify({'success': False, 'message': 'Parti sayısı sıfırdan büyük olmalıdır!'}), 400
    if bag_weight <= 0:
        return jsonify({'success': False, 'message': 'Torba ağırlığı sıfırdan büyük olmalıdır!'}), 400
        
    batch_size = total_amount / batch_count
    batches_list = [batch_size] * batch_count
        
    new_order = Order(
        customer_name=firm.name,
        recipe_name=recipe.name,
        total_amount=total_amount,
        bag_weight=bag_weight
    )
    db.session.add(new_order)
    db.session.commit() # commit to get order ID
    
    # Create batches
    import time
    timestamp = int(time.time() * 1000)
    for i, size in enumerate(batches_list):
        batch = Batch(
            id=f"B{timestamp}-{i+1}",
            order_id=new_order.id,
            no=i+1,
            total_batches=batch_count,
            target_amount=size,
            status='beklemede'
        )
        db.session.add(batch)
        
    db.session.commit()
    return jsonify({'success': True, 'order': new_order.to_dict()})

@app.route('/api/batches/<string:batch_id>', methods=['DELETE'])
@require_permission('can_manage_orders')
def delete_batch(batch_id):
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'message': 'İş emri bulunamadı.'}), 404
        
    order = batch.order
    
    # Delete associated weighing logs
    WeighingLog.query.filter_by(batch_id=batch_id).delete()
    
    # Delete batch
    db.session.delete(batch)
    
    # If order has no more batches left, delete the order itself
    if order and len(order.batches) <= 1:
        db.session.delete(order)
        
    db.session.commit()
    return jsonify({'success': True})

# --- JOB / WEIGHING WORKFLOW ---

@app.route('/api/batches/<string:batch_id>/start', methods=['POST'])
def start_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.json or {}
    operator_name = data.get('operator', '').strip()
    
    if not operator_name:
        return jsonify({'success': False, 'message': 'Operatör bilgisi gerekli!'}), 400
        
    batch.status = 'tartımda'
    batch.operator = operator_name
    db.session.commit()
    
    return jsonify({'success': True, 'batch': batch.to_dict()})

@app.route('/api/batches/<string:batch_id>/finish', methods=['POST'])
def finish_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    batch.status = 'fiş kesilmedi'
    db.session.commit()
    return jsonify({'success': True, 'batch': batch.to_dict()})

@app.route('/api/batches/<string:batch_id>/status', methods=['PUT'])
def update_batch_status(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.json or {}
    new_status = data.get('status')
    if new_status:
        batch.status = new_status
        db.session.commit()
        return jsonify({'success': True, 'batch': batch.to_dict()})
    return jsonify({'success': False, 'message': 'Status is required'}), 400

@app.route('/api/logs', methods=['POST'])
def add_log():
    data = request.json or {}
    batch_id = data.get('batchId')
    operator = data.get('operator')
    customer = data.get('customer')
    recipe = data.get('recipe')
    item = data.get('item')
    target = data.get('target')
    actual = data.get('actual')
    status = data.get('status')
    
    if not batch_id or not operator or not item or target is None or actual is None or not status:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    log = WeighingLog(
        batch_id=batch_id,
        operator=operator,
        customer=customer or '',
        recipe=recipe or '',
        item=item,
        target=float(target),
        actual=float(actual),
        status=status,
        timestamp=datetime.now(timezone.utc)
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'success': True, 'log': log.to_dict()})

# --- BACKUP / EXPORT / IMPORT / RESET ---

@app.route('/api/system/export', methods=['GET'])
@require_admin
def export_db():
    users = User.query.all()
    scales = Scale.query.all()
    firms = Firm.query.all()
    recipes = Recipe.query.all()
    orders = Order.query.all()
    logs = WeighingLog.query.order_by(WeighingLog.timestamp.desc()).all()

    # Recreate structure
    db_json = {
        'users': [u.to_dict() for u in users],
        'scales': [s.to_dict() for s in scales],
        'firms': [f.to_dict() for f in firms],
        'recipes': [r.to_dict() for r in recipes],
        'orders': [o.to_dict() for o in orders],
        'logs': [l.to_dict() for l in logs]
    }
    
    # Save to a temporary or memory file
    from io import BytesIO
    mem = BytesIO()
    mem.write(json.dumps(db_json, indent=2, ensure_ascii=False).encode('utf-8'))
    mem.seek(0)
    
    date_str = datetime.now().strftime('%d-%m-%Y')
    return send_file(
        mem,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'baharat_sistemi_yedek_{date_str}.json'
    )

@app.route('/api/system/import', methods=['POST'])
@require_admin
def import_db():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Dosya bulunamadı!'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Dosya seçilmedi!'}), 400
        
    try:
        data = json.load(file)
        # Validation
        if 'users' not in data or 'recipes' not in data or 'firms' not in data:
            return jsonify({'success': False, 'message': 'Geçersiz dosya formatı!'}), 400
            
        # Clean all tables
        db.session.query(WeighingLog).delete()
        db.session.query(Batch).delete()
        db.session.query(Order).delete()
        db.session.query(RecipeItem).delete()
        db.session.query(Recipe).delete()
        db.session.query(Firm).delete()
        db.session.query(Scale).delete()
        db.session.query(User).delete()
        db.session.commit()
        
        # 1. Users
        for u in data.get('users', []):
            db.session.add(User(
                id=u.get('id'),
                name=u.get('name'),
                role=u.get('role'),
                password=u.get('pass'),
                can_manage_recipes=u.get('canManageRecipes', True),
                can_manage_customers=u.get('canManageCustomers', True),
                can_manage_orders=u.get('canManageOrders', True),
                can_manage_users=u.get('canManageUsers', True),
                can_manage_scales=u.get('canManageScales', True),
                can_view_reports=u.get('canViewReports', True)
            ))
            
        # 2. Scales
        for s in data.get('scales', []):
            db.session.add(Scale(id=s.get('id'), name=s.get('name'), ip=s.get('ip'), port=s.get('port'), status=s.get('status', True), is_simulator=s.get('is_simulator', False)))
            
        # 3. Firms
        for f in data.get('firms', []):
            db.session.add(Firm(id=f.get('id'), name=f.get('name')))
        db.session.commit() # commit to set foreign key reference fields if needed
        
        # 4. Recipes & Items
        for r in data.get('recipes', []):
            recipe = Recipe(id=r.get('id'), firm_id=r.get('firmId'), name=r.get('name'), base_amount=r.get('baseAmount', 1.0))
            db.session.add(recipe)
            for item in r.get('items', []):
                db.session.add(RecipeItem(id=item.get('id'), recipe_id=recipe.id, name=item.get('name'), amount=item.get('amount'), tolerance=item.get('tolerance')))
                
        # 5. Orders & Batches
        for o in data.get('orders', []):
            order = Order(id=o.get('id'), customer_name=o.get('customer'), recipe_name=o.get('recipeName'), total_amount=o.get('totalAmount'))
            db.session.add(order)
            for b in o.get('batches', []):
                db.session.add(Batch(id=b.get('id'), order_id=order.id, no=b.get('no'), total_batches=b.get('totalBatches'), target_amount=b.get('targetAmount'), status=b.get('status'), operator=b.get('operator')))
                
        # 6. Logs
        for l in data.get('logs', []):
            # Parse timestamp
            ts = None
            if l.get('timestamp'):
                try:
                    ts = datetime.fromisoformat(l.get('timestamp').replace('Z', '+00:00'))
                except ValueError:
                    pass
            db.session.add(WeighingLog(
                batch_id=l.get('batchId'),
                operator=l.get('operator'),
                customer=l.get('customer', ''),
                recipe=l.get('recipe', ''),
                item=l.get('item'),
                target=float(l.get('target')),
                actual=float(l.get('actual')),
                status=l.get('status'),
                timestamp=ts or datetime.now(timezone.utc)
            ))
            
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Hata: {str(e)}'}), 500

@app.route('/api/system/reset', methods=['POST'])
@require_admin
def reset_db():
    try:
        # Clean all tables
        db.session.query(WeighingLog).delete()
        db.session.query(Batch).delete()
        db.session.query(Order).delete()
        db.session.query(RecipeItem).delete()
        db.session.query(Recipe).delete()
        db.session.query(Firm).delete()
        db.session.query(Scale).delete()
        db.session.query(User).delete()
        db.session.commit()
        
        # Seed
        seed_database()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Sıfırlama Hatası: {str(e)}'}), 500

# Initialize Database on Startup
with app.app_context():
    db.create_all()
    
    # Run dynamic schema migrations for user and recipe tables in SQLite
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
        
    seed_database()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
