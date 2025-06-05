# Installing Tellet Admin CLI

## For Team Members

Install the Tellet Admin CLI directly from our Git repository:

```bash
# Install globally (recommended)
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Or install a specific version
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#v2.5.1
```

## Updating

To update to the latest version:

```bash
# Using the built-in updater
tellet-admin update

# Or manually with npm
npm update -g git+https://github.com/telletai/tellet-admin-cli.git

# Or reinstall
npm uninstall -g tellet-admin-cli
npm install -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Quick Start

After installation:

```bash
# Launch the interactive wizard
tellet-wizard

# Or use the CLI directly
tellet-admin --help
```
