FROM node:20-slim


# تثبيت أدوات بسيطة للـ healthcheck
RUN apt-get update -y && apt-get install -y --no-install-recommends \
curl tini && rm -rf /var/lib/apt/lists/*


WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev


COPY src ./src
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["tini", "--", "node", "src/index.js"]