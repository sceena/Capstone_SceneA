FROM node:20-alpine

# mediasoup 네이티브 빌드에 필요한 패키지
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

CMD ["node", "src/index.js"]
