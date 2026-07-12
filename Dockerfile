# ChoirAI Railway Dockerfile
FROM node:20-slim

# Install Java (needed for Audiveris)
RUN apt-get update && apt-get install -y \
    default-jre \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Audiveris
RUN wget https://github.com/Audiveris/audiveris/releases/download/5.3.1/Audiveris-5.3.1-linux-x86_64.sh \
    && chmod +x Audiveris-5.3.1-linux-x86_64.sh \
    && ./Audiveris-5.3.1-linux-x86_64.sh -q \
    && rm Audiveris-5.3.1-linux-x86_64.sh

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY api/package*.json ./api/

# Install dependencies
RUN npm install
RUN cd api && npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "api/index.js"]
