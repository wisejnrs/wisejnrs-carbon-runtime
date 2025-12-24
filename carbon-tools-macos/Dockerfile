# Carbon Tools - macOS Edition
# Creative applications + Security tools + DevOps
# Built on carbon-base-macos with GPU support via krunkit

ARG ROOT_CONTAINER=wisejnrs/carbon-base-macos:latest
FROM ${ROOT_CONTAINER} AS carbon-tools-macos

LABEL maintainer="Michael Wise <mike@WiseJNRS.net>"
LABEL version="2.0.0-macos-tools"
LABEL description="Carbon Tools for macOS with creative apps, security tools, and GPU support"

ARG DEFAULT_USER="carbon"
ARG DEBIAN_FRONTEND=noninteractive

ENV DOCKER_NAME="carbon-tools-macos"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
USER root

# Copy tools-specific rootfs
COPY --chown=root:root rootfs/ /

# Install Docker CLI (for container-in-container workflows)
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y docker-ce-cli && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install kubectl (ARM64-compatible)
RUN ARCH="$(dpkg --print-architecture)" && \
    if [ "$ARCH" = "arm64" ]; then K8S_ARCH="arm64"; else K8S_ARCH="amd64"; fi && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${K8S_ARCH}/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl

# Install Terraform (ARM64-compatible)
RUN wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | tee /usr/share/keyrings/hashicorp-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list && \
    apt-get update && \
    apt-get install -y terraform && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Ansible and DevOps tools
RUN pip3 install --no-cache-dir \
    ansible \
    ansible-lint \
    httpie \
    awscli

# Install Security & Network tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nmap nikto sqlmap gobuster dirb hydra \
    tcpdump tshark dnsutils whois netcat-openbsd socat \
    wireshark aircrack-ng \
    exiftool \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python security tools
RUN pip3 install --no-cache-dir \
    scapy \
    requests \
    beautifulsoup4

# Install SecLists (security wordlists)
RUN mkdir -p /usr/share && \
    git clone --depth 1 https://github.com/danielmiessler/SecLists /usr/share/seclists && \
    ln -sfn /usr/share/seclists /usr/share/wordlists

# Install Creative Applications (compatible with ARM64)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gimp inkscape krita \
    blender \
    kdenlive \
    audacity \
    libreoffice \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add GPU test script (already in rootfs from carbon-base)
# Verify it's executable
RUN chmod +x /usr/local/bin/test-gpu.sh 2>/dev/null || echo "test-gpu.sh will be added on rebuild"

# User and permissions
RUN chown -R ${DEFAULT_USER}:${DEFAULT_USER} /home/${DEFAULT_USER}

# Expose ports (same as base)
EXPOSE 2222 3306 3389 3390 5900 5901 6080 6900 5432 6379

# No ENTRYPOINT/CMD - inherit from base (supervisor)
