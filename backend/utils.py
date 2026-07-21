from functools import wraps
from flask import session, jsonify, request
from backend.models import User

def get_authenticated_user():
    # Check session first
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return user
            
    # Check Bearer token
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = User.query.filter_by(api_token=token).first()
        if user:
            return user
            
    return None

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return jsonify({'success': False, 'message': 'Giriş yapılmadı veya geçersiz API Token!'}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_permission(permission_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_authenticated_user()
            if not user:
                return jsonify({'success': False, 'message': 'Giriş yapılmadı veya geçersiz API Token!'}), 401
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
        user = get_authenticated_user()
        if not user:
            return jsonify({'success': False, 'message': 'Giriş yapılmadı veya geçersiz API Token!'}), 401
        if user.role != 'admin':
            return jsonify({'success': False, 'message': 'Bu işlem sadece birincil yönetici tarafından yapılabilir!'}), 403
        return f(*args, **kwargs)
    return decorated_function
