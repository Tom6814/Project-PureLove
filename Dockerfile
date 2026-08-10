# Node 22+：@supabase/supabase-js 的 Realtime 依赖 Node 22 原生 WebSocket，Node 20 会直接抛错崩溃
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "run", "start"]
