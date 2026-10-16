FROM node:24-alpine
WORKDIR /app
COPY carporeo-source.tar.gz /tmp/carporeo-source.tar.gz
RUN tar -xzf /tmp/carporeo-source.tar.gz -C /app && rm /tmp/carporeo-source.tar.gz && npm install -g pnpm@11.25.0 && pnpm install --prod --frozen-lockfile
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
EXPOSE 4173
CMD ["node","server.mjs"]
