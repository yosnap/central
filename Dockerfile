# Central en producción (Dokploy). Una imagen y dos servicios del compose: «web» (Next) y «tareas» (servidores y uptime).
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY . .
RUN bunx prisma generate && bun --bun next build

FROM oven/bun:1.4
# ssh para leer los servidores (infobar); git no hace falta: el escáner corre en el Mac
RUN apt-get update && apt-get install -y --no-install-recommends openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production CENTRAL_RUNTIME=production PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
CMD ["sh", "-c", "bunx prisma migrate deploy && bun --bun next start -p 3000"]
