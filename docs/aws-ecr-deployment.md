# AWS ECR Deployment Guide

This guide explains how to deploy Carbon Base Docker images to Amazon Elastic Container Registry (ECR) using GitHub Actions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [AWS Setup](#aws-setup)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Deployment Workflow](#deployment-workflow)
- [Manual Deployment](#manual-deployment)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

## Prerequisites

Before deploying to AWS ECR, ensure you have:

1. **AWS Account**: Active AWS account with appropriate permissions
2. **GitHub Repository**: Repository with the Carbon Base project
3. **AWS CLI**: Installed and configured locally (for manual operations)
4. **Docker**: Installed locally (for testing)

## AWS Setup

### 1. Create IAM User for GitHub Actions

Create an IAM user with programmatic access for GitHub Actions:

```bash
# Create IAM user
aws iam create-user --user-name github-actions-carbon-base

# Create access key
aws iam create-access-key --user-name github-actions-carbon-base
```

### 2. Create IAM Policy

Create a policy with the necessary ECR permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:BatchImportLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:DescribeRepositories",
                "ecr:DescribeImages",
                "ecr:DescribeImageScanFindings",
                "ecr:InitiateLayerUpload",
                "ecr:ListImages",
                "ecr:PutImage",
                "ecr:UploadLayerPart",
                "ecr:CreateRepository",
                "ecr:PutLifecyclePolicy",
                "ecr:PutImageScanningConfiguration"
            ],
            "Resource": "*"
        }
    ]
}
```

Save this as `ecr-policy.json` and create the policy:

```bash
aws iam create-policy \
    --policy-name GitHubActionsCarbonBaseECR \
    --policy-document file://ecr-policy.json
```

### 3. Attach Policy to User

```bash
aws iam attach-user-policy \
    --user-name github-actions-carbon-base \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/GitHubActionsCarbonBaseECR
```

### 4. Create ECR Repositories (Optional)

The workflow will create repositories automatically, but you can create them manually:

```bash
# Create base repository
aws ecr create-repository \
    --repository-name carbon-base \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true

# Create compute repository
aws ecr create-repository \
    --repository-name carbon-compute \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true

# Create staging repositories
aws ecr create-repository \
    --repository-name carbon-base-staging \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true

aws ecr create-repository \
    --repository-name carbon-compute-staging \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true
```

## GitHub Secrets Configuration

Configure the following secrets in your GitHub repository:

### Required Secrets

1. **AWS_ACCESS_KEY_ID**: Access key ID from step 1
2. **AWS_SECRET_ACCESS_KEY**: Secret access key from step 1
3. **AWS_ACCOUNT_ID**: Your AWS account ID

### Setting Secrets via GitHub UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the appropriate value

### Setting Secrets via GitHub CLI

```bash
# Set AWS credentials
gh secret set AWS_ACCESS_KEY_ID --body "YOUR_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --body "YOUR_SECRET_ACCESS_KEY"
gh secret set AWS_ACCOUNT_ID --body "YOUR_ACCOUNT_ID"
```

## Deployment Workflow

The deployment workflow (`deploy-ecr.yml`) automatically:

1. **Detects Changes**: Only deploys when Docker-related files change
2. **Creates Repositories**: Automatically creates ECR repositories if they don't exist
3. **Builds Images**: Builds both base and compute images for multiple architectures
4. **Security Scanning**: Runs vulnerability scans on deployed images
5. **Environment Management**: Supports staging and production environments

### Automatic Deployment Triggers

- **Push to main**: Deploys to staging environment
- **Release published**: Deploys to production environment
- **Manual trigger**: Deploy to specified environment

### Manual Deployment

To manually trigger a deployment:

1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy to AWS ECR** workflow
3. Click **Run workflow**
4. Choose environment and options
5. Click **Run workflow**

## Environment Configuration

### Staging Environment

- **Repositories**: `carbon-base-staging`, `carbon-compute-staging`
- **Trigger**: Push to main branch
- **Purpose**: Testing and validation

### Production Environment

- **Repositories**: `carbon-base`, `carbon-compute`
- **Trigger**: Release published or manual deployment
- **Purpose**: Production-ready images

## Using Deployed Images

### Authentication

First, authenticate with ECR:

```bash
# Get login token and authenticate Docker
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### Pull Images

```bash
# Pull latest staging images
docker pull YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-base-staging:latest
docker pull YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute-staging:latest

# Pull production images
docker pull YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-base:latest
docker pull YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest

# Pull specific version
docker pull YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:v1.0.0
```

### Run Containers

```bash
# Run compute container from ECR
docker run -d \
    --name carbon-compute \
    --gpus all \
    -p 8888:8888 \
    -p 9999:9999 \
    -v $(pwd)/work:/work \
    YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest
```

## Image Tagging Strategy

The deployment workflow uses the following tagging strategy:

### Tag Types

1. **latest**: Always points to the most recent build
2. **SHA**: Git commit SHA (e.g., `abc123def`)
3. **Environment**: Environment name (e.g., `staging`, `production`)
4. **Date**: Build timestamp (e.g., `20240312-143022`)
5. **Version**: Release version (e.g., `v1.0.0`) - only for releases

### Example Tags

```
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:abc123def
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:staging
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:20240312-143022
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:v1.0.0
```

## Security Features

### Vulnerability Scanning

- **Automatic Scanning**: ECR automatically scans images on push
- **Threshold Checking**: Workflow fails if critical vulnerabilities exceed threshold
- **Scan Results**: Available in ECR console and workflow artifacts

### Image Signing (Optional)

For enhanced security, consider implementing image signing:

```bash
# Install cosign
curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
sudo chmod +x /usr/local/bin/cosign

# Sign image
cosign sign --key cosign.key YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest
```

## Lifecycle Management

### Automatic Cleanup

The workflow configures lifecycle policies to:

- Keep only the 10 most recent tagged images
- Delete untagged images older than 1 day

### Manual Cleanup

```bash
# List images in repository
aws ecr list-images --repository-name carbon-compute --region us-east-1

# Delete specific image
aws ecr batch-delete-image \
    --repository-name carbon-compute \
    --region us-east-1 \
    --image-ids imageTag=old-tag
```

## Monitoring and Logging

### CloudWatch Integration

ECR integrates with CloudWatch for monitoring:

- **Metrics**: Repository size, image push/pull counts
- **Events**: Image push/scan completion events
- **Logs**: API call logs via CloudTrail

### Setting Up Alerts

```bash
# Create CloudWatch alarm for repository size
aws cloudwatch put-metric-alarm \
    --alarm-name "ECR-CarbonCompute-Size" \
    --alarm-description "Monitor ECR repository size" \
    --metric-name RepositorySizeInBytes \
    --namespace AWS/ECR \
    --statistic Maximum \
    --period 86400 \
    --threshold 10737418240 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=RepositoryName,Value=carbon-compute \
    --evaluation-periods 1
```

## Troubleshooting

### Common Issues

#### Authentication Errors

```bash
# Error: no basic auth credentials
# Solution: Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

#### Permission Denied

```bash
# Error: User is not authorized to perform: ecr:CreateRepository
# Solution: Check IAM permissions and attach the correct policy
aws iam list-attached-user-policies --user-name github-actions-carbon-base
```

#### Repository Not Found

```bash
# Error: repository does not exist
# Solution: Create repository manually or check workflow logs
aws ecr create-repository --repository-name carbon-compute --region us-east-1
```

#### Build Failures

1. **Check workflow logs** in GitHub Actions
2. **Verify Dockerfile syntax** and dependencies
3. **Check resource limits** and build timeouts
4. **Validate base image availability**

### Debugging Commands

```bash
# Check ECR repositories
aws ecr describe-repositories --region us-east-1

# Check image scan results
aws ecr describe-image-scan-findings \
    --repository-name carbon-compute \
    --image-id imageTag=latest \
    --region us-east-1

# Check repository policy
aws ecr get-repository-policy \
    --repository-name carbon-compute \
    --region us-east-1

# Check lifecycle policy
aws ecr get-lifecycle-policy \
    --repository-name carbon-compute \
    --region us-east-1
```

## Cost Optimization

### Storage Costs

- **Lifecycle Policies**: Automatically delete old images
- **Image Optimization**: Use multi-stage builds to reduce image size
- **Compression**: Enable image compression

### Data Transfer Costs

- **Regional Deployment**: Deploy in the same region as your compute resources
- **VPC Endpoints**: Use VPC endpoints to avoid internet gateway charges
- **Caching**: Implement local caching strategies

### Monitoring Costs

```bash
# Get ECR costs from Cost Explorer API
aws ce get-cost-and-usage \
    --time-period Start=2024-01-01,End=2024-01-31 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE
```

## Best Practices

### Security

1. **Least Privilege**: Use minimal IAM permissions
2. **Regular Scanning**: Enable automatic vulnerability scanning
3. **Image Signing**: Implement image signing for production
4. **Access Logging**: Enable CloudTrail for audit logs

### Performance

1. **Multi-stage Builds**: Optimize Dockerfile for smaller images
2. **Layer Caching**: Use BuildKit cache for faster builds
3. **Parallel Builds**: Build multiple architectures in parallel
4. **Regional Proximity**: Deploy close to compute resources

### Reliability

1. **Health Checks**: Implement container health checks
2. **Rollback Strategy**: Maintain previous image versions
3. **Monitoring**: Set up CloudWatch alarms
4. **Backup Strategy**: Consider cross-region replication

## Integration with Other AWS Services

### Amazon ECS

```yaml
# ECS task definition
{
  "family": "carbon-compute",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "carbon-compute",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest",
      "memory": 8192,
      "cpu": 4096,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8888,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

### Amazon EKS

```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbon-compute
spec:
  replicas: 1
  selector:
    matchLabels:
      app: carbon-compute
  template:
    metadata:
      labels:
        app: carbon-compute
    spec:
      containers:
      - name: carbon-compute
        image: ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/carbon-compute:latest
        ports:
        - containerPort: 8888
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
```

## Support and Resources

- **AWS ECR Documentation**: https://docs.aws.amazon.com/ecr/
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Docker Documentation**: https://docs.docker.com/
- **AWS CLI Reference**: https://docs.aws.amazon.com/cli/

For project-specific issues, please create an issue in the GitHub repository.

