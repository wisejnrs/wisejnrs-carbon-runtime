# Contributing to Carbon Base

Thank you for your interest in contributing to Carbon Base! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and constructive in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Docker Engine 20.10+ or Docker Desktop
- Git 2.20+
- Basic understanding of Docker, Linux, and containerization
- NVIDIA GPU and drivers (for GPU-related contributions)
- At least 16GB RAM and 50GB free disk space

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/carbon-base.git
   cd carbon-base
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/wisejnrs/carbon-base.git
   ```

## Development Setup

### Local Development Environment

1. **Build the images locally:**
   ```bash
   # Build base image
   docker build -t carbon-base:dev ./carbon-base
   
   # Build compute image
   docker build --build-arg ROOT_CONTAINER=carbon-base:dev -t carbon-compute:dev ./carbon-compute
   ```

2. **Run development containers:**
   ```bash
   # Using docker-compose
   docker-compose -f docker-compose.dev.yml up -d
   
   # Or run individual containers
   docker run -it --rm --gpus all -v $(pwd):/workspace carbon-compute:dev bash
   ```

3. **Set up development tools:**
   ```bash
   # Install development dependencies
   pip install -r requirements-dev.txt
   
   # Install pre-commit hooks
   pre-commit install
   ```

### Development Containers

For consistent development environments, use the provided development containers:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Access development container
docker exec -it carbon-compute-dev bash
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues in existing functionality
- **Feature additions**: Add new capabilities or tools
- **Documentation**: Improve or add documentation
- **Performance improvements**: Optimize existing code or configurations
- **Security enhancements**: Address security vulnerabilities
- **Testing**: Add or improve test coverage

### Contribution Areas

#### Docker Images
- **Base Image (`carbon-base/`)**: System packages, development tools, desktop environment
- **Compute Image (`carbon-compute/`)**: Data science tools, Jupyter, Spark, ML libraries

#### Documentation
- **README files**: Usage instructions and examples
- **API documentation**: Code and configuration documentation
- **Tutorials**: Step-by-step guides for common workflows

#### CI/CD and Automation
- **GitHub Actions**: Build, test, and deployment workflows
- **Scripts**: Automation and utility scripts
- **Configuration**: Docker Compose and environment configurations

### Coding Standards

#### Dockerfile Best Practices
- Use multi-stage builds where appropriate
- Minimize layer count and image size
- Use specific version tags for base images
- Group related RUN commands
- Clean up package caches and temporary files
- Use non-root users when possible

```dockerfile
# Good example
RUN apt-get update && apt-get install -y \
    package1 \
    package2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```

#### Shell Script Standards
- Use `#!/bin/bash` shebang
- Enable strict mode: `set -euo pipefail`
- Quote variables: `"$variable"`
- Use meaningful variable names
- Add comments for complex logic

#### Python Code Standards
- Follow PEP 8 style guidelines
- Use type hints where appropriate
- Write docstrings for functions and classes
- Use meaningful variable and function names
- Keep functions focused and small

#### Documentation Standards
- Use clear, concise language
- Include code examples
- Keep documentation up-to-date with code changes
- Use proper Markdown formatting
- Include table of contents for long documents

## Pull Request Process

### Before Submitting

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes:**
   - Follow coding standards
   - Add tests if applicable
   - Update documentation
   - Test your changes locally

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(compute): add PyTorch 2.0 support
fix(base): resolve CUDA driver compatibility issue
docs(readme): update installation instructions
```

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Tests added/updated for changes
- [ ] Documentation updated
- [ ] No merge conflicts with main branch
- [ ] All CI checks pass
- [ ] Linked to relevant issues

### Pull Request Template

When creating a pull request, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Other (specify)

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

## Issue Reporting

### Bug Reports

When reporting bugs, include:

1. **Environment information:**
   - OS and version
   - Docker version
   - GPU information (if applicable)
   - Image version/tag

2. **Steps to reproduce:**
   - Exact commands used
   - Configuration files
   - Input data (if applicable)

3. **Expected vs actual behavior:**
   - What you expected to happen
   - What actually happened
   - Error messages or logs

4. **Additional context:**
   - Screenshots (if applicable)
   - Related issues or PRs

### Feature Requests

For feature requests, provide:

1. **Problem description:**
   - What problem does this solve?
   - Who would benefit from this feature?

2. **Proposed solution:**
   - Detailed description of the feature
   - Alternative solutions considered

3. **Implementation details:**
   - Technical requirements
   - Potential challenges
   - Breaking changes

## Development Workflow

### Branch Strategy

- `main`: Stable release branch
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical bug fixes
- `release/*`: Release preparation branches

### Release Process

1. **Feature development:**
   ```bash
   git checkout develop
   git checkout -b feature/new-feature
   # Develop feature
   git push origin feature/new-feature
   # Create PR to develop
   ```

2. **Release preparation:**
   ```bash
   git checkout develop
   git checkout -b release/v1.2.0
   # Update version numbers, changelog
   git push origin release/v1.2.0
   # Create PR to main
   ```

3. **Hotfixes:**
   ```bash
   git checkout main
   git checkout -b hotfix/critical-fix
   # Fix issue
   git push origin hotfix/critical-fix
   # Create PR to main and develop
   ```

## Testing

### Local Testing

1. **Build and test images:**
   ```bash
   # Build images
   make build
   
   # Run tests
   make test
   
   # Test specific functionality
   make test-jupyter
   make test-spark
   ```

2. **Manual testing:**
   ```bash
   # Start containers
   docker-compose up -d
   
   # Test services
   curl http://localhost:8888
   curl http://localhost:9999
   ```

3. **GPU testing:**
   ```bash
   # Test CUDA availability
   docker run --rm --gpus all carbon-compute:dev nvidia-smi
   
   # Test PyTorch GPU
   docker run --rm --gpus all carbon-compute:dev python -c "import torch; print(torch.cuda.is_available())"
   ```

### Automated Testing

The project uses GitHub Actions for automated testing:

- **Build tests**: Verify images build successfully
- **Functionality tests**: Test key features and services
- **Security scans**: Scan for vulnerabilities
- **Performance tests**: Benchmark critical operations

### Test Categories

1. **Unit tests**: Test individual components
2. **Integration tests**: Test component interactions
3. **End-to-end tests**: Test complete workflows
4. **Performance tests**: Measure resource usage and speed
5. **Security tests**: Vulnerability and compliance checks

## Documentation

### Documentation Types

1. **User documentation**: Installation, usage, tutorials
2. **Developer documentation**: API references, architecture
3. **Operational documentation**: Deployment, monitoring, troubleshooting

### Documentation Standards

- Use clear, concise language
- Include practical examples
- Keep documentation current
- Use proper formatting and structure
- Include diagrams where helpful

### Building Documentation

```bash
# Install documentation dependencies
pip install -r docs/requirements.txt

# Build documentation
cd docs
make html

# Serve documentation locally
make serve
```

## Getting Help

### Communication Channels

- **Website**: [wisejnrs.net](https://www.wisejnrs.net) - Visit for more projects and resources
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Email**: mike@wisejnrs.net for direct contact

### Resources

- [Docker Documentation](https://docs.docker.com/)
- [NVIDIA Container Toolkit](https://github.com/NVIDIA/nvidia-docker)
- [Jupyter Documentation](https://jupyter.readthedocs.io/)
- [Apache Spark Documentation](https://spark.apache.org/docs/latest/)

## Recognition

Contributors will be recognized in:

- `CONTRIBUTORS.md` file
- Release notes
- Project documentation
- GitHub contributor graphs

Thank you for contributing to Carbon Base! Your efforts help make this project better for everyone.

---

**Project by [Michael Wise (WiseJNRS)](https://www.wisejnrs.net)**

