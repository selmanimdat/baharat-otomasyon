from flask import Blueprint, request, jsonify, session
from backend.extensions import db
from backend.models import User, Scale, Firm, Recipe, RecipeItem, Order, Batch, WeighingLog, SystemSetting
from backend.utils import require_permission
from backend.services.scale_manager import scale_manager

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/settings', methods=['POST'])
def save_settings():
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Sadece Birincil Yönetici ayarları değiştirebilir!'}), 403

    data = request.json or {}
    key = data.get('key')
    value = data.get('value')
    if not key:
        return jsonify({'success': False, 'message': 'Eksik veri'}), 400

    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting:
        setting = SystemSetting(key=key, value=value)
        db.session.add(setting)
    else:
        setting.value = value
    
    db.session.commit()
    return jsonify({'success': True, 'setting': setting.to_dict()})

@admin_bp.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting:
        return jsonify({'key': key, 'value': ''}), 200
    return jsonify(setting.to_dict())



# --- USER MANAGEMENT ---
@admin_bp.route('/users', methods=['POST'])
@admin_bp.route('/personnel', methods=['POST'])
def add_user():
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
    if not current_user or (current_user.role != 'admin' and not current_user.can_manage_users):
        return jsonify({'success': False, 'message': 'Personel ekleme yetkiniz yok!'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    password = data.get('password') or data.get('pass', '')
    password = password.strip()
    
    # Map friendly roles to backend roles
    raw_role = data.get('role', 'operator').strip()
    if 'yönetici' in raw_role.lower() or 'manager' in raw_role.lower():
        role = 'manager'
    elif 'sekreter' in raw_role.lower() or 'secretary' in raw_role.lower():
        role = 'secretary'
    else:
        role = 'operator'
    
    if not name or not password:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    if role not in ['manager', 'secretary', 'operator']:
        return jsonify({'success': False, 'message': 'Geçersiz rol seçimi!'}), 400

    if current_user.role == 'manager' and role == 'manager':
        return jsonify({'success': False, 'message': 'Yöneticiler başka bir yönetici oluşturamaz!'}), 403

    if User.query.filter_by(name=name).first():
        return jsonify({'success': False, 'message': 'Bu isimde bir personel zaten var!'}), 400
        
    if role == 'manager':
        can_recipes = can_customers = can_orders = can_users = can_scales = can_reports = can_sales = True
    elif role == 'secretary':
        can_recipes = can_customers = can_orders = can_users = can_scales = can_sales = False
        can_reports = True
    else:
        can_recipes = can_customers = can_orders = can_users = can_scales = can_reports = can_sales = False

    new_user = User(
        name=name, role=role, password=password,
        can_manage_recipes=can_recipes, can_manage_customers=can_customers,
        can_manage_orders=can_orders, can_manage_users=can_users,
        can_manage_scales=can_scales, can_view_reports=can_reports, can_view_sales=can_sales
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'success': True, 'id': new_user.id, 'user': new_user.to_dict()})

@admin_bp.route('/users/<int:user_id>/permissions', methods=['PUT'])
def update_user_permissions(user_id):
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
    if not current_user or (current_user.role != 'admin' and not current_user.can_manage_users):
        return jsonify({'success': False, 'message': 'Yetki düzenleme yetkiniz yok!'}), 403
        
    target_user = User.query.get_or_404(user_id)
    if target_user.role == 'admin':
        return jsonify({'success': False, 'message': 'Birincil yönetici yetkileri değiştirilemez!'}), 400
        
    if current_user.role == 'manager' and target_user.role in ['admin', 'manager']:
        return jsonify({'success': False, 'message': 'Yöneticiler diğer yöneticilerin yetkilerini değiştiremez!'}), 403

    data = request.json or {}
    new_role = data.get('role')
    if new_role:
        if new_role == 'admin':
            return jsonify({'success': False, 'message': 'Birincil yönetici rolü atanamaz!'}), 400
        if current_user.role == 'manager' and new_role == 'manager':
            return jsonify({'success': False, 'message': 'Yöneticiler rol atamasını yönetici olarak değiştiremez!'}), 403
        target_user.role = new_role
        
    if 'canManageRecipes' in data: target_user.can_manage_recipes = bool(data['canManageRecipes'])
    if 'canManageCustomers' in data: target_user.can_manage_customers = bool(data['canManageCustomers'])
    if 'canManageOrders' in data: target_user.can_manage_orders = bool(data['canManageOrders'])
    if 'canManageUsers' in data: target_user.can_manage_users = bool(data['canManageUsers'])
    if 'canManageScales' in data: target_user.can_manage_scales = bool(data['canManageScales'])
    if 'canViewReports' in data: target_user.can_view_reports = bool(data['canViewReports'])
    if 'canViewSales' in data: target_user.can_view_sales = bool(data['canViewSales'])
        
    db.session.commit()
    return jsonify({'success': True, 'user': target_user.to_dict()})

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user:
        return jsonify({'success': False, 'message': 'Giriş yapılmadı!'}), 401
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


# --- SCALE MANAGEMENT ---
@admin_bp.route('/scales', methods=['POST'])
@require_permission('can_manage_scales')
def add_scale():
    data = request.json or {}
    name = data.get('name', '').strip()
    ip = data.get('ip', '').strip()
    port = data.get('port')
    is_simulator = data.get('is_simulator', False)
    
    connection_type = data.get('connection_type') or data.get('type', 'wired')
    if 'kablolu' in connection_type.lower() or 'lan' in connection_type.lower(): connection_type = 'wired'
    elif 'uzak' in connection_type.lower() or 'remote' in connection_type.lower(): connection_type = 'remote'
    
    data_format = data.get('data_format') or data.get('format', 'densi')
    if 'densi' in data_format.lower(): data_format = 'densi'
    
    if not name or not ip or not port:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    new_scale = Scale(
        name=name, ip=ip, port=int(port), status=True, 
        is_simulator=bool(is_simulator),
        connection_type=connection_type,
        data_format=data_format
    )
    db.session.add(new_scale)
    db.session.commit()
    return jsonify({'success': True, 'id': new_scale.id, 'scale': new_scale.to_dict()})

@admin_bp.route('/scales/test-connection', methods=['POST'])
def test_scale_connection():
    data = request.json or {}
    ip = data.get('ip', '').strip()
    port = data.get('port')
    is_simulator = data.get('is_simulator', False)
    
    if is_simulator:
        return jsonify({'success': True, 'message': 'Simülasyon Modu Aktif (Bağlantı başarılı kabul edildi)'})
    
    if not ip or not port:
        return jsonify({'success': False, 'message': 'IP ve port belirtilmelidir!'}), 400
        
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        sock.connect((ip, int(port)))
        sock.close()
        return jsonify({'success': True, 'message': 'Bağlantı Başarılı!'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Bağlantı başarısız: {str(e)}'}), 400

@admin_bp.route('/scales/<int:scale_id>/connect', methods=['POST'])
def connect_scale(scale_id):
    scale = Scale.query.get_or_404(scale_id)
    success = scale_manager.connect_scale(scale.id, scale.ip, scale.port, scale.is_simulator, scale.data_format)
    if success:
        return jsonify({'success': True, 'message': f'{scale.name} terazisine bağlanıldı.'})
    else:
        return jsonify({'success': False, 'message': f'{scale.name} terazisine bağlantı kurulamadı!'}), 400

@admin_bp.route('/scales/<int:scale_id>/disconnect', methods=['POST'])
def disconnect_scale(scale_id):
    scale_manager.disconnect_scale(scale_id)
    return jsonify({'success': True, 'message': 'Bağlantı kesildi.'})

@admin_bp.route('/scales/<int:scale_id>/weight', methods=['GET'])
def get_scale_weight(scale_id):
    weight, active = scale_manager.get_weight(scale_id)
    return jsonify({'success': True, 'weight': weight, 'connected': active})

@admin_bp.route('/scales/<int:scale_id>/weight', methods=['POST'])
def set_scale_weight(scale_id):
    data = request.json or {}
    weight = data.get('weight', 0.0)
    success = scale_manager.set_simulated_weight(scale_id, weight)
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'message': 'Sadece simülasyon modundaki terazilerin ağırlığı güncellenebilir!'}), 400

@admin_bp.route('/scales/<int:scale_id>', methods=['DELETE'])
@require_permission('can_manage_scales')
def delete_scale(scale_id):
    scale = Scale.query.get_or_404(scale_id)
    db.session.delete(scale)
    db.session.commit()
    return jsonify({'success': True})

# --- FIRM / CUSTOMER MANAGEMENT ---
@admin_bp.route('/firms', methods=['POST'])
@require_permission('can_manage_customers')
def add_firm():
    data = request.json or {}
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    address = data.get('address', '').strip()
    tax_id = data.get('taxId', '').strip()
    contact_person = data.get('contactPerson', '').strip()
    notes = data.get('notes', '').strip()

    if not name:
        return jsonify({'success': False, 'message': 'Müşteri / Firma adı boş olamaz!'}), 400
    if Firm.query.filter_by(name=name).first():
        return jsonify({'success': False, 'message': 'Bu müşteri zaten kayıtlı!'}), 400
        
    new_firm = Firm(
        name=name, phone=phone, email=email, address=address,
        tax_id=tax_id, contact_person=contact_person, notes=notes
    )
    db.session.add(new_firm)
    db.session.commit()
    return jsonify({'success': True, 'firm': new_firm.to_dict()})

@admin_bp.route('/firms/<int:firm_id>', methods=['PUT'])
@require_permission('can_manage_customers')
def update_firm(firm_id):
    firm = Firm.query.get_or_404(firm_id)
    data = request.json or {}
    
    name = data.get('name', '').strip()
    if name:
        existing = Firm.query.filter_by(name=name).first()
        if existing and existing.id != firm.id:
            return jsonify({'success': False, 'message': 'Bu isimde başka bir müşteri zaten var!'}), 400
        firm.name = name

    if 'phone' in data: firm.phone = data.get('phone', '').strip()
    if 'email' in data: firm.email = data.get('email', '').strip()
    if 'address' in data: firm.address = data.get('address', '').strip()
    if 'taxId' in data: firm.tax_id = data.get('taxId', '').strip()
    if 'contactPerson' in data: firm.contact_person = data.get('contactPerson', '').strip()
    if 'notes' in data: firm.notes = data.get('notes', '').strip()

    db.session.commit()
    return jsonify({'success': True, 'firm': firm.to_dict()})

@admin_bp.route('/firms/<int:firm_id>', methods=['DELETE'])
@require_permission('can_manage_customers')
def delete_firm(firm_id):
    firm = Firm.query.get_or_404(firm_id)
    db.session.delete(firm)
    db.session.commit()
    return jsonify({'success': True})

# --- RECIPE MANAGEMENT ---
@admin_bp.route('/recipes', methods=['POST'])
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

@admin_bp.route('/recipes/<int:recipe_id>', methods=['DELETE'])
@require_permission('can_manage_recipes')
def delete_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/recipes/<int:recipe_id>/items', methods=['POST'])
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

@admin_bp.route('/recipes/<int:recipe_id>/items/<int:item_id>', methods=['DELETE'])
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
@admin_bp.route('/orders', methods=['POST'])
@require_permission('can_manage_orders')
def create_order():
    data = request.json or {}
    firm_id = data.get('firmId')
    recipe_id = data.get('recipeId')
    total_amount = data.get('totalAmount') or data.get('totalWeight')
    bag_weight = data.get('bagWeight')
    batch_count = data.get('batches') or data.get('batchCount')
    
    if not firm_id or not recipe_id or not total_amount or not batch_count or not bag_weight:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    firm = Firm.query.get_or_404(int(firm_id))
    recipe = Recipe.query.get_or_404(int(recipe_id))
    
    total_amount = float(total_amount)
    batch_count = int(batch_count)
    bag_weight = float(bag_weight)
    
    if batch_count <= 0: return jsonify({'success': False, 'message': 'Parti sayısı sıfırdan büyük olmalıdır!'}), 400
    if bag_weight <= 0: return jsonify({'success': False, 'message': 'Torba ağırlığı sıfırdan büyük olmalıdır!'}), 400
        
    batch_size = total_amount / batch_count
    batches_list = [batch_size] * batch_count
        
    new_order = Order(
        customer_name=firm.name,
        recipe_name=recipe.name,
        total_amount=total_amount,
        bag_weight=bag_weight
    )
    db.session.add(new_order)
    db.session.commit()
    
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
    return jsonify({'success': True, 'message': f'Sipariş oluşturuldu ve {batch_count} adet iş emrine bölündü.', 'order': new_order.to_dict()})

@admin_bp.route('/batches/<string:batch_id>', methods=['DELETE'])
@require_permission('can_manage_orders')
def delete_batch(batch_id):
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'message': 'İş emri bulunamadı.'}), 404
    order = batch.order
    WeighingLog.query.filter_by(batch_id=batch_id).delete()
    db.session.delete(batch)
    if order and len(order.batches) <= 1:
        db.session.delete(order)
    db.session.commit()
    return jsonify({'success': True})
