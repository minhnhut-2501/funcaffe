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
#
# Thử lại ba lần rồi mới lùi về nguồn, chứ không gọi thẳng --prefer-source ngay.
#
# Lượt dựng 17/08/2026 chết ở đúng dòng này: codeload.github.com trả 429 khi tải
# guzzle — một gói gần cuối, sau khi mấy chục gói trước đã tải xong. Composer in
# "Source fallback is disabled. Not trying alternative sources." rồi bỏ cuộc. Nghĩa là
# mặc định nó KHÔNG tự chuyển sang git khi zip hỏng, nên MỘT gói vấp là hỏng cả lượt
# dựng. Mà 429 thì không phải lỗi của mã mình và cũng chẳng sửa được bằng cách sửa mã.
#
# 429 là lỗi nhất thời, chờ vài chục giây thường là qua — nên thử lại trước, rẻ hơn
# nhiều so với clone lại toàn bộ. Chỉ khi cả ba lần đều hỏng mới dùng --prefer-source:
# nó lấy bằng git qua github.com, một đường KHÁC codeload, nên sống được ngay cả lúc
# codeload đang chặn. Đổi lại thì chậm và để lại .git trong vendor, nên để làm đường
# lui chứ không phải đường chính.
#
# Composer giữ đệm giữa các lần thử, nên lần sau chỉ tải lại đúng gói còn thiếu.
RUN set -eu; \
    for i in 1 2 3; do \
      if composer install --no-dev --optimize-autoloader --no-interaction; then exit 0; fi; \
      echo "=== composer install hong lan $i — cho $((i*20))s roi thu lai ==="; \
      sleep $((i*20)); \
    done; \
    echo '=== Ba lan deu hong — lui ve cai tu ma nguon (git) ==='; \
    composer install --no-dev --optimize-autoloader --no-interaction --prefer-source

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
#
# NHIỀU WORKER Ở BƯỚC 'serve'. Không có hai thứ đó thì máy chủ phục vụ ĐÚNG MỘT
# request tại một thời điểm: `php artisan serve` bọc quanh `php -S`, và Laravel mặc
# định PHP_CLI_SERVER_WORKERS=1. Hệ quả không lộ ra ở máy lập trình — nơi mỗi request
# xong trong vài trăm mili giây — nhưng trên bản triển khai thì một lượt gọi nặng
# chặn đứng mọi lượt gọi nhẹ xếp sau nó, và trang nào mở nhiều request cùng lúc sẽ
# thấy những request cuối hàng hết hạn chờ trong khi bản thân chúng chỉ cần vài giây.
#
# Cờ `--no-reload` là BẮT BUỘC: thiếu nó Laravel bỏ qua PHP_CLI_SERVER_WORKERS và chỉ
# in một dòng cảnh báo rồi chạy đơn luồng như cũ (xem ServeCommand::initialize).
# Đặt biến ngay trên dòng lệnh chứ không qua env của Render, vì `config:cache` ở trên
# làm Laravel bỏ qua tệp .env — biến đặt kiểu này là biến tiến trình thật, luôn đọc được.
#
# Để 3 chứ không cao hơn: gói free chỉ có 512MB, mà mỗi worker phục vụ một phản hồi
# danh sách dài có thể ngốn hơn trăm MB.
EXPOSE 8000
CMD echo '=== config:cache ==='; php artisan config:cache; \
    touch database/database.sqlite; \
    echo '=== migrate ==='; php artisan migrate --force; \
    echo '=== db:indexes ==='; php artisan db:indexes; \
    echo '=== db:seed ==='; php artisan db:seed --class=ProductionSeeder --force; \
    echo '=== serve ==='; PHP_CLI_SERVER_WORKERS=3 php artisan serve --no-reload --host=0.0.0.0 --port=${PORT:-8000}
