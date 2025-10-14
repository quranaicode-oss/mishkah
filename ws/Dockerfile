FROM node:20-slim

# أدوات لازمة للتثبيت والبناء (uWS قد يحتاج build tools)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    curl tini ca-certificates git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN node -v && npm -v
RUN npm config set fund false && npm config set audit false && npm config set progress=false

# انسخ تعريفات الحزم أولاً
COPY package*.json ./
RUN echo "----- package.json -----" && cat package.json && echo "------------------------"

# تثبيت dependencies (لو فيه lock → ci وإلا i)
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    npm ci --omit=dev || (echo 'npm ci failed, retry with verbose...' && npm ci --omit=dev --loglevel=verbose); \
  else \
    npm i --omit=dev || (echo 'npm i failed, retry with verbose...' && npm i --omit=dev --loglevel=verbose); \
  fi

# انسخ السورس
COPY src ./src

# احذف أدوات البناء لتخفيف الصورة
RUN apt-get purge -y git python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["tini", "--", "node", "src/index.js"]

