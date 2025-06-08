# Quick Start Guide

Get up and running with Tellet Admin CLI in 5 minutes!

## 1. Installation

```bash
npm install -g @tellet/admin-cli
```

## 2. Setup Credentials

Create a `.env` file in your working directory:

```bash
cat > .env << EOF
TELLET_EMAIL=your-email@example.com
TELLET_PASSWORD=your-password
EOF
```

## 3. Verify Installation

```bash
# Check version
tellet-admin --version

# Test API connection
tellet-admin test-api
```

## 4. Choose Your Interface

### Option A: Interactive Wizard (Recommended for Beginners)

```bash
tellet-wizard
```

The wizard provides a menu-driven interface for all operations:
- 🤖 Auto-Categorize Questions
- 📥 Export Data
- 📊 Usage Analytics
- And more...

### Option B: Direct CLI Commands

```bash
# List your organizations
tellet-admin list-orgs

# Export conversations
tellet-admin export-conversations -p PROJECT_ID

# Generate analytics
tellet-admin usage-analytics -g ORG_ID
```

## 5. Your First Task

Let's export conversations from a project:

### Using the Wizard:

1. Run `tellet-wizard`
2. Select "📥 Export Data"
3. Choose "💬 Export All Conversations (CSV)"
4. Follow the prompts to select your project

### Using CLI:

```bash
# First, find your project ID
tellet-admin list-orgs --show-ids

# Then export conversations
tellet-admin export-conversations -p YOUR_PROJECT_ID -o ./exports
```

## 6. Common Workflows

### Generate Organization Report

```bash
# Get comprehensive usage analytics
tellet-admin usage-analytics -g ORG_ID -o ./reports
```

### Auto-Categorize Interview Questions

```bash
# Let AI categorize your questions
tellet-admin categorize -p PROJECT_ID
```

### Download All Media Files

```bash
# Download audio/video/images from conversations
tellet-admin download-media -p PROJECT_ID -o ./media
```

## 7. Tips & Tricks

### Use Tab Completion

Enable command completion (bash/zsh):
```bash
tellet-admin completion >> ~/.bashrc
source ~/.bashrc
```

### Check for Updates

```bash
# Built-in update checker
tellet-admin update
```

### Get Help

```bash
# General help
tellet-admin --help

# Command-specific help
tellet-admin export-conversations --help

# Interactive help
tellet-wizard
```

## 8. Next Steps

- Explore all [available commands](../commands/README.md)
- Learn about [best practices](best-practices.md)
- Set up [automation scripts](../examples/automation.md)
- Understand the [API integration](../api/README.md)

## Troubleshooting

### Authentication Failed

1. Check your credentials in `.env`
2. Ensure you have access to the organization
3. Try clearing cache: `rm ~/.tellet-cli-cache.json`

### Command Not Found

1. Verify installation: `npm list -g @tellet/admin-cli`
2. Check PATH: `echo $PATH`
3. Try full path: `$(npm bin -g)/tellet-admin`

### Network Issues

1. Check internet connection
2. Verify API URL: `echo $TELLET_API_URL`
3. Try with debug mode: `tellet-admin --debug test-api`

---

**Need more help?** Check the [full documentation](../INDEX.md) or run `tellet-wizard` for guided assistance.