# Tellet Admin CLI Tool

A powerful command-line tool for managing Tellet projects, including automated categorization, data export, media downloads, and health checks.

## Features

- **Interactive Wizard Mode**: User-friendly guided interface for all operations
- **Auto-categorization**: Generate AI-powered categories for project questions
- **Data Export**: Export conversations, transcripts, and metadata in multiple formats
- **Media Download**: Download all audio, video, and image files from conversations
- **Health Check**: Analyze project health and identify issues
- **Usage Analytics**: Generate usage reports for organizations and workspaces
- **Organization Management**: List and navigate organizations, workspaces, and projects
- **Bulk User Management**: Invite multiple users to organizations from CSV files
- **API Testing**: Test all Tellet API endpoints
- **Metadata Updates**: Update conversation metadata in bulk from CSV (pending API support)

## Installation & Updates

### Option 1: Global Installation (Recommended for Easy Updates)

Install the tool globally from npm:

**macOS/Linux:**
```bash
# Install globally
npm install -g @tellet/admin-cli

# Now you can use the tool from anywhere
tellet-wizard  # Launch the interactive wizard
tellet-admin --help  # See all available commands
```

**Windows:**
```cmd
REM Install globally
npm install -g @tellet/admin-cli

REM Now you can use the tool from anywhere
tellet-wizard
tellet-admin --help
```

**Windows Installation Notes:**
- Requires Node.js for Windows (download from https://nodejs.org/)
- Works in Command Prompt, PowerShell, and Git Bash
- Alternative: Use Windows Package Manager: `winget install OpenJS.NodeJS`

**Updating the Tool:**

The tool automatically checks for updates daily. When an update is available, you'll see a notification.

To update manually:
```bash
# Option 1: Using the built-in update command
tellet-admin update

# Option 2: Using npm
npm update -g @tellet/admin-cli

# Option 3: Force reinstall to latest version
npm install -g @tellet/admin-cli@latest
```

### Option 2: Local Installation (For Development)

Clone and install locally:

**macOS/Linux:**
```bash
cd tellet-admin-cli
npm install

# Run with node
node tellet-admin-tool.js --help
node tellet-wizard.js
```

**Windows:**
```cmd
cd tellet-admin-cli
npm install

REM Run with node
node tellet-admin-tool.js --help
node tellet-wizard.js

REM Or use the provided batch files
install.cmd        REM Install dependencies and global CLI
tellet-wizard.cmd  REM Launch the wizard
tellet-admin.cmd   REM Run CLI commands
```

### Option 3: Distribution via Private Registry

For internal distribution, you can:

1. **Publish to npm private registry:**
   ```bash
   # Set up npm private registry (if using)
   npm config set @tellet:registry https://your-private-registry.com
   
   # Publish
   npm publish --access restricted
   ```

2. **Install from Git repository:**
   ```bash
   # Install directly from Git
   npm install -g git+https://github.com/your-org/tellet-admin-cli.git
   
   # Or from a specific branch/tag
   npm install -g git+https://github.com/your-org/tellet-admin-cli.git#v2.5.1
   ```

3. **Create a standalone executable:**
   ```bash
   # Package as standalone executable using pkg
   npm install -g pkg
   pkg tellet-admin-tool.js -t node18-macos-x64,node18-linux-x64,node18-win-x64
   ```

## Configuration

### Environment Variables (Recommended)

To avoid typing credentials repeatedly, you can set them as environment variables:

1. **Option 1: Create a .env file** (recommended)
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

   Example .env file:
   ```env
   TELLET_EMAIL=your-email@example.com
   TELLET_PASSWORD=your-password
   ```

2. **Option 2: Export in your shell**
   ```bash
   export TELLET_EMAIL=your-email@example.com
   export TELLET_PASSWORD=your-password
   ```

3. **Option 3: Add to your shell profile**
   ```bash
   # Add to ~/.bashrc, ~/.zshrc, etc.
   export TELLET_EMAIL=your-email@example.com
   export TELLET_PASSWORD=your-password
   ```

### Supported Environment Variables

- `TELLET_EMAIL` or `TELLET_ADMIN_EMAIL` - Your Tellet account email
- `TELLET_PASSWORD` or `TELLET_ADMIN_PASSWORD` - Your Tellet account password
- `TELLET_API_URL` - API base URL (defaults to https://api.tellet.ai)

**Note:** The tool accepts either `TELLET_EMAIL`/`TELLET_PASSWORD` or `TELLET_ADMIN_EMAIL`/`TELLET_ADMIN_PASSWORD` for backward compatibility.

## Overview

The Tellet Admin CLI provides powerful tools for:
- 🤖 **Auto-categorization** - Generate AI-powered categories for interview questions
- 📥 **Data Export** - Export conversations and metadata in CSV format  
- 📄 **Transcript Export** - Export conversations in text format for qualitative analysis
- 🎬 **Media Download** - Download all media files (audio, video, images) from conversations
- 🏥 **Health Check** - Monitor project health and identify issues
- 📊 **Usage Analytics** - Generate comprehensive usage reports for organizations and workspaces
- 📝 **Metadata Management** - Bulk update conversation metadata (coming soon)
- 👥 **User Management** - Bulk invite users to organizations from CSV files
- 🔍 **Project Analysis** - Access project data and insights

## Quick Start

### 🧙 Interactive Wizard Mode (Recommended for New Users)

The easiest way to use the Tellet Admin Tool is through the interactive wizard:

```bash
# Install dependencies
npm install

# Launch the wizard
npm run wizard

# Or directly:
node tellet-wizard.js
```

The wizard will:
- Guide you through credential setup (with option to save to .env)
- Let you browse and select projects/organizations from lists
- Provide clear options for each operation
- Show progress and results in a user-friendly format

### 🚀 Direct Command Mode (For Power Users)

```bash
# Install dependencies
npm install

# Set up credentials (one time)
cp .env.example .env
# Edit .env with your credentials

# List your organizations and workspaces
node tellet-admin-tool.js list-orgs

# Now you can run commands without typing credentials every time:

# Auto-categorize a project
node tellet-admin-tool.js categorize -p PROJECT_ID

# Export all conversations
node tellet-admin-tool.js export-conversations -p PROJECT_ID

# Export conversation overview
node tellet-admin-tool.js export-overview -p PROJECT_ID

# Export transcripts for qualitative analysis
node tellet-admin-tool.js export-transcripts -p PROJECT_ID

# Download all media files from conversations
node tellet-admin-tool.js download-media -p PROJECT_ID

# Check project health
node tellet-admin-tool.js health-check -p PROJECT_ID

# Generate usage analytics
node tellet-admin-tool.js usage-analytics

# Test API endpoints
node tellet-admin-tool.js test-api

# Bulk invite users to organization
node tellet-admin-tool.js bulk-invite -o ORG_ID -f users.csv

# Or override credentials for a specific command
node tellet-admin-tool.js categorize -p PROJECT_ID -e other@email.com -P different-password
```

## Understanding Tellet's API Structure

The Tellet platform uses multiple services with different requirements:

- **Dashboard API** (port 2000): Requires organization/workspace context
  - URL Pattern: `/organizations/:orgId/workspaces/:wsId/projects`
  - Used for: Project management, workspace operations
  - Note: Dashboard endpoints do NOT have a `/dashboard` prefix
  
- **Analyzer API** (port 1500): Direct project access
  - URL Pattern: `/analyzer/results/:projectId/conversations`
  - Used for: Data analysis, exports, categorization
  
- **Worker API** (port 1000): Chat and transcription
- **Super Admin API** (port 2500): Administrative functions

**Important**: Most data operations use analyzer endpoints which only need project IDs.

## Commands

### 🧙 Interactive Wizard Mode

Launch the user-friendly interactive wizard that guides you through all operations:

```bash
npm run wizard
# or
node tellet-wizard.js
# or
node tellet-admin-tool.js wizard
```

**Features:**
- Interactive menu system with arrow key navigation
- Automatic project/organization selection from lists
- Credential management with optional .env file creation
- Step-by-step guidance for each operation
- Clear progress indicators and results
- No need to remember command syntax or project IDs

**Wizard Options:**
- 🤖 Auto-Categorize Questions
- 📥 Export Data (with submenu for different export types)
- 🎬 Download Media Files
- 🏥 Check Project Health
- 📊 Usage Analytics
- 👥 Bulk Invite Users
- 🏢 List Organizations & Projects
- 🔍 Test API Endpoints
- ⚙️ Settings (manage credentials and configuration)

**Example Wizard Flow:**
1. Launch wizard → Automatically checks/prompts for credentials
2. Select operation from menu (e.g., "Auto-Categorize Questions")
3. Choose project from a list (no need to know project ID)
4. Configure options (dry run, verbose output, etc.)
5. Execute and see results
6. Return to main menu or exit

### 🏢 List Organizations and Workspaces

Discover your organization and workspace IDs:

```bash
node tellet-admin-tool.js list-orgs
```

**Options:**
- `--show-ids` - Show full IDs instead of truncated versions

**Example output:**
```
📂 Organization: My Company
   ID: 5f9e...abc123
   Role: owner
   Workspaces:
   
   📁 Research Projects
      ID: 6a2f...def456
      Role: owner
      Projects:
      📄 Customer Interviews (abc123) - PUBLISHED
      📄 Market Research (def456) - DRAFT
```

### 🏥 Project Health Check

Monitor project health and identify potential issues that need attention.

```bash
node tellet-admin-tool.js health-check -p PROJECT_ID
```

**Options:**
- `-p, --project <id>` - Check specific project
- `-w, --workspace <id>` - Check all projects in workspace
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `--export` - Export detailed report to JSON
- `-o, --output-dir <path>` - Output directory for report (default: ./reports)
- `-u, --url <url>` - API base URL
- `--delay <ms>` - Delay between checks (default: 100ms)

**Health Metrics Evaluated:**
- **Critical Issues** (10 points each):
  - Has conversations
  - Has interview questions
  - Project is published or completed
- **Major Issues** (5 points each):
  - Completion rate ≥ 50%
  - 80% of questions have categories
  - Recent activity (within 30 days)
- **Minor Issues** (3 points each):
  - Custom theme configured
  - Healthy conversation duration (5-60 minutes)
  - Low error rate (< 10%)

**Grading System:**
- **A** (90-100): Excellent health
- **B** (80-89): Good health
- **C** (70-79): Fair health
- **D** (60-69): Poor health
- **F** (0-59): Critical issues

**Examples:**

Check single project:
```bash
node tellet-admin-tool.js health-check -p 6620c77adde7a2da963dd38a
```

Check all projects in workspace:
```bash
node tellet-admin-tool.js health-check -w WORKSPACE_ID --export
```

Export detailed report:
```bash
node tellet-admin-tool.js health-check -p PROJECT_ID --export -o ./health-reports
```

### 🤖 Auto-Categorize Questions

Automatically generate AI categories for project questions that don't have categories.

```bash
node tellet-admin-tool.js categorize -p PROJECT_ID -e EMAIL -P PASSWORD
```

**Options:**
- `-p, --project <id>` - Project ID (24-character MongoDB ObjectId) **(required)**
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-u, --url <url>` - API base URL (default: https://api.tellet.ai)
- `-d, --dry-run` - Preview without making changes
- `-v, --verbose` - Show detailed output including category details
- `--skip-run` - Generate categories without applying them
- `--delay <ms>` - Delay between operations (default: 1000ms)
- `--continue-on-error` - Continue if errors occur

**What it does:**
1. Authenticates with the Tellet API
2. Fetches project details and interview questions
3. Checks each question for existing categories
4. For questions without categories:
   - Analyzes conversation responses
   - Generates appropriate AI categories
   - Applies categories to all conversations
5. Reports summary of processed questions

### 📥 Export Conversation Transcripts

Export all conversation transcripts for a project to CSV format.

```bash
node tellet-admin-tool.js export-conversations -p PROJECT_ID -e EMAIL -P PASSWORD
```

**Options:**
- `-p, --project <id>` - Project ID **(required)**
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-o, --output-dir <path>` - Output directory (default: ./exports)
- `-u, --url <url>` - API base URL

**Features:**
- Creates organized folder structure: `exports/PROJECT_ID/`
- Consistent file naming: `conversations_PROJECT_ID_DATE.csv`
- CSV format compatible with Excel and data analysis tools

**Output includes:**
- `conversation_id` - Conversation identifier
- `_id` - Message ID
- `text` - Message content
- `role` - Interviewer or Participant
- `created_at` - Timestamp

### 📊 Export Conversation Overview

Export conversation metadata to CSV format.

```bash
node tellet-admin-tool.js export-overview -p PROJECT_ID -e EMAIL -P PASSWORD
```

**Options:**
- `-p, --project <id>` - Project ID **(required)**
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-s, --status <status>` - Filter by status (e.g., digested, abandoned)
- `-o, --output-dir <path>` - Output directory (default: ./exports)
- `-u, --url <url>` - API base URL

**Features:**
- Creates organized folder structure: `exports/PROJECT_ID/`
- Consistent file naming: `conversation_overview_PROJECT_ID_STATUS_DATE.csv`
- CSV format for easy analysis

**Output includes:**
- `conversation_id` - Unique identifier
- `summary` - Conversation summary
- `start_time` - When conversation started
- `duration` - Conversation duration
- All metadata fields (language, source, participant_id, custom fields)

**Note:** Currently exports all conversations. Status filtering will work once `includeIncompletes` parameter is deployed to production.

### 📄 Export Transcripts for Qualitative Analysis

Export conversation transcripts in text format optimized for qualitative research analysis.

```bash
node tellet-admin-tool.js export-transcripts -p PROJECT_ID -e EMAIL -P PASSWORD
```

**Options:**
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-p, --projects <ids...>` - Project IDs to export (space-separated)
- `-w, --workspaces <ids...>` - Workspace IDs to export all projects from (space-separated)
- `-o, --output-dir <path>` - Output directory (default: ./exports)
- `-q, --split-by-question` - Create separate files for each question
- `--include-unrelated` - Include messages without relates_to field (default: true)
- `-u, --url <url>` - API base URL
- `--delay <ms>` - Delay between API calls (default: 100ms)
- `--continue-on-error` - Continue processing even if errors occur

**Features:**
- Export multiple projects at once using project IDs or workspace IDs
- Generate separate text files for each project
- Option to split conversations by question for focused analysis
- Rich metadata including participant IDs, timestamps, and custom metadata
- Formatted for easy reading and qualitative analysis
- Conversation summaries and message threading preserved

**Output Format:**
- Creates a folder for each project: `exports/PROJECT_ID/`
- Default: Single file per project with all conversations
- With `-q` flag: Separate files for each question
- Includes conversation metadata, summaries, and full transcripts
- Formatted with speaker labels and paragraph numbering

**Examples:**

Export a single project:
```bash
node tellet-admin-tool.js export-transcripts \
  -p 6620c77adde7a2da963dd38a \
  -e admin@example.com \
  -P password123
```

Export all projects in a workspace:
```bash
node tellet-admin-tool.js export-transcripts \
  -w 681c9c4239ced2850e878c40 \
  -e admin@example.com \
  -P password123
```

Export multiple projects with question splitting:
```bash
node tellet-admin-tool.js export-transcripts \
  -p 6620c77adde7a2da963dd38a 6620c77adde7a2da963dd38b \
  -e admin@example.com \
  -P password123 \
  -q \
  -o ./research-exports
```

### 🎬 Download Media Files

Download all media files (audio, video, images) from conversations in a project.

```bash
node tellet-admin-tool.js download-media -p PROJECT_ID
```

**Options:**
- `-p, --project <id>` - Project ID **(required)**
- `-c, --conversation <id>` - Download media from specific conversation only
- `-s, --status <status>` - Filter by conversation status (e.g., digested)
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-o, --output-dir <path>` - Output directory (default: ./media-downloads)
- `-u, --url <url>` - API base URL
- `--delay <ms>` - Delay between downloads (default: 200ms)
- `--continue-on-error` - Continue if download errors occur

**Features:**
- Downloads all media types: audio, video, images, documents
- Organized folder structure: `media-downloads/PROJECT_ID/CONVERSATION_ID/`
- Preserves original file types with proper extensions
- Creates metadata.json for each conversation with file details
- Saves audio transcriptions separately (if available)
- Smart file naming: `001_respondent_2024-01-15_audio.mp3`

**Output Structure:**
```
media-downloads/
└── PROJECT_ID/
    ├── CONVERSATION_ID_1/
    │   ├── 001_respondent_2024-01-15T10-30-00_audio.mp3
    │   ├── 002_interviewer_2024-01-15T10-31-00_image.jpg
    │   ├── metadata.json
    │   └── transcriptions.json
    ├── CONVERSATION_ID_2/
    │   └── ...
    └── download_summary.json
```

**Examples:**

Download all media from a project:
```bash
node tellet-admin-tool.js download-media -p 6620c77adde7a2da963dd38a
```

Download media from a specific conversation:
```bash
node tellet-admin-tool.js download-media -p PROJECT_ID -c CONVERSATION_ID
```

Download only from completed conversations:
```bash
node tellet-admin-tool.js download-media -p PROJECT_ID -s digested
```

### 📊 Usage Analytics

Generate comprehensive usage reports for organizations and workspaces with detailed metrics.

```bash
node tellet-admin-tool.js usage-analytics
```

**Options:**
- `-o, --organization <id>` - Specific organization ID (optional)
- `-w, --workspace <id>` - Specific workspace ID (optional)
- `-s, --start-date <date>` - Start date for analytics (YYYY-MM-DD)
- `-e, --end-date <date>` - End date for analytics (YYYY-MM-DD, default: today)
- `--output-dir <path>` - Output directory for reports (default: ./analytics)
- `-v, --verbose` - Show detailed progress
- `--email <email>` - Email for authentication (optional if using env vars)
- `--password <password>` - Password for authentication (optional if using env vars)
- `-u, --url <url>` - API base URL

**What it collects:**
- Total number of organizations, workspaces, and projects
- Total conversations and digested conversations per project
- Completion rates for each project/workspace/organization
- Total interview questions and questions with probing
- Project status and activity dates

**Output formats:**
1. **Organization Summary CSV** - High-level metrics per organization
2. **Workspace Summary CSV** - Detailed metrics per workspace
3. **Project Details CSV** - Granular data for each project
4. **JSON Report** - Complete data structure for custom analysis

**Examples:**

Generate analytics for all organizations:
```bash
node tellet-admin-tool.js usage-analytics
```

Generate analytics for a specific date range:
```bash
node tellet-admin-tool.js usage-analytics \
  -s 2025-01-01 \
  -e 2025-06-30 \
  --output-dir ./q2-analytics
```

Generate analytics for a specific organization:
```bash
node tellet-admin-tool.js usage-analytics \
  -o ORGANIZATION_ID \
  -v
```

Generate analytics for a specific workspace:
```bash
node tellet-admin-tool.js usage-analytics \
  -w WORKSPACE_ID \
  -v
```

Combine filters - organization with date range:
```bash
node tellet-admin-tool.js usage-analytics \
  -o ORGANIZATION_ID \
  -s 2025-01-01 \
  -e 2025-06-30 \
  --output-dir ./q1-org-analytics
```

**Sample output:**
```
📊 Usage Analytics Summary
════════════════════════════════════════════════════════════
Organizations:           3
Workspaces:              8
Projects:                45
Total Conversations:     1,234
Digested Conversations:  1,102
Completion Rate:         89.3%
Total Questions:         456
With Probing:            789
════════════════════════════════════════════════════════════

🏆 Top Organizations by Conversations:
   1. Acme Corp: 567 conversations
   2. TechStart Inc: 432 conversations
   3. Global Research: 235 conversations

📄 Reports generated:
   • Organization Summary: ./analytics/organization_usage_summary_all_time_2025-06-07.csv
   • Workspace Summary: ./analytics/workspace_usage_summary_all_time_2025-06-07.csv
   • Project Details: ./analytics/project_usage_details_all_time_2025-06-07.csv
   • Full JSON Report: ./analytics/usage_analytics_all_time_2025-06-07.json
```

### 📝 Update Metadata from CSV

**⚠️ API Endpoint Pending** - This command is implemented but requires a metadata update endpoint in the Tellet API that is not yet available.

Update conversation metadata in bulk from a CSV file.

```bash
node tellet-admin-tool.js update-metadata -p PROJECT_ID -f CSV_FILE -m MATCH_FIELD -e EMAIL -P PASSWORD
```

### 👥 Bulk Invite Users to Organization

Invite multiple users to an organization at once using a CSV file.

```bash
node tellet-admin-tool.js bulk-invite -o ORGANIZATION_ID -f users.csv
```

**Options:**
- `-o, --organization <id>` - Organization ID **(required)**
- `-f, --file <path>` - CSV file path containing user information **(required)**
- `-r, --role <role>` - User role: admin, moderator, or viewer (default: viewer)
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `-d, --dry-run` - Preview invitations without sending them
- `--output-dir <path>` - Output directory for results (default: ./exports)
- `--delay <ms>` - Delay between invitations in milliseconds (default: 500)
- `-u, --url <url>` - API base URL

**CSV Format Requirements:**
The CSV file must contain these columns:
- `email` - User's email address (required)
- `name` - User's full name (required)

**Example CSV file (users.csv):**
```csv
email,name
john.doe@example.com,John Doe
jane.smith@example.com,Jane Smith
bob.johnson@example.com,Bob Johnson
```

**Features:**
- Validates email addresses and required fields
- Handles duplicate users gracefully (skips already existing members)
- Generates a detailed results CSV with invitation status
- Supports dry-run mode to preview invitations
- Configurable delay between API calls to avoid rate limiting
- Detailed logging of each invitation attempt

**Output:**
- Creates a results CSV file: `bulk_invite_results_ORG_ID_DATE.csv`
- CSV columns include:
  - `email` - User's email address
  - `name` - User's full name  
  - `status` - Result status: success, skipped, error, or dry-run
  - `message` - Detailed status message
  - `role` - The role assigned to the user
  - `invitationId` - ID of the invitation (for successful invites)
- Automatically handles duplicate users by marking them as "skipped"
- Provides summary statistics

**Examples:**

Dry run to preview invitations:
```bash
node tellet-admin-tool.js bulk-invite \
  -o 5f9eabc123def456789 \
  -f new_users.csv \
  --dry-run
```

Invite users as moderators:
```bash
node tellet-admin-tool.js bulk-invite \
  -o 5f9eabc123def456789 \
  -f moderators.csv \
  -r moderator
```

Invite with custom delay and output directory:
```bash
node tellet-admin-tool.js bulk-invite \
  -o 5f9eabc123def456789 \
  -f users.csv \
  --delay 1000 \
  --output-dir ./invitation-results
```

**Sample output:**
```
👥 Starting bulk user invitation...
📄 Reading CSV file: users.csv
   Found 3 users to invite
   📧 Inviting: John Doe (john.doe@example.com) as viewer
   ✅ Successfully invited: john.doe@example.com
   ⏭️  User already exists: jane.smith@example.com
   📧 Inviting: Bob Johnson (bob.johnson@example.com) as viewer
   ✅ Successfully invited: bob.johnson@example.com

📄 Results saved to: exports/bulk_invite_results_5f9eabc123def456789_2025-01-04.csv

📊 Bulk Invite Summary:
   Total users: 3
   ✅ Successful: 2
   ⏭️  Skipped: 1
   ❌ Errors: 0
```

### 🔍 Test API Endpoints

Test all Tellet API endpoints to verify connectivity and permissions:

```bash
node tellet-admin-tool.js test-api
```

**Options:**
- `-p, --project <id>` - Test project ID (auto-detected if not provided)
- `-w, --workspace <id>` - Test workspace ID (auto-detected if not provided)
- `-c, --conversation <id>` - Test conversation ID (auto-detected if not provided)
- `-e, --email <email>` - Email for authentication (optional if using env vars)
- `-P, --password <password>` - Password for authentication (optional if using env vars)
- `--export` - Export detailed report to JSON
- `-o, --output-dir <path>` - Output directory for report (default: ./reports)
- `--delay <ms>` - Delay between tests (default: 100ms)

**Features:**
- Tests all major API endpoints across different services
- Auto-detects required IDs if not provided
- Shows response times and data received
- Categorizes results by service (Dashboard, Analyzer, Worker)
- Exports detailed reports for troubleshooting

**Example output:**
```
✅ Dashboard - List Organizations
   Status: 200 | Time: 145ms | Data: Array(2)
⏭️ Dashboard - List Projects
   Requires organizationId parameter
✅ Analyzer - Get Conversations
   Status: 200 | Time: 89ms | Data: Array(15)
```

## Examples

### Export abandoned conversations
```bash
node tellet-admin-tool.js export-overview \
  -p 6620c77adde7a2da963dd38a \
  -e admin@example.com \
  -P password123 \
  -s abandoned \
  -o abandoned_conversations.csv
```

### Auto-categorize with verbose output
```bash
node tellet-admin-tool.js categorize \
  -p 6620c77adde7a2da963dd38a \
  -e admin@example.com \
  -P password123 \
  --verbose \
  --delay 2000
```

### Use with staging environment
```bash
node tellet-admin-tool.js export-conversations \
  -p PROJECT_ID \
  -e EMAIL \
  -P PASSWORD \
  -u https://api-staging.tellet.ai
```

### Dry run to preview categorization
```bash
node tellet-admin-tool.js categorize \
  -p PROJECT_ID \
  -e EMAIL \
  -P PASSWORD \
  --dry-run
```

### Download media with custom settings
```bash
node tellet-admin-tool.js download-media \
  -p PROJECT_ID \
  -s digested \
  -o ./project-media \
  --delay 500
```

### Complete project export workflow
```bash
# Export everything for a project
PROJECT_ID=6620c77adde7a2da963dd38a

# 1. Export conversation transcripts in text format
node tellet-admin-tool.js export-transcripts -p $PROJECT_ID

# 2. Download all media files
node tellet-admin-tool.js download-media -p $PROJECT_ID

# 3. Export conversation data in CSV
node tellet-admin-tool.js export-conversations -p $PROJECT_ID

# 4. Export conversation overview
node tellet-admin-tool.js export-overview -p $PROJECT_ID
```

## Alternative Usage

### Standalone Scripts

The following standalone scripts are also available in the directory:

```bash
# Direct categorization script
node auto-categorize-project.js -p PROJECT_ID -e EMAIL -P PASSWORD

# Shell wrapper (make sure it's executable: chmod +x auto-categorize.sh)
./auto-categorize.sh PROJECT_ID EMAIL PASSWORD

# TypeScript version (requires TypeScript compilation)
npm run start:ts -- -p PROJECT_ID -e EMAIL -P PASSWORD
```

### Sample Files

The directory includes sample files to help you get started:
- `sample-bulk-invite.csv` - Example CSV format for bulk user invitations

## Configuration

### Environment Variables

```bash
# Set default API URL
export TELLET_API_URL=https://api.tellet.ai

# Use staging environment
export TELLET_API_URL=https://api-staging.tellet.ai
```

### API Endpoints

The CLI uses these Tellet API endpoints:

**Authentication:**
- `POST /users/login` - User authentication

**Dashboard Service (port 2000):**
- `GET /organizations` - List user's organizations
- `GET /organizations/:orgId/workspaces` - List workspaces
- `GET /organizations/:orgId/workspaces/:wsId/projects` - List projects
- `POST /organizations/:orgId/invite` - Invite users to organization

**Analyzer Service (port 1500):**
- `GET /analyzer/results/:projectId/interview_questions` - Get project questions
- `GET/POST /analyzer/categorization/:projectId` - Manage AI categories
- `GET /analyzer/results/:projectId/conversations` - Get conversations
- `GET /analyzer/results/per_conversation/export/:projectId` - Export overview
- `GET /analyzer/results/per_respondent/export/:projectId` - Export single conversation
- `GET /analyzer/results/per_respondent/export_all/:projectId` - Export all conversations

## Status Values

Conversation statuses (case-insensitive):
- `digested` - Completed and fully processed
- `abandoned` - User left the conversation
- `in_progress` - Active conversation
- `done` - Completed but not yet digested
- `analyzing` - Being processed
- `test` - Test conversation
- `initiated` - Just started
- `prescreening` - In prescreening phase
- `prescreening_failed` - Failed prescreening

## Requirements

- Node.js >= 14.0.0
- Valid Tellet account with project access
- Account without 2FA enabled
- Project must be PUBLISHED or COMPLETED
- Project must have digested conversations for categorization

## API Limitations

Based on your authentication level and API configuration, some features may have limitations:

- **Organizations/Workspaces**: If the dashboard endpoints return 404 errors, you may need to manually enter project IDs
- **Project Details**: If dashboard access is limited, use analyzer endpoints with project IDs directly
- **Manual Entry**: The wizard offers manual project ID entry when automatic fetching fails
- **Categories**: Reading categories may fail, but creating them through auto-categorization should still work

To test which endpoints are available with your authentication:
```bash
node tellet-admin-tool.js test-api
```

## Troubleshooting

### Authentication Failed
- Verify credentials are correct
- Ensure 2FA is disabled on your account
- Check you're using the correct API URL

### Project Not Found
- Verify the project ID is exactly 24 characters
- Ensure you have access to the project
- Check the project exists in the target environment

### No Categories Generated
- Ensure project has digested conversations
- Verify questions have participant responses
- Check project status is PUBLISHED or COMPLETED

### Rate Limiting
- Increase `--delay` parameter
- Use `--continue-on-error` for batch operations
- Process in smaller batches for large projects

## Output Format

The CLI provides clear feedback:
- ✅ Success messages
- ⏭️  Skipped items
- ❌ Error messages with details
- 📊 Summary statistics

## Contributing

This tool is part of the Tellet platform. For issues or feature requests, please contact the development team.

## Version Management

### Current Version

Tellet Admin CLI Tool v2.5.1

### Checking Your Version

```bash
# Check installed version
tellet-admin --version

# Check for updates
tellet-admin update
```

### Update Notifications

The tool automatically checks for updates once per day and displays a notification if a newer version is available. This check happens:
- When you run any command
- When you launch the wizard
- Silently in the background (no interruption to your work)

### Version History

See the [releases page](https://github.com/your-org/tellet-admin-cli/releases) for version history and changelog.

## License

© 2025 Tellet. All rights reserved.