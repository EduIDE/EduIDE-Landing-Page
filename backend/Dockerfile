# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for the build step)
RUN npm ci --legacy-peer-deps

# Copy source and configs
COPY tsconfig.json esbuild.js ./
COPY src ./src

# Type-check and bundle
RUN npm run build

# Production stage - only the Node runtime and the bundled output
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/dist/index.js ./dist/index.js

EXPOSE 8090

CMD ["node", "dist/index.js"]
