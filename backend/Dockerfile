# FunCafe backend — Laravel 13 / PHP 8.3 + MongoDB
# Dùng cho Render (Web Service, runtime Docker, root directory = backend)
FROM php:8.3-cli

# Thư viện hệ thống cần cho các extension.
# libssl-dev + pkg-config BẮT BUỘC để ext mongodb build KÈM TLS/SSL,
# nếu thiếu -> lỗi "SSL not enabled in this build" khi nối Atlas (mongodb+srv).
RUN apt-get update && apt-get install -y \
        git unzip libzip-dev libonig-dev libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions: zip/bcmath/mbstring cho Laravel, mongodb (2.x) cho DB
RUN docker-php-ext-install zip bcmath mbstring \
    && pecl install mongodb \
    && docker-php-ext-enable mongodb

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# Cài dependencies production (ext-mongodb 2.x đã có ở trên nên qua được platform check)
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Quyền ghi cho Laravel
RUN chmod -R 775 storage bootstrap/cache

# Render cấp cổng qua $PORT. config:cache chạy lúc RUNTIME để nhận env đã inject.
# db:seed ProductionSeeder idempotent (chỉ nạp khi rỗng) — thay cho Shell mà
# free tier không có; dùng ';' để serve vẫn chạy dù seed lỗi.
EXPOSE 8000
CMD php artisan config:cache \
    && php artisan db:seed --class=ProductionSeeder --force ; \
    php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
