# Carbon Runtime v2.1.0 - Session Summary

**Dates:** 2026-05-30 – 2026-05-31
**Release:** [v2.1.0](https://github.com/wisejnrs/wisejnrs-carbon-runtime/releases/tag/v2.1.0)
**Scope:** carbon-base + carbon-compute (`linux/amd64` GPU build)
**Status:** ✅ COMPLETE — all changes merged, both images rebuilt, full end-to-end smoke verified

---

## 🎯 Goal

Catch up the GPU-enabled runtime images on stale supervisord units, retired upstream artifacts (Ollama `.tgz` → `.tar.zst`), pip pins, the CUDA base image, and the Python ML stack — without regressing any of the existing services.

---

## 📦 Image Versions

| Image | Tag | sha256 | Size |
|---|---|---|---|
| `wisejnrs/carbon-base` | `2.1.0` / `latest` | `fffd1a82d5fe` | 20.5 GB |
| `wisejnrs/carbon-compute` | `2.1.0` / `latest` | `c76545679da5` | 53 GB |

Both pushed to Docker Hub on 2026-05-31.

---

## 🚢 PRs Landed (14 total)

### Bug fixes — supervisord/runtime regressions
- [#1](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/1) — Fix four supervisord units that have always failed at runtime (mlflow + superset binary paths, dbus stale pid, postgres-init gating)
- [#2](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/2) — Fix Ollama install: upstream switched `.tgz` → `.tar.zst`
- [#11](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/11) — Pin `pyspark==3.4.1` to match the bundled Spark 3.4.1 JVM
- [#12](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/12) — Install `delta-spark` + add JAR via `spark.jars.packages`
- [#14](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/14) — Fix Delta Maven artifact: `delta-spark_2.12` → `delta-core_2.12` (Delta 2.x naming)

### Pip upgrade phases
- [#3](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/3) — **Phase 0:** drop stale security pins (`aiohttp`, `urllib3`, `markupsafe`)
- [#4](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/4) — **Phase 1:** CUDA base image 12.1.1 → 12.4.1
- [#5](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/5) — **Phase 2:** PyTorch 2.4 → 2.6 (cu124 wheels) + loosen ML stack
- [#7](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/7) — **Phase 3:** enable numpy 2.x by unblocking pandas
- [#8](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/8) — Revert Phase 3 (Superset 6.x hard-caps `pandas<2.2`; no upstream fix yet)
- [#6](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/6) — Fix transformers + TensorFlow + Keras 3 incompatibility (`tf-keras`)
- [#9](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/9) — Bump Databricks-OSS pins: mlflow 3.9→3.12, superset 6.0→6.1, dbt-core 1.11.2→1.11.11
- [#10](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/10) — Long-tail: bump 26 patch/minor pins in API/RAG stack

### Operator UX
- [#13](https://github.com/wisejnrs/wisejnrs-carbon-runtime/pull/13) — `start-carbon-compute.sh`: bind-mount real host `/work` and `/data` by default (overridable via `CARBON_DATA_DIR` / `CARBON_WORK_DIR`)

---

## 🧪 Verified End-to-End

| Area | Result |
|---|---|
| 11 supervisord units | all RUNNING (`mlflow`, `superset`, `dbus`, `jupyter`, `code-server`, `spark-master`, `spark-worker`, `sshd`, `vnc`, `xrdp`, `xrdp-sesman`) |
| Web endpoints | mlflow `:5000`, superset `:8088`, jupyter `:8890`, code-server `:9999`, novnc `:6900`, spark UIs `:8080`/`:8081` — all respond |
| SSH | `:2222` open |
| GPU | `nvidia-smi` sees GTX 1070 via driver 570.133.07 |
| **torch GPU matmul** | `torch 2.6.0+cu124` on CUDA 12.4 — `1024×1024` matmul OK |
| **transformers GPU** | distilbert sentiment pipeline returns label+score on cuda:0 **without `framework="pt"` hint** (tf-keras shim works) |
| vLLM import | `vllm 0.8.5.post1`, auto-detects CUDA platform |
| tensorflow + keras 3 | `tf 2.21.0` + `keras 3.12.2` happily coexist |
| opencv numpy ABI | `cv2 4.11.0`, BGR→GRAY conversion OK |
| MLflow | log+read metric round-trip via the running server |
| DB drivers | 7/7 import (`asyncpg`, `psycopg2`, `psycopg` v3, `pymongo`, `redis`, `oracledb`, `pymssql`) |
| Long-tail bumped libs | 30/30 import |
| Ollama | binary at `/usr/local/bin/ollama`, client v0.24.0 |
| **Spark + Delta** | full ACID round-trip: write/read/append/time-travel against the live `spark://localhost:7077` cluster |
| Container mounts | host `/work` and `/data` visible inside container |

---

## ⛔ Deferred (Superset 6.x is the floor on these)

Apache Superset 6.0/6.1 hard-cap `pandas[excel]>=2.1.4,<2.2`, which pins numpy at 1.x. Removed once upstream releases 6.2+:

- **numpy 2.x** — attempted in PR #7, reverted in PR #8
- **cryptography 47/48** — Superset 6.1 lifted its cap from `<45` to `<47`, so we float at 46.x today (PR #9)
- **pandas 2.2/2.3**

## ⛔ Deferred (separate audit work)

- **transformers 4 → 5** — major API breaks (tokenizer surface, etc.) → needs notebook audit before bumping
- **trafilatura 1 → 2**, **weasyprint 61 → 68**, **aiosmtplib 3 → 5**, **limits 3 → 5**, **et-xmlfile 1 → 2**, **unstructured 0.16 → 0.22**, **duckduckgo-search 7 → 8** — each is a major or 0.x churn that warrants its own focused PR (inline comments in `carbon-compute/Dockerfile` flag the cap and the reason at each pin)

## 📝 Known minor inconsistency

The image internal `LABEL version="2.0.0-gpu"` (carbon-base/Dockerfile:27) was **not** bumped in this release — doing so would have required a full ~50-minute carbon-base + carbon-compute rebuild for a metadata change only. The release version is conveyed by the `:2.1.0` Docker tag, `CHANGELOG.md` `[2.1.0]` entry, and the GitHub `v2.1.0` release. The next functional rebuild can absorb the LABEL bump.

## 🧹 Side housekeeping during the session

- Reclaimed ~135 GB host disk by pruning buildx caches (carbon-builder 92.9 GB + multiplatform 42.4 GB) and dangling docker images
- Applied 9 host apt upgrades including `nvidia-container-toolkit` 1.19.0 → 1.19.1 (with docker restart)
- Saved a memory note for future Claude sessions: `apache-superset 6.x is the floor on numpy 2.x + cryptography 47 in this image`

---

## 🔧 How to roll forward

```bash
docker pull wisejnrs/carbon-compute:2.1.0   # pin to this release
# or
docker pull wisejnrs/carbon-compute:latest  # track main
./start-carbon-compute.sh                   # uses /work and /data by default
```

To override mount paths if your host layout differs:
```bash
CARBON_DATA_DIR=/srv/data CARBON_WORK_DIR=/srv/work ./start-carbon-compute.sh
```
