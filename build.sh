#!/bin/bash

set -e


cd admin/
pnpm install
pnpm build
cd ..

cd chat/
pnpm install
pnpm build
cd ..

cd service/
pnpm install
pnpm build
cd ..

rm -rf ./AIWebQuickDeploy/dist/* ./AIWebQuickDeploy/public/admin/* ./AIWebQuickDeploy/public/chat/* ./AIWebQuickDeploy/public/open-docs/*
mkdir -p ./AIWebQuickDeploy/dist ./AIWebQuickDeploy/public/admin ./AIWebQuickDeploy/public/chat ./AIWebQuickDeploy/public/open-docs

cp service/pm2.conf.json ./AIWebQuickDeploy/pm2.conf.json
cp service/package.json ./AIWebQuickDeploy/package.json

cp service/.env.example ./AIWebQuickDeploy/.env.example
cp service/.env.docker ./AIWebQuickDeploy/.env.docker
cp service/Dockerfile ./AIWebQuickDeploy/Dockerfile
cp service/docker-compose.yml ./AIWebQuickDeploy/docker-compose.yml
cp service/.dockerignore ./AIWebQuickDeploy/.dockerignore

cp -a service/dist/* ./AIWebQuickDeploy/dist
cp -r admin/dist/* ./AIWebQuickDeploy/public/admin
cp -r chat/dist/* ./AIWebQuickDeploy/public/chat
cp -r service/src/public/open-docs/* ./AIWebQuickDeploy/public/open-docs

echo "打包完成"