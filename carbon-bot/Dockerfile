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
# Dev toolkit for channel-per-repo sessions (tc-runtime-informed:
# compatibility > size): build tools, python+uv, gh, search tools, ffmpeg
# for voice. Bot git identity for commits made from Discord.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates ffmpeg curl gnupg \
      jq ripgrep fd-find bat \
      build-essential pkg-config \
      python3 python3-pip python3-venv python-is-python3 \
    && rm -rf /var/lib/apt/lists/* \
    && git config --system user.name "MrRoboto" \
    && git config --system user.email "mrroboto@wisejnrs.net" \
    && git config --system --add safe.directory '*'
# GitHub CLI (repo mounts + a mounted ~/.config/gh give dev sessions PR powers)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*
# uv (python toolchain), pnpm/yarn shims, pre-installed MCP servers
RUN curl -fsSL https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
    && corepack enable \
    && npm install -g @gongrzhe/server-gmail-autoauth-mcp @cocal/google-calendar-mcp
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
