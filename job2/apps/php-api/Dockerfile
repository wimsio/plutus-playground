FROM php:8.3-cli-alpine

# ✅ Add git (needed for clone), plus bash/curl already used
RUN apk add --no-cache bash curl git

WORKDIR /app

COPY composer.json /app/
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
  && composer install --no-interaction --no-progress

COPY . /app

EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]