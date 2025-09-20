const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 8889;

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "'unsafe-inline'"],
                "script-src-attr": ["'none'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
                "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
                "img-src": ["'self'", "data:", "blob:", "https:", "http:"],
                "connect-src": ["'self'", "https://api.ipify.org"],
                "frame-ancestors": ["'self'"],
                "upgrade-insecure-requests": []
            }
        }
    })
);
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // максимум 100 запросов с одного IP
});
app.use(limiter);

// Инициализация базы данных
const db = new sqlite3.Database('./cosmos_blog.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('✅ Подключение к базе данных SQLite успешно');
        initDatabase();
    }
});

// Создание таблиц
function initDatabase() {
    // Таблица постов
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        video TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица посещений
    db.run(`CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        user_agent TEXT,
        page TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица пользователей (для будущего расширения)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Создание индексов для оптимизации
    db.run(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip)`);

    console.log('✅ Таблицы базы данных созданы');
}

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'cosmos_secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// API маршруты

// Получение всех постов
app.get('/api/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(`
        SELECT * FROM posts 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `, [limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Получение общего количества постов
        db.get('SELECT COUNT(*) as total FROM posts', (err, countResult) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                posts,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(countResult.total / limit),
                    totalPosts: countResult.total,
                    hasNext: page * limit < countResult.total,
                    hasPrev: page > 1
                }
            });
        });
    });
});

// Получение поста по ID
app.get('/api/posts/:id', (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!post) {
            return res.status(404).json({ error: 'Пост не найден' });
        }
        res.json(post);
    });
});

// Создание нового поста
app.post('/api/posts', authenticateToken, (req, res) => {
    const { title, video, description } = req.body;
    
    if (!title || !video || !description) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    const postId = uuidv4();
    const now = new Date().toISOString();

    db.run(`
        INSERT INTO posts (id, title, video, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [postId, title, video, description, now, now], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
            id: postId,
            title,
            video,
            description,
            created_at: now,
            updated_at: now
        });
    });
});

// Обновление поста
app.put('/api/posts/:id', authenticateToken, (req, res) => {
    const { title, video, description } = req.body;
    
    if (!title || !video || !description) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    const now = new Date().toISOString();

    db.run(`
        UPDATE posts 
        SET title = ?, video = ?, description = ?, updated_at = ?
        WHERE id = ?
    `, [title, video, description, now, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Пост не найден' });
        }
        
        res.json({
            id: req.params.id,
            title,
            video,
            description,
            updated_at: now
        });
    });
});

// Удаление поста
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM posts WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Пост не найден' });
        }
        
        res.json({ message: 'Пост успешно удален' });
    });
});

// Запись посещения
app.post('/api/visits', (req, res) => {
    const { ip, userAgent, page } = req.body;
    
    if (!ip) {
        return res.status(400).json({ error: 'IP адрес обязателен' });
    }

    db.run(`
        INSERT INTO visits (ip, user_agent, page)
        VALUES (?, ?, ?)
    `, [ip, userAgent || '', page || ''], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({ message: 'Посещение записано' });
    });
});

// Получение статистики посещений
app.get('/api/analytics', authenticateToken, (req, res) => {
    const days = parseInt(req.query.days) || 7;
    
    // Общая статистика
    db.get('SELECT COUNT(*) as total FROM visits', (err, totalResult) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Уникальные посетители
        db.get('SELECT COUNT(DISTINCT ip) as unique FROM visits', (err, uniqueResult) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Посещения за сегодня
            db.get(`
                SELECT COUNT(*) as today FROM visits 
                WHERE DATE(timestamp) = DATE('now')
            `, (err, todayResult) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Статистика за последние N дней
                db.all(`
                    SELECT 
                        DATE(timestamp) as date,
                        COUNT(*) as count
                    FROM visits 
                    WHERE timestamp >= DATE('now', '-${days} days')
                    GROUP BY DATE(timestamp)
                    ORDER BY date
                `, (err, dailyResults) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // Последние посещения
                    db.all(`
                        SELECT ip, user_agent, page, timestamp
                        FROM visits 
                        ORDER BY timestamp DESC 
                        LIMIT 10
                    `, (err, recentVisits) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }

                        res.json({
                            total: totalResult.total,
                            unique: uniqueResult.unique,
                            today: todayResult.today,
                            daily: dailyResults,
                            recent: recentVisits
                        });
                    });
                });
            });
        });
    });
});

// Очистка старых посещений
app.delete('/api/analytics/cleanup', authenticateToken, (req, res) => {
    const days = parseInt(req.query.days) || 12;
    
    db.run(`
        DELETE FROM visits 
        WHERE timestamp < DATE('now', '-${days} days')
    `, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
            message: `Очищено ${this.changes} записей старше ${days} дней` 
        });
    });
});

// Экспорт данных
app.get('/api/export', authenticateToken, (req, res) => {
    const type = req.query.type || 'all';
    
    if (type === 'posts') {
        db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ posts, exportDate: new Date().toISOString() });
        });
    } else if (type === 'visits') {
        db.all('SELECT * FROM visits ORDER BY timestamp DESC', (err, visits) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ visits, exportDate: new Date().toISOString() });
        });
    } else {
        // Экспорт всех данных
        db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.all('SELECT * FROM visits ORDER BY timestamp DESC', (err, visits) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    posts,
                    visits,
                    exportDate: new Date().toISOString()
                });
            });
        });
    }
});

// Аутентификация
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    
    if (password === 'r@@t00') {
        const token = jwt.sign(
            { role: 'admin', username: 'admin' },
            process.env.JWT_SECRET || 'cosmos_secret_key',
            { expiresIn: '24h' }
        );
        
        res.json({ token, role: 'admin' });
    } else {
        res.status(401).json({ error: 'Неверный пароль' });
    }
});

// Проверка токена
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Что-то пошло не так!' });
});

// 404 для несуществующих маршрутов
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер КОСМОС запущен на порту ${PORT}`);
    console.log(`📱 Админ-панель: http://192.168.1.2:${PORT}/root.html`);
    console.log(`🌌 Главная страница: http://192.168.1.2:${PORT}/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Получен сигнал SIGINT, закрытие сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка при закрытии базы данных:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Получен сигнал SIGTERM, закрытие сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка при закрытии базы данных:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});

