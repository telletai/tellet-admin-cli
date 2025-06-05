#!/bin/bash

# Auto-categorize Tellet Project Script
# Usage: ./auto-categorize.sh PROJECT_ID EMAIL PASSWORD [OPTIONS]

# Check if minimum arguments are provided
if [ "$#" -lt 3 ]; then
    echo "Usage: $0 PROJECT_ID EMAIL PASSWORD [OPTIONS]"
    echo "Example: $0 6123456789abcdef12345678 admin@example.com password123"
    echo ""
    echo "Options:"
    echo "  --dry-run         Run without making changes"
    echo "  --verbose         Show detailed output"
    echo "  --skip-run        Generate categories but skip categorization"
    echo "  --url URL         Custom API URL (default: https://api-staging.tellet.ai)"
    echo "  --delay MS        Delay between questions (default: 1000ms)"
    echo "  --continue        Continue on errors"
    exit 1
fi

PROJECT_ID=$1
EMAIL=$2
PASSWORD=$3
shift 3

# Run the Node.js script with the provided arguments
node "$(dirname "$0")/auto-categorize-project.js" \
    --project "$PROJECT_ID" \
    --email "$EMAIL" \
    --password "$PASSWORD" \
    "$@"