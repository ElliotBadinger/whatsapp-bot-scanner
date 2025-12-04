FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install build tools needed for native npm packages (e.g., better-sqlite3)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
