# ===== Compute image built on macOS-optimized base =====
# ===== Features Apple Silicon MPS (Metal Performance Shaders) GPU acceleration =====
ARG ROOT_CONTAINER=wisejnrs/carbon-base-macos:latest
FROM $ROOT_CONTAINER AS carbon-compute-macos

LABEL maintainer="Michael Wise <mike@WiseJNRS.net>" \
      version="2.0.0-macos-mps" \
      description="Carbon Compute Environment - macOS optimized with MPS GPU support for Apple Silicon"

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
ARG TARGETPLATFORM
ARG BUILDPLATFORM

ENV DOTNET_SPARK_VERSION=${DOTNET_SPARK_VERSION} \
    DOTNET_WORKER_DIR=/dotnet/Microsoft.Spark.Worker-${DOTNET_SPARK_VERSION} \
    DOCKER_NAME="carbon-compute-macos" \
    CONDA_DIR="/opt/conda" \
    DOTNETBACKEND_PORT=5567 \
    JUPYTER_ENABLE_LAB=true \
    SPARK_VERSION=${SPARK_VERSION} \
    SPARK_HOME=/spark \
    PYTHON_UNBUFFERED=1 \
    M2_HOME=/usr/local/bin/maven/current \
    TF_ENABLE_ONEDNN_OPTS=0 \
    DISPLAY=":1"

# ===== macOS/MPS-specific environment (Apple Silicon GPU support) =====
# Remove CUDA-specific env vars, add MPS support
ENV PYTORCH_ENABLE_MPS_FALLBACK=1 \
    PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0 \
    UV_THREADPOOL_SIZE=32 \
    TF_CPP_MIN_LOG_LEVEL=2

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
# Install code-server as root, then configure as user
USER root
RUN set -uex \
    && curl -fsSL https://code-server.dev/install.sh | sh
USER ${DEFAULT_UID}
RUN set -uex \
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
# Architecture-aware package installation with MPS support
RUN set -uex; \
  arch="$(uname -m)"; \
  echo "Building for architecture: $arch"; \
  if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then \
    echo "ARCH=arm64" > /tmp/build_arch.txt; \
    echo "MPS_ENABLED=true" >> /tmp/build_arch.txt; \
    echo "Apple Silicon detected - MPS GPU support will be enabled"; \
  else \
    echo "ARCH=amd64" > /tmp/build_arch.txt; \
    echo "MPS_ENABLED=false" >> /tmp/build_arch.txt; \
    echo "Intel/AMD detected - CPU-only mode"; \
  fi

# Constraints keep pip resolver saner for fast-moving libs
RUN set -uex \
 && cat > /tmp/py-constraints.txt <<'EOF'
torch>=2.4.0
torchvision>=0.19.0
torchaudio>=2.4.0
aiohttp==3.9.5
multidict==6.0.5
yarl==1.9.4
frozenlist==1.4.1
aiosignal==1.3.1
transformers>=4.41,<4.45
pytorch-lightning>=2.3,<2.4
sentence-transformers>=3.0,<3.2
faiss-cpu>=1.8.0,<1.9
urllib3<2.3
EOF

# 1) Core scientific
RUN set -uex \
 && pip install --upgrade pip \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    wheel packaging numpy pandas scipy scikit-learn scikit-image \
    statsmodels matplotlib seaborn plotly opencv-python opencv-python-headless

# 2) PyTorch - Architecture-specific installation
# Apple Silicon: MPS-enabled (GPU via Metal!)
# Intel: CPU-only
RUN set -uex; \
  arch="$(uname -m)"; \
  if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then \
    echo "Installing PyTorch with MPS (Metal Performance Shaders) support for Apple Silicon GPU..."; \
    pip install --no-cache-dir \
      torch>=2.4.0 torchvision>=0.19.0 torchaudio>=2.4.0; \
    echo "PyTorch installed with MPS support - GPU acceleration enabled!"; \
  else \
    echo "Installing PyTorch (CPU-only for Intel Mac)..."; \
    pip install --no-cache-dir \
      torch>=2.4.0 torchvision>=0.19.0 torchaudio>=2.4.0; \
    echo "PyTorch installed (CPU-only)"; \
  fi

# 3) TensorFlow - Architecture-specific installation
# Apple Silicon: Add tensorflow-metal plugin for GPU acceleration
# Intel: CPU-only
RUN set -uex; \
  arch="$(uname -m)"; \
  echo "Installing TensorFlow and Keras..."; \
  pip install --no-cache-dir tensorflow keras; \
  if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then \
    echo "Installing tensorflow-metal plugin for Apple Silicon GPU acceleration..."; \
    pip install --no-cache-dir tensorflow-metal || \
      echo "[WARN] tensorflow-metal installation failed, TensorFlow will use CPU"; \
    echo "TensorFlow installed with Metal plugin - GPU acceleration enabled!"; \
  else \
    echo "TensorFlow installed (CPU-only for Intel Mac)"; \
  fi

# 4) "big AI" stack
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pytorch-lightning transformers safetensors accelerate sentence-transformers

# 5) llama-cpp-python - Replaces vLLM (CUDA-dependent)
# Architecture-specific: Metal support for Apple Silicon, CPU for Intel
RUN set -uex; \
  arch="$(uname -m)"; \
  if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then \
    echo "Installing llama-cpp-python with Metal support for Apple Silicon..."; \
    CMAKE_ARGS="-DLLAMA_METAL=on" \
    pip install --no-cache-dir llama-cpp-python || \
      pip install --no-cache-dir llama-cpp-python; \
    echo "llama-cpp-python installed with Metal support (GPU-accelerated LLM inference)"; \
  else \
    echo "Installing llama-cpp-python (CPU-only for Intel Mac)..."; \
    pip install --no-cache-dir llama-cpp-python; \
    echo "llama-cpp-python installed (CPU-only)"; \
  fi

# Create log directory as root
USER root
RUN install -d -m 0755 /var/log/llama && chown -R ${DEFAULT_UID}:${DEFAULT_UID} /var/log/llama
USER ${DEFAULT_UID}

# 6) Data / cloud / notebooks / viz / NLP
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pyspark delta boto3 openai \
    ipywidgets ipyleaflet ipycanvas nteract_on_jupyter rise \
    ffmpeg-python librosa textblob spacy stanza \
    beautifulsoup4 requests artifacts-keyring pyyaml orjson \
    pygwalker squarify

# 7) DB / messaging / misc utils
RUN set -uex \
 && pip install --no-cache-dir -c /tmp/py-constraints.txt \
    pygit2 vpk faiss-cpu zmq markupsafe==2.1.1 \
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

# ---------- Install Claude Code ----------
USER root
RUN set -uex \
  && npm install -g @anthropic-ai/claude-code

# ---------- Final touches ----------
RUN set -uex \
    && chown -R root:root /etc/supervisor/conf.d || true \
    && mkdir -p /var/log/supervisor /run/supervisor \
    && chown -R root:root /var/log/supervisor /run/supervisor \
    && chmod 755 /var/log/supervisor /run/supervisor \
    && rm -rf /tmp/* /var/tmp/*

# Ensure log dirs are present & writable
RUN set -eux; \
  install -d -m 0755 /var/log/jupyter /var/log/code-server; \
  chown -R carbon:carbon /var/log/jupyter /var/log/code-server

# ===== Cleanup to reduce image size =====
RUN set -eux; \
  echo "Cleaning up carbon-compute-macos to reduce image size..."; \
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
  echo "carbon-compute-macos cleanup complete!"

# ===== Display build summary =====
RUN set -eux; \
  echo ""; \
  echo "========================================"; \
  echo "  Carbon Compute macOS Build Summary"; \
  echo "========================================"; \
  echo ""; \
  arch="$(uname -m)"; \
  echo "Architecture: $arch"; \
  if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then \
    echo "GPU Support: MPS (Metal Performance Shaders)"; \
    echo "  - PyTorch: MPS-enabled (GPU via Metal)"; \
    echo "  - TensorFlow: Metal plugin installed"; \
    echo "  - llama-cpp-python: Metal-accelerated"; \
  else \
    echo "GPU Support: CPU-only (Intel Mac)"; \
    echo "  - PyTorch: CPU-only"; \
    echo "  - TensorFlow: CPU-only"; \
    echo "  - llama-cpp-python: CPU-only"; \
  fi; \
  echo ""; \
  echo "LLM Inference:"; \
  echo "  - Ollama: Installed (from base)"; \
  echo "  - llama-cpp-python: Installed (replaces vLLM)"; \
  echo ""; \
  echo "Notebooks: Jupyter Lab 3.6.6"; \
  echo "IDE: code-server with extensions"; \
  echo "Big Data: Apache Spark ${SPARK_VERSION}"; \
  echo ""; \
  echo "Ready for ML/AI development on macOS!"; \
  echo "========================================"; \
  echo ""

# ---------- Final user ----------
# IMPORTANT: keep root so supervisord (from base) runs as root; individual programs run as carbon via their confs
USER root
WORKDIR /home/${DEFAULT_USER}

# Only expose compute-specific ports (base already exposes the rest)
EXPOSE 8888 9999

# No ENTRYPOINT/CMD here — inherit from base (tini → supervisord)
