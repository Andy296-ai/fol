// Административная панель КОСМОС с API

class AdminPanel {
    constructor() {
        this.currentTab = 'posts';
        this.currentPage = 1;
        this.postsPerPage = 5;
        this.posts = [];
        this.visits = [];
        this.chart = null;
        this.authToken = null;
        this.apiBaseUrl = window.location.origin + '/api';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showLoginScreen();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Вход в систему
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Выход из системы
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Навигация по вкладкам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Управление постами
        document.getElementById('addPostBtn').addEventListener('click', () => this.showPostForm());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hidePostForm());
        document.getElementById('postFormElement').addEventListener('submit', (e) => this.handlePostSubmit(e));

        // Делегирование кликов по постам (редактирование/удаление)
        const postsList = document.getElementById('postsList');
        if (postsList) {
            postsList.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                if (editBtn) {
                    const postId = editBtn.getAttribute('data-id');
                    if (postId) this.showPostForm(postId);
                    return;
                }
                const deleteBtn = e.target.closest('.delete-btn');
                if (deleteBtn) {
                    const postId = deleteBtn.getAttribute('data-id');
                    if (postId) this.deletePost(postId);
                    return;
                }
            });
        }

        // Делегирование кликов по пагинации
        const pagination = document.getElementById('pagination');
        if (pagination) {
            pagination.addEventListener('click', (e) => {
                const pageBtn = e.target.closest('.page-btn');
                if (pageBtn && pageBtn.dataset.page) {
                    const page = parseInt(pageBtn.dataset.page, 10);
                    if (!Number.isNaN(page)) this.goToPage(page);
                }
            });
        }

        // Аналитика
        document.getElementById('refreshAnalytics').addEventListener('click', () => this.refreshAnalytics());

        // Настройки
        document.getElementById('clearVisitsBtn').addEventListener('click', () => this.clearOldVisits());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('backupBtn').addEventListener('click', () => this.createBackup());

        // Модальное окно
        document.getElementById('confirmYes').addEventListener('click', () => this.handleConfirm());
        document.getElementById('confirmNo').addEventListener('click', () => this.hideConfirmModal());
    }

    // Показ экрана входа
    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
    }

    // Скрытие экрана входа
    hideLoginScreen() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
    }

    // Вход в систему
    async login() {
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                const data = await response.json();
                this.authToken = data.token;
                this.hideLoginScreen();
                this.loadPosts();
                this.loadAnalytics();
                document.getElementById('password').value = '';
                
                // Сохраняем токен в localStorage для удобства
                localStorage.setItem('cosmos_auth_token', this.authToken);
            } else {
                const errorData = await response.json();
                alert(`Ошибка входа: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            alert('Ошибка подключения к серверу');
        }
    }

    // Выход из системы
    logout() {
        this.authToken = null;
        localStorage.removeItem('cosmos_auth_token');
        this.showLoginScreen();
        this.currentTab = 'posts';
        this.currentPage = 1;
        this.updateTabButtons();
    }

    // Переключение вкладок
    switchTab(tabName) {
        this.currentTab = tabName;
        this.updateTabButtons();
        this.showTabContent(tabName);
    }

    // Обновление кнопок вкладок
    updateTabButtons() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${this.currentTab}"]`).classList.add('active');
    }

    // Показ содержимого вкладки
    showTabContent(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        if (tabName === 'posts') {
            this.loadPosts();
        } else if (tabName === 'analytics') {
            this.loadAnalytics();
        }
    }

    // Показ формы поста
    showPostForm(postId = null) {
        const form = document.getElementById('postForm');
        const title = document.getElementById('formTitle');
        const formElement = document.getElementById('postFormElement');

        if (postId) {
            const post = this.posts.find(p => p.id === postId);
            if (post) {
                title.textContent = 'Редактировать пост';
                document.getElementById('postId').value = post.id;
                document.getElementById('postTitle').value = post.title;
                document.getElementById('postVideo').value = post.video;
                document.getElementById('postDescription').value = post.description;
            }
        } else {
            title.textContent = 'Добавить новый пост';
            formElement.reset();
            document.getElementById('postId').value = '';
        }

        form.classList.remove('hidden');
    }

    // Скрытие формы поста
    hidePostForm() {
        document.getElementById('postForm').classList.add('hidden');
    }

    // Обработка отправки формы поста
    async handlePostSubmit(e) {
        e.preventDefault();

        const postId = document.getElementById('postId').value;
        const title = document.getElementById('postTitle').value;
        const video = document.getElementById('postVideo').value;
        const description = document.getElementById('postDescription').value;

        try {
            if (postId) {
                // Редактирование существующего поста
                await this.updatePost(postId, { title, video, description });
            } else {
                // Добавление нового поста
                await this.createPost({ title, video, description });
            }

            this.hidePostForm();
            this.loadPosts();
        } catch (error) {
            console.error('Ошибка сохранения поста:', error);
            alert('Ошибка сохранения поста');
        }
    }

    // Создание поста
    async createPost(postData) {
        const response = await fetch(`${this.apiBaseUrl}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            throw new Error('Ошибка создания поста');
        }

        return await response.json();
    }

    // Обновление поста
    async updatePost(postId, postData) {
        const response = await fetch(`${this.apiBaseUrl}/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            throw new Error('Ошибка обновления поста');
        }

        return await response.json();
    }

    // Удаление поста
    async deletePost(postId) {
        this.showConfirmModal(
            'Вы уверены, что хотите удалить этот пост?',
            async () => {
                try {
                    const response = await fetch(`${this.apiBaseUrl}/posts/${postId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${this.authToken}`
                        }
                    });

                    if (response.ok) {
                        this.loadPosts();
                        this.hideConfirmModal();
                    } else {
                        throw new Error('Ошибка удаления поста');
                    }
                } catch (error) {
                    console.error('Ошибка удаления поста:', error);
                    alert('Ошибка удаления поста');
                }
            }
        );
    }

    // Загрузка постов
    async loadPosts() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/posts?page=${this.currentPage}&limit=${this.postsPerPage}`);
            
            if (response.ok) {
                const data = await response.json();
                this.posts = data.posts;
                this.renderPosts(data.pagination);
            } else {
                throw new Error('Ошибка загрузки постов');
            }
        } catch (error) {
            console.error('Ошибка загрузки постов:', error);
            this.posts = [];
            this.renderPosts({});
        }
    }

    // Рендеринг постов
    renderPosts(pagination) {
        const postsList = document.getElementById('postsList');
        const paginationElement = document.getElementById('pagination');

        postsList.innerHTML = this.posts.map(post => `
            <div class="post-item" data-id="${post.id}">
                <div class="post-header">
                    <h3 class="post-title">${post.title}</h3>
                    <div class="post-actions">
                        <button class="action-btn edit-btn" data-id="${post.id}" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${post.id}" title="Удалить">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <a href="${post.video}" target="_blank" class="post-video">${post.video}</a>
                <p class="post-description">${post.description}</p>
                <div class="post-date">${new Date(post.created_at).toLocaleDateString('ru-RU')}</div>
            </div>
        `).join('');

        this.renderPagination(pagination);
    }

    // Рендеринг пагинации
    renderPagination(pagination) {
        const paginationElement = document.getElementById('pagination');

        if (!pagination || pagination.totalPages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }

        const buttons = [];
        if (pagination.hasPrev) {
            buttons.push(`<button class="page-btn" data-page="${pagination.currentPage - 1}">←</button>`);
        }
        for (let i = 1; i <= pagination.totalPages; i++) {
            const activeClass = i === pagination.currentPage ? ' active' : '';
            buttons.push(`<button class="page-btn${activeClass}" data-page="${i}">${i}</button>`);
        }
        if (pagination.hasNext) {
            buttons.push(`<button class="page-btn" data-page="${pagination.currentPage + 1}">→</button>`);
        }
        paginationElement.innerHTML = buttons.join('');
    }

    // Переход на страницу
    goToPage(page) {
        this.currentPage = page;
        this.loadPosts();
    }

    // Загрузка аналитики
    async loadAnalytics() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/analytics`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.visits = data.recent || [];
                this.renderAnalytics(data);
            } else {
                throw new Error('Ошибка загрузки аналитики');
            }
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
            this.visits = [];
            this.renderAnalytics({});
        }
    }

    // Рендеринг аналитики
    renderAnalytics(data) {
        this.updateStats(data);
        this.renderChart(data.daily || []);
        this.renderVisitsList(data.recent || []);
    }

    // Обновление статистики
    updateStats(data) {
        document.getElementById('totalVisits').textContent = data.total || 0;
        document.getElementById('uniqueVisitors').textContent = data.unique || 0;
        document.getElementById('todayVisits').textContent = data.today || 0;
    }

    // Рендеринг графика
    renderChart(dailyData) {
        const ctx = document.getElementById('visitsChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const labels = dailyData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        });

        const data = dailyData.map(item => item.count);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Посещения',
                    data: data,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b8c5d6'
                        },
                        grid: {
                            color: 'rgba(0, 255, 136, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#b8c5d6'
                        },
                        grid: {
                            color: 'rgba(0, 255, 136, 0.1)'
                        }
                    }
                }
            }
        });
    }

    // Рендеринг списка посещений
    renderVisitsList(visits) {
        const visitsList = document.getElementById('visitsList');
        
        visitsList.innerHTML = visits.map(visit => `
            <div class="visit-item">
                <div class="visit-ip">${visit.ip}</div>
                <div class="visit-time">${new Date(visit.timestamp).toLocaleString('ru-RU')}</div>
            </div>
        `).join('');
    }

    // Обновление аналитики
    refreshAnalytics() {
        this.loadAnalytics();
    }

    // Очистка старых посещений
    async clearOldVisits() {
        this.showConfirmModal(
            'Вы уверены, что хотите удалить историю посещений старше 12 дней?',
            async () => {
                try {
                    const response = await fetch(`${this.apiBaseUrl}/analytics/cleanup?days=12`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${this.authToken}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        alert(result.message);
                        this.loadAnalytics();
                        this.hideConfirmModal();
                    } else {
                        throw new Error('Ошибка очистки данных');
                    }
                } catch (error) {
                    console.error('Ошибка очистки данных:', error);
                    alert('Ошибка очистки данных');
                }
            }
        );
    }

    // Экспорт данных
    async exportData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/export`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.downloadJSON(data, `cosmos_data_${new Date().toISOString().split('T')[0]}.json`);
            } else {
                throw new Error('Ошибка экспорта данных');
            }
        } catch (error) {
            console.error('Ошибка экспорта данных:', error);
            alert('Ошибка экспорта данных');
        }
    }

    // Создание резервной копии
    async createBackup() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/export?type=posts`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.downloadJSON(data, `cosmos_backup_${new Date().toISOString().split('T')[0]}.json`);
            } else {
                throw new Error('Ошибка создания резервной копии');
            }
        } catch (error) {
            console.error('Ошибка создания резервной копии:', error);
            alert('Ошибка создания резервной копии');
        }
    }

    // Скачивание JSON файла
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Показ модального окна подтверждения
    showConfirmModal(message, callback) {
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmModal').classList.remove('hidden');
        this.confirmCallback = callback;
    }

    // Скрытие модального окна подтверждения
    hideConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
        this.confirmCallback = null;
    }

    // Обработка подтверждения
    handleConfirm() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
    }

    // Проверка авторизации при загрузке
    checkAuth() {
        const savedToken = localStorage.getItem('cosmos_auth_token');
        if (savedToken) {
            this.authToken = savedToken;
            // Проверяем валидность токена
            fetch(`${this.apiBaseUrl}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            }).then(response => {
                if (response.ok) {
                    this.hideLoginScreen();
                    this.loadPosts();
                    this.loadAnalytics();
                } else {
                    localStorage.removeItem('cosmos_auth_token');
                    this.authToken = null;
                }
            }).catch(() => {
                localStorage.removeItem('cosmos_auth_token');
                this.authToken = null;
            });
        }
    }
}

// Инициализация админ-панели
let adminPanel;

document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    adminPanel.checkAuth();
});

// Функция для записи посещений (вызывается с главной страницы)
async function recordVisit() {
    try {
        // Получение IP адреса
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        
        const visit = {
            ip: ipData.ip,
            userAgent: navigator.userAgent,
            page: window.location.pathname
        };

        // Отправка на сервер
        await fetch('/api/visits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(visit)
        });
    } catch (error) {
        console.error('Ошибка записи посещения:', error);
    }
}

// Запись посещения при загрузке страницы
if (window.location.pathname !== '/root.html') {
    recordVisit();
}

