# y-websocket server compatible with cards (yjs@13 + y-websocket@3 client)
#
# Coolify:
# - Build pack: Dockerfile
# - Dockerfile location: /deploy/yjs/Dockerfile  (if building from cards repo)
#   OR copy this file as /Dockerfile on a dedicated app
# - Ports Exposes: 1234
# - Domain: https://realtime-tarot.untestcomplique.com
# - Do NOT use git source yjs/y-websocket (v3 has no server) nor @y/websocket-server
#   (@y/websocket-server pulls yjs@14 and breaks yjs@13 clients).
#
# Start is baked into the image; leave Coolify "Start Command" empty.

FROM node:22-alpine

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=1234
# Last y-websocket release that still ships the server binary; protocol-compatible
# with y-websocket@3.x clients and yjs@13.6.x (latest stable Yjs line).
ENV YWS_VERSION=2.0.4

RUN npm install --omit=dev "y-websocket@${YWS_VERSION}" \
  && ln -sf /app/node_modules/.bin/y-websocket /usr/local/bin/y-websocket

EXPOSE 1234

CMD ["y-websocket"]
