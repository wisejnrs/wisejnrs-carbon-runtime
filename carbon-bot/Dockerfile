# Debian-based: onnxruntime-node, sharp, better-sqlite3 and lancedb need glibc.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/app/data \
    CORPUS_DIR=/app/corpus \
    YOLO_MODEL_PATH=/app/models/yolo26s.onnx \
    HF_HOME=/app/data/hf-cache
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Model is not in git (43MB); copy it into the build context before building the image.
COPY models ./models
RUN mkdir -p /app/data /app/corpus && chown -R node:node /app/data /app/corpus
USER node
EXPOSE 8300
CMD ["node", "dist/index.js"]
