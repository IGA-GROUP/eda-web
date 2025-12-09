// API конфигурация
const API_URL = 'http://localhost:5000/api';
let currentUser = null;
let cart = [];
let currentFilter = 'all';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadMenu();
    setupEventListeners();
});

// ==================== AUTHENTICATION ==================== 

function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        updateUIForLoggedInUser();
    }
}

function updateUIForLoggedInUser() {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userMenu').style.display = 'block';
    document.getElementById('ordersLink').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.name;
}

function updateUIForLoggedOutUser() {
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('ordersLink').style.display = 'none';
    currentUser = null;
    cart = [];
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка входа');
        }
        
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        currentUser = data.user;
        
        closeModal('loginModal');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        errorDiv.classList.remove('show');
        
        updateUIForLoggedInUser();
        showNotification('Успешный вход!');
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    const address = document.getElementById('registerAddress').value;
    const errorDiv = document.getElementById('registerError');
    
    if (password.length < 6) {
        errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
        errorDiv.classList.add('show');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, phone, address })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка регистрации');
        }
        
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        currentUser = data.user;
        
        closeModal('registerModal');
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPhone').value = '';
        document.getElementById('registerAddress').value = '';
        errorDiv.classList.remove('show');
        
        updateUIForLoggedInUser();
        showNotification('Регистрация успешна!');
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    updateUIForLoggedOutUser();
    closeModal('profileModal');
    closeModal('cartModal');
    showNotification('Вы вышли из аккаунта');
}

async function showProfileModal() {
    if (!currentUser) {
        showModal('loginModal');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        const user = data.user;
        document.getElementById('profileName').value = user.name;
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profilePhone').value = user.phone || '';
        document.getElementById('profileAddress').value = user.address || '';
        
        showModal('profileModal');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleUpdateProfile(event) {
    event.preventDefault();
    
    if (!currentUser) return;
    
    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    const address = document.getElementById('profileAddress').value;
    const errorDiv = document.getElementById('profileError');
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ name, phone, address })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        currentUser.name = name;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('userName').textContent = name;
        
        errorDiv.classList.remove('show');
        showNotification('Профиль обновлён');
        closeModal('profileModal');
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

// ==================== MENU ==================== 

async function loadMenu() {
    try {
        const response = await fetch(`${API_URL}/menu`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки меню');
        }
        
        displayMenu(data.items);
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(error.message, 'error');
    }
}

function displayMenu(items) {
    const menuGrid = document.getElementById('menuGrid');
    menuGrid.innerHTML = '';
    
    const filteredItems = currentFilter === 'all' 
        ? items 
        : items.filter(item => item.category === currentFilter);
    
    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.innerHTML = `
            <div class="menu-card-image">
                ${getCategoryEmoji(item.category)}
            </div>
            <div class="menu-card-content">
                <div class="menu-card-name">${item.name}</div>
                <div class="menu-card-description">${item.description}</div>
                <div class="menu-card-footer">
                    <div class="menu-card-price">${item.price} ₽</div>
                    <button class="btn-add-to-cart" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </div>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

function getCategoryEmoji(category) {
    const emojis = {
        'Пиццы': '🍕',
        'Бургеры': '🍔',
        'Салаты': '🥗',
        'Суши': '🍣',
        'Пасты': '🍝',
        'Напитки': '🥤'
    };
    return emojis[category] || '🍽️';
}

function filterMenu(category) {
    currentFilter = category;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadMenu();
}

// ==================== CART ==================== 

function addToCart(itemId, itemName, itemPrice) {
    const existingItem = cart.find(item => item.id === itemId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: itemPrice,
            quantity: 1
        });
    }
    
    showNotification(`${itemName} добавлена в корзину`);
}

function showCart() {
    if (!currentUser) {
        showModal('loginModal');
        return;
    }
    
    updateCartDisplay();
    showModal('cartModal');
}

function updateCartDisplay() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartTotalDiv = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
        cartTotalDiv.textContent = '0 ₽';
        return;
    }
    
    cartItemsDiv.innerHTML = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price} ₽</div>
            <div class="cart-item-quantity">
                <button onclick="updateQuantity(${index}, -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateQuantity(${index}, 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">Удалить</button>
        `;
        cartItemsDiv.appendChild(cartItem);
    });
    
    cartTotalDiv.textContent = `${total} ₽`;
}

function updateQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            removeFromCart(index);
        } else {
            updateCartDisplay();
        }
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

async function placeOrder() {
    const cartErrorDiv = document.getElementById('cartError');
    
    if (!currentUser) {
        cartErrorDiv.textContent = 'Пожалуйста, войдите в аккаунт';
        cartErrorDiv.classList.add('show');
        return;
    }
    
    if (cart.length === 0) {
        cartErrorDiv.textContent = 'Корзина пуста';
        cartErrorDiv.classList.add('show');
        return;
    }
    
    try {
        const items = cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        }));
        
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ items })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка при оформлении заказа');
        }
        
        cart = [];
        closeModal('cartModal');
        showNotification(`Заказ ${data.order_id} успешно оформлен!`);
        
    } catch (error) {
        cartErrorDiv.textContent = error.message;
        cartErrorDiv.classList.add('show');
    }
}

// ==================== ORDERS ==================== 

async function loadOrders() {
    if (!currentUser) {
        showModal('loginModal');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        displayOrders(data.orders);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">У вас нет заказов</div>';
        return;
    }
    
    ordersList.innerHTML = '';
    
    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        
        const statusClass = order.status === 'completed' ? 'status-completed' : 'status-pending';
        const statusText = order.status === 'completed' ? 'Доставлено' : 'В обработке';
        
        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `<div class="order-item">${item.name} × ${item.quantity}</div>`;
        });
        
        card.innerHTML = `
            <div class="order-header">
                <div class="order-id">Заказ #${order.id}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                <span class="order-price">${order.total_price} ₽</span>
                <span style="font-size: 0.9rem; color: #999;">${new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
        `;
        ordersList.appendChild(card);
    });
}

// ==================== MODALS ==================== 

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

function switchModals(fromId, toId) {
    closeModal(fromId);
    showModal(toId);
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('dropdownContent');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Закрытие модальной окна при клике вне него
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
    if (!event.target.matches('.nav-btn-user') && !event.target.closest('.user-dropdown')) {
        const dropdown = document.getElementById('dropdownContent');
        if (dropdown) dropdown.style.display = 'none';
    }
}

// ==================== UTILITIES ==================== 

function showNotification(message, type = 'success') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Можно расширить с реальным уведомлением
}

function scrollToMenu() {
    document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
}

function setupEventListeners() {
    // Обработка клика по пункту "Мои заказы"
    const ordersLink = document.getElementById('ordersLink');
    if (ordersLink) {
        ordersLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadOrders();
            document.getElementById('menu').style.display = 'none';
            document.getElementById('orders').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // Обработка клика по пункту "Меню"
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.textContent === 'Меню') {
            link.addEventListener('click', function() {
                document.getElementById('menu').style.display = 'block';
                document.getElementById('orders').style.display = 'none';
            });
        }
        if (link.textContent === 'Главная') {
            link.addEventListener('click', function() {
                document.getElementById('menu').style.display = 'block';
                document.getElementById('orders').style.display = 'none';
            });
        }
    });
}
