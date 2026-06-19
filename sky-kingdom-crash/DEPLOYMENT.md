# Deployment Guide

## Architecture
- PostgreSQL 14
- Redis 6.2
- Node.js 18
- Nginx reverse proxy
- Dockerized services
- Kubernetes for orchestration

## Build Process
1. Pull latest code from repository
2. Run `npm install` in backend and client directories
3. Build Dart frontend with `flutter build`
4. Generate PostgreSQL migrations (`npx prisma migrate dev`)
5. Deploy to Docker containers:
   - `docker build -t sky-kingdom-crash:backend`
   - `docker build -t sky-kingdom-crash:frontend`
6. Push to container registry
7. Deploy to Kubernetes cluster

## Environment Setup
- Set PORT=3000 for backend
- Configure Redis connection in `.env`
- Set CORS_ORIGINS in environment variables
- Enable SSL for production

## Monitoring
- Prometheus + Grafana dashboards
- Redis monitoring via Redis Docker image
- Log aggregation with ELK stack

## Rollback
- Keep Docker image tags with version numbers
- Maintain backup scripts for database dumps
