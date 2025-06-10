# Migration Guide: v2.x to v3.0.0

This guide helps you upgrade from Tellet Admin CLI v2.x to v3.0.0.

## 🚨 Breaking Changes

### 1. Authentication Changes

**v2.x**: Passwords were passed as command-line arguments
```bash
# Old way - DEPRECATED
tellet-admin export -p PROJECT_ID -e email@example.com -P password123
```

**v3.0.0**: Uses secure token-based authentication
```bash
# New way - credentials from environment
export TELLET_EMAIL=email@example.com
export TELLET_PASSWORD=password123
tellet-admin export-conversations -p PROJECT_ID

# Or use .env file
echo "TELLET_EMAIL=email@example.com" > .env
echo "TELLET_PASSWORD=password123" >> .env
```

### 2. Command Name Changes

Some commands have been renamed for clarity:

| Old Command (v2.x) | New Command (v3.0.0) |
|-------------------|---------------------|
| `export` | `export-conversations` |
| `auto-categorize` | `categorize` |

### 3. Response Data Structure

**v2.x**: Direct axios responses
```javascript
const orgs = response.data.data; // nested data
```

**v3.0.0**: Standardized response handling
```javascript
const orgs = response.data; // direct data access
```

### 4. Workspace API Structure

**v2.x**: Used `privateWorkspaces` and `sharedWorkspaces`
```javascript
const workspaces = [...data.privateWorkspaces, ...data.sharedWorkspaces];
```

**v3.0.0**: Uses `priv` and `shared`
```javascript
const workspaces = [...data.priv, ...data.shared];
```

## ✅ New Features in v3.0.0

### 1. Interactive Wizard
```bash
tellet-wizard  # New user-friendly interface
```

### 2. Workspace-Level Analytics
```bash
tellet-admin usage-analytics -w WORKSPACE_ID
```

### 3. Auto-Update Checking
```bash
tellet-admin update  # Check for updates
```

### 4. Streaming Support for Large Exports
- Handles large datasets without memory issues
- Progress tracking for long operations

## 📝 Step-by-Step Migration

### Step 1: Backup Current Installation

```bash
# Note your current version
tellet-admin --version

# Backup any custom scripts
cp -r ~/tellet-scripts ~/tellet-scripts-backup
```

### Step 2: Uninstall Old Version

```bash
# If installed globally
npm uninstall -g tellet-admin-cli

# If installed locally
npm uninstall tellet-admin-cli
```

### Step 3: Install v3.0.0+

```bash
# Install latest version from GitHub
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Or use the install script
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash

# Verify installation
tellet-admin --version  # Should show 3.0.2 or later
```

### Step 4: Update Credentials

Create a `.env` file:
```env
TELLET_EMAIL=your-email@example.com
TELLET_PASSWORD=your-password
TELLET_API_URL=https://api.tellet.ai
```

### Step 5: Update Scripts

Update any automation scripts to use new command names and remove password arguments:

**Old Script (v2.x)**:
```bash
#!/bin/bash
EMAIL="user@example.com"
PASSWORD="secret"
PROJECT="project-id"

tellet-admin export -p $PROJECT -e $EMAIL -P $PASSWORD -o ./exports
tellet-admin auto-categorize -p $PROJECT -e $EMAIL -P $PASSWORD
```

**New Script (v3.0.0)**:
```bash
#!/bin/bash
# Credentials now from .env or environment
PROJECT="project-id"

tellet-admin export-conversations -p $PROJECT -o ./exports
tellet-admin categorize -p $PROJECT
```

### Step 6: Test Your Workflows

```bash
# Test authentication
tellet-admin test-api

# Test a simple command
tellet-admin list-orgs

# Try the wizard
tellet-wizard
```

## 🔧 Troubleshooting

### Authentication Issues

If you get authentication errors:

1. Check `.env` file exists and has correct credentials
2. Ensure environment variables are set
3. Try clearing the auth cache: `rm ~/.tellet-cli-cache.json`

### Command Not Found

If commands are not found:

1. Ensure global installation: `npm list -g @tellet/admin-cli`
2. Check PATH includes npm global bin: `npm bin -g`
3. Try using full path: `$(npm bin -g)/tellet-admin`

### API Compatibility

If you get API errors:

1. Ensure you're using the correct API URL
2. Check if your organization has been migrated
3. Contact support for API access issues

## 📚 Additional Resources

- [Command Reference](../commands/README.md) - Detailed command documentation
- [Configuration Guide](../configuration/README.md) - Environment setup
- [API Documentation](../api/README.md) - API integration details
- [Troubleshooting](../installation/troubleshooting.md) - Common issues

## 🆘 Getting Help

If you encounter issues during migration:

1. Check the [troubleshooting guide](../installation/troubleshooting.md)
2. Review the [CHANGELOG](../../CHANGELOG.md) for detailed changes
3. Contact the Tellet team for support

---

*Remember: v3.0.0 is more secure, faster, and easier to use. The migration effort is worth it!*