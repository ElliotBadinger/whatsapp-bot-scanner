FROM node:20-alpine
WORKDIR /app

COPY tsconfig.base.json /app/
COPY types /app/types

COPY packages/confusable /app/packages/confusable
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && \
    npm install --no-audit --progress=false && \
    npm run build && \
    npm pack

COPY services/scan-orchestrator/package.json services/scan-orchestrator/tsconfig.json /app/services/scan-orchestrator/
RUN cd /app/services/scan-orchestrator && \
    npm install ../..//packages/shared/*.tgz --no-audit --progress=false && \
    npm install --no-audit --progress=false --ignore-scripts && \
    npm rebuild esbuild

COPY services/scan-orchestrator/src /app/services/scan-orchestrator/src
RUN cd /app/services/scan-orchestrator && \
    npm run build


RUN mkdir -p /app/storage && chown -R node:node /app/storage

ENV NODE_ENV=production
USER node
WORKDIR /app/services/scan-orchestrator
EXPOSE 3001
CMD ["node","dist/index.js"]
