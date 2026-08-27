# Carbon Base Project Structure

This document provides an overview of the complete project structure and organization.

## Directory Structure

```
wisejnrs-carbon-runtime/
├── .git/                             # Git repository metadata
├── .github/                          # GitHub Actions workflows and templates
│   └── workflows/
│       ├── build-and-test.yml        # Main CI/CD pipeline
│       ├── deploy-ecr.yml            # AWS ECR deployment
│       ├── release.yml               # Release automation
│       └── security-and-maintenance.yml # Security scanning and maintenance
├── carbon-base/                      # Base Docker image
│   ├── Dockerfile                    # Base image definition
│   ├── entrypoint.sh                 # Container startup script
│   ├── fix-permissions               # Permission management script
│   ├── bash.bashrc                   # Bash configuration
│   ├── noVNC/                        # Web-based VNC client
│   ├── openbox-config/               # Desktop environment configuration
│   ├── vnc-passwd                    # VNC password file
│   ├── nuget.config                  # .NET package configuration
│   ├── xrdp.ini                      # Remote desktop configuration
│   └── .dockerignore                 # Docker build exclusions
├── carbon-tools/                     # Development tools Docker image
│   ├── Dockerfile                    # Tools image definition
│   ├── README.md                     # Tools image documentation
│   ├── rootfs/                       # Root filesystem additions
│   ├── userfs/                       # User filesystem additions
│   └── .dockerignore                 # Docker build exclusions
├── carbon-compute/                   # Compute Docker image
│   ├── Dockerfile                    # Compute image definition
│   ├── entrypoint.sh                 # Container startup script
│   ├── jupyter_notebook_config.py   # Jupyter configuration
│   ├── README.md                     # Compute image documentation
│   └── .dockerignore                 # Docker build exclusions
├── docs/                             # Project documentation
│   ├── README.md                     # Documentation index
│   └── aws-ecr-deployment.md         # AWS ECR deployment guide
├── examples/                         # Example configurations
│   ├── docker-compose.production.yml # Production deployment example
│   └── .env.example                  # Environment variables template
├── node_modules/                     # Node.js dependencies (includes Claude CLI)
├── package.json                      # Node.js package configuration
├── package-lock.json                 # Node.js dependency lock file
├── README.md                         # Main project documentation
├── CONTRIBUTING.md                   # Contribution guidelines
├── DEPLOYMENT.md                     # Deployment guide
├── PROJECT-STRUCTURE.md              # This file
├── LICENSE                           # MIT license
├── .gitignore                        # Git exclusions
└── docker-compose.yml                # Multi-service Docker Compose configuration
```

## Key Components

### Docker Images

#### carbon-base
- **Purpose**: Foundation image with core system components
- **Base**: nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04
- **Features**: 
  - CUDA 12.1.1 with cuDNN 8
  - Ubuntu 22.04 with Cinnamon desktop
  - VNC and noVNC for remote access
  - Essential system libraries and runtime
  - Desktop environment and basic applications
  - Database systems (PostgreSQL, MariaDB, MongoDB, Redis)

#### carbon-tools
- **Purpose**: Development and DevOps tooling environment
- **Base**: carbon-base
- **Features**:
  - Development tools (Node.js, Python, .NET, Swift)
  - DevOps tools (Docker CLI, kubectl, Terraform, Ansible)
  - Cloud CLIs (AWS, Azure, Google Cloud)
  - CLI utilities (GitHub CLI, jq, fzf, zoxide)
  - Database clients and monitoring tools
  - Network and system analysis tools

#### carbon-compute
- **Purpose**: Data science and machine learning environment
- **Base**: carbon-tools
- **Features**:
  - Jupyter Labs with extensive Python ecosystem
  - Apache Spark 3.4.1 with Hadoop 3.2
  - Machine learning frameworks (PyTorch, TensorFlow, scikit-learn)
  - VS Code Server integration
  - .NET Interactive kernels
  - Conda package management

### GitHub Actions Workflows

#### build-and-test.yml
- **Triggers**: Push to main/develop, pull requests
- **Features**:
  - Multi-platform builds (amd64, arm64)
  - Automated testing
  - Security scanning with Trivy
  - Integration tests
  - Change detection

#### deploy-ecr.yml
- **Triggers**: Push to main, releases, manual dispatch
- **Features**:
  - AWS ECR deployment
  - Environment-specific deployments (staging/production)
  - Automatic repository creation
  - Security scanning
  - Image tagging strategy

#### release.yml
- **Triggers**: Git tags (v*)
- **Features**:
  - Automated release creation
  - Multi-platform image builds
  - Changelog generation
  - Version management
  - Documentation updates

#### security-and-maintenance.yml
- **Triggers**: Daily schedule, manual dispatch
- **Features**:
  - Regular security scans
  - Dependency auditing
  - Performance monitoring
  - Maintenance reporting
  - Artifact cleanup

### Documentation

#### README.md
- Project overview and quick start guide
- Feature descriptions and architecture
- Installation and usage instructions
- Configuration examples

#### CONTRIBUTING.md
- Contribution guidelines and standards
- Development workflow
- Code review process
- Testing requirements

#### DEPLOYMENT.md
- Comprehensive deployment guide
- Environment-specific configurations
- Security considerations
- Troubleshooting guide

#### docs/aws-ecr-deployment.md
- Detailed AWS ECR setup guide
- IAM configuration
- GitHub secrets setup
- Cost optimization strategies

### Configuration Files

#### docker-compose.yml
- Default multi-service configuration
- Development-friendly settings
- Volume and network definitions
- Service dependencies

#### examples/docker-compose.production.yml
- Production-ready configuration
- Resource limits and health checks
- Monitoring integration
- Security hardening

#### examples/.env.example
- Environment variable template
- Configuration options
- Security settings
- Resource limits

## File Purposes

### Root Level Files

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation and quick start |
| `CONTRIBUTING.md` | Guidelines for contributors |
| `DEPLOYMENT.md` | Comprehensive deployment guide |
| `PROJECT-STRUCTURE.md` | This file - project organization |
| `LICENSE` | MIT license terms |
| `.gitignore` | Git exclusion patterns |
| `docker-compose.yml` | Multi-service Docker Compose configuration with profiles |
| `package.json` | Node.js dependencies (includes Claude CLI integration) |
| `package-lock.json` | Node.js dependency lock file |

### Docker Configuration

| File | Purpose |
|------|---------|
| `carbon-base/Dockerfile` | Base image build instructions |
| `carbon-tools/Dockerfile` | Development tools image build instructions |
| `carbon-compute/Dockerfile` | Compute image build instructions |
| `*/entrypoint.sh` | Container startup scripts |
| `*/.dockerignore` | Docker build exclusions |

### GitHub Actions

| File | Purpose |
|------|---------|
| `build-and-test.yml` | CI/CD pipeline for testing and building |
| `deploy-ecr.yml` | AWS ECR deployment automation |
| `release.yml` | Release process automation |
| `security-and-maintenance.yml` | Security and maintenance tasks |

### Documentation

| File | Purpose |
|------|---------|
| `docs/README.md` | Documentation index |
| `docs/aws-ecr-deployment.md` | AWS ECR deployment guide |

### Examples

| File | Purpose |
|------|---------|
| `examples/docker-compose.production.yml` | Production deployment template |
| `examples/.env.example` | Environment configuration template |

## Recent Updates

### Latest Changes
- Enhanced PostgreSQL integration with improved configuration
- Updated CLI tooling with Node.js dependencies  
- Improved .NET support and container orchestration
- Added comprehensive Docker Compose profiles for different deployment scenarios
- Enhanced database service integration (PostgreSQL, Redis, MongoDB)

## Development Workflow

### 1. Local Development
```bash
git clone https://github.com/wisejnrs/carbon-base.git
cd wisejnrs-carbon-runtime
# Install Node.js dependencies (includes Claude CLI)
npm install
# Start the full stack
docker-compose up -d
# Or start with specific profiles
docker-compose --profile databases up -d
docker-compose --profile spark-cluster up -d
```

### 2. Making Changes
```bash
git checkout -b feature/new-feature
# Make changes
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create pull request
```

### 3. Testing
- Automated tests run on pull requests
- Security scans validate changes
- Integration tests verify functionality

### 4. Deployment
- Merge to main triggers staging deployment
- Releases trigger production deployment
- Manual deployments available via GitHub Actions

## Maintenance

### Regular Tasks
- Security scans run daily
- Dependencies audited weekly
- Images rebuilt on base image updates
- Documentation kept current

### Monitoring
- Build status via GitHub Actions
- Security alerts via Trivy scans
- Performance metrics via container stats
- Usage tracking via Docker Hub/ECR

## Security

### Image Security
- Regular vulnerability scanning
- Base image updates
- Minimal attack surface
- Non-root user execution

### Access Control
- GitHub repository permissions
- AWS IAM roles and policies
- Container runtime security
- Network isolation

### Secrets Management
- GitHub secrets for CI/CD
- Environment variables for runtime
- Encrypted storage for sensitive data
- Regular secret rotation

## Scalability

### Horizontal Scaling
- Docker Compose replicas
- Kubernetes deployments
- Load balancer integration
- Service mesh compatibility

### Vertical Scaling
- Resource limit configuration
- GPU allocation management
- Memory and CPU tuning
- Storage optimization

## Future Enhancements

### Planned Features
- Kubernetes Helm charts
- Terraform infrastructure templates
- Additional ML frameworks
- Enhanced monitoring dashboards

### Optimization Opportunities
- Multi-stage build optimization
- Layer caching improvements
- Startup time reduction
- Resource usage optimization

This structure provides a solid foundation for a production-ready containerized data science environment with comprehensive CI/CD, security, and deployment capabilities.

