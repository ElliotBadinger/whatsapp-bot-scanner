FROM node:20-alpine
WORKDIR /app

COPY tsconfig.base.json /app/

COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && npm install && npm run build && npm pack

COPY services/control-plane/package.json services/control-plane/tsconfig.json /app/services/control-plane/
COPY services/control-plane/src /app/services/control-plane/src
RUN cd /app/services/control-plane && npm install ../..//packages/shared/*.tgz && npm install && npm run build

ENV NODE_ENV=production
USER node
WORKDIR /app/services/control-plane
EXPOSE 8080
CMD ["node","dist/index.js"]
