# Command to Wizard Mapping Analysis

## CLI Commands Available

From `tellet-admin-tool.js --help`:

1. **categorize|auto-categorize** - Auto-categorize questions without existing categories using AI
2. **export-conversations|export** - Export conversation data to CSV or JSON format
3. **export-transcripts** - Export conversation transcripts for qualitative analysis
4. **export-overview** - Export conversation overview with metadata to CSV
5. **health-check** - Check project health and identify issues
6. **download-media** - Download all media files from a project
7. **usage-analytics** - Generate usage analytics report
8. **test-api** - Test API connection and authentication
9. **update-metadata** - Update conversation metadata in bulk from CSV
10. **bulk-invite** - Bulk invite users to organization from CSV
11. **wizard** - Launch the interactive wizard
12. **list-orgs** - List your organizations and workspaces
13. **update** - Check for updates and install if available

## Wizard Menu Options

From tellet-wizard.js mainMenuChoices:

1. **🤖 Auto-Categorize Questions** → `categorize`
2. **📥 Export Data** → Submenu:
   - 📊 Export Conversation Overview → `export-overview`
   - 💬 Export All Conversations (CSV) → `export-conversations`
   - 📄 Export Transcripts (Text) → `export-transcripts`
3. **🎬 Download Media Files** → `download-media`
4. **🏥 Check Project Health** → `health-check`
5. **📊 Usage Analytics** → `usage-analytics`
6. **👥 Bulk Invite Users** → `bulk-invite`
7. **🏢 List Organizations & Projects** → `list-orgs`
8. **🔍 Test API Endpoints** → `test-api`
9. **⚙️ Settings** → Settings menu
10. **❌ Exit** → Exit wizard

## Missing from Wizard

The following CLI commands are NOT available in the wizard:

1. **update-metadata** - Update conversation metadata in bulk from CSV
2. **update** - Check for updates and install if available

## Analysis Summary

- **11/13 commands** are accessible through the wizard (85% coverage)
- **2 commands** are missing from the wizard:
  - `update-metadata` - This is a specialized bulk operation
  - `update` - Update checking functionality

## Recommendations

1. Add "📝 Update Metadata" option to the main wizard menu
2. Add "🔄 Check for Updates" option to the Settings submenu
3. All export commands are properly grouped under the Export Data submenu
4. Usage Analytics now properly supports workspace filtering (fixed)