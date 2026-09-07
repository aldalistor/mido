FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:22-bookworm

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/mido
USER node
