# Tellet Admin CLI

A powerful command-line tool for managing Tellet projects with AI-powered categorization, data export, and comprehensive analytics.

[![Version](https://img.shields.io/badge/version-3.0.2-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](package.json)

## ✨ Features

- **🤖 AI-Powered Categorization** - Automatically generate categories for interview questions
- **📊 Data Export** - Export conversations, transcripts, and metadata in multiple formats
- **📈 Usage Analytics** - Generate comprehensive reports across organizations and workspaces
- **🎬 Media Download** - Batch download audio, video, and image files
- **🏥 Health Check** - Analyze project health and identify issues
- **👥 User Management** - Bulk invite users from CSV files
- **🧙 Interactive Wizard** - User-friendly guided interface for all operations

## 🚀 Quick Start

```bash
# Install globally
npm install -g @tellet/admin-cli

# Launch interactive wizard
tellet-wizard

# Or use CLI directly
tellet-admin --help
```

## 📖 Documentation

For detailed documentation, see the [docs directory](docs/INDEX.md):

- [Installation Guide](docs/installation/README.md)
- [Command Reference](docs/commands/README.md)
- [Configuration](docs/configuration/README.md)
- [API Documentation](docs/api/README.md)
- [Examples](docs/examples/README.md)

## 🎯 Common Tasks

### Export Data
```bash
# Export all conversations
tellet-admin export-conversations -p PROJECT_ID -o ./exports

# Export transcripts
tellet-admin export-transcripts -p PROJECT_ID
```

### Generate Analytics
```bash
# Organization analytics
tellet-admin usage-analytics -g ORG_ID

# Workspace analytics
tellet-admin usage-analytics -w WORKSPACE_ID
```

### Auto-Categorize Questions
```bash
tellet-admin categorize -p PROJECT_ID
```

## 🔧 Configuration

Set up your credentials using environment variables:

```bash
export TELLET_EMAIL=your-email@example.com
export TELLET_PASSWORD=your-password
```

Or create a `.env` file:
```env
TELLET_EMAIL=your-email@example.com
TELLET_PASSWORD=your-password
TELLET_API_URL=https://api.tellet.ai  # Optional
```

## 🆕 What's New in v3.0.2

- **Fixed Authentication** - Resolved critical auth issues with API client integration
- **Enhanced Wizard Display** - Fixed ASCII art and dynamic version loading
- **Improved API Client** - Better response handling and error messages
- **Module Compatibility** - Replaced ES modules with CommonJS alternatives
- **100% Test Coverage** - All tests now passing with updated implementations

### Previous v3.0.0 Features:
- **Modular Architecture** - Complete rewrite for better maintainability
- **Enhanced Security** - Token-based authentication (no passwords in CLI args)
- **Improved Performance** - Optimized API calls and streaming support
- **Better Testing** - 80%+ code coverage
- **Auto-Updates** - Built-in update checking

See [CHANGELOG.md](CHANGELOG.md) for full details.

## 📄 License

This project is proprietary software. All rights reserved by Tellet.

## 🆘 Support

- **Documentation**: [Full Documentation](docs/INDEX.md)
- **Help**: Contact the Tellet team for support
- **Updates**: Run `tellet-admin update` to check for updates

---

Made with ❤️ by the Tellet Team