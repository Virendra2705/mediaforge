FROM --platform=linux/amd64 node:22-bookworm-slim

ARG YTDLP_VERSION=2026.08.19
ENV NODE_ENV=production \
    YTDLP_PATH=/opt/yt-dlp/bin/yt-dlp

WORKDIR /app

# Use Debian's Python virtual environment so pip does not modify Bookworm's
# externally managed system Python (PEP 668). The pinned console script is
# installed at a deterministic path and runs with the same Python at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/python -m pip install --no-cache-dir "yt-dlp[default]==${YTDLP_VERSION}" \
    && chown -R node:node /opt/yt-dlp

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && chown -R node:node /app

USER node
RUN test -x "${YTDLP_PATH}" \
    && test "$("${YTDLP_PATH}" --version)" = "${YTDLP_VERSION}" \
    && test -x /usr/bin/ffmpeg \
    && /usr/bin/ffmpeg -version >/dev/null 2>&1 \
    && test -x /usr/bin/ffprobe \
    && /usr/bin/ffprobe -version >/dev/null 2>&1

EXPOSE 10000
CMD ["npm", "start"]
