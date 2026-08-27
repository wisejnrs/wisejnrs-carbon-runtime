# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] — 2026-06-01

Patch release covering interactive-shell papercuts found in post-v2.1.0 testing, plus a fix for a recurring Apache mirror flake that's been killing rebuilds.

### Fixed
- `mybash`: comment out 11 upstream alias definitions whose target commands aren't installed in this image — `rm → trash`, `vi/vim/vis → nvim`, `less/hlp → less`, `multitail`, `alert → notify-send`, `kssh → kitty`, `yayf → yay`, `whatismyip → whatsmyip`. Typing `vi` / `vim` / `rm` etc. now hits the real `/usr/bin/*` binary instead of either failing silently or piping through `trash-cli` with confusing `.Trash`-vs-`.Trash-1000` warnings on bind-mounted volumes (#16, #17).
- `carbon-compute/Dockerfile`: add `curl --retry 5 --retry-all-errors --retry-delay 10 --connect-timeout 30` to the Maven/Spark download step. `archive.apache.org` reliably resets connections mid-transfer on the ~370 MB Spark tarball, which was killing the whole build at 80-90% of the download. The retry rides out the flake (#18).

### How to revive any of the disabled aliases per-user
```bash
sed -i "s|^# alias vi=|alias vi=|" ~/.bashrc
. ~/.bashrc
```

## [2.1.0] — 2026-05-31

End-to-end refresh of the GPU-enabled runtime images: CUDA + PyTorch + ML stack upgrade, plus a sweep of pre-existing supervisord and upstream-asset regressions. Full session detail in [`SESSION-SUMMARY-2026-05-30.md`](SESSION-SUMMARY-2026-05-30.md).

### Added
- `delta-spark==2.4.0` Python package (the actual Delta Lake PySpark library; the previously-installed `delta` was a tiny unrelated lib) (#12)
- `spark.jars.packages = io.delta:delta-core_2.12:2.4.0` in `spark-defaults.conf` so Ivy fetches the JAR at SparkContext startup (#12 + #14)
- `tf-keras 2.21` compatibility shim so `transformers.pipeline()` auto-backend detection works with TensorFlow 2.21 + Keras 3 (#6)
- `zstd` apt package (needed by `tar --zstd` for the new Ollama asset format) (#2)
- `CARBON_DATA_DIR` / `CARBON_WORK_DIR` env-overridable mount defaults in `start-carbon-compute.sh` (#13)

### Changed
- CUDA base image: `nvidia/cuda:12.1.1-cudnn8` → `12.4.1-cudnn` for both pgvector-builder and base-system stages (#4)
- PyTorch: `2.4.0+cu121` → `2.6.0+cu124`; torchvision/torchaudio to matching cu124 wheels (#5)
- vLLM: 0.6.1 → 0.8.5.post1 (resolver-picked, compatible with torch 2.6)
- transformers cap loosened `<4.45` → `<5.0`; sentence-transformers `<3.2` → `<4.0`; pytorch-lightning `<2.4` → `<2.6` (#5)
- MLflow 3.9.0 → 3.12.0; apache-superset 6.0.0 → 6.1.0; dbt-core 1.11.2 → 1.11.11 (#9)
- 26 patch/minor bumps across the Production API & RAG stack (mangum, pydantic-settings, structlog, asyncpg, aioboto3, aws-lambda-powertools, boto3-stubs, PyMuPDF, pypdf, python-docx, xlsxwriter, qrcode, drawpyo, celery, arq, email-validator, apscheduler, python-crontab, prometheus-client, sentry-sdk, protego, QtPy, jupyter, qtconsole, psycopg2-binary, python-multipart) (#10)
- `start-carbon-compute.sh` default mounts: `/tmp/carbon-compute-{data,work}` → `/data` / `/work` (host paths) (#13)

### Fixed
- **mlflow / superset (FATAL)** — supervisord pointed at `/usr/local/bin/{mlflow,superset}` but pip installed under `/home/carbon/.local/bin/`; also fixed `superset.conf` `user=root` (deps live under carbon user's site-packages) (#1)
- **dbus (FATAL)** — `/run/dbus/pid` persisted across container restarts; wrapped the supervisord command to remove the stale pid file before starting (#1)
- **postgres-init (exit 1 every boot)** — `configure-services.sh` gated `postgres` by `ENABLE_POSTGRESQL` but didn't touch `postgres-init`, which then timed out waiting 60s for a server that was never started; gated both together (#1)
- **Ollama install (404 at build)** — upstream switched their Linux release assets from `.tgz` to `.tar.zst` after v0.6.0; updated URL + `tar --zstd` extraction (#2)
- **PySpark version mismatch** — `pyspark` was installed unpinned; resolver picked 4.x against the bundled Spark 3.4.1 JVM and any `SparkSession` died with `JavaPackage object is not callable`. Pinned `pyspark==3.4.1` (#11)
- **transformers + TensorFlow + Keras 3** — `pipeline()` without `framework="pt"` died on the TF backend; resolved by adding `tf-keras` (#6)

### Removed / Dropped pins
- `aiohttp==3.9.5` + its four coordinated dep pins (multidict, yarl, frozenlist, aiosignal) — addresses CVE-2024-23334 and CVE-2024-30251; aiohttp now floats to 3.13.5 (#3)
- `urllib3<2.3` — already broken in practice; urllib3 floats to 2.7.0 (#3)
- `markupsafe==2.1.1` — superset/jinja2 in this stack support Markupsafe 3.x; now at 3.0.3 (#3)

### Reverted
- Phase 3 numpy 2.x bump (#7 reverted by #8) — blocked by apache-superset 6.x hard-cap `pandas[excel]>=2.1.4,<2.2`. Waiting on upstream Superset 6.2+ to lift the cap. See [`SESSION-SUMMARY-2026-05-30.md`](SESSION-SUMMARY-2026-05-30.md) for the deferred list.

### Known minor inconsistency
- Image internal `LABEL version="2.0.0-gpu"` was not bumped (would have required a 50-min metadata-only rebuild). Release version is conveyed by Docker tag `:2.1.0`, this CHANGELOG entry, and GitHub release `v2.1.0`.

## [Old Unreleased — superseded by 2.1.0]

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