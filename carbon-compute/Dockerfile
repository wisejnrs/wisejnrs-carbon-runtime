# ===== Compute image built on GPU-enabled base =====
ARG ROOT_CONTAINER=wisejnrs/carbon-base:latest
FROM $ROOT_CONTAINER AS carbon-compute

# ---------- Args & Env ----------
ARG DEFAULT_USER="carbon"
ARG DEFAULT_UID="1000"
ARG DEFAULT_GID="100"
ARG PYTHON_VERSION=default
ARG DEBIAN_FRONTEND=noninteractive
ARG DOTNET_SPARK_VERSION=2.1.1
ARG SPARK_VERSION=3.4.1            # set "latest" to auto-resolve at build time
ARG HADOOP_VERSION=3.2             # hadoop flavor derived from the major version
ARG MAVEN_VERSION=3.9.4            # set "latest" to auto-resolve at build time

ENV DOTNET_SPARK_VERSION=${DOTNET_SPARK_VERSION} \
    DOTNET_WORKER_DIR=/dotnet/Microsoft.Spark.Worker-${DOTNET_SPARK_VERSION} \
    DOCKER_NAME="carbon-compute" \
    CONDA_DIR="/opt/conda" \
    DOTNETBACKEND_PORT=5567 \
    JUPYTER_ENABLE_LAB=true \
    SPARK_VERSION=${SPARK_VERSION} \
    SPARK_HOME=/spark \
    PYTHON_UNBUFFERED=1 \
    M2_HOME=/usr/local/bin/maven/current \
    TF_ENABLE_ONEDNN_OPTS=0 \
    DISPLAY=":1"

# GPU/runtime friendliness
ENV PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:128,expandable_segments:True" \
    MALLOC_TRIM_THRESHOLD_="268435456" \
    NCCL_LAUNCH_MODE=GROUP \
    NCCL_ASYNC_ERROR_HANDLING=1 \
    UV_THREADPOOL_SIZE=32 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    CUDA_DEVICE_ORDER=PCI_BUS_ID

ENV PATH="${PATH}:${CONDA_DIR}/bin:${M2_HOME}/bin:/opt/crashsdk/bin"

# ---------- Prep dirs ----------
USER root
RUN set -uex \
    && mkdir -p "${CONDA_DIR}" \
    && chmod 777 "${CONDA_DIR}" \
    && chown -R "${DEFAULT_USER}:${DEFAULT_USER}" "${CONDA_DIR}" \
    && install -d -m 0755 /var/log/jupyter /var/log/code-server \
    && chown -R "${DEFAULT_USER}:${DEFAULT_USER}" /var/log/jupyter /var/log/code-server

# ===== Copy local rootfs into container root =====
COPY --chown=root:root rootfs/ /

# Normalize CRLF and make helper scripts executable
RUN set -eux; \
  find /usr/local/bin -maxdepth 1 -type f -name '*.sh' -print \
    -exec sed -i 's/\r$//' {} \; \
    -exec chmod 0755 {} \; ; \
  for f in /usr/local/bin/fix-permissions; do \
    [ -f "$f" ] || continue; sed -i 's/\r$//' "$f"; chmod 0755 "$f"; \
  done

# ---------- Conda (robust installer with fallbacks) ----------
USER ${DEFAULT_UID}
WORKDIR /tmp
RUN set -uex; \
  arch="$(uname -m)"; \
  case "$arch" in \
    x86_64|amd64)  M_ARCH="x86_64" ;; \
    aarch64|arm64) M_ARCH="aarch64" ;; \
    *)             M_ARCH="$arch"  ;; \
  esac; \
  urls=" \
    https://github.com/conda-forge/miniforge/releases/latest/download/Mambaforge-Linux-${M_ARCH}.sh \
    https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-${M_ARCH}.sh \
    https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-${M_ARCH}.sh \
  "; \
  for u in $urls; do \
    echo "Trying $u"; \
    if curl -fsSL "$u" -o /tmp/conda_installer.sh; then \
      echo "Downloaded: $u"; break; \
    fi; \
  done; \
  /bin/bash /tmp/conda_installer.sh -f -b -p "${CONDA_DIR}"; \
  rm -f /tmp/conda_installer.sh; \
  if ! "${CONDA_DIR}/bin/mamba" --version >/dev/null 2>&1; then \
    "${CONDA_DIR}/bin/conda" install -n base -c conda-forge -y mamba; \
  fi; \
  "${CONDA_DIR}/bin/conda" config --system --set auto_update_conda false; \
  "${CONDA_DIR}/bin/conda" config --system --set show_channel_urls true; \
  if [ "${PYTHON_VERSION}" != "default" ]; then "${CONDA_DIR}/bin/mamba" install -y python="${PYTHON_VERSION}"; fi; \
  "${CONDA_DIR}/bin/mamba" list python | awk '/^python[[:space:]]/{print $1" "$2}' >> "${CONDA_DIR}/conda-meta/pinned"; \
  "${CONDA_DIR}/bin/conda" config --append channels nvidia; \
  "${CONDA_DIR}/bin/conda" config --append channels main; \
  "${CONDA_DIR}/bin/conda" update --all -y; \
  python3 --version; \
  "${CONDA_DIR}/bin/mamba" install -y notebook jupyterhub jupyterlab==3.6.6 xeus-python; \
  "${CONDA_DIR}/bin/mamba" clean --all -f -y; \
  "${CONDA_DIR}/bin/jupyter" notebook --generate-config; \
  "${CONDA_DIR}/bin/jupyter" lab clean; \
  /usr/local/bin/fix-permissions "${CONDA_DIR}"; \
  /usr/local/bin/fix-permissions "/home/${DEFAULT_USER}"

# ---------- Fetch Maven & Spark from official sources (with archive fallbacks) ----------
USER root
RUN set -uex \
    && HADOOP_MAJOR="$(echo "${HADOOP_VERSION}" | cut -d. -f1)" \
    && HADOOP_FLAVOR="hadoop${HADOOP_MAJOR}" \
    \
    # ----- Maven (MAVEN_VERSION or latest) -----
    && if [ "${MAVEN_VERSION}" = "latest" ]; then \
         MAVEN_VERSION="$(curl -fsSL https://downloads.apache.org/maven/maven-3/ \
           | grep -oE 'href=\"[0-9]+\.[0-9]+\.[0-9]+/' \
           | sed 's|href=\"||;s|/||' | sort -V | tail -1)"; \
       fi \
    && MAVEN_TGZ="apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    && ( curl -fL "https://downloads.apache.org/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TGZ}" -o "/tmp/${MAVEN_TGZ}" \
         || curl -fL "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/${MAVEN_TGZ}" -o "/tmp/${MAVEN_TGZ}" ) \
    \
    # ----- Spark (SPARK_VERSION or latest) -----
    && if [ "${SPARK_VERSION}" = "latest" ]; then \
         SPARK_VERSION="$(curl -fsSL https://downloads.apache.org/spark/ \
           | grep -oE 'spark-[0-9]+\.[0-9]+\.[0-9]+/' \
           | sed 's|spark-||;s|/||' | sort -V | tail -1)"; \
       fi \
    && SPARK_TGZ="spark-${SPARK_VERSION}-bin-${HADOOP_FLAVOR}.tgz" \
    && ( curl -fL "https://downloads.apache.org/spark/spark-${SPARK_VERSION}/${SPARK_TGZ}" -o "/tmp/${SPARK_TGZ}" \
         || curl -fL "https://archive.apache.org/dist/spark/spark-${SPARK_VERSION}/${SPARK_TGZ}" -o "/tmp/${SPARK_TGZ}" )

# ---------- Install Maven ----------
RUN set -uex \
    && mkdir -p /usr/local/bin/maven \
    && cd /usr/local/bin/maven \
    && tar -xvzf "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    && ln -s "apache-maven-${MAVEN_VERSION}" current \
    && rm -f "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    \
    && git clone https://github.com/dotnet/spark.git "/home/${DEFAULT_USER}/dotnet.spark" \
    && mkdir -p "/home/${DEFAULT_USER}/.nuget/NuGet" \
    && cp "/home/${DEFAULT_USER}/dotnet.spark/NuGet.config" "/home/${DEFAULT_USER}/.nuget/NuGet/NuGet.Config" \
    && chown -R "${DEFAULT_USER}:${DEFAULT_USER}" /usr/local/bin/maven "/home/${DEFAULT_USER}/dotnet.spark" "/home/${DEFAULT_USER}/.nuget"

# ---------- Install Spark ----------
RUN set -uex; \
    HADOOP_MAJOR="$(echo "${HADOOP_VERSION}" | cut -d. -f1)"; \
    HADOOP_FLAVOR="hadoop${HADOOP_MAJOR}"; \
    tar -xvzf "/tmp/spark-${SPARK_VERSION}-bin-${HADOOP_FLAVOR}.tgz"; \
    mv "spark-${SPARK_VERSION}-bin-${HADOOP_FLAVOR}" "${SPARK_HOME}"; \
    rm -f "/tmp/spark-${SPARK_VERSION}-bin-${HADOOP_FLAVOR}.tgz"; \
    chown -R "${DEFAULT_USER}:${DEFAULT_USER}" "${SPARK_HOME}"; \
    mkdir -p "${SPARK_HOME}/conf" && cp -a /etc/spark/conf/. "${SPARK_HOME}/conf/"

# ---------- Work dir ----------
RUN set -uex \
    && mkdir -p /work \
    && chmod 777 /work \
    && chown -R "${DEFAULT_USER}:${DEFAULT_USER}" /work

# ---------- User env ----------
USER ${DEFAULT_UID}

# Optional user-layer files (now chowned)
COPY --chown=${DEFAULT_UID}:${DEFAULT_UID} userfs/ /home/${DEFAULT_USER}

WORKDIR "/home/${DEFAULT_USER}"
ENV PATH="${PATH}:${HOME}/.dotnet:${HOME}/.dotnet/tools:${ORACLE_HOME}:${ORACLE_BASE}/sqldeveloper:${HOME}/.local/bin"

# Extra safety: ensure ownership of entire home (covers any pre-existing root-owned bits)
USER root
RUN chown -R ${DEFAULT_UID}:${DEFAULT_UID} /home/${DEFAULT_USER}
USER ${DEFAULT_UID}

# ---------- code-server + extensions ----------
RUN set -uex \
    && curl -fsSL https://code-server.dev/install.sh | sh \
    && mkdir -p "$HOME/.config/code-server" "$HOME/.local/share/code-server/extensions" \
    && printf "bind-addr: 0.0.0.0:9999\nauth: password\ncert: false\n" > "$HOME/.config/code-server/config.yaml" \
    \
    && EXTS="\
anthropic.claude-code \
ms-vscode.cpptools \
llvm-vs-code-extensions.vscode-clangd \
eg2.vscode-npm-script \
esbenp.prettier-vscode \
GitHub.copilot \
humao.rest-client \
liviuschera.noctis \
mhutchie.git-graph \
tintoy.msbuild-project-tools \
fernandoescolar.vscode-solution-explorer \
mikestead.dotenv \
foxundermoon.shell-format \
hashicorp.terraform \
visualstudioexptteam.vscodeintellicode \
amazonwebservices.aws-toolkit-vscode \
tyriar.sort-lines \
formulahendry.dotnet-test-explorer \
ms-azuretools.vscode-docker \
ms-azure-devops.azure-pipelines \
ms-azuretools.vscode-apimanagement \
ms-azuretools.vscode-azureappservice \
ms-azuretools.vscode-azurefunctions \
ms-azuretools.vscode-azureresourcegroups \
ms-azuretools.vscode-azurestorage \
ms-azuretools.vscode-azurevirtualmachines \
ms-azuretools.vscode-bicep \
ms-azuretools.vscode-cosmosdb \
ms-dotnettools.csharp \
ms-dotnettools.vscode-dotnet-runtime \
ms-toolsai.jupyter \
ms-vscode-remote.remote-containers \
ms-vscode-remote.remote-ssh \
ms-vscode-remote.remote-ssh-edit \
ms-vscode-remote.remote-wsl \
ms-vscode-remote.vscode-remote-extensionpack \
ms-vscode.azure-account \
ms-vscode.azurecli \
ms-vscode.powershell \
ms-vscode.vscode-node-azure-pack \
ms-vscode.vscode-typescript-tslint-plugin \
ms-vsliveshare.vsliveshare \
msazurermtools.azurerm-vscode-tools \
msjsdiag.debugger-for-chrome \
octref.vetur \
peakchen90.vue-beautify \
PKief.material-icon-theme \
vscode-icons-team.vscode-icons \
waderyan.gitblame \
yokawasa.jwt-debugger \
yzhang.markdown-all-in-one \
ms-python.python \
vahidk.tensorflow-snippets \
lamartire.git-indicators \
ms-vscode.hexeditor \
databricks.databricks \
dbaeumer.vscode-eslint \
ms-vscode.cmake-tools \
twxs.cmake \
ms-vscode.makefile-tools \
vadimcn.vscode-lldb \
jeff-hykin.better-cpp-syntax \
ms-python.isort \
ms-python.vscode-pylance \
13xforever.language-x86-64-assembly \
marus25.cortex-debug \
maziac.asm-code-lens \
maziac.z80-asm-meter \
" \
    && for ext in $EXTS; do \
         echo "Installing extension: $ext"; \
         code-server --install-extension "$ext" || echo "[warn] failed to install $ext (skipping)"; \
       done \
    && code-server --list-extensions \
    \
    && if [ -d /opt/vscode-vsix/nes ]; then \
         for vsix in /opt/vscode-vsix/nes/*.vsix; do \
           [ -e "$vsix" ] || continue; \
           echo "Installing NES VSIX: $vsix"; \
           code-server --install-extension "$vsix" || echo "[warn] failed to install $vsix"; \
         done; \
       fi

# ---------- .NET + Jupyter kernel (best-effort & resilient) ----------
# Create dirs as root (fixes "Operation not permitted" when they already exist root-owned)
USER root
RUN set -eux; \
    install -d -m 0755 /home/${DEFAULT_USER}/.jupyter \
                       /home/${DEFAULT_USER}/.local/share/jupyter \
                       /home/${DEFAULT_USER}/.config \
                       /home/${DEFAULT_USER}/.dotnet/tools; \
    chown -R ${DEFAULT_UID}:${DEFAULT_UID} /home/${DEFAULT_USER}
USER ${DEFAULT_UID}

WORKDIR /home/${DEFAULT_USER}
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
RUN set -eux; \
  dotnet new tool-manifest --force || true; \
  (dotnet tool install -g Microsoft.dotnet-interactive \
    || dotnet tool install -g Microsoft.dotnet-interactive --prerelease \
    || true); \
  if [ -x "$HOME/.dotnet/tools/dotnet-interactive" ]; then \
      "$HOME/.dotnet/tools/dotnet-interactive" --version || true; \
      "$HOME/.dotnet/tools/dotnet-interactive" jupyter install --path "$HOME/.local/share/jupyter" || true; \
  fi; \
  jupyter kernelspec list || true

# ---------- Python libs (split + constrained) ----------
# Constraints keep pip resolver saner for fast-moving libs
RUN set -uex \
 && cat > /tmp/py-constraints.txt <<'EOF'
torch==2.6.0
torchvision==0.21.0
torchaudio==2.6.0
transformers>=4.46,<5.0
pytorch-lightning>=2.3,<2.6
sentence-transformers>=3.2,<4.0
faiss-cpu>=1.8.0,<1.13
# Phase 3: numpy 2.x — pandas 2.1.4 is the only consumer in the stack
# still pinning numpy<2; bumping pandas≥2.2.2 unblocks numpy 2.x which
# opencv-python-headless and cupy already require at runtime.
numpy>=2.0,<2.3
pandas>=2.2.2
EOF

# 1) Core scientific
RUN set -uex \
 && pip install --upgrade pip \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    wheel packaging numpy pandas scipy scikit-learn scikit-image \
    statsmodels matplotlib seaborn plotly tensorflow keras tf-keras \
    opencv-python opencv-python-headless

# 2) PyTorch GPU (CUDA 12.4 wheels)
RUN set -uex \
 && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu124 \
    torch==2.6.0+cu124 torchvision==0.21.0+cu124 torchaudio==2.6.0+cu124

# 3) "big AI" stack
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pytorch-lightning transformers safetensors accelerate sentence-transformers

# 3.5) vLLM (GPU-accelerated LLM inference engine)
# Moved from carbon-base - this is an ML tool and belongs in carbon-compute
RUN set -uex \
 && CUDA_MAJ_MIN="$(/usr/local/cuda/bin/nvcc --version | sed -n 's/.*release \([0-9]\+\)\.\([0-9]\+\).*/\1\2/p' || true)"; \
    VLLM_PKG="vllm"; \
    if [ "$CUDA_MAJ_MIN" = "121" ]; then VLLM_PKG="vllm-cu121"; fi; \
    if [ "$CUDA_MAJ_MIN" = "122" ]; then VLLM_PKG="vllm-cu122"; fi; \
    if [ "$CUDA_MAJ_MIN" = "124" ] || [ "$CUDA_MAJ_MIN" = "125" ]; then VLLM_PKG="vllm-cu124"; fi; \
    pip install --no-cache-dir -c /tmp/py-constraints.txt "${VLLM_PKG}" || pip install --no-cache-dir -c /tmp/py-constraints.txt vllm; \
    install -d -m 0755 /var/log/vllm && chown -R ${DEFAULT_UID}:${DEFAULT_UID} /var/log/vllm; \
    echo "vLLM installed (GPU-enabled with CPU fallback)"

# 4) Data / cloud / notebooks / viz / NLP
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pyspark delta boto3 openai \
    ipywidgets ipyleaflet ipycanvas nteract_on_jupyter rise \
    ffmpeg-python librosa textblob spacy stanza \
    beautifulsoup4 requests artifacts-keyring pyyaml orjson \
    pygwalker squarify

# 5) DB / messaging / misc utils
# (note: 'delta' removed here to avoid duplicate install)
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pygit2 vpk faiss-cpu zmq \
    pymssql pymongo psycopg[binary] \
    sendsmtp PySmbClient oracledb \
    redis paho-mqtt pdfkit \
    marshmallow tabulate colorama openpyxl \
    qiskit \
    langchain \
    pyautogen \
    ollama \
    flask fastapi uvicorn qdrant-client

# Ensure user owns Jupyter dirs (prevents build-time permission errors)
USER root
RUN set -eux; \
  install -d -m 0755 -o ${DEFAULT_UID} -g ${DEFAULT_UID} \
    /home/${DEFAULT_USER}/.jupyter \
    /home/${DEFAULT_USER}/.local/share/jupyter \
    /home/${DEFAULT_USER}/.config; \
  chown -R ${DEFAULT_USER}:${DEFAULT_USER} /home/${DEFAULT_USER}
USER ${DEFAULT_UID}
ENV JUPYTER_CONFIG_DIR=/home/${DEFAULT_USER}/.jupyter

# ---------- Jupyter: Databricks-y experience (deps only; settings come from rootfs) ----------
USER ${DEFAULT_UID}
WORKDIR /home/${DEFAULT_USER}
RUN set -uex \
  && pip install --no-cache-dir \
       jupyterlab-lsp \
       "python-lsp-server[all]" \
       jupyterlab_code_formatter black isort autopep8 yapf \
       lckr-jupyterlab-variableinspector \
       jupyterlab-toc \
       jupyterlab_execute_time \
       jupyter-resource-usage jupyterlab-system-monitor jupyterlab-topbar-extension \
       ipython-sql sqlalchemy \
       jupytext nbdime \
       jupyterlab_latex jupyterlab-git jupyterlab_sql jupyterlab_executor ipyaggrid \
       ipywidgets ipyleaflet ipycanvas \
       jupyterlab-drawio ipydrawio ipydrawio-export \
  && jupyter server extension enable --sys-prefix jupyterlab_code_formatter || true \
  && jupyter server extension enable --sys-prefix jupyter_resource_usage || true \
  && jupyter server extension enable --sys-prefix jupyter_lsp || true \
  && jupyter server extension enable --sys-prefix ipydrawio || true \
  && pip cache purge

# ---------- Production API & RAG Stack ----------
# Install comprehensive production packages for API development and RAG
RUN set -uex \
 && pip install --no-cache-dir \
    # Web Framework & API
    mangum==0.18.0 \
    python-multipart==0.0.20 \
    pydantic-settings==2.6.1 \
    structlog==24.4.0 \
    # Database Drivers
    asyncpg==0.30.0 \
    psycopg2-binary==2.9.10 \
    # AWS SDK
    aioboto3==13.3.0 \
    'aws-lambda-powertools[all]==3.3.0' \
    'boto3-stubs[bedrock-runtime]==1.35.81' \
    # Document Processing for RAG
    'unstructured[pdf]==0.16.9' \
    PyMuPDF==1.24.14 \
    'pdfminer.six==20260107' \
    pypdf==6.6.0 \
    python-docx==1.1.2 \
    python-pptx==1.0.2 \
    trafilatura==1.12.2 \
    'markitdown[all]>=0.0.1' \
    # PDF Generation
    weasyprint==61.2 \
    pydyf==0.10.0 \
    # Visualization & Export
    xlsxwriter==3.2.0 \
    'qrcode[pil]==8.0' \
    drawpyo==0.2.3 \
    # Background Jobs
    'celery[redis]==5.4.0' \
    arq==0.26.1 \
    # Email & Notifications
    email-validator==2.2.0 \
    aiosmtplib==3.0.2 \
    # Scheduling
    apscheduler==3.10.4 \
    python-crontab==3.2.0 \
    # Rate Limiting
    slowapi==0.1.9 \
    limits==3.13.0 \
    # Monitoring
    prometheus-client==0.21.0 \
    'sentry-sdk[fastapi]==2.21.0' \
    # Web Scraping
    duckduckgo-search==7.2.1 \
    protego==0.3.1 \
    # Additional Jupyter packages
    QtPy==2.4.1 \
    et-xmlfile==1.1.0 \
    jupyter==1.0.0 \
    jupyter-console==6.6.3 \
    qtconsole==5.5.2 \
 && pip cache purge

# ---------- Databricks OSS + Superset ----------
# Install MLflow, Superset, and dbt for Databricks-like experience
RUN set -uex \
 && pip install --no-cache-dir \
    mlflow==3.9.0 \
    apache-superset==6.0.0 \
    dbt-core==1.11.2 \
    dbt-postgres==1.10.0 \
 && pip cache purge

# ---------- MLflow & Superset Setup ----------
# Create directories and initialize Superset
USER root
RUN set -eux; \
  mkdir -p /var/log/mlflow /var/log/superset \
           /home/carbon/.mlflow /home/carbon/.superset \
           /home/carbon/mlflow-artifacts; \
  chown -R carbon:carbon /home/carbon/.mlflow /home/carbon/.superset /home/carbon/mlflow-artifacts; \
  chmod -R 0755 /var/log/mlflow /var/log/superset

# Create Superset config and initialize (skip init to avoid build delays)
RUN set -eux; \
  printf 'import os\n\
SECRET_KEY = "carbon-compute-secret-key-change-in-production"\n\
SQLALCHEMY_DATABASE_URI = "sqlite:////home/carbon/.superset/superset.db"\n\
WTF_CSRF_ENABLED = True\n\
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300}\n\
ENABLE_CORS = True\n\
CORS_OPTIONS = {"supports_credentials": True, "allow_headers": ["*"], "resources": ["*"], "origins": ["*"]}\n' > /home/carbon/superset_config.py; \
  chown carbon:carbon /home/carbon/superset_config.py

# ---------- Final touches ----------
RUN set -uex \
    && chown -R root:root /etc/supervisor/conf.d || true \
    && mkdir -p /var/log/supervisor /run/supervisor \
    && chown -R root:root /var/log/supervisor /run/supervisor || true \
    && chmod 755 /var/log/supervisor /run/supervisor || true \
    && rm -rf /tmp/* /var/tmp/*

# Ensure log dirs are present & writable
USER root
RUN set -eux; \
  mkdir -p /var/log/jupyter /var/log/code-server /var/log/rag-api; \
  chmod -R 0755 /var/log/jupyter /var/log/code-server /var/log/rag-api || true; \
  chown -R carbon:carbon /var/log/jupyter /var/log/code-server /var/log/rag-api || true

# ===== Cleanup to reduce image size =====
RUN set -eux; \
  echo "Cleaning up carbon-compute to reduce image size..."; \
  # Remove Python __pycache__
  find /opt/conda -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true; \
  find /usr -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true; \
  # Remove pip cache
  rm -rf /home/carbon/.cache/pip || true; \
  # Remove conda package cache
  /opt/conda/bin/conda clean -afy 2>/dev/null || true; \
  # Remove Jupyter build artifacts
  rm -rf /home/carbon/.cache/yarn /home/carbon/.cache/webpack || true; \
  # Remove npm cache
  npm cache clean --force 2>/dev/null || true; \
  # Clean up temp files
  rm -rf /tmp/* /var/tmp/*; \
  echo "carbon-compute cleanup complete!"

# ---------- Final user ----------
# IMPORTANT: keep root so supervisord (from base) runs as root; individual programs run as carbon via their confs
USER root
WORKDIR /home/${DEFAULT_USER}

# Only expose compute-specific ports (base already exposes the rest)
# Jupyter, code-server, MLflow, Superset
EXPOSE 8888 9999 5000 8088

# No ENTRYPOINT/CMD here — inherit from base (tini → supervisord)
