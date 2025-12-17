# Carbon Tools

Carbon Tools is a development and productivity tooling container built on top of carbon-base. It includes essential development tools, CLI utilities, and infrastructure management tools.

## Features

- **Development Tools**: Git, build tools, compilers
- **Infrastructure Tools**: Docker CLI, kubectl, Terraform, Ansible  
- **Cloud Tools**: AWS CLI, Azure CLI, Google Cloud CLI
- **Database Tools**: PostgreSQL, MySQL, Redis, MongoDB clients
- **Network Tools**: netcat, telnet, nmap
- **System Monitoring**: htop, iotop, iftop
- **Text Processing**: jq, yq, yamllint
- **HTTP Tools**: httpie for API testing

## Usage

### With Docker Compose

```bash
docker-compose up carbon-tools
```

### Standalone

```bash
docker run -it --rm \
  -v $(pwd)/work:/work \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wisejnrs/carbon-tools:latest
```

## Ports

- `8080`: General purpose web service
- `3000`: Additional web service

## Volumes

- `/work`: Main working directory
- `/data`: Data storage directory (PostgreSQL, MongoDB, Redis, and MariaDB data will be persisted here)

## Base Image

Built on `carbon-base` which provides the foundational environment with CUDA support, desktop environment, and basic utilities.