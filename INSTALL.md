# 🚀 Установка и запуск сервера КОСМОС

## 📋 Требования

- **Node.js** версии 16.0.0 или выше
- **npm** версии 8.0.0 или выше
- **Git** (опционально, для клонирования репозитория)

## 🔧 Установка

### 1. Установка зависимостей

```bash
# Установка всех необходимых пакетов
npm install

# Или используйте скрипт
npm run install-deps
```

### 2. Настройка конфигурации

Создайте файл `.env` в корневой папке проекта:

```bash
# Конфигурация сервера КОСМОС
PORT=8889
NODE_ENV=development

# JWT секретный ключ (ИЗМЕНИТЕ НА СВОЙ!)
JWT_SECRET=cosmos_super_secret_key_2025_shodruz_blog_secure_token

# Настройки базы данных
DB_PATH=./cosmos_blog.db

# Настройки безопасности
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Настройки CORS
CORS_ORIGIN=http://localhost:8889

# Настройки логирования
LOG_LEVEL=info
```

## 🚀 Запуск сервера

### Режим разработки (с автоперезагрузкой)

```bash
npm run dev
```

### Продакшн режим

```bash
npm start
```

### Ручной запуск

```bash
node server.js
```

## 📱 Доступ к приложению

После успешного запуска сервера:

- **Главная страница**: http://localhost:8889/
- **Админ-панель**: http://localhost:8889/root.html
- **Пароль админа**: `r@@t00`

## 🗄️ База данных

### Автоматическое создание

При первом запуске сервера автоматически создается:

- Файл базы данных: `cosmos_blog.db`
- Таблицы: `posts`, `visits`, `users`
- Индексы для оптимизации

### Структура базы данных

```sql
-- Таблица постов
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица посещений
CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    user_agent TEXT,
    page TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользователей
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 API Endpoints

### Аутентификация
- `POST /api/auth/login` - вход в систему
- `GET /api/auth/verify` - проверка токена

### Посты
- `GET /api/posts` - получение списка постов
- `GET /api/posts/:id` - получение поста по ID
- `POST /api/posts` - создание поста
- `PUT /api/posts/:id` - обновление поста
- `DELETE /api/posts/:id` - удаление поста

### Аналитика
- `GET /api/analytics` - статистика посещений
- `POST /api/visits` - запись посещения
- `DELETE /api/analytics/cleanup` - очистка старых данных

### Экспорт
- `GET /api/export` - экспорт всех данных
- `GET /api/export?type=posts` - экспорт только постов
- `GET /api/export?type=visits` - экспорт только посещений

## 🛡️ Безопасность

### JWT токены
- Токены действительны 24 часа
- Хранятся в localStorage браузера
- Автоматически проверяются при каждом запросе

### Rate Limiting
- Максимум 100 запросов с одного IP за 15 минут
- Защита от DDoS атак

### Helmet.js
- Защита заголовков HTTP
- Предотвращение XSS атак
- Безопасные настройки CSP

## 📊 Мониторинг и логи

### Логи сервера
```bash
# Запуск с выводом логов
npm run dev

# Логи в консоли
🚀 Сервер КОСМОС запущен на порту 8889
✅ Подключение к базе данных SQLite успешно
✅ Таблицы базы данных созданы
```

### Автоматическая очистка
- Старые записи о посещениях удаляются каждые 12 дней
- Ручная очистка через админ-панель

## 🔧 Устранение неполадок

### Проблемы с портом
```bash
# Измените порт в .env файле
PORT=3001

# Или укажите при запуске
PORT=3001 npm start
```

### Проблемы с базой данных
```bash
# Удалите файл базы данных для пересоздания
rm cosmos_blog.db

# Перезапустите сервер
npm start
```

### Проблемы с зависимостями
```bash
# Очистите кэш npm
npm cache clean --force

# Удалите node_modules и переустановите
rm -rf node_modules package-lock.json
npm install
```

## 📦 Скрипты npm

```bash
npm start          # Запуск сервера
npm run dev        # Запуск в режиме разработки
npm run install-deps # Установка зависимостей
npm run build      # Сборка проекта
npm test           # Запуск тестов
```

## 🌐 Развертывание на хостинге

### Heroku
```bash
# Создание приложения
heroku create your-cosmos-blog

# Установка переменных окружения
heroku config:set JWT_SECRET=ваш_секретный_ключ
heroku config:set NODE_ENV=production

# Деплой
git push heroku main
```

### VPS/Дедicated сервер
```bash
# Установка PM2 для управления процессами
npm install -g pm2

# Запуск с PM2
pm2 start server.js --name "cosmos-blog"

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

## 📱 Тестирование

### Проверка API
```bash
# Тест получения постов
curl http://localhost:8889/api/posts

# Тест аутентификации
curl -X POST http://localhost:8889/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"r@@t00"}'
```

### Проверка базы данных
```bash
# Подключение к SQLite
sqlite3 cosmos_blog.db

# Просмотр таблиц
.tables

# Просмотр данных
SELECT * FROM posts;
SELECT * FROM visits;
```

## 🎯 Следующие шаги

1. ✅ Установите зависимости: `npm install`
2. ✅ Настройте `.env` файл
3. ✅ Запустите сервер: `npm run dev`
4. ✅ Откройте http://localhost:8889/
5. ✅ Войдите в админ-панель с паролем `r@@t00`
6. ✅ Добавьте первый пост
7. ✅ Проверьте аналитику посещений

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи сервера в консоли
2. Убедитесь, что все зависимости установлены
3. Проверьте настройки в `.env` файле
4. Убедитесь, что порт 8889 свободен

---

**Удачного запуска вашего футуристического блога КОСМОС! 🚀✨**

