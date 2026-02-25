FROM node:20-bookworm

WORKDIR /app

# Build context is the repo root — prefix all paths with backend/
# Install dependencies first (layer-cached unless package.json changes)
COPY backend/package*.json ./
# --ignore-scripts prevents postinstall (prisma generate + playwright install)
# from running before the source files are copied into the image
RUN npm install --ignore-scripts

# Install Chromium browser + all required Linux system libraries
RUN npx playwright install --with-deps chromium

# Copy the rest of the backend source code
COPY backend/ .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
