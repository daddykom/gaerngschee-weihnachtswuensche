FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    mariadb-client \
    libzip-dev \
    oniguruma-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    zip \
    mbstring \
    gd \
    opcache

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/99-custom.ini
COPY backend/ ./
COPY db/ /var/www/db/
COPY frontend/public/i18n/ /var/www/shared/i18n/

WORKDIR /var/www/html

ENV SHARED_TRANSLATIONS_PATH=/var/www/shared/i18n/de.json

RUN composer install --no-dev --optimize-autoloader

RUN chown -R nginx:nginx /var/www/html /var/www/db

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
