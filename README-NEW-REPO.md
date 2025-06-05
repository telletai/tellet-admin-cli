# Tellet Admin CLI Tool

A powerful command-line tool for managing Tellet projects, including automated categorization, data export, media downloads, and health checks.

## 🚀 Quick Start for Team Members

### Installation

Install the tool globally from our Git repository:

```bash
# Install latest version
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git

# Or install a specific version
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git#v2.5.1
```

### First Run

```bash
# Launch the interactive wizard (recommended)
tellet-wizard

# Or use the CLI directly
tellet-admin --help
```

### Updating

The tool checks for updates automatically. When an update is available:

```bash
# Use the built-in update command
tellet-admin update

# Or manually update
npm update -g @tellet/admin-cli
```

## 📋 Features

- **Interactive Wizard Mode**: User-friendly guided interface for all operations
- **Auto-categorization**: Generate AI-powered categories for project questions
- **Data Export**: Export conversations, transcripts, and metadata in multiple formats
- **Media Download**: Download all audio, video, and image files from conversations
- **Health Check**: Analyze project health and identify issues
- **Organization Management**: List and navigate organizations, workspaces, and projects
- **Bulk User Management**: Invite multiple users to organizations from CSV files
- **API Testing**: Test all Tellet API endpoints
- **Automatic Updates**: Built-in update checker and updater

## 🔧 Configuration

### Setting Up Credentials

The tool supports multiple ways to provide credentials:

1. **Environment Variables (Recommended)**
   ```bash
   export TELLET_EMAIL=your-email@example.com
   export TELLET_PASSWORD=your-password
   ```

2. **Using .env file**
   ```bash
   # Create .env file in your working directory
   echo "TELLET_EMAIL=your-email@example.com" > .env
   echo "TELLET_PASSWORD=your-password" >> .env
   ```

3. **Interactive Setup**
   - The wizard will prompt for credentials on first run
   - Option to save credentials to .env file

## 📚 Common Use Cases

### 1. Auto-Categorize Project Questions

```bash
# Using wizard (recommended)
tellet-wizard
# Select "Auto-Categorize Questions"

# Using CLI
tellet-admin categorize -p PROJECT_ID
```

### 2. Export Project Data

```bash
# Export all conversations
tellet-admin export-conversations -p PROJECT_ID

# Export transcripts for analysis
tellet-admin export-transcripts -p PROJECT_ID

# Download all media files
tellet-admin download-media -p PROJECT_ID
```

### 3. Project Health Check

```bash
# Check single project
tellet-admin health-check -p PROJECT_ID

# Check all projects in workspace
tellet-admin health-check -w WORKSPACE_ID
```

### 4. Bulk Invite Users

```bash
# Prepare a CSV file with columns: email, name
tellet-admin bulk-invite -o ORGANIZATION_ID -f users.csv
```

## 🛠️ Development & Contributing

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-ORG/tellet-admin-cli.git
cd tellet-admin-cli

# Install dependencies
npm install

# Run locally
node tellet-admin-tool.js --help
```

### Creating a New Release

```bash
# Use the release script
./release.sh patch  # For bug fixes (2.5.1 -> 2.5.2)
./release.sh minor  # For new features (2.5.1 -> 2.6.0)
./release.sh major  # For breaking changes (2.5.1 -> 3.0.0)

# Or manually
npm version patch
git push origin main
git push origin --tags
```

### Project Structure

```
tellet-admin-cli/
├── tellet-admin-tool.js    # Main CLI entry point
├── tellet-wizard.js        # Interactive wizard
├── update-checker.js       # Automatic update checking
├── project-helper.js       # Project selection utilities
├── workspace-helper.js     # Workspace utilities
└── selection-helper.js     # Interactive selection helpers
```

## 🔒 Security

- Credentials are never stored in the code
- Environment variables are the recommended approach
- .env files should never be committed to Git
- All API communication uses HTTPS

## 📝 Version Management

### Current Version

Check your installed version:

```bash
tellet-admin --version
```

### Update Notifications

- Automatic daily checks for updates
- Non-intrusive notifications when updates are available
- One-command updates with `tellet-admin update`

## 🤝 Support

For issues or questions:
1. Check the [Issues](https://github.com/YOUR-ORG/tellet-admin-cli/issues) page
2. Contact the development team
3. Run `tellet-admin test-api` to diagnose connectivity issues

## 📄 License

© 2025 Tellet. All rights reserved.

---

**Note**: This tool requires a valid Tellet account with appropriate permissions. 2FA must be disabled for API access.