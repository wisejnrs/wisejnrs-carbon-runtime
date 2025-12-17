# Carbon Base Deployment Guide

This guide provides step-by-step instructions for deploying Carbon Base in various environments.

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/wisejnrs/carbon-base.git
cd carbon-base

# Start with Docker Compose
docker-compose up -d

# Access services
# Jupyter Labs: http://localhost:8888
# VS Code Server: http://localhost:9999
# VNC: http://localhost:6900
```

### Production Deployment

```bash
# Copy environment template
cp examples/.env.example .env

# Edit environment variables
nano .env

# Deploy with production configuration
docker-compose -f examples/docker-compose.production.yml up -d
```

## Deployment Options

### 1. Local Docker

**Best for**: Development, testing, single-user scenarios

```bash
# Simple deployment
docker run -d \
  --name carbon-compute \
  --gpus all \
  -p 8888:8888 \
  -p 9999:9999 \
  -v $(pwd)/work:/work \
  wisejnrs/carbon-compute:latest
```

### 2. Docker Compose

**Best for**: Multi-service deployments, development teams

```bash
# Standard deployment (base services only)
docker-compose up -d

# With databases (PostgreSQL, Redis, MongoDB)
docker-compose --profile databases up -d

# With Spark cluster
docker-compose --profile spark-cluster up -d

# With monitoring
docker-compose --profile monitoring up -d

# All services
docker-compose --profile databases --profile spark-cluster up -d
```

### 3. AWS ECR + ECS

**Best for**: Production, scalable cloud deployments

1. **Deploy to ECR** (automated via GitHub Actions)
2. **Create ECS Task Definition**:

```json
{
  "family": "carbon-compute",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "carbon-compute",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest",
      "memory": 8192,
      "cpu": 4096,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8888,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "JUPYTER_ENABLE_LAB",
          "value": "yes"
        }
      ]
    }
  ]
}
```

### 4. Kubernetes

**Best for**: Container orchestration, high availability

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbon-compute
spec:
  replicas: 1
  selector:
    matchLabels:
      app: carbon-compute
  template:
    metadata:
      labels:
        app: carbon-compute
    spec:
      containers:
      - name: carbon-compute
        image: wisejnrs/carbon-compute:latest
        ports:
        - containerPort: 8888
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
            nvidia.com/gpu: 1
          limits:
            memory: "8Gi"
            cpu: "4"
            nvidia.com/gpu: 1
```

## Environment-Specific Configurations

### Development

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  carbon-compute:
    build:
      context: ./carbon-compute
    volumes:
      - .:/workspace
      - ./work:/work
    environment:
      - DEBUG=true
      - DEVELOPMENT_MODE=true
```

### Staging

```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  carbon-compute:
    image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/carbon-compute-staging:latest
    environment:
      - ENVIRONMENT=staging
      - LOG_LEVEL=DEBUG
```

### Production

```yaml
# docker-compose.production.yml
version: '3.8'
services:
  carbon-compute:
    image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/carbon-compute:latest
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - LOG_LEVEL=INFO
    deploy:
      resources:
        limits:
          memory: 16G
          cpus: '8'
```

## Security Considerations

### Network Security

```bash
# Use custom networks
docker network create carbon-network --subnet=172.20.0.0/16

# Restrict port exposure
docker run -p 127.0.0.1:8888:8888 carbon-compute
```

### Authentication

```bash
# Set strong passwords
export JUPYTER_TOKEN=$(openssl rand -hex 32)
export VSCODE_PASSWORD=$(openssl rand -base64 32)

# Use environment files
echo "JUPYTER_TOKEN=$JUPYTER_TOKEN" >> .env
```

### SSL/TLS

```bash
# Generate self-signed certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# Use with nginx proxy
docker-compose --profile with-proxy up -d
```

## Monitoring and Logging

### Health Checks

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8888/api"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

### Logging Configuration

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"
```

### Monitoring Stack

```bash
# Deploy with monitoring
docker-compose --profile monitoring up -d

# Access monitoring
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000
```

## Scaling and Performance

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  carbon-compute:
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 8G
          cpus: '4'
```

### Vertical Scaling

```bash
# Increase resources
docker run --memory=16g --cpus=8 --gpus=2 carbon-compute
```

### Load Balancing

```yaml
# nginx.conf
upstream carbon_backend {
    server carbon-compute-1:8888;
    server carbon-compute-2:8888;
    server carbon-compute-3:8888;
}
```

## Backup and Recovery

### Data Backup

```bash
# Backup volumes
docker run --rm -v carbon_work:/data -v $(pwd):/backup \
  alpine tar czf /backup/work-backup.tar.gz /data

# Backup databases
docker exec postgres pg_dump -U carbon carbondb > backup.sql
```

### Disaster Recovery

```bash
# Restore from backup
docker run --rm -v carbon_work:/data -v $(pwd):/backup \
  alpine tar xzf /backup/work-backup.tar.gz -C /

# Restore database
docker exec -i postgres psql -U carbon carbondb < backup.sql
```

## Troubleshooting

### Common Issues

#### GPU Not Available

```bash
# Check NVIDIA runtime
docker run --rm --gpus all nvidia/cuda:11.8-base nvidia-smi

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

#### Port Conflicts

```bash
# Check port usage
netstat -tulpn | grep :8888

# Use different ports
docker run -p 8889:8888 carbon-compute
```

#### Memory Issues

```bash
# Check memory usage
docker stats

# Increase memory limits
docker run --memory=16g carbon-compute
```

### Debugging Commands

```bash
# Check container logs
docker logs carbon-compute

# Execute commands in container
docker exec -it carbon-compute bash

# Check container resources
docker inspect carbon-compute

# Monitor container performance
docker stats carbon-compute
```

## Performance Optimization

### Image Optimization

```dockerfile
# Multi-stage builds
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04 AS builder
# Build dependencies
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS runtime
# Copy only necessary files
```

### Resource Tuning

```yaml
# Optimize for your workload
environment:
  - SPARK_WORKER_MEMORY=8g
  - SPARK_WORKER_CORES=4
  - JUPYTER_CONFIG_DIR=/opt/jupyter
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

### Caching Strategies

```bash
# Use build cache
docker build --cache-from carbon-base:latest .

# Use registry cache
docker buildx build --cache-from type=registry,ref=carbon-base:cache .
```

## Migration Guide

### From Docker Hub to ECR

```bash
# Pull from Docker Hub
docker pull wisejnrs/carbon-compute:latest

# Tag for ECR
docker tag wisejnrs/carbon-compute:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest
```

### Version Upgrades

```bash
# Backup current data
docker-compose down
docker run --rm -v carbon_work:/data -v $(pwd):/backup \
  alpine tar czf /backup/pre-upgrade-backup.tar.gz /data

# Pull new version
docker-compose pull

# Start with new version
docker-compose up -d

# Verify upgrade
docker-compose logs -f
```

## Support and Maintenance

### Regular Maintenance

```bash
# Update images
docker-compose pull && docker-compose up -d

# Clean up unused resources
docker system prune -a

# Update security patches
docker build --no-cache .
```

### Health Monitoring

```bash
# Check service health
curl -f http://localhost:8888/api || echo "Service unhealthy"

# Monitor resource usage
docker stats --no-stream

# Check logs for errors
docker logs carbon-compute 2>&1 | grep -i error
```

For additional support, please refer to:
- [Project Documentation](docs/)
- [GitHub Issues](https://github.com/wisejnrs/carbon-base/issues)
- [Contributing Guide](CONTRIBUTING.md)

