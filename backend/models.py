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
    can_manage_scales = db.Column(db.Boolean, default=True)
    can_view_reports = db.Column(db.Boolean, default=True)
    can_view_sales = db.Column(db.Boolean, default=True)
    api_token = db.Column(db.String(100), unique=True, nullable=True)

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
            'canManageScales': self.can_manage_scales,
            'canViewReports': self.can_view_reports,
            'canViewSales': self.can_view_sales,
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

class Scale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ip = db.Column(db.String(50), nullable=False)
    port = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Boolean, default=True)
    is_simulator = db.Column(db.Boolean, default=False)
    connection_type = db.Column(db.String(50), default='wired')
    data_format = db.Column(db.String(50), default='densi')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ip': self.ip,
            'port': self.port,
            'status': self.status,
            'is_simulator': self.is_simulator,
            'connection_type': self.connection_type,
            'data_format': self.data_format
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

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone or '',
            'email': self.email or '',
            'address': self.address or '',
            'taxId': self.tax_id or '',
            'contactPerson': self.contact_person or '',
            'notes': self.notes or ''
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
    id = db.Column(db.String(100), primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id', ondelete='CASCADE'), nullable=False)
    no = db.Column(db.Integer, nullable=False)
    total_batches = db.Column(db.Integer, nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='beklemede')
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
            'timestamp': self.timestamp.isoformat() if self.timestamp else ''
        }
