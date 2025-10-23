FROM node:20-alpine
WORKDIR /app

COPY tsconfig.base.json /app/

COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && npm install && npm run build && npm pack

COPY services/scan-orchestrator/package.json services/scan-orchestrator/tsconfig.json /app/services/scan-orchestrator/
COPY services/scan-orchestrator/src /app/services/scan-orchestrator/src
RUN cd /app/services/scan-orchestrator && npm install ../..//packages/shared/*.tgz && npm install && npm run build

ENV NODE_ENV=production
USER node
WORKDIR /app/services/scan-orchestrator
EXPOSE 3001
CMD ["node","dist/index.js"]
