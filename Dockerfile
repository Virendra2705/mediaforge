FROM --platform=linux/amd64 node:22-bookworm-slim

ARG YTDLP_VERSION=2026.08.19
ENV NODE_ENV=production \
    YTDLP_PATH=/usr/local/bin/yt-dlp

WORKDIR /app

# Render's Docker runtime and the yt-dlp_linux release asset are amd64/x86_64.
# Debian bookworm provides a compatible glibc runtime for the standalone binary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && test "$(dpkg --print-architecture)" = "amd64" \
    && curl --fail --location --silent --show-error \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" \
      --output /usr/local/bin/yt-dlp \
    && curl --fail --location --silent --show-error \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/SHA2-256SUMS" \
      --output /tmp/yt-dlp-SHA2-256SUMS \
    && grep -E '[[:space:]]yt-dlp_linux$' /tmp/yt-dlp-SHA2-256SUMS \
      | sed 's#yt-dlp_linux$#/usr/local/bin/yt-dlp#' > /tmp/yt-dlp-checksum \
    && test -s /tmp/yt-dlp-checksum \
    && sha256sum --check /tmp/yt-dlp-checksum \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && test "$(/usr/local/bin/yt-dlp --version)" = "${YTDLP_VERSION}" \
    && rm -f /tmp/yt-dlp-SHA2-256SUMS /tmp/yt-dlp-checksum

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && test -x "${YTDLP_PATH}" \
    && test "$("${YTDLP_PATH}" --version)" = "${YTDLP_VERSION}" \
    && chown -R node:node /app

USER node
EXPOSE 10000
CMD ["npm", "start"]
