from datetime import datetime, timezone
from .extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'admin', 'manager', 'secretary', 'operator'
    password = db.Column(db.String(100), nullable=False)
    
    can_manage_recipes = db.Column(db.Boolean, default=True)
    can_manage_customers = db.Column(db.Boolean, default=True)
    can_manage_orders = db.Column(db.Boolean, default=True)
    can_manage_users = db.Column(db.Boolean, default=True)
    can_view_reports = db.Column(db.Boolean, default=True)
    can_view_sales = db.Column(db.Boolean, default=True)
    can_view_dashboard = db.Column(db.Boolean, default=True)
    can_view_traceability = db.Column(db.Boolean, default=True)
    can_view_accounting = db.Column(db.Boolean, default=True)
    can_view_current_accounts = db.Column(db.Boolean, default=True)
    can_manage_settings = db.Column(db.Boolean, default=False)
    api_token = db.Column(db.String(100), unique=True, nullable=True)
    
    # Operator specific permissions
    op_can_see_color = db.Column(db.Boolean, default=False)
    op_can_see_garlic = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.name,
            'role': self.role,
            'pass': self.password,
            'canManageRecipes': self.can_manage_recipes,
            'canManageCustomers': self.can_manage_customers,
            'canManageOrders': self.can_manage_orders,
            'canManageUsers': self.can_manage_users,
            'canViewReports': self.can_view_reports,
            'canViewSales': self.can_view_sales,
            'canViewDashboard': self.can_view_dashboard,
            'canViewTraceability': self.can_view_traceability,
            'canViewAccounting': self.can_view_accounting,
            'canViewCurrentAccounts': self.can_view_current_accounts,
            'canManageSettings': self.can_manage_settings,
            'opCanSeeColor': getattr(self, 'op_can_see_color', True),
            'opCanSeeGarlic': getattr(self, 'op_can_see_garlic', True),
            'api_token': self.api_token
        }

class SystemSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False) # Store JSON string for complex settings

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value
        }

class Firm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    tax_id = db.Column(db.String(50), nullable=True)
    contact_person = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    balance = db.Column(db.Float, default=0.0)
    
    #firma oluşturma tarihini tutumak için 
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.String(100), nullable=True, default='Sistem')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone or '',
            'email': self.email or '',
            'address': self.address or '',
            'taxId': self.tax_id or '',
            'contactPerson': self.contact_person or '',
            'notes': self.notes or '',
            'balance': self.balance,
            'createdAt': self.created_at.replace(tzinfo=timezone.utc).isoformat() if self.created_at else None,
            'createdBy': self.created_by or 'Sistem',
        }

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    firm_id = db.Column(db.Integer, db.ForeignKey('firm.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    base_amount = db.Column(db.Float, default=1.0)
    price_per_kg = db.Column(db.Float, default=150.0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.String(100), nullable=True, default='Sistem')
    hide_separate_colors = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    is_custom_kg_based = db.Column(db.Boolean, default=False)
    
    firm = db.relationship('Firm', backref=db.backref('recipes', cascade='all, delete-orphan', passive_deletes=True))
    items = db.relationship('RecipeItem', backref='recipe', cascade='all, delete-orphan', order_by='RecipeItem.sort_order')

    def to_dict(self):
        return {
            'id': self.id,
            'firmId': self.firm_id,
            'name': self.name,
            'baseAmount': self.base_amount,
            'pricePerKg': self.price_per_kg,
            'createdAt': self.created_at.replace(tzinfo=timezone.utc).isoformat() if self.created_at else None,
            'createdBy': self.created_by or 'Sistem',
            'hideSeparateColors': self.hide_separate_colors,
            'isActive': self.is_active if self.is_active is not None else True,
            'isCustomKgBased': getattr(self, 'is_custom_kg_based', False),
            'items': [item.to_dict() for item in self.items]
        }

class RecipeItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    tolerance = db.Column(db.Float, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    unit_price = db.Column(db.Float, nullable=True)
    is_separate = db.Column(db.Boolean, default=False)
    is_not_included = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'amount': self.amount,
            'tolerance': self.tolerance,
            'sort_order': self.sort_order,
            'unit_price': self.unit_price,
            'is_separate': self.is_separate,
            'is_not_included': getattr(self, 'is_not_included', False)
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(200), nullable=False)
    recipe_name = db.Column(db.String(200), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    bag_weight = db.Column(db.Float, nullable=True, default=20.0)
    packaging_segments = db.Column(db.Text, nullable=True)
    delivery_date = db.Column(db.String(50), nullable=True)
    urgency = db.Column(db.String(20), default='normal')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.String(100), nullable=True, default='Sistem')
    notes = db.Column(db.Text, nullable=True)
    
    batches = db.relationship('Batch', backref='order', cascade='all, delete-orphan')

    def to_dict(self):
        firm = Firm.query.filter_by(name=self.customer_name).first()
        recipe_query = None
        if firm:
            recipe_query = Recipe.query.filter_by(name=self.recipe_name, firm_id=firm.id).first()
        if not recipe_query:
            recipe_query = Recipe.query.filter_by(name=self.recipe_name).first()

            
        items_dict = [i.to_dict() for i in recipe_query.items] if recipe_query else []

        import json
        packaging_segments = []
        if self.packaging_segments:
            try:
                packaging_segments = json.loads(self.packaging_segments)
            except (json.JSONDecodeError, TypeError):
                packaging_segments = []
        
        return {
            'id': self.id,
            'customer': self.customer_name,
            'recipeName': self.recipe_name,
            'recipeItems': items_dict,
            'isCustomKgBased': getattr(recipe_query, 'is_custom_kg_based', False) if recipe_query else False,
            'totalAmount': self.total_amount,
            'bagWeight': self.bag_weight or 20.0,
            'packagingSegments': packaging_segments,
            'deliveryDate': self.delivery_date or '',
            'urgency': self.urgency or 'normal',
            'createdAt': self.created_at.replace(tzinfo=timezone.utc).isoformat() if self.created_at else None,
            'createdBy': self.created_by or 'Sistem',
            'notes': self.notes or '',
            'batches': [b.to_dict() for b in self.batches]
        }

class Batch(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id', ondelete='CASCADE'), nullable=False)
    no = db.Column(db.Integer, nullable=False)
    total_batches = db.Column(db.Integer, nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='beklemede')
    operator = db.Column(db.String(100), nullable=True)
    extra_items = db.Column(db.Text, nullable=True)
    payments = db.Column(db.Text, nullable=True)
    bag_weight = db.Column(db.Float, nullable=True)

    def to_dict(self):
        effective_bag_weight = self.bag_weight if self.bag_weight else (self.order.bag_weight if self.order else 20.0)
        return {
            'id': self.id,
            'no': self.no,
            'totalBatches': self.total_batches,
            'targetAmount': self.target_amount,
            'status': self.status,
            'operator': self.operator,
            'orderId': self.order_id,
            'bagWeight': effective_bag_weight or 20.0,
            'extraItems': self.extra_items,
            'payments': self.payments
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
    status = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'batchId': self.batch_id,
            'operator': self.operator,
            'customer': self.customer,
            'recipe': self.recipe,
            'item': self.item,
            'target': self.target,
            'actual': self.actual,
            'status': self.status,
            'timestamp': self.timestamp.replace(tzinfo=timezone.utc).isoformat() if self.timestamp else ''
        }

class Scale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    connection_type = db.Column(db.String(50), nullable=False, default='sta') # 'wired', 'ap', 'sta'
    ip_address = db.Column(db.String(50), nullable=True)
    port = db.Column(db.Integer, default=8899)
    baud_rate = db.Column(db.Integer, default=9600)
    data_format = db.Column(db.String(50), default='densi')
    wifi_ssid = db.Column(db.String(100), nullable=True)
    wifi_password = db.Column(db.String(100), nullable=True)
    com_port = db.Column(db.String(50), nullable=True)
    regex_template = db.Column(db.String(255), default=r'([+-]?\s*\d+\.\d+)')
    terminator = db.Column(db.String(10), default=r'\n')
    communication_mode = db.Column(db.String(50), default='continuous')
    request_command = db.Column(db.String(50), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'connection_type': self.connection_type,
            'ip_address': self.ip_address,
            'port': self.port,
            'baud_rate': self.baud_rate,
            'data_format': self.data_format,
            'wifi_ssid': self.wifi_ssid,
            'wifi_password': self.wifi_password,
            'com_port': self.com_port,
            'regex_template': self.regex_template,
            'terminator': self.terminator,
            'communication_mode': self.communication_mode,
            'request_command': self.request_command
        }

class SystemLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.Column(db.String(100))
    action = db.Column(db.String(255))
    details = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.replace(tzinfo=timezone.utc).isoformat() if self.timestamp else None,
            'user': self.user,
            'action': self.action,
            'details': self.details
        }

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    firm_id = db.Column(db.Integer, db.ForeignKey('firm.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    type = db.Column(db.String(50), nullable=False) # 'SATIŞ', 'TAHSİLAT', 'İADE'
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    batch_id = db.Column(db.String(100), nullable=True)

    firm = db.relationship('Firm', backref=db.backref('transactions', cascade='all, delete-orphan', passive_deletes=True))

    def to_dict(self):
        return {
            'id': self.id,
            'firmId': self.firm_id,
            'date': self.date.replace(tzinfo=timezone.utc).isoformat() if self.date else None,
            'type': self.type,
            'amount': self.amount,
            'description': self.description or '',
            'batchId': self.batch_id or ''
        }

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    user = db.Column(db.String(100), nullable=True, default='Sistem')
    entity_type = db.Column(db.String(50), nullable=False) # e.g., 'RecipeItem', 'SystemSetting'
    entity_id = db.Column(db.String(100), nullable=False) # String since setting keys are strings
    action = db.Column(db.String(50), nullable=False) # 'UPDATE', 'DELETE', 'CREATE'
    old_value = db.Column(db.Text, nullable=True) # JSON string
    new_value = db.Column(db.Text, nullable=True) # JSON string
    description = db.Column(db.String(255), nullable=True) # User friendly description
    is_reverted = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.replace(tzinfo=timezone.utc).isoformat() if self.timestamp else None,
            'user': self.user,
            'entityType': self.entity_type,
            'entityId': self.entity_id,
            'action': self.action,
            'oldValue': self.old_value,
            'newValue': self.new_value,
            'description': self.description or '',
            'isReverted': self.is_reverted
        }
