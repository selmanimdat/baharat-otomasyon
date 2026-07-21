from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from backend.extensions import db
from backend.models import Batch, WeighingLog

operator_bp = Blueprint('operator', __name__)

@operator_bp.route('/batches/<string:batch_id>/start', methods=['POST'])
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

@operator_bp.route('/batches/<string:batch_id>/finish', methods=['POST'])
def finish_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    batch.status = 'fiş kesilmedi'
    db.session.commit()
    return jsonify({'success': True, 'batch': batch.to_dict()})

@operator_bp.route('/batches/<string:batch_id>/status', methods=['PUT'])
def update_batch_status(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.json or {}
    new_status = data.get('status')
    operator_name = data.get('operator')
    
    if new_status:
        batch.status = new_status
        if operator_name:
            batch.operator = operator_name
        db.session.commit()
        return jsonify({'success': True, 'message': 'Parti durumu güncellendi.', 'batch': batch.to_dict()})
    return jsonify({'success': False, 'message': 'Status is required'}), 400

@operator_bp.route('/batches/<string:batch_id>/logs', methods=['GET'])
def get_batch_logs(batch_id):
    batch = Batch.query.get(batch_id)
    logs = WeighingLog.query.filter_by(batch_id=batch_id).all()
    return jsonify({
        'success': True,
        'logs': [l.to_dict() for l in logs],
        'batch': batch.to_dict() if batch else None
    })

@operator_bp.route('/batches/<string:batch_id>/logs/undo', methods=['POST'])
def undo_batch_log(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.json or {}
    item_name = data.get('item', '').strip()
    
    if not item_name:
        return jsonify({'success': False, 'message': 'Hammadde adı gerekli!'}), 400
        
    # Delete weighing logs for this item
    WeighingLog.query.filter_by(batch_id=batch_id, item=item_name).delete()
    
    # Revert batch status to 'tartımda' if it moved forward or was completed
    if batch.status in ['mikserde', 'paketlemede', 'fiş kesilmedi', 'tamamlandı', 'Tamamlandı']:
        batch.status = 'tartımda'
        
    db.session.commit()
    return jsonify({'success': True, 'message': f'{item_name} tartım onayı geri alındı.', 'batch': batch.to_dict()})

@operator_bp.route('/logs/undo', methods=['POST'])
def undo_log_generic():
    data = request.json or {}
    batch_id = data.get('batchId')
    item_name = data.get('item', '').strip()
    if not batch_id or not item_name:
        return jsonify({'success': False, 'message': 'Eksik bilgi!'}), 400
    
    batch = Batch.query.get(batch_id)
    WeighingLog.query.filter_by(batch_id=batch_id, item=item_name).delete()
    if batch and batch.status in ['mikserde', 'paketlemede', 'fiş kesilmedi', 'tamamlandı', 'Tamamlandı']:
        batch.status = 'tartımda'
    db.session.commit()
    return jsonify({'success': True, 'message': 'Geri alındı.'})

@operator_bp.route('/logs', methods=['POST'])
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
    return jsonify({'success': True, 'message': 'Tartım logu kaydedildi.', 'log': log.to_dict()})
