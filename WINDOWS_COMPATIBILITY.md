# Windows Compatibility Guide for Tellet Admin CLI

## Current Windows Compatibility Issues

1. **Shebang lines** (`#!/usr/bin/env node`) - Not recognized by Windows
2. **Shell execution** - Using `shell: true` in spawn commands
3. **Path separators** - Need to ensure cross-platform paths
4. **Scripts** - `.sh` files won't run on Windows

## Solutions

### Option 1: Node.js Native (Recommended)
The CLI is already mostly Windows-compatible since it's written in Node.js. Users need:

1. **Install Node.js for Windows**
   - Download from https://nodejs.org/
   - Or use Windows Package Manager: `winget install OpenJS.NodeJS`

2. **Install the CLI globally**
   ```cmd
   npm install -g git+https://github.com/telletai/tellet-admin-cli.git
   ```

3. **Run commands**
   ```cmd
   tellet-wizard
   tellet-admin list-orgs
   ```

### Option 2: Windows Terminal + Git Bash
For users who prefer Unix-like environment:

1. Install Git for Windows (includes Git Bash)
2. Use Git Bash terminal to run the CLI
3. All Unix commands will work as expected

### Option 3: Windows Subsystem for Linux (WSL)
For power users:

1. Enable WSL2 on Windows 10/11
2. Install Ubuntu or preferred Linux distribution
3. Install Node.js in WSL
4. Run the CLI exactly as on Mac/Linux

### Option 4: PowerShell Compatibility
Make the CLI fully PowerShell-compatible:

1. Create `.ps1` wrapper scripts
2. Handle path separators with `path.join()`
3. Replace shell scripts with Node.js equivalents

## Code Changes Needed for Full Windows Support

### 1. Fix Shell Spawning
Replace `shell: true` with cross-platform approach:

```javascript
// Instead of:
spawn('node', ['tellet-wizard.js'], { shell: true })

// Use:
spawn(process.platform === 'win32' ? 'node.exe' : 'node', ['tellet-wizard.js'])
```

### 2. Path Handling
Always use Node.js path module:

```javascript
const path = require('path');
// Use path.join() instead of string concatenation
const exportPath = path.join(baseDir, 'exports', projectId);
```

### 3. Create Windows Batch Files
Create `.cmd` files alongside `.sh` files:

**install.cmd**
```batch
@echo off
npm install -g .
echo Tellet Admin CLI installed successfully!
```

**release.cmd**
```batch
@echo off
npm version patch
git push --tags
echo Release complete!
```

### 4. Package.json Scripts
Add Windows-specific scripts:

```json
{
  "scripts": {
    "start:win": "node tellet-admin-tool.js",
    "wizard:win": "node tellet-wizard.js"
  }
}
```

## Testing on Windows

To ensure compatibility:

1. Test on Windows 10/11 with Node.js installed
2. Test in Command Prompt, PowerShell, and Git Bash
3. Verify file paths work correctly
4. Check that exports create proper directory structures

## Distribution Options

### 1. npm Package (Current)
- Works on Windows with Node.js installed
- Users run: `npm install -g tellet-admin-cli`

### 2. Standalone Executables
Use pkg or nexe to create `.exe` files:

```bash
npm install -g pkg
pkg tellet-admin-tool.js --targets node18-win-x64 --output tellet-admin.exe
```

### 3. Windows Installer
Create MSI installer using:
- WiX Toolset
- Electron-builder
- NSIS

### 4. Chocolatey Package
Distribute via Windows package manager:
```
choco install tellet-admin-cli
```

## Recommended Approach

1. **Keep current Node.js approach** - It already works on Windows with Node.js
2. **Fix minor issues**:
   - Remove `shell: true` from spawn calls
   - Use `path.join()` consistently
   - Test on Windows
3. **Add Windows documentation** in README
4. **Create .cmd wrapper scripts** for convenience
5. **Consider standalone .exe** for non-technical users

This approach maintains a single codebase while ensuring Windows compatibility.