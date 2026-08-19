import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session
from backend.extensions import db
from backend.models import User, Firm, Recipe, RecipeItem, Order, Batch, WeighingLog, SystemSetting, Scale, Transaction
from backend.utils import require_permission, get_authenticated_user

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
    
    from backend.models import AuditLog
    username = current_user.name if current_user else 'Sistem'
    
    if not setting:
        setting = SystemSetting(key=key, value=value)
        db.session.add(setting)
        
        log_entry = AuditLog(
            user=username,
            entity_type='SystemSetting',
            entity_id=key,
            action='CREATE',
            old_value=None,
            new_value=json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value),
            description=f"Ayar oluşturuldu: {key}"
        )
        db.session.add(log_entry)
    else:
        old_val = setting.value
        setting.value = value
        
        log_entry = AuditLog(
            user=username,
            entity_type='SystemSetting',
            entity_id=key,
            action='UPDATE',
            old_value=json.dumps(old_val, ensure_ascii=False) if isinstance(old_val, (dict, list)) else str(old_val),
            new_value=json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value),
            description=f"Ayar güncellendi: {key}"
        )
        db.session.add(log_entry)
    
    db.session.commit()
    return jsonify({'success': True, 'setting': setting.to_dict()})

@admin_bp.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting:
        return jsonify({'key': key, 'value': ''}), 200
    return jsonify(setting.to_dict())
@admin_bp.route('/settings/rename_ingredient', methods=['PUT'])
def rename_ingredient():
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Sadece Yönetici işlemi yapabilir!'}), 403

    data = request.json or {}
    old_name = data.get('oldName', '').strip()
    new_name = data.get('newName', '').strip()

    if not old_name or not new_name or old_name == new_name:
        return jsonify({'success': False, 'message': 'Geçersiz isim!'}), 400

    # 1. Update recipe_order in SystemSetting
    recipe_setting = SystemSetting.query.filter_by(key='recipe_order').first()
    if recipe_setting and recipe_setting.value:
        lines = [s.strip() for s in recipe_setting.value.split('\n') if s.strip()]
        if old_name in lines:
            lines[lines.index(old_name)] = new_name
            recipe_setting.value = '\n'.join(lines)
            db.session.add(recipe_setting)

    # 2. Update RecipeItem table
    RecipeItem.query.filter_by(name=old_name).update({"name": new_name})

    # 3. Update Inventory and InventoryTransaction tables
    from backend.models import Inventory, InventoryTransaction, SystemLog
    Inventory.query.filter_by(ingredient_name=old_name).update({"ingredient_name": new_name})
    InventoryTransaction.query.filter_by(ingredient_name=old_name).update({"ingredient_name": new_name})

    # 4. Add to SystemLog
    log_action = f"Hammadde Adı Değiştirildi: {old_name} -> {new_name}"
    log_entry = SystemLog(user=current_user.name, action=log_action, details="Genel Ayarlar (Reçete & Depo)")
    db.session.add(log_entry)
    
    db.session.commit()
    return jsonify({'success': True})

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
        can_recipes = can_customers = can_orders = can_users = can_reports = can_sales = True
        can_dashboard = can_trace = can_acc = can_cur = can_settings = True
    elif role == 'secretary':
        can_recipes = can_customers = can_orders = can_users = can_sales = False
        can_reports = True
        can_dashboard = can_trace = can_acc = can_cur = can_settings = False
    else:
        can_recipes = can_customers = can_orders = can_users = can_reports = can_sales = False
        can_dashboard = can_trace = can_acc = can_cur = can_settings = False

    new_user = User(
        name=name, role=role, password=password,
        can_manage_recipes=can_recipes, can_manage_customers=can_customers,
        can_manage_orders=can_orders, can_manage_users=can_users,
        can_view_reports=can_reports, can_view_sales=can_sales,
        can_view_dashboard=can_dashboard, can_view_traceability=can_trace,
        can_view_accounting=can_acc, can_view_current_accounts=can_cur,
        can_manage_settings=can_settings
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
    if 'canViewReports' in data: target_user.can_view_reports = bool(data['canViewReports'])
    if 'canViewSales' in data: target_user.can_view_sales = bool(data['canViewSales'])
    if 'canViewDashboard' in data: target_user.can_view_dashboard = bool(data['canViewDashboard'])
    if 'canViewTraceability' in data: target_user.can_view_traceability = bool(data['canViewTraceability'])
    if 'canViewAccounting' in data: target_user.can_view_accounting = bool(data['canViewAccounting'])
    if 'canViewCurrentAccounts' in data: target_user.can_view_current_accounts = bool(data['canViewCurrentAccounts'])
    if 'canManageSettings' in data: target_user.can_manage_settings = bool(data['canManageSettings'])
    if 'opCanSeeColor' in data: target_user.op_can_see_color = bool(data['opCanSeeColor'])
    if 'opCanSeeGarlic' in data: target_user.op_can_see_garlic = bool(data['opCanSeeGarlic'])
        
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
        
        old_name = firm.name
        if old_name != name:
            firm.name = name
            Order.query.filter_by(customer_name=old_name).update({"customer_name": name}, synchronize_session=False)
            WeighingLog.query.filter_by(customer=old_name).update({"customer": name}, synchronize_session=False)

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
    new_recipe = Recipe(firm_id=int(firm_id), name=name, base_amount=100.0)
    db.session.add(new_recipe)
    db.session.commit()
    return jsonify({'success': True, 'recipe': new_recipe.to_dict()})

@admin_bp.route('/recipes/<int:recipe_id>', methods=['DELETE', 'PUT'])
@require_permission('can_manage_recipes')
def manage_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    
    if request.method == 'DELETE':
        current_user = get_authenticated_user()
        username = current_user.name if current_user else 'Sistem'
        recipe.is_active = False
        recipe.deleted_at = datetime.now(timezone.utc)
        recipe.deleted_by = username
        db.session.commit()
        return jsonify({'success': True, 'message': 'Reçete çöp kutusuna taşındı.'})
        
    if request.method == 'PUT':
        data = request.json
        if 'hide_separate_colors' in data:
            recipe.hide_separate_colors = data['hide_separate_colors']
        if 'is_custom_kg_based' in data:
            recipe.is_custom_kg_based = data['is_custom_kg_based']
            
        db.session.commit()
        from backend.services.websocket_notifier import notify_websocket
        notify_websocket({'type': 'SETTINGS_UPDATED'})
        return jsonify({'success': True, 'recipe': recipe.to_dict()})

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
        
    # Get global sorting order
    sort_order = 999
    setting = SystemSetting.query.filter_by(key='recipe_order').first()
    if setting and setting.value:
        global_order = [s.strip() for s in setting.value.split('\n') if s.strip()]
        if name in global_order:
            sort_order = global_order.index(name)
            
    unit_price = data.get('unit_price')
    unit_price = float(unit_price) if unit_price is not None else None
    
    is_separate = data.get('is_separate', False)
    is_separate = str(is_separate).lower() in ['true', '1', 't', 'y', 'yes']
            
    new_item = RecipeItem(
        recipe_id=recipe.id, 
        name=name, 
        amount=float(amount), 
        tolerance=float(tolerance), 
        sort_order=sort_order,
        unit_price=unit_price,
        is_separate=is_separate
    )
    db.session.add(new_item)
    from backend.utils import get_authenticated_user
    cu = get_authenticated_user()
    recipe.updated_by = cu.name if cu else 'Sistem'
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})

@admin_bp.route('/recipes/<int:recipe_id>/items/<int:item_id>', methods=['DELETE'])
@require_permission('can_manage_recipes')
def delete_recipe_item(recipe_id, item_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    item = RecipeItem.query.get_or_404(item_id)
    if item.recipe_id != recipe.id:
        return jsonify({'success': False, 'message': 'Hatalı işlem!'}), 400
        
    old_val = item.to_dict()
    db.session.delete(item)
    
    from backend.models import AuditLog
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    username = current_user.name if current_user else 'Sistem'
    
    log_entry = AuditLog(
        user=username,
        entity_type='RecipeItem',
        entity_id=str(item.id),
        action='DELETE',
        old_value=json.dumps(old_val, ensure_ascii=False),
        new_value=None,
        description=f"Reçete Hammadde Silindi: {recipe.firm.name} - {recipe.name} ({item.name})"
    )
    db.session.add(log_entry)
    
    from backend.utils import get_authenticated_user
    cu = get_authenticated_user()
    recipe.updated_by = cu.name if cu else 'Sistem'
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})

@admin_bp.route('/recipes/<int:recipe_id>/items/<int:item_id>', methods=['PUT'])
@require_permission('can_manage_recipes')
def update_recipe_item(recipe_id, item_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    item = RecipeItem.query.get_or_404(item_id)
    if item.recipe_id != recipe.id:
        return jsonify({'success': False, 'message': 'Hatalı işlem!'}), 400
        
    data = request.json or {}
    
    old_val = item.to_dict()
    changes = []
    
    try:
        if 'amount' in data:
            amt_str = str(data['amount']).strip()
            if not amt_str:
                return jsonify({'success': False, 'message': 'Miktar boş olamaz!'}), 400
            new_amt = float(amt_str)
            if abs(new_amt - item.amount) > 0.0001:
                changes.append(f"Miktar: {item.amount}gr -> {new_amt}gr")
                item.amount = new_amt

        if 'tolerance' in data:
            tol_str = str(data['tolerance']).strip()
            if not tol_str:
                return jsonify({'success': False, 'message': 'Tolerans boş olamaz!'}), 400
            new_tol = float(tol_str)
            if abs(new_tol - item.tolerance) > 0.0001:
                changes.append(f"Tolerans: {item.tolerance}gr -> {new_tol}gr")
                item.tolerance = new_tol
                
        if 'unit_price' in data:
            up = data['unit_price']
            new_price = float(up) if up is not None and str(up).strip() != '' else None
            if item.unit_price != new_price:
                changes.append(f"Fiyat: {item.unit_price} -> {new_price}")
                item.unit_price = new_price
                

    except ValueError:
        return jsonify({'success': False, 'message': 'Geçersiz sayı formatı!'}), 400
        
    if 'is_separate' in data:
        val = data['is_separate']
        new_sep = str(val).lower() in ['true', '1', 't', 'y', 'yes']
        if item.is_separate != new_sep:
            changes.append(f"Ayrı Hazırlanır: {item.is_separate} -> {new_sep}")
            item.is_separate = new_sep

    if 'is_not_included' in data:
        val = data['is_not_included']
        new_inc = str(val).lower() in ['true', '1', 't', 'y', 'yes']
        if item.is_not_included != new_inc:
            changes.append(f"Dahil Değil: {item.is_not_included} -> {new_inc}")
            item.is_not_included = new_inc

    if changes:
        from backend.utils import get_authenticated_user
        current_user = get_authenticated_user()
        username = current_user.name if current_user else "Sistem"
        
        log_action = f"Reçete Hammadde Güncellendi: {recipe.firm.name} - {recipe.name} ({item.name})"
        log_details = ", ".join(changes)
        
        from backend.models import SystemLog, AuditLog
        sys_log = SystemLog(user=username, action=log_action, details=log_details)
        db.session.add(sys_log)
        
        audit_log = AuditLog(
            user=username,
            entity_type='RecipeItem',
            entity_id=str(item.id),
            action='UPDATE',
            old_value=json.dumps(old_val, ensure_ascii=False),
            new_value=json.dumps(item.to_dict(), ensure_ascii=False),
            description=f"{log_action} [{log_details}]"
        )
        db.session.add(audit_log)
    recipe.updated_by = username

    from backend.utils import get_authenticated_user
    cu = get_authenticated_user()
    recipe.updated_by = cu.name if cu else 'Sistem'
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})

@admin_bp.route('/recipes/<int:recipe_id>/archive', methods=['POST'])
@require_permission('can_manage_recipes')
def archive_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.json or {}
    
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    archived_by = data.get('username', current_user.name if current_user else 'Bilinmeyen Kullanıcı')
    
    import json
    from backend.models import RecipeArchive
    
    archive = RecipeArchive(
        recipe_id=recipe.id,
        recipe_name=recipe.name,
        archived_by=archived_by,
        recipe_data=json.dumps(recipe.to_dict())
    )
    db.session.add(archive)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Reçete arşivlendi'})


@admin_bp.route('/recipes/<int:recipe_id>/archives', methods=['GET'])
@require_permission('can_manage_recipes')
def get_recipe_archives(recipe_id):
    from backend.models import RecipeArchive
    archives = RecipeArchive.query.filter_by(recipe_id=recipe_id).order_by(RecipeArchive.archived_at.desc()).all()
    return jsonify({'success': True, 'archives': [a.to_dict() for a in archives]})

@admin_bp.route('/recipes/<int:recipe_id>/restore/<int:archive_id>', methods=['POST'])
@require_permission('can_manage_recipes')
def restore_recipe(recipe_id, archive_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    from backend.models import RecipeArchive, RecipeItem
    archive = RecipeArchive.query.get_or_404(archive_id)
    
    if archive.recipe_id != recipe.id:
        return jsonify({'success': False, 'message': 'Bu arşiv bu reçeteye ait değil!'}), 400
        
    import json
    data = json.loads(archive.recipe_data)
    
    # 1. Update basic recipe fields
    recipe.base_amount = data.get('baseAmount', recipe.base_amount)
    recipe.price_per_kg = data.get('pricePerKg', recipe.price_per_kg)
    recipe.hide_separate_colors = data.get('hideSeparateColors', recipe.hide_separate_colors)
    recipe.is_custom_kg_based = data.get('isCustomKgBased', getattr(recipe, 'is_custom_kg_based', False))
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    recipe.updated_by = current_user.name if current_user else 'Sistem'
    
    # 2. Delete existing items
    for item in recipe.items:
        db.session.delete(item)
        
    # 3. Create new items from archive
    items = data.get('items', [])
    for idx, item_data in enumerate(items):
        new_item = RecipeItem(
            recipe_id=recipe.id,
            name=item_data.get('name'),
            amount=item_data.get('amount', 0),
            tolerance=item_data.get('tolerance', 0),
            sort_order=item_data.get('sort_order', idx),
            unit_price=item_data.get('unit_price', 0),
            is_separate=item_data.get('is_separate', False),
            is_not_included=item_data.get('is_not_included', False)
        )
        db.session.add(new_item)
        
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Reçete arşivden geri yüklendi', 'recipe': recipe.to_dict()})

@admin_bp.route('/recipes/<int:recipe_id>/items/reorder', methods=['PUT'])
@require_permission('can_manage_recipes')
def reorder_recipe_items(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.json or {}
    item_ids = data.get('itemIds', [])
    
    if not isinstance(item_ids, list):
        return jsonify({'success': False, 'message': 'Geçersiz veri formatı'}), 400

    # Update sort_order for each item based on its index in the array
    for index, item_id in enumerate(item_ids):
        item = RecipeItem.query.filter_by(id=item_id, recipe_id=recipe.id).first()
        if item:
            item.sort_order = index
            
    from backend.utils import get_authenticated_user
    cu = get_authenticated_user()
    recipe.updated_by = cu.name if cu else 'Sistem'
    db.session.commit()
    return jsonify({'success': True, 'recipe': recipe.to_dict()})


# --- ORDER MANAGEMENT ---

def _validate_packaging_segments(segments, total_amount):
    """Validate packaging segments. Returns JSON string to store on order."""
    import json
    total_seg = sum(float(s['amount']) for s in segments)
    if abs(total_seg - total_amount) > 0.01:
        raise ValueError(f'Bölüm toplamı ({total_seg} kg) sipariş miktarına ({total_amount} kg) eşit olmalıdır.')
    for seg in segments:
        if float(seg.get('bagWeight', 0)) <= 0:
            raise ValueError('Mikser kapasitesi sıfırdan büyük olmalıdır.')
        if float(seg.get('amount', 0)) <= 0:
            raise ValueError('Bölüm miktarı sıfırdan büyük olmalıdır.')
    return json.dumps([{'amount': float(s['amount']), 'bagWeight': float(s['bagWeight'])} for s in segments])


@admin_bp.route('/orders', methods=['POST'])
@require_permission('can_manage_orders')
def create_order():
    data = request.json or {}
    firm_id = data.get('firmId')
    recipe_id = data.get('recipeId')
    total_amount = data.get('totalAmount') or data.get('totalWeight')
    bag_weight = data.get('bagWeight')
    batch_count = data.get('batches') or data.get('batchCount') or 1
    segments = data.get('segments') or data.get('packagingSegments')
    delivery_date = data.get('deliveryDate')
    # Teslim tarihi girilmemişse bugünü otomatik ata (YYYY-MM-DD)
    if not delivery_date:
        from datetime import date
        delivery_date = date.today().isoformat()
    urgency = data.get('urgency') or 'normal'

    
    if not bag_weight and segments and len(segments) > 0:
        for seg in segments:
            if seg.get('bagWeight'):
                try:
                    bag_weight = float(seg.get('bagWeight'))
                    break
                except (ValueError, TypeError):
                    pass
        if not bag_weight:
            bag_weight = 250.0

    if not firm_id or not recipe_id or not total_amount or not bag_weight:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
        
    firm = Firm.query.get_or_404(int(firm_id))
    recipe = Recipe.query.get_or_404(int(recipe_id))
    if not recipe.is_active:
        return jsonify({'success': False, 'message': 'Bu reçete pasif durumda, yeni sipariş oluşturulamaz.'}), 400
    
    total_amount = float(total_amount)
    batch_count = int(batch_count)
    bag_weight = float(bag_weight)
    
    if batch_count <= 0:
        return jsonify({'success': False, 'message': 'Parti sayısı sıfırdan büyük olmalıdır!'}), 400
    if bag_weight <= 0:
        return jsonify({'success': False, 'message': 'Torba ağırlığı sıfırdan büyük olmalıdır!'}), 400

    packaging_segments_json = None
    try:
        if segments and len(segments) > 0:
            packaging_segments_json = _validate_packaging_segments(segments, total_amount)
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400

    batch_size = total_amount / batch_count
        
    new_order = Order(
        customer_name=firm.name,
        recipe_name=recipe.name,
        total_amount=total_amount,
        bag_weight=bag_weight,
        packaging_segments=packaging_segments_json,
        delivery_date=delivery_date,
        urgency=urgency,
        created_by=data.get('createdBy', 'Sistem'),
        notes=data.get('notes', '')
    )
    db.session.add(new_order)
    db.session.commit()
    
    import json
    extra_items_json = None
    if data.get('extras'):
        extra_items_json = json.dumps(data.get('extras'))

    import time
    timestamp = int(time.time() * 1000)
    for i in range(batch_count):
        batch = Batch(
            id=f"B{timestamp}-{i+1}",
            order_id=new_order.id,
            no=i+1,
            total_batches=batch_count,
            target_amount=batch_size,
            bag_weight=bag_weight,
            status='beklemede',
            extra_items=extra_items_json
        )
        db.session.add(batch)
        
    db.session.commit()
    return jsonify({'success': True, 'message': f'Sipariş oluşturuldu ve {batch_count} adet iş emrine bölündü.', 'order': new_order.to_dict()})

@admin_bp.route('/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 401
        
    order = Order.query.get_or_404(order_id)
    data = request.json or {}
    
    extra_items_json = None
    if 'extras' in data:
        import json
        extra_items_json = json.dumps(data['extras'])

    # Operators can only change bagWeight
    role = user.role
    if 'bagWeight' in data:
        order.bag_weight = float(data['bagWeight'])
        
    # Admins can change other fields
    if role != 'operator':
        if 'deliveryDate' in data:
            order.delivery_date = data['deliveryDate']
        if 'urgency' in data:
            order.urgency = data['urgency']
        if 'notes' in data:
            order.notes = data['notes']
        # Handle totalAmount and bagWeight changes
        new_total_amount = float(data.get('totalAmount', order.total_amount))
        new_bag_weight = float(data.get('bagWeight', order.bag_weight))
        
        if new_total_amount != order.total_amount or new_bag_weight != order.bag_weight or 'batches' in data or 'batchCount' in data:
            order.total_amount = new_total_amount
            order.bag_weight = new_bag_weight

            
            in_progress_batches = [b for b in order.batches if b.status != 'beklemede']
            pending_batches = [b for b in order.batches if b.status == 'beklemede']
            
            allocated_amount = sum(b.target_amount for b in in_progress_batches)
            remaining_amount = new_total_amount - allocated_amount
            
            # Preserve existing pending batch count (or use explicit batches count if provided)
            if 'batches' in data or 'batchCount' in data:
                new_pending_count = int(data.get('batches') or data.get('batchCount') or 1)
            else:
                new_pending_count = len(pending_batches) if len(pending_batches) > 0 else 1
            
            for b in pending_batches:
                db.session.delete(b)
                
            db.session.commit()
            
            if remaining_amount > 0 and new_pending_count > 0:
                import time
                batch_size = remaining_amount / new_pending_count
                
                timestamp = int(time.time() * 1000)
                start_no = len(in_progress_batches) + 1
                total_new_batches = len(in_progress_batches) + new_pending_count
                
                for b in in_progress_batches:
                    b.total_batches = total_new_batches
                
                for i in range(new_pending_count):
                    new_batch = Batch(
                        id=f"B{timestamp}-{i+1}",
                        order_id=order.id,
                        no=start_no + i,
                        total_batches=total_new_batches,
                        target_amount=batch_size,
                        bag_weight=new_bag_weight,
                        status='beklemede',
                        extra_items=extra_items_json
                    )
                    db.session.add(new_batch)
                    
            db.session.commit()

        else:
            # Update extra_items for existing waiting batches if they were not recreated
            if 'extras' in data:
                for b in order.batches:
                    if b.status == 'beklemede':
                        b.extra_items = extra_items_json
            db.session.commit()

    else:
        db.session.commit()
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'ORDER_UPDATED'})
    return jsonify({'success': True, 'order': order.to_dict()})

@admin_bp.route('/orders/<int:order_id>/deliver', methods=['POST'])
@require_permission('can_manage_orders')
def deliver_order(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.json or {}
    amount = float(data.get('amount', 0))
    delivered_by = data.get('deliveredBy', 'Admin')

    if amount <= 0:
        return jsonify({'success': False, 'message': 'Teslim edilecek miktar sıfırdan büyük olmalıdır.'}), 400

    if (order.delivered_amount or 0.0) + amount > order.total_amount:
        return jsonify({'success': False, 'message': 'Teslim edilecek miktar toplam sipariş miktarını aşamaz.'}), 400

    # Depo düşüm işlemi
    firm = Firm.query.filter_by(name=order.customer_name).first()
    recipe = None
    if firm:
        recipe = Recipe.query.filter_by(name=order.recipe_name, firm_id=firm.id).first()
    if not recipe:
        recipe = Recipe.query.filter_by(name=order.recipe_name).first()

    if recipe:
        recipe_total_grams = sum(item.amount for item in recipe.items)
        recipe_total_kg = recipe_total_grams / 1000.0

        if recipe_total_kg > 0:
            from backend.models import Inventory, InventoryTransaction
            for item in recipe.items:
                if getattr(item, 'is_not_included', False):
                    continue
                
                # Her 1 kg son ürün için kullanılacak hammadde kg miktarı
                ingredient_per_kg = (item.amount / 1000.0) / recipe_total_kg
                deduction_kg = amount * ingredient_per_kg
                
                if deduction_kg > 0:
                    inv = Inventory.query.filter_by(ingredient_name=item.name).first()
                    if inv:
                        prev_stock = inv.current_stock
                        inv.current_stock -= deduction_kg
                        txn = InventoryTransaction(
                            ingredient_name=inv.ingredient_name,
                            transaction_type='Çıkış',
                            amount=deduction_kg,
                            previous_stock=prev_stock,
                            new_stock=inv.current_stock,
                            timestamp=datetime.now(timezone.utc),
                            notes=f"{order.customer_name} - {recipe.name} Sipariş Teslimatı",
                            user=delivered_by
                        )
                        db.session.add(txn)

    order.delivered_amount = (order.delivered_amount or 0.0) + amount
    from backend.models import OrderDelivery
    delivery = OrderDelivery(
        order_id=order.id,
        amount=amount,
        delivered_by=delivered_by
    )
    db.session.add(delivery)
    
    db.session.commit()
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'ORDER_UPDATED'})
    return jsonify({'success': True, 'order': order.to_dict()})

@admin_bp.route('/batches/<string:batch_id>', methods=['PUT'])
@admin_bp.route('/batches/<string:batch_id>/status', methods=['PUT'])
def update_batch(batch_id):
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 401

    batch = Batch.query.get_or_404(batch_id)
    data = request.json or {}

    if 'status' in data:
        batch.status = data['status']

    if 'bagWeight' in data:
        new_weight = float(data['bagWeight'])
        if new_weight <= 0:
            return jsonify({'success': False, 'message': 'Geçerli bir mikser kapasitesi girin.'}), 400
        batch.bag_weight = new_weight

    db.session.commit()
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'ORDER_UPDATED'})
    return jsonify({'success': True, 'batch': batch.to_dict()})


@admin_bp.route('/batches/<string:batch_id>', methods=['DELETE'])
@require_permission('can_manage_orders')
def delete_batch(batch_id):
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'message': 'İş emri bulunamadı.'}), 404
    order = batch.order
    if order:
        current_user = get_authenticated_user()
        username = current_user.name if current_user else 'Sistem'
        order.is_active = False
        order.deleted_at = datetime.now(timezone.utc)
        order.deleted_by = username
        db.session.commit()
        from backend.services.websocket_notifier import notify_websocket
        notify_websocket({'type': 'ORDER_UPDATED'})
        return jsonify({'success': True, 'message': 'Sipariş çöp kutusuna taşındı.'})
    else:
        db.session.delete(batch)
        db.session.commit()
        from backend.services.websocket_notifier import notify_websocket
        notify_websocket({'type': 'ORDER_UPDATED'})
        return jsonify({'success': True, 'message': 'İş emri silindi.'})

@admin_bp.route('/recipes/<int:recipe_id>/restore', methods=['POST'])
@require_permission('can_manage_recipes')
def restore_deleted_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    recipe.is_active = True
    recipe.deleted_at = None
    recipe.deleted_by = None
    db.session.commit()
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'SETTINGS_UPDATED'})
    return jsonify({'success': True, 'message': 'Reçete geri yüklendi.'})

@admin_bp.route('/orders/<int:order_id>/restore', methods=['POST'])
@require_permission('can_manage_orders')
def restore_deleted_order(order_id):
    order = Order.query.get_or_404(order_id)
    order.is_active = True
    order.deleted_at = None
    order.deleted_by = None
    db.session.commit()
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'ORDER_UPDATED'})
    return jsonify({'success': True, 'message': 'Sipariş geri yüklendi.'})

@admin_bp.route('/batches/<string:batch_id>/extra_items', methods=['PUT'])
def update_batch_extra_items(batch_id):
    import json
    from backend.models import Transaction, Firm
    
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'message': 'İş emri bulunamadı.'}), 404
        
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'Geçersiz veri.'}), 400
        
    if 'extraItems' in data:
        batch.extra_items = json.dumps(data['extraItems'])
    if 'payments' in data:
        batch.payments = json.dumps(data['payments'])
        
        # Handle transactions
        order = batch.order
        if order:
            firm = Firm.query.filter_by(name=order.customer_name).first()
            if firm:
                firm_id = firm.id
                
                # Delete old transactions for this batch
                old_txs = Transaction.query.filter(
                    Transaction.firm_id == firm_id,
                    Transaction.description.like(f"%Parti {batch_id}%")
                ).all()
                for tx in old_txs:
                    db.session.delete(tx)
                    
                # Create new transactions
                for payment in data['payments']:
                    amt = float(payment.get('amount', 0))
                    method = payment.get('method', 'Nakit')
                    if amt > 0:
                        tx = Transaction(
                            firm_id=firm_id,
                            type='TAHSİLAT',
                            amount=amt,
                            description=f"Fiş Tahsilatı - Parti {batch_id} - {method}"
                        )
                        db.session.add(tx)
                        
                # We must recalculate firm balance!
                db.session.commit()
                
                # Recalculate firm balance
                firm_obj = Firm.query.get(firm_id)
                if firm_obj:
                    all_txs = Transaction.query.filter_by(firm_id=firm_id).all()
                    new_balance = sum([t.amount if t.type == 'BORÇ' else -t.amount for t in all_txs])
                    firm_obj.balance = new_balance
                    db.session.commit()
    else:
        db.session.commit()
    
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'ORDER_UPDATED'})
    
    return jsonify({'success': True, 'batch': batch.to_dict()})

@admin_bp.route('/system-logs', methods=['GET'])
@require_permission('can_view_reports')
def get_system_logs():
    from backend.models import SystemLog
    # Get last 100 logs
    logs = SystemLog.query.order_by(SystemLog.timestamp.desc()).limit(100).all()
    return jsonify({'success': True, 'logs': [l.to_dict() for l in logs]})

# --- SCALE MANAGEMENT ---
@admin_bp.route('/scales', methods=['GET'])
def get_scales():
    scales = Scale.query.all()
    return jsonify({'success': True, 'scales': [s.to_dict() for s in scales]})

@admin_bp.route('/scales', methods=['POST'])
def add_scale():
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Sadece Birincil Yönetici tartı ekleyebilir!'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    connection_type = data.get('connection_type', 'sta').strip()
    ip_address = data.get('ip_address', '').strip()
    port = data.get('port')
    baud_rate = data.get('baud_rate')
    data_format = data.get('data_format', 'densi').strip()
    wifi_ssid = data.get('wifi_ssid', '').strip()
    wifi_password = data.get('wifi_password', '').strip()
    com_port = data.get('com_port', '').strip()
    
    regex_template = data.get('regex_template', r'([+-]?\s*\d+\.\d+)').strip()
    terminator = data.get('terminator', r'\n').strip()
    communication_mode = data.get('communication_mode', 'continuous').strip()
    request_command = data.get('request_command', '').strip()


    if not name:
        return jsonify({'success': False, 'message': 'Cihaz adı boş olamaz!'}), 400
    if Scale.query.filter_by(name=name).first():
        return jsonify({'success': False, 'message': 'Bu isimde bir cihaz zaten var!'}), 400
        
    try:
        if port: port = int(port)
        else: port = 8899
        if baud_rate: baud_rate = int(baud_rate)
        else: baud_rate = 9600
    except ValueError:
        return jsonify({'success': False, 'message': 'Port veya Baud Rate geçersiz!'}), 400

    new_scale = Scale(
        name=name, connection_type=connection_type, ip_address=ip_address,
        port=port, baud_rate=baud_rate, data_format=data_format,
        wifi_ssid=wifi_ssid, wifi_password=wifi_password, com_port=com_port,
        regex_template=regex_template, terminator=terminator,
        communication_mode=communication_mode, request_command=request_command
    )
    db.session.add(new_scale)
    db.session.commit()
    return jsonify({'success': True, 'scale': new_scale.to_dict()})

@admin_bp.route('/scales/<int:scale_id>', methods=['DELETE'])
def delete_scale(scale_id):
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Sadece Birincil Yönetici tartı silebilir!'}), 403

    scale = Scale.query.get_or_404(scale_id)
    db.session.delete(scale)
    db.session.commit()
    return jsonify({'success': True})



@admin_bp.route('/settings/global-prices-advanced', methods=['POST'])
@require_permission('can_manage_recipes')
def update_global_prices_advanced():
    data = request.json
    price_changes = data.get('price_changes', {})
    selected_recipe_ids = data.get('selected_recipe_ids', [])
    override_custom = data.get('override_custom', False)
    
    if not price_changes:
        return jsonify({'success': False, 'message': 'Değişiklik yok.'}), 400
        
    from backend.models import SystemSetting, Recipe
    import json
    
    # Get current global prices
    setting = SystemSetting.query.filter_by(key='ingredient_prices').first()
    global_prices = {}
    if setting and setting.value:
        try:
            global_prices = json.loads(setting.value)
        except:
            pass
            
    # Iterate through all recipes
    all_recipes = Recipe.query.all()
    
    for recipe in all_recipes:
        for item in recipe.items:
            if item.name in price_changes:
                new_price = price_changes[item.name]
                old_global_price = global_prices.get(item.name, 0.0)
                
                is_selected = recipe.id in selected_recipe_ids
                
                if is_selected:
                    if override_custom:
                        # Override everything, make it follow global price
                        item.unit_price = None
                    else:
                        # Don't touch if it already has a custom price that isn't the old global price
                        if item.unit_price is not None and abs(item.unit_price - old_global_price) > 0.001:
                            pass # Keep custom price
                        else:
                            # It was following global price, keep following it (by making sure it's null)
                            item.unit_price = None
                else:
                    # Recipe is NOT selected. We must freeze it at the old price so it doesn't get updated.
                    if item.unit_price is None or abs(item.unit_price - old_global_price) <= 0.001:
                        # It was using global price. Freeze it!
                        item.unit_price = old_global_price

    old_global_prices = dict(global_prices) # Copy before changes
    
    # Finally update global prices setting
    for k, v in price_changes.items():
        global_prices[k] = v
        
    from backend.models import AuditLog
    from backend.utils import get_authenticated_user
    current_user = get_authenticated_user()
    username = current_user.name if current_user else 'Sistem'
        
    if not setting:
        setting = SystemSetting(key='ingredient_prices', value=json.dumps(global_prices))
        db.session.add(setting)
        
        log_entry = AuditLog(
            user=username,
            entity_type='SystemSetting',
            entity_id='ingredient_prices',
            action='CREATE',
            old_value=None,
            new_value=json.dumps(global_prices, ensure_ascii=False),
            description="Genel fiyat ayarları oluşturuldu."
        )
        db.session.add(log_entry)
    else:
        old_val = setting.value
        setting.value = json.dumps(global_prices)
        
        log_entry = AuditLog(
            user=username,
            entity_type='SystemSetting',
            entity_id='ingredient_prices',
            action='UPDATE',
            old_value=old_val,
            new_value=setting.value,
            description="Genel fiyatlar güncellendi."
        )
        db.session.add(log_entry)
        
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Gelişmiş fiyat güncellemesi başarıyla tamamlandı.'})


@admin_bp.route('/transactions', methods=['GET'])
@require_permission('can_view_reports')
def get_transactions():
    firm_id = request.args.get('firm_id')
    if firm_id:
        txs = Transaction.query.filter_by(firm_id=firm_id).order_by(Transaction.date.desc()).all()
    else:
        txs = Transaction.query.order_by(Transaction.date.desc()).all()
    return jsonify({'success': True, 'transactions': [t.to_dict() for t in txs]})

@admin_bp.route('/transactions', methods=['POST'])
@require_permission('can_manage_orders')
def create_transaction():
    data = request.json or {}
    firm_id = data.get('firm_id')
    amount = data.get('amount')
    description = data.get('description', '')
    tx_type = data.get('type', 'TAHSİLAT')

    if not firm_id or not amount:
        return jsonify({'success': False, 'message': 'Firma ve tutar zorunludur!'}), 400

    firm = Firm.query.get_or_404(firm_id)
    
    # Create transaction
    tx = Transaction(
        firm_id=firm_id,
        type=tx_type,
        amount=float(amount),
        description=description
    )

    # If it's TAHSİLAT (Payment from customer to us), balance goes down.
    # If it's SATIŞ (Customer owes us), balance goes up. 
    # For a manual POST, usually it's TAHSİLAT.
    if tx_type == 'TAHSİLAT':
        firm.balance -= float(amount)
    elif tx_type == 'SATIŞ':
        firm.balance += float(amount)
    elif tx_type == 'İADE':
        firm.balance -= float(amount)

    db.session.add(tx)
    db.session.commit()

    return jsonify({'success': True, 'message': 'İşlem eklendi.', 'transaction': tx.to_dict(), 'new_balance': firm.balance})

@admin_bp.route('/audit_logs', methods=['GET'])
@require_permission('can_manage_settings')
def get_audit_logs():
    from backend.models import AuditLog
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    return jsonify({'success': True, 'logs': [l.to_dict() for l in logs]})

@admin_bp.route('/audit_logs/<int:log_id>/revert', methods=['POST'])
@require_permission('can_manage_settings')
def revert_audit_log(log_id):
    from backend.models import AuditLog, RecipeItem, SystemSetting
    import json
    
    log = AuditLog.query.get_or_404(log_id)
    if log.is_reverted:
        return jsonify({'success': False, 'message': 'Bu işlem zaten geri alınmış.'}), 400
        
    try:
        old_val_data = json.loads(log.old_value) if log.old_value else None
    except:
        old_val_data = None
        
    if log.entity_type == 'RecipeItem':
        item = RecipeItem.query.get(int(log.entity_id))
        
        if log.action == 'DELETE':
            if not old_val_data:
                return jsonify({'success': False, 'message': 'Geri alınacak eski veri bulunamadı.'}), 400
            
            # Bulunmayan recipeId'yi to_dict'e eklemedik, o yüzden recipe_id'yi bulmamız zor olabilir. 
            # Ancak biz recipeItem'ı sildiğimizde, eski to_dict()'te recipe_id yok. Fakat log description'da recipe name var.
            # Şimdilik UPDATE üzerinden yürütelim. Eğer item yoksa, ekleme yapmak için Recipe objesi lazım.
            pass # TODO: handle delete revert
            
        elif log.action == 'UPDATE':
            if not item:
                return jsonify({'success': False, 'message': 'Kayıt bulunamadı (silinmiş olabilir).'}), 400
            if old_val_data:
                item.name = old_val_data.get('name', item.name)
                item.amount = old_val_data.get('amount', item.amount)
                item.tolerance = old_val_data.get('tolerance', item.tolerance)
                item.unit_price = old_val_data.get('unit_price', item.unit_price)
                item.is_separate = old_val_data.get('is_separate', item.is_separate)
                item.is_not_included = old_val_data.get('is_not_included', item.is_not_included)
                
    elif log.entity_type == 'SystemSetting':
        setting = SystemSetting.query.filter_by(key=log.entity_id).first()
        if log.action == 'UPDATE' or log.action == 'CREATE':
            if not old_val_data and log.action == 'CREATE':
                if setting:
                    db.session.delete(setting)
            else:
                if not setting:
                    # SystemSetting requires key, value
                    setting = SystemSetting(key=log.entity_id, value=log.old_value)
                    db.session.add(setting)
                else:
                    setting.value = log.old_value
                    
    log.is_reverted = True
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'İşlem başarıyla geri alındı.'})

@admin_bp.route('/settings/apply_recipe_order', methods=['POST'])
@require_permission('can_manage_settings')
def apply_recipe_order():
    from backend.models import Setting, Recipe, RecipeArchive, db
    from backend.utils import get_authenticated_user
    import json
    from datetime import datetime
    
    data = request.json or {}
    new_order = data.get('new_order', [])
    mode = data.get('mode', 'none')
    params = data.get('params', {})
    archive_flag = data.get('archive', False)
    
    current_user = get_authenticated_user()
    action_by = current_user.name if current_user else 'Sistem'
    
    # 1. Save global setting first
    setting = Setting.query.filter_by(key='recipe_order').first()
    new_value = '\n'.join(new_order)
    if setting:
        setting.value = new_value
    else:
        setting = Setting(key='recipe_order', value=new_value)
        db.session.add(setting)
    
    if mode == 'none':
        db.session.commit()
        return jsonify({'success': True, 'message': 'Sadece ayar kaydedildi.'})
        
    # 2. Filter recipes
    query = Recipe.query.filter_by(is_active=True)
    if mode == 'all':
        pass # query all
    elif mode == 'date_range':
        start = params.get('start_date')
        end = params.get('end_date')
        if start and end:
            start_dt = datetime.strptime(start, '%Y-%m-%d')
            end_dt = datetime.strptime(end, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(db.or_(
                Recipe.updated_at.between(start_dt, end_dt),
                db.and_(Recipe.updated_at == None, Recipe.created_at.between(start_dt, end_dt))
            ))
    elif mode == 'before_date':
        date_str = params.get('date')
        if date_str:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            query = query.filter(db.or_(
                Recipe.updated_at < dt,
                db.and_(Recipe.updated_at == None, Recipe.created_at < dt)
            ))
    elif mode == 'after_date':
        date_str = params.get('date')
        if date_str:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            query = query.filter(db.or_(
                Recipe.updated_at > dt,
                db.and_(Recipe.updated_at == None, Recipe.created_at > dt)
            ))
    elif mode == 'include_specific':
        ids = params.get('selected_recipe_ids', [])
        query = query.filter(Recipe.id.in_(ids))
    elif mode == 'exclude_specific':
        ids = params.get('selected_recipe_ids', [])
        query = query.filter(~Recipe.id.in_(ids))
        
    recipes = query.all()
    
    # 3. Apply changes and archive if needed
    for recipe in recipes:
        if archive_flag:
            archive = RecipeArchive(
                recipe_id=recipe.id,
                recipe_name=recipe.name,
                archived_by=action_by,
                recipe_data=json.dumps(recipe.to_dict())
            )
            db.session.add(archive)
            
        # Re-sort recipe items
        items = recipe.items
        for item in items:
            try:
                idx = new_order.index(item.ingredient_name)
                item.sort_order = idx
            except ValueError:
                # Not in new order, put at the end
                item.sort_order = len(new_order) + items.index(item)
                
        recipe.updated_at = datetime.utcnow()
        recipe.updated_by = action_by
        
    db.session.commit()
    return jsonify({'success': True, 'message': f'{len(recipes)} reçete güncellendi.'})

# --- Inventory Management Endpoints ---

@admin_bp.route('/inventory', methods=['GET'])
def get_inventory():
    from backend.models import SystemSetting, Inventory, db
    import json
    
    # Get active ingredients list from SystemSetting
    setting = SystemSetting.query.filter_by(key='recipe_order').first()
    active_ingredients = []
    if setting and setting.value:
        active_ingredients = [x.strip() for x in setting.value.split('\n') if x.strip()]
        
    inventory_records = {inv.ingredient_name: inv for inv in Inventory.query.all()}
    
    results = []
    for ing in active_ingredients:
        inv = inventory_records.get(ing)
        if inv:
            results.append(inv.to_dict())
        else:
            results.append({
                'id': None,
                'ingredientName': ing,
                'currentStock': 0.0,
                'warningThreshold': 0.0,
                'updatedAt': None
            })
            
    return jsonify({'success': True, 'inventory': results})

@admin_bp.route('/inventory/<string:ingredient_name>/transaction', methods=['POST'])
def add_inventory_transaction(ingredient_name):
    from backend.models import Inventory, InventoryTransaction, AuditLog, db
    from backend.utils import get_authenticated_user
    import json
    from urllib.parse import unquote
    
    ingredient_name = unquote(ingredient_name)
    data = request.json or {}
    tx_type = data.get('type') # 'IN' or 'OUT'
    amount = float(data.get('amount', 0))
    notes = data.get('notes', '')
    
    if amount <= 0:
        return jsonify({'success': False, 'message': 'Miktar 0\'dan büyük olmalıdır.'}), 400
    if tx_type not in ['IN', 'OUT']:
        return jsonify({'success': False, 'message': 'Geçersiz işlem tipi.'}), 400
        
    inv = Inventory.query.filter_by(ingredient_name=ingredient_name).first()
    if not inv:
        inv = Inventory(ingredient_name=ingredient_name, current_stock=0.0, warning_threshold=0.0)
        db.session.add(inv)
        db.session.flush()
        
    prev_stock = inv.current_stock
    if tx_type == 'IN':
        inv.current_stock += amount
    else:
        inv.current_stock -= amount
        
    new_stock = inv.current_stock
    
    current_user = get_authenticated_user()
    user_name = current_user.name if current_user else 'Sistem'
    
    tx = InventoryTransaction(
        ingredient_name=ingredient_name,
        transaction_type=tx_type,
        amount=amount,
        previous_stock=prev_stock,
        new_stock=new_stock,
        user=user_name,
        notes=notes
    )
    db.session.add(tx)
    
    # Audit log
    action_text = 'Giriş' if tx_type == 'IN' else 'Çıkış'
    log = AuditLog(
        user=user_name,
        entity_type='Inventory',
        entity_id=ingredient_name,
        action='UPDATE',
        old_value=json.dumps({'stock': prev_stock}),
        new_value=json.dumps({'stock': new_stock}),
        description=f"Depo {action_text}: {ingredient_name} ({amount} kg). Yeni stok: {new_stock} kg."
    )
    db.session.add(log)
    db.session.commit()
    
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'INVENTORY_UPDATED'})
    
    return jsonify({'success': True, 'message': f'Depo işlemi başarılı.', 'newStock': new_stock})

@admin_bp.route('/inventory/<string:ingredient_name>/threshold', methods=['PUT'])
def update_inventory_threshold(ingredient_name):
    from backend.models import Inventory, AuditLog, db
    from backend.utils import get_authenticated_user
    import json
    from urllib.parse import unquote
    
    ingredient_name = unquote(ingredient_name)
    data = request.json or {}
    threshold = float(data.get('threshold', 0))
    
    inv = Inventory.query.filter_by(ingredient_name=ingredient_name).first()
    if not inv:
        inv = Inventory(ingredient_name=ingredient_name, current_stock=0.0, warning_threshold=threshold)
        db.session.add(inv)
    else:
        inv.warning_threshold = threshold
        
    current_user = get_authenticated_user()
    user_name = current_user.name if current_user else 'Sistem'
    
    log = AuditLog(
        user=user_name,
        entity_type='Inventory',
        entity_id=ingredient_name,
        action='UPDATE',
        description=f"{ingredient_name} için depo uyarı limiti güncellendi: {threshold} kg."
    )
    db.session.add(log)
    db.session.commit()
    
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'INVENTORY_UPDATED'})
    
    return jsonify({'success': True, 'message': 'Uyarı limiti güncellendi.'})

@admin_bp.route('/inventory/bulk', methods=['POST'])
def add_inventory_bulk():
    from backend.models import Inventory, InventoryTransaction, AuditLog, db
    from backend.utils import get_authenticated_user
    import json
    
    data = request.json or {}
    transactions = data.get('transactions', [])
    
    if not transactions:
        return jsonify({'success': False, 'message': 'İşlem listesi boş.'}), 400
        
    current_user = get_authenticated_user()
    user_name = current_user.name if current_user else 'Sistem'
    
    for tx_data in transactions:
        ing_name = tx_data.get('ingredient_name')
        tx_type = tx_data.get('type')
        amount = float(tx_data.get('amount', 0))
        notes = tx_data.get('notes', '')
        
        if amount <= 0 or tx_type not in ['IN', 'OUT']:
            continue
            
        inv = Inventory.query.filter_by(ingredient_name=ing_name).first()
        if not inv:
            inv = Inventory(ingredient_name=ing_name, current_stock=0.0, warning_threshold=0.0)
            db.session.add(inv)
            db.session.flush()
            
        prev_stock = inv.current_stock
        if tx_type == 'IN':
            inv.current_stock += amount
        else:
            inv.current_stock -= amount
            
        new_stock = inv.current_stock
        
        tx = InventoryTransaction(
            ingredient_name=ing_name,
            transaction_type=tx_type,
            amount=amount,
            previous_stock=prev_stock,
            new_stock=new_stock,
            user=user_name,
            notes=notes
        )
        db.session.add(tx)
        
    log = AuditLog(
        user=user_name,
        entity_type='Inventory',
        entity_id='Bulk',
        action='UPDATE',
        description=f"Toplu depo işlemi yapıldı ({len(transactions)} kalem)."
    )
    db.session.add(log)
    db.session.commit()
    
    from backend.services.websocket_notifier import notify_websocket
    notify_websocket({'type': 'INVENTORY_UPDATED'})
    
    return jsonify({'success': True, 'message': 'Toplu depo işlemi başarılı.'})
