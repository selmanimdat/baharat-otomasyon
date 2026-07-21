from flask import Blueprint, request, jsonify, session
from backend.models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/status', methods=['GET'])
def auth_status():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({'authenticated': True, 'user': user.to_dict()})
    return jsonify({'authenticated': False})

@auth_bp.route('/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', '')

    if role == 'admin':
        user = User.query.filter(User.name == username, User.role.in_(['admin', 'manager', 'secretary'])).first()
    else:
        user = User.query.filter(User.name.collate('NOCASE') == username, User.role == 'operator').first()

    if user and user.password == password:
        import secrets
        from backend.extensions import db
        if not user.api_token:
            user.api_token = secrets.token_hex(32)
            db.session.commit()
            
        session['user_id'] = user.id
        return jsonify({'success': True, 'user': user.to_dict()})
    
    return jsonify({'success': False, 'message': 'Hatalı Kullanıcı Adı veya Şifre!'}), 401

@auth_bp.route('/logout', methods=['POST'])
def auth_logout():
    session.pop('user_id', None)
    return jsonify({'success': True})
