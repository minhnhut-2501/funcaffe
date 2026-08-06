# FunCafe backend — Laravel 13 / PHP 8.3 + MongoDB
# Dùng cho Render (Web Service, runtime Docker, root directory = backend)
FROM php:8.3-cli

# Thư viện hệ thống cần cho các extension.
# libssl-dev + pkg-config BẮT BUỘC để ext mongodb build KÈM TLS/SSL,
# nếu thiếu -> lỗi "SSL not enabled in this build" khi nối Atlas (mongodb+srv).
RUN apt-get update && apt-get install -y \
        git unzip libzip-dev libonig-dev libssl-dev libsqlite3-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions: zip/bcmath/mbstring cho Laravel, mongodb (2.x) cho DB chính,
# pdo_sqlite để lưu Sanctum token (model PersonalAccessToken dùng connection sqlite).
RUN docker-php-ext-install zip bcmath mbstring pdo_sqlite \
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
# free tier không có.
#
# Các bước nối bằng ';' chứ KHÔNG phải '&&'. Với '&&', một bước hỏng là mọi bước sau
# im lặng không chạy — mà 'serve' vẫn lên nên dịch vụ trông vẫn khỏe. Đó là cách dễ
# nhất để chỉ mục không bao giờ được tạo mà chẳng ai biết: log không có lấy một dòng
# nào của db:indexes để mà thắc mắc. Mỗi lệnh artisan ở đây đều chạy lại được nhiều
# lần và tự chịu lỗi, nên để chúng độc lập vừa an toàn vừa luôn để lại dấu vết.
#
# Mốc '=== ' để tìm nhanh trong log của Render.
EXPOSE 8000
CMD echo '=== config:cache ==='; php artisan config:cache; \
    touch database/database.sqlite; \
    echo '=== migrate ==='; php artisan migrate --force; \
    echo '=== db:indexes ==='; php artisan db:indexes; \
    echo '=== db:seed ==='; php artisan db:seed --class=ProductionSeeder --force; \
    echo '=== serve ==='; php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
