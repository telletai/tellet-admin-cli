# Command Reference

Complete reference for all Tellet Admin CLI commands.

## Available Commands

### Data Management
- [**categorize**](categorize.md) - Auto-categorize interview questions using AI
- [**export**](export.md) - Export conversation data in various formats
  - `export-conversations` - Export all conversation data
  - `export-transcripts` - Export conversation transcripts
  - `export-overview` - Export conversation overview with metadata
- [**download-media**](download-media.md) - Download media files from conversations

### Analytics & Monitoring
- [**usage-analytics**](usage-analytics.md) - Generate comprehensive usage reports
- [**health-check**](health-check.md) - Check project health and identify issues

### User Management
- [**bulk-invite**](bulk-invite.md) - Invite multiple users from CSV file
- [**update-metadata**](update-metadata.md) - Update conversation metadata in bulk

### System Commands
- **test-api** - Test API connection and authentication
- **list-orgs** - List organizations, workspaces, and projects
- **update** - Check for CLI updates
- **wizard** - Launch interactive wizard interface

## Command Syntax

All commands follow this general syntax:

```bash
tellet-admin <command> [options]
```

### Global Options

These options are available for all commands:

- `-e, --email <email>` - Email for authentication
- `-P, --password <password>` - Password for authentication (deprecated, use env vars)
- `-u, --url <url>` - API base URL (default: https://api.tellet.ai)
- `--no-cache` - Skip credential caching
- `--debug` - Enable debug logging
- `-h, --help` - Display help for command
- `-v, --version` - Display version

### Authentication

Commands require authentication. Set credentials using:

1. **Environment Variables** (Recommended):
   ```bash
   export TELLET_EMAIL=your-email@example.com
   export TELLET_PASSWORD=your-password
   ```

2. **.env File**:
   ```env
   TELLET_EMAIL=your-email@example.com
   TELLET_PASSWORD=your-password
   ```

3. **Command Line** (Deprecated):
   ```bash
   tellet-admin <command> -e email@example.com -P password
   ```

## Common Usage Patterns

### Working with Projects

Most commands require a project ID:

```bash
# Export conversations from a project
tellet-admin export-conversations -p PROJECT_ID

# Check health of a project
tellet-admin health-check -p PROJECT_ID

# Auto-categorize questions in a project
tellet-admin categorize -p PROJECT_ID
```

### Working with Workspaces

Some commands can operate at workspace level:

```bash
# Generate analytics for a workspace
tellet-admin usage-analytics -w WORKSPACE_ID

# Check health of all projects in workspace
tellet-admin health-check -w WORKSPACE_ID
```

### Working with Organizations

Organization-level operations:

```bash
# Generate analytics for entire organization
tellet-admin usage-analytics -g ORGANIZATION_ID

# Bulk invite users to organization
tellet-admin bulk-invite -o ORGANIZATION_ID -f users.csv
```

## Output Formats

Many commands support multiple output formats:

- **JSON** - Machine-readable format
- **CSV** - Spreadsheet-compatible format
- **TXT** - Human-readable text format

Specify output directory with `-o, --output`:

```bash
tellet-admin export-conversations -p PROJECT_ID -o ./exports
```

## Getting Help

### Command-Specific Help

Get detailed help for any command:

```bash
tellet-admin <command> --help
```

Example:
```bash
tellet-admin export-conversations --help
```

### Interactive Mode

Not sure which command to use? Launch the wizard:

```bash
tellet-wizard
```

## Error Handling

Commands will exit with these codes:

- `0` - Success
- `1` - General error
- `2` - Authentication error
- `3` - Network error
- `4` - Invalid input

## Examples

### Export All Data from a Project

```bash
# Set credentials
export TELLET_EMAIL=user@example.com
export TELLET_PASSWORD=secret

# Export conversations
tellet-admin export-conversations -p PROJECT_ID -o ./data

# Export transcripts
tellet-admin export-transcripts -p PROJECT_ID -o ./data

# Download media files
tellet-admin download-media -p PROJECT_ID -o ./media
```

### Generate Organization Report

```bash
# Get organization ID
tellet-admin list-orgs --show-ids

# Generate analytics
tellet-admin usage-analytics -g ORG_ID -o ./reports
```

### Bulk Operations

```bash
# Check health of all projects in workspace
tellet-admin health-check -w WORKSPACE_ID

# Update metadata for multiple conversations
tellet-admin update-metadata -p PROJECT_ID -f metadata.csv
```

## See Also

- [Interactive Wizard Guide](../guides/wizard.md)
- [Best Practices](../guides/best-practices.md)
- [API Documentation](../api/README.md)