FROM node:20-alpine

# Install pnpm without corepack downloading at runtime
RUN npm i -g pnpm@9

WORKDIR /app
COPY ../../package.json ../../pnpm-workspace.yaml /app/
COPY ../../apps /app/apps
COPY ../../packages /app/packages

WORKDIR /app/apps/shell-frontend
EXPOSE 5173

CMD ["sh", "-lc", "pnpm i && pnpm dev --host 0.0.0.0"]