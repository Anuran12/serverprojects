FROM node:20-alpine
WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_API_BASE=""
ARG NEXT_PUBLIC_SOCKET_BASE=""
ARG NEXT_PUBLIC_SOCKET_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_SOCKET_BASE=$NEXT_PUBLIC_SOCKET_BASE
ENV NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build
RUN mkdir -p .next/standalone/.next \
  && cp -r .next/static .next/standalone/.next/static \
  && if [ -d public ]; then cp -r public .next/standalone/public; fi

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
