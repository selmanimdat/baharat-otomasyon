import json
import socket
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_file
from io import BytesIO

from backend.extensions import db
from backend.models import User, Scale, Firm, Recipe, RecipeItem, Order, Batch, WeighingLog, SystemSetting
from backend.utils import require_admin, require_auth
# We'll import seed_database locally in reset to avoid circular dependency if needed

system_bp = Blueprint('system', __name__)

@system_bp.route('/db', methods=['GET'])
@require_auth
def get_entire_db():
    users = User.query.all()
    scales = Scale.query.all()
    firms = Firm.query.all()
    recipes = Recipe.query.all()
    orders = Order.query.all()
    logs = WeighingLog.query.order_by(WeighingLog.timestamp.desc()).all()
    settings = SystemSetting.query.all()

    return jsonify({
        'users': [u.to_dict() for u in users],
        'scales': [s.to_dict() for s in scales],
        'firms': [f.to_dict() for f in firms],
        'recipes': [r.to_dict() for r in recipes],
        'orders': [o.to_dict() for o in orders],
        'logs': [l.to_dict() for l in logs],
        'settings': [s.to_dict() for s in settings]
    })

@system_bp.route('/export', methods=['GET'])
@require_admin
def export_db():
    users = User.query.all()
    scales = Scale.query.all()
    firms = Firm.query.all()
    recipes = Recipe.query.all()
    orders = Order.query.all()
    logs = WeighingLog.query.order_by(WeighingLog.timestamp.desc()).all()

    db_json = {
        'users': [u.to_dict() for u in users],
        'scales': [s.to_dict() for s in scales],
        'firms': [f.to_dict() for f in firms],
        'recipes': [r.to_dict() for r in recipes],
        'orders': [o.to_dict() for o in orders],
        'logs': [l.to_dict() for l in logs]
    }
    
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

@system_bp.route('/import', methods=['POST'])
@require_admin
def import_db():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Dosya bulunamadı!'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Dosya seçilmedi!'}), 400
        
    try:
        data = json.load(file)
        if 'users' not in data or 'recipes' not in data or 'firms' not in data:
            return jsonify({'success': False, 'message': 'Geçersiz dosya formatı!'}), 400
            
        db.session.query(WeighingLog).delete()
        db.session.query(Batch).delete()
        db.session.query(Order).delete()
        db.session.query(RecipeItem).delete()
        db.session.query(Recipe).delete()
        db.session.query(Firm).delete()
        db.session.query(Scale).delete()
        db.session.query(User).delete()
        db.session.commit()
        
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
                can_view_reports=u.get('canViewReports', True),
                can_view_sales=u.get('canViewSales', True)
            ))
            
        for s in data.get('scales', []):
            db.session.add(Scale(id=s.get('id'), name=s.get('name'), ip=s.get('ip'), port=s.get('port'), status=s.get('status', True), is_simulator=s.get('is_simulator', False)))
            
        for f in data.get('firms', []):
            db.session.add(Firm(id=f.get('id'), name=f.get('name')))
        db.session.commit()
        
        for r in data.get('recipes', []):
            recipe = Recipe(id=r.get('id'), firm_id=r.get('firmId'), name=r.get('name'), base_amount=r.get('baseAmount', 1.0), price_per_kg=r.get('pricePerKg', 150.0))
            db.session.add(recipe)
            for item in r.get('items', []):
                db.session.add(RecipeItem(id=item.get('id'), recipe_id=recipe.id, name=item.get('name'), amount=item.get('amount'), tolerance=item.get('tolerance')))
                
        for o in data.get('orders', []):
            order = Order(id=o.get('id'), customer_name=o.get('customer'), recipe_name=o.get('recipeName'), total_amount=o.get('totalAmount'), bag_weight=o.get('bagWeight', 20.0))
            db.session.add(order)
            for b in o.get('batches', []):
                db.session.add(Batch(id=b.get('id'), order_id=order.id, no=b.get('no'), total_batches=b.get('totalBatches'), target_amount=b.get('targetAmount'), status=b.get('status'), operator=b.get('operator')))
                
        for l in data.get('logs', []):
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

@system_bp.route('/reset', methods=['POST'])
@require_admin
def reset_db():
    try:
        db.session.query(WeighingLog).delete()
        db.session.query(Batch).delete()
        db.session.query(Order).delete()
        db.session.query(RecipeItem).delete()
        db.session.query(Recipe).delete()
        db.session.query(Firm).delete()
        db.session.query(Scale).delete()
        db.session.query(User).delete()
        db.session.commit()
        
        from backend.seed import seed_database
        seed_database()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Sıfırlama Hatası: {str(e)}'}), 500
