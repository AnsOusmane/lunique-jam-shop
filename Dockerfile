# ---------- Étape 1 : build du client Angular ----------
FROM node:22-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-fund --no-audit
COPY client/ ./
RUN npm run build

# ---------- Étape 2 : serveur Express ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev --no-fund --no-audit

COPY server/ ./
# Le serveur sert le front depuis ../client/dist/client/browser
COPY --from=client /app/client/dist ../client/dist

# DATA_DIR doit pointer vers un volume persistant en prod (ex : /data sur Railway)
EXPOSE 3000
CMD ["node", "src/index.js"]
