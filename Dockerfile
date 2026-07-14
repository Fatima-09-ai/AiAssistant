# Root Dockerfile for Back4app Containers-as-a-Service.
# Builds and runs the Node/Express backend in backend/, while still
# including frontend/ alongside it since backend/server.js serves it
# as static files from a relative "../frontend" path.

FROM node:18-alpine

WORKDIR /app

# Install backend dependencies first (better Docker layer caching)
COPY backend/package*.json backend/
RUN cd backend && npm install --omit=dev

# Now copy the rest of the project (backend code + frontend static files)
COPY backend/ backend/
COPY frontend/ frontend/

WORKDIR /app/backend

# Back4app (and most hosts) inject PORT at runtime; server.js already
# reads process.env.PORT, defaulting to 5000 if not set.
EXPOSE 5000

CMD ["node", "server.js"]
