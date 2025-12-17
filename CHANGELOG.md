# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive Docker Compose configuration with service profiles
- Enhanced PostgreSQL integration with improved configuration
- Added Redis and MongoDB services with Docker Compose profiles
- Node.js dependencies including Claude CLI integration
- Spark cluster deployment profile for distributed computing
- Enhanced database service integration across all components

### Changed
- Updated project structure documentation to reflect current directory layout
- Improved Docker Compose deployment instructions with profile usage
- Enhanced README with current port mappings and service access information
- Updated deployment guide with multi-service configuration examples

### Fixed
- Corrected port mappings in documentation to match actual Docker Compose configuration
- Updated service access URLs and credentials in quick start guide

## Recent Commits

### Latest Updates (August 2025)
- `1734ee3` - Updates work: General improvements and refinements
- `243cba1` - Updates to fix: Bug fixes and stability improvements  
- `7ecee0c` - Updates for PostgreSQL: Enhanced PostgreSQL integration and configuration
- `cb324c7` - Updated .NET: Improved .NET support and tooling
- `e85ec81` - Updates for CLI and PostgreSQL: Enhanced command-line interface and database integration

## Infrastructure

### Docker Services
- **carbon-base**: Foundation image with CUDA, desktop environment, and development tools
- **carbon-compute**: Data science workbench with Jupyter, Spark, and ML frameworks
- **PostgreSQL**: Primary database service (port 5432/5433)
- **Redis**: In-memory data store (port 6379/6380) 
- **MongoDB**: Document database (port 27017)
- **Spark Master/Worker**: Distributed computing cluster (ports 7077, 4040, 8080/8081)

### Network Configuration
- Custom bridge network: `carbon-network` (172.20.0.0/16)
- Service discovery via container names
- Volume persistence for data and configurations

### Development Tools
- Jupyter Labs with extensive Python ecosystem
- VS Code Server for browser-based development
- VNC/noVNC for desktop access
- Claude CLI for AI-assisted development

---

For more detailed information, see the [README](README.md) and [DEPLOYMENT](DEPLOYMENT.md) guides.