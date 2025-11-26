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

COPY services/control-plane/package.json services/control-plane/tsconfig.json /app/services/control-plane/
RUN cd /app/services/control-plane && \
    npm install ../..//packages/shared/*.tgz --no-audit --progress=false && \
    npm install --no-audit --progress=false

COPY services/control-plane/src /app/services/control-plane/src
RUN cd /app/services/control-plane && \
    npm run build


RUN mkdir -p /app/storage && chown -R node:node /app/storage

ENV NODE_ENV=production
USER node
WORKDIR /app/services/control-plane
EXPOSE 8080
CMD ["node","dist/index.js"]
