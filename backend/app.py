from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
from datetime import timedelta
import pkgutil
import importlib.util

# В новых версиях Python метод pkgutil.get_loader может отсутствовать.
# Flask (в некоторых версиях) ожидает его наличие при определении путей пакетов.
# Добавляем безопасный полифилл, чтобы избежать AttributeError на новых интерпретаторах.
if not hasattr(pkgutil, 'get_loader'):
    def _get_loader(name):
        try:
            # importlib.util.find_spec может бросать ValueError если
            # вызывается для __main__ без указанного __spec__ при запуске
            # как скрипт. Ловим исключения и возвращаем None в таких случаях.
            spec = importlib.util.find_spec(name)
        except Exception:
            return None
        return spec.loader if spec is not None else None
    pkgutil.get_loader = _get_loader

app = Flask(__name__)
CORS(app)

# Конфигурация
app.config['JWT_SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

jwt = JWTManager(app)

# Инициализация БД
DB_PATH = 'food_delivery.db'

def init_db():
    """Инициализация базы данных"""
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Таблица пользователей
        c.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица меню
        c.execute('''
            CREATE TABLE menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category TEXT NOT NULL,
                image TEXT,
                available BOOLEAN DEFAULT 1
            )
        ''')
        
        # Таблица заказов
        c.execute('''
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_price REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        # Таблица товаров в заказе
        c.execute('''
            CREATE TABLE order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                menu_item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
            )
        ''')
        
        # Добавляем примеры меню
        menu_data = [
            ('Пицца Маргарита', 'Классическая пицца с помидорами и моцареллой', 499, 'Пиццы', 'pizza-margherita.jpg'),
            ('Бургер Классический', 'Сочный бургер с говядиной и свежими овощами', 349, 'Бургеры', 'burger-classic.jpg'),
            ('Цезарь с курицей', 'Салат с курицей и сухариками', 299, 'Салаты', 'caesar-chicken.jpg'),
            ('Суши сет', 'Ассортимент суши из свежей рыбы', 799, 'Суши', 'sushi-set.jpg'),
            ('Паста Болоньезе', 'Паста с мясным соусом', 399, 'Пасты', 'pasta-bolognese.jpg'),
            ('Фраппучино', 'Холодный кофейный напиток', 199, 'Напитки', 'frappuccino.jpg'),
        ]
        
        c.executemany(
            'INSERT INTO menu_items (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)',
            menu_data
        )
        
        conn.commit()
        conn.close()

def get_db():
    """Получить подключение к БД"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ==================== AUTH ENDPOINTS ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Регистрация пользователя"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    phone = data.get('phone', '')
    address = data.get('address', '')
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    try:
        conn = get_db()
        c = conn.cursor()
        hashed_password = generate_password_hash(password)
        
        c.execute(
            'INSERT INTO users (email, password, name, phone, address) VALUES (?, ?, ?, ?, ?)',
            (email, hashed_password, name, phone, address)
        )
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        
        access_token = create_access_token(identity=user_id)
        return jsonify({
            'message': 'User registered successfully',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': email,
                'name': name
            }
        }), 201
    
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Вход пользователя"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, password, name FROM users WHERE email = ?', (email,))
        user = c.fetchone()
        conn.close()
        
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        access_token = create_access_token(identity=user['id'])
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': user['id'],
                'email': email,
                'name': user['name']
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Получить профиль текущего пользователя"""
    user_id = get_jwt_identity()
    
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, email, name, phone, address FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'phone': user['phone'],
                'address': user['address']
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Обновить профиль пользователя"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute(
            'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
            (data.get('name'), data.get('phone'), data.get('address'), user_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Profile updated successfully'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== MENU ENDPOINTS ====================

@app.route('/api/menu', methods=['GET'])
def get_menu():
    """Получить весь список меню"""
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM menu_items WHERE available = 1')
        items = c.fetchall()
        conn.close()
        
        menu = [dict(item) for item in items]
        return jsonify({'items': menu}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/menu/<int:item_id>', methods=['GET'])
def get_menu_item(item_id):
    """Получить конкретный товар из меню"""
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM menu_items WHERE id = ?', (item_id,))
        item = c.fetchone()
        conn.close()
        
        if not item:
            return jsonify({'error': 'Item not found'}), 404
        
        return jsonify({'item': dict(item)}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ORDER ENDPOINTS ====================

@app.route('/api/orders', methods=['POST'])
@jwt_required()
def create_order():
    """Создать новый заказ"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('items'):
        return jsonify({'error': 'Missing items'}), 400
    
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Вычисляем общую сумму
        total_price = 0
        items_to_add = []
        
        for item in data.get('items', []):
            item_id = item.get('id')
            quantity = item.get('quantity', 1)
            
            c.execute('SELECT price FROM menu_items WHERE id = ?', (item_id,))
            menu_item = c.fetchone()
            
            if not menu_item:
                return jsonify({'error': f'Item {item_id} not found'}), 404
            
            item_price = menu_item['price'] * quantity
            total_price += item_price
            items_to_add.append((item_id, quantity, menu_item['price']))
        
        # Создаем заказ
        c.execute(
            'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)',
            (user_id, total_price, 'pending')
        )
        order_id = c.lastrowid
        
        # Добавляем товары в заказ
        for item_id, quantity, price in items_to_add:
            c.execute(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
                (order_id, item_id, quantity, price)
            )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Order created successfully',
            'order_id': order_id,
            'total_price': total_price
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_user_orders():
    """Получить заказы текущего пользователя"""
    user_id = get_jwt_identity()
    
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
        orders = c.fetchall()
        conn.close()
        
        orders_list = []
        for order in orders:
            conn = get_db()
            c = conn.cursor()
            c.execute('''
                SELECT oi.*, mi.name, mi.image 
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = ?
            ''', (order['id'],))
            items = c.fetchall()
            conn.close()
            
            orders_list.append({
                'id': order['id'],
                'total_price': order['total_price'],
                'status': order['status'],
                'created_at': order['created_at'],
                'items': [dict(item) for item in items]
            })
        
        return jsonify({'orders': orders_list}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Server error'}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
