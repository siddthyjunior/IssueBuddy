FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN DATABASE_URL=postgresql://issuebuddy:issuebuddy@127.0.0.1:5432/issuebuddy npx prisma generate

COPY src ./src
COPY prisma/seed.js ./prisma/seed.js

RUN mkdir -p /app/uploads
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && npm run dev"]
