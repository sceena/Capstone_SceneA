FROM node:20-slim

# mediasoup 빌드 도구 (prebuilt 바이너리 실패 시 fallback용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

CMD ["node", "src/index.js"]
