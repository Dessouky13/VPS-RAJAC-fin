FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Use a non-root user for better security (create user as root)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser || true

# Create runtime writable directories and give ownership to the non-root user (still root)
RUN mkdir -p /usr/src/app/uploads /usr/src/app/temp \
  && chown -R appuser:appgroup /usr/src/app/uploads /usr/src/app/temp

# Switch to the non-root user
USER appuser

# PORT defaults to 3000; override via environment variable or docker-compose
ENV PORT 3000
EXPOSE ${PORT}

CMD [ "node", "server.js" ]
