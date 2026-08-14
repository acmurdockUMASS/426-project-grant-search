FROM node:24

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(response => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["npm", "src/index.js"]
