# CLI Tools Reference

Carbon images include comprehensive CLI tooling for cloud, AI, databases, and productivity.

---

## ☁️ Cloud CLIs

### AWS CLI v2
**Amazon Web Services command-line interface**

**Installed in**: All images (base, compute, tools)

**Usage:**
```bash
# Configure credentials
aws configure

# List S3 buckets
aws s3 ls

# EC2 instances
aws ec2 describe-instances

# Lambda functions
aws lambda list-functions
```

**Documentation**: https://aws.amazon.com/cli/

### Azure CLI
**Microsoft Azure command-line interface**

**Installed in**: All images (base, compute, tools)

**Usage:**
```bash
# Login
az login

# List resource groups
az group list

# VM operations
az vm list

# Container instances
az container list
```

**Documentation**: https://docs.microsoft.com/cli/azure/

### Google Cloud SDK
**Install if needed:**
```bash
# In container
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

---

## 🤖 AI/ML CLIs

### Claude Code
**Anthropic's Claude AI code assistant**

**Installed in**: All images (base, compute, tools)

**Usage:**
```bash
# Start Claude Code
claude

# Or via npx
npx @anthropic-ai/claude-code

# Help
claude --help
```

**Set API Key:**
```bash
# Set in environment
export ANTHROPIC_API_KEY="your-api-key"

# Or in .env file
ANTHROPIC_API_KEY=your-api-key
```

**Documentation**: https://docs.anthropic.com/

### Ollama CLI
**Local LLM management**

**Installed in**: GPU images (base-gpu, compute)

**Enable:**
```bash
ENABLE_OLLAMA=true ./start-carbon-configurable.sh --variant gpu
```

**Usage:**
```bash
# Pull models
ollama pull llama3.2
ollama pull codellama
ollama pull mistral

# Run model
ollama run llama3.2

# List models
ollama list

# API endpoint
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?"
}'
```

**Documentation**: https://ollama.ai/

---

## 🗄️ Database CLIs

### psql (PostgreSQL)
**PostgreSQL command-line client**

**Usage:**
```bash
# Connect
psql -U postgres

# Connect to specific database
psql -U carbon -d carbon

# Execute query
psql -U postgres -c "SELECT version();"

# Run SQL file
psql -U postgres -f script.sql

# pgvector example
psql -U postgres -c "CREATE EXTENSION vector; SELECT extversion FROM pg_extension WHERE extname='vector';"

# PostGIS example
psql -U postgres -c "CREATE EXTENSION postgis; SELECT PostGIS_Version();"
```

### mongosh (MongoDB Shell)
**MongoDB command-line client**

**Usage:**
```bash
# Connect
mongosh

# With authentication
mongosh "mongodb://carbon:Carbon123#@localhost:27017/carbon"

# Execute commands
mongosh --eval "db.version()"

# Run script
mongosh < script.js
```

### redis-cli (Redis)
**Redis command-line client**

**Usage:**
```bash
# Connect
redis-cli

# Execute command
redis-cli PING
redis-cli SET mykey "value"
redis-cli GET mykey

# Monitor all commands
redis-cli MONITOR

# Info
redis-cli INFO
```

### qdrant-cli
**Qdrant HTTP API via curl**

**Usage:**
```bash
# Health check
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections

# Create collection
curl -X PUT http://localhost:6333/collections/test \
  -H 'Content-Type: application/json' \
  -d '{"vectors": {"size": 384, "distance": "Cosine"}}'

# Web dashboard
# Open: http://localhost:6333/dashboard
```

---

## 🛠️ DevOps & Infrastructure

### Docker CLI
**Docker command-line (client only)**

**Installed in**: All images

**Usage:**
```bash
# Build
docker build -t myimage .

# Run
docker run -d myimage

# PS
docker ps

# Exec
docker exec -it container bash
```

**Note**: Docker daemon is NOT included (use host's Docker socket if needed)

### kubectl
**Kubernetes command-line**

**Installed in**: carbon-tools

**Usage:**
```bash
# Get pods
kubectl get pods

# Logs
kubectl logs pod-name

# Apply config
kubectl apply -f deployment.yaml
```

### Terraform
**Infrastructure as code**

**Installed in**: carbon-tools

**Usage:**
```bash
# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply
```

### Ansible
**Configuration management**

**Installed in**: carbon-tools

**Usage:**
```bash
# Ping hosts
ansible all -m ping

# Run playbook
ansible-playbook playbook.yml

# Ad-hoc command
ansible all -a "uptime"
```

### GitHub CLI (gh)
**GitHub command-line**

**Installed in**: carbon-tools

**Usage:**
```bash
# Login
gh auth login

# Create repo
gh repo create

# Create PR
gh pr create

# View issues
gh issue list
```

---

## 📦 Package Managers

### npm (Node.js)
```bash
npm install package
npm i -g global-package
npx command
```

### pip (Python)
```bash
pip install package
pip install -r requirements.txt
pip list
```

### conda/mamba (compute image)
```bash
conda install package
mamba install package  # Faster
conda env create -f environment.yml
```

### apt (System packages)
```bash
sudo apt-get update
sudo apt-get install package
```

---

## 🚀 Productivity Tools

### Zoxide (Smart cd)
**Installed in**: All images

**Usage:**
```bash
# Jump to directory (learns from your history)
z projects    # Jump to most-used "projects" directory
z doc         # Jump to most-used "doc*" directory

# Interactive
zi proj       # Fuzzy search for "proj"

# List tracked
zoxide query -l

# Add manually
zoxide add /path/to/dir
```

### fzf (Fuzzy Finder)
**Installed in**: All images

**Usage:**
```bash
# Fuzzy find files
fzf

# Ctrl+R: Fuzzy history search
# Ctrl+T: Fuzzy file search
# Alt+C: Fuzzy directory search

# In pipes
cat file.txt | fzf

# Preview files
find . -type f | fzf --preview 'cat {}'
```

### jq (JSON Processor)
**Installed in**: carbon-tools

**Usage:**
```bash
# Parse JSON
echo '{"name":"John","age":30}' | jq '.name'

# Pretty print
cat data.json | jq .

# Filter arrays
cat api-response.json | jq '.items[] | select(.active == true)'
```

### GitHub CLI (gh)
**Installed in**: carbon-tools

**Usage:**
```bash
# Authenticate
gh auth login

# Clone repo
gh repo clone user/repo

# Create issue
gh issue create

# Create PR
gh pr create --title "My PR" --body "Description"

# View PR
gh pr view 123
```

---

## 🔍 System & Network Tools

### htop
Interactive process viewer

```bash
htop
```

### nmap
Network scanner

```bash
# Scan host
nmap localhost

# Scan network
nmap 192.168.1.0/24

# Service detection
nmap -sV localhost
```

### curl / wget
HTTP clients

```bash
# GET request
curl https://api.example.com

# POST request
curl -X POST https://api.example.com -d '{"key":"value"}'

# Download
wget https://example.com/file.zip
```

### tmux
Terminal multiplexer

```bash
# New session
tmux

# List sessions
tmux ls

# Attach
tmux attach -t session-name
```

---

## 🎯 Quick Examples

### Deploy to AWS
```bash
# Configure AWS
aws configure

# Deploy Lambda
aws lambda create-function \
  --function-name my-function \
  --runtime python3.11 \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::123456789012:role/lambda-role
```

### Ask Claude
```bash
# Start Claude Code
claude

# Use in scripts
echo "Write a Python function to sort a list" | claude
```

### Vector Search with Qdrant
```bash
# Create collection
curl -X PUT http://localhost:6333/collections/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"vectors": {"size": 384, "distance": "Cosine"}}'

# Insert vector
curl -X PUT http://localhost:6333/collections/embeddings/points \
  -H 'Content-Type: application/json' \
  -d '{"points": [{"id": 1, "vector": [0.1, 0.2, ...], "payload": {"text": "example"}}]}'
```

### Smart Navigation
```bash
# Traditional
cd /home/carbon/projects/myapp
cd /var/log
cd /etc/nginx

# With zoxide (after visiting once)
z myapp   # Jump to projects/myapp
z log     # Jump to /var/log
z nginx   # Jump to /etc/nginx

# Fuzzy find
zi my     # Interactive selection
```

---

## 📚 Documentation Links

- **AWS CLI**: https://docs.aws.amazon.com/cli/
- **Azure CLI**: https://docs.microsoft.com/cli/azure/
- **Claude**: https://docs.anthropic.com/
- **Ollama**: https://ollama.ai/
- **Docker**: https://docs.docker.com/engine/reference/commandline/cli/
- **kubectl**: https://kubernetes.io/docs/reference/kubectl/
- **Terraform**: https://www.terraform.io/docs/cli/
- **Ansible**: https://docs.ansible.com/ansible/latest/cli/
- **Zoxide**: https://github.com/ajeetdsouza/zoxide
- **fzf**: https://github.com/junegunn/fzf

---

## 💡 Tips & Tricks

### 1. AWS Credentials
```bash
# Set in .env
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=us-east-1
```

### 2. Claude API Key
```bash
# Set in .env
ANTHROPIC_API_KEY=your-api-key

# Or at runtime
docker run -e ANTHROPIC_API_KEY=your-key ...
```

### 3. Combine Tools
```bash
# Find files with fzf, open with vim
vim $(fzf)

# Fuzzy search command history
# Press Ctrl+R

# Jump to directory, then fuzzy find
z projects
vim $(fzf)
```

### 4. Cloud Resource Management
```bash
# AWS + jq
aws ec2 describe-instances | jq '.Reservations[].Instances[] | {id:.InstanceId, state:.State.Name}'

# Azure + jq
az vm list | jq '.[].name'
```

---

**Carbon provides a complete CLI toolkit for modern cloud-native development!** 🚀
