# Use official Puppeteer image with Chromium preinstalled
FROM ghcr.io/puppeteer/puppeteer:22.13.1

USER root
WORKDIR /app

COPY tsconfig.base.json /app/

# Install shared package
COPY packages/confusable /app/packages/confusable
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && \
    npm install --no-audit --progress=false && \
    npm run build && \
    npm pack

# Install service
COPY services/wa-client/package.json services/wa-client/tsconfig.json /app/services/wa-client/
RUN cd /app/services/wa-client && \
    npm install ../..//packages/shared/*.tgz --no-audit --progress=false && \
    npm install --no-audit --progress=false

COPY services/wa-client/src /app/services/wa-client/src
RUN cd /app/services/wa-client && \
    npm run build

RUN mkdir -p /app/services/wa-client/data && chown -R pptruser:pptruser /app/services/wa-client

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

USER pptruser

VOLUME ["/app/services/wa-client/data"]

EXPOSE 3000

WORKDIR /app/services/wa-client
CMD ["node","dist/index.js"]
