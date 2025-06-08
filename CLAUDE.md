# Tellet Admin CLI - Platform Integration Guide

This document describes the relationship between the Tellet Admin CLI and the Tellet platform's data structures.

## Overview

The Tellet Admin CLI is a command-line tool that interacts with the Tellet platform API to provide administrative functions for managing organizations, workspaces, projects, and conversations.

## Platform Data Model

### Hierarchical Structure
```
Organization
  └── Workspaces
       └── Projects
            └── Conversations
                 └── Messages
```

### Key Entities

#### Organizations
- **MongoDB Collection**: `organizations`
- **Key Fields**:
  - `_id`: MongoDB ObjectId
  - `name`: Organization name
  - `members`: Array of members with roles (OWNER, ADMIN, EDITOR)
  - `owner_id`: Reference to the User who owns the organization

#### Workspaces
- **MongoDB Collection**: `workspaces`
- **Key Fields**:
  - `_id`: MongoDB ObjectId
  - `name`: Workspace name
  - `organization_id`: Reference to parent Organization
  - `members`: Array of members with roles (OWNER, CAN_EDIT, CAN_VIEW)

**API Response Structure**:
```json
{
  "priv": [],    // Private workspaces (single member)
  "shared": []   // Shared workspaces (multiple members)
}
```
Note: The API categorizes workspaces as `priv` and `shared`, not `privateWorkspaces` and `sharedWorkspaces`.

#### Projects
- **MongoDB Collection**: `projects`
- **Key Fields**:
  - `_id`: MongoDB ObjectId
  - `title`: Project name (NOT `name`)
  - `workspace_id`: Reference to parent Workspace
  - `status`: DRAFT, READY, PUBLISHED, COMPLETED, etc.
  - `interview_questions`: Array of interview questions
  - `theme_id`: Reference to visual theme

#### Conversations
- **MongoDB Collection**: `conversations`
- **Key Fields**:
  - `_id`: MongoDB ObjectId
  - `project_id`: Reference to parent Project
  - `status`: IN_PROGRESS, DONE, DIGESTED, etc.
  - `messages`: Array of chat messages
  - `metadata`: Participant information and custom data
  - `digest`: AI-generated summary

## CLI Integration Points

### Authentication
- Uses email/password authentication
- Receives JWT token from `/users/login` endpoint
- Token included in all subsequent API requests

### API Endpoints Used
```
# Dashboard Service
/organizations
/organizations/:orgId/workspaces
/organizations/:orgId/workspaces/:wsId/projects
/organizations/:orgId/workspaces/:wsId/projects/:projId

# Analyzer Service
/analyzer/results/:projectId/conversations
/analyzer/results/:projectId/conversations/:convId
/analyzer/results/:projectId/interview_questions
/analyzer/results/per_respondent/export/:projectId
/analyzer/results/per_conversation/export/:projectId
/analyzer/categorization/:projectId
```

### Export Directory Structure
The CLI organizes exports in a hierarchical structure matching the platform:
```
exports/
├── {organization_id}/
│   ├── {workspace_id}/
│   │   ├── {project_id}/
│   │   │   ├── conversations_{project_id}_{date}.csv
│   │   │   ├── {project_id}_transcripts.txt
│   │   │   └── media files...
```

### Key Implementation Notes

1. **Workspace Handling**: The API returns workspaces in an object with `priv` and `shared` arrays. The CLI must combine these arrays to get all workspaces.

2. **Project Names**: Projects use the `title` field, not `name`. The CLI falls back to `_id` if title is not available.

3. **Soft Deletes**: All entities support soft deletion with `isDeleted` and `deletedAt` fields.

4. **Role-Based Access**: The CLI respects the platform's role hierarchy:
   - Organization roles cascade to workspaces
   - Workspace roles control project access
   - API automatically filters based on user permissions

5. **Date Filtering**: The usage analytics feature can filter by date ranges using `createdAt` and `updatedAt` fields.

## Common Tasks

### Auto-Categorization
1. Fetches project interview questions
2. Analyzes conversation digests
3. Uses AI to generate categories
4. Updates project with generated categories

### Usage Analytics
1. Traverses organization → workspace → project hierarchy
2. Collects conversation statistics
3. Generates CSV and JSON reports
4. Handles large datasets with progress tracking

### Transcript Export
1. Fetches conversations with full message history
2. Formats messages by speaker and timestamp
3. Optionally splits by interview question
4. Maintains conversation metadata

## Version Compatibility
- CLI Version: 2.6.3+
- Platform API: Compatible with Tellet API v1
- Node.js: 14.0.0 or higher

## Environment Variables
```bash
TELLET_API_URL=https://api.tellet.ai  # API base URL
TELLET_EMAIL=user@example.com         # User email
TELLET_PASSWORD=password              # User password
```

## Error Handling
- API errors are caught and displayed with helpful messages
- Network timeouts default to 2 minutes for large operations
- Continues processing on non-critical errors when --continue-on-error flag is used