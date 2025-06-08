# Usage Analytics Testing Plan

## Test Scenarios

### 1. Basic Functionality
- [ ] Run `tellet-admin usage-analytics` without any options
- [ ] Verify it collects data from all organizations
- [ ] Check that all 4 CSV files are generated
- [ ] Verify JSON report contains complete data

### 2. Date Range Filtering
- [ ] Test with start date only: `-s 2025-01-01`
- [ ] Test with date range: `-s 2025-01-01 -e 2025-06-30`
- [ ] Verify conversations are filtered by date
- [ ] Check file names include date range

### 3. Organization/Workspace Filtering
- [ ] Test with specific organization: `-o ORGANIZATION_ID`
- [ ] Test with specific workspace: `-w WORKSPACE_ID`
- [ ] Verify only selected data is included

### 4. Output Options
- [ ] Test custom output directory: `--output-dir ./custom-analytics`
- [ ] Test verbose mode: `-v`
- [ ] Verify progress messages appear with verbose

### 5. Error Handling
- [ ] Test with invalid credentials
- [ ] Test with non-existent organization/workspace IDs
- [ ] Test with invalid date formats
- [ ] Test with read-only output directory

### 6. Wizard Mode
- [ ] Launch wizard and select "Usage Analytics"
- [ ] Test all scope options (all, organization, workspace)
- [ ] Test date range input validation
- [ ] Verify workspace selection after organization

### 7. Data Accuracy
- [ ] Compare conversation counts with project health check
- [ ] Verify completion rate calculations
- [ ] Check question counts match project data
- [ ] Validate probing question counts

### 8. Performance
- [ ] Test with organizations having many workspaces/projects
- [ ] Monitor API rate limiting
- [ ] Check memory usage with large datasets

## Test Commands

```bash
# Basic test
tellet-admin usage-analytics -v

# Date range test
tellet-admin usage-analytics -s 2025-01-01 -e 2025-12-31 -v

# Organization test
tellet-admin usage-analytics -o YOUR_ORG_ID -v

# Wizard test
tellet-wizard
# Select "Usage Analytics"

# Error test - invalid date
tellet-admin usage-analytics -s invalid-date

# Custom output test
tellet-admin usage-analytics --output-dir ./test-analytics -v
```

## Expected Results

1. **CSV Files Generated:**
   - `organization_usage_summary_*.csv`
   - `workspace_usage_summary_*.csv`
   - `project_usage_details_*.csv`

2. **Console Output:**
   - Summary statistics displayed
   - Top organizations listed
   - File paths shown

3. **Data Validation:**
   - All counts should be non-negative
   - Completion rates between 0-100%
   - Dates in valid format

## Known Limitations

1. Organization/workspace filtering is noted but not implemented in the analytics module
2. Requires dashboard API access for organization/workspace data
3. May timeout with very large datasets