#!/bin/bash
# Setup script for Gemini CLI hooks
# Run: chmod +x setup-hooks.sh && ./setup-hooks.sh

set -e

HOOKS_DIR=".gemini/hooks"

echo "Creating hooks directory..."
mkdir -p "$HOOKS_DIR"

# ============================================================================
# Hook 1: inject-schema.sh (BeforeAgent)
# Injects database schema context when prompt mentions database/schema/sql
# ============================================================================
cat > "$HOOKS_DIR/inject-schema.sh" << 'EOF'
#!/bin/bash
# BeforeAgent hook: Inject schema context for database-related prompts

# Read the event JSON from stdin
EVENT_JSON=$(cat)

# Extract the user prompt from the event
USER_PROMPT=$(echo "$EVENT_JSON" | jq -r '.input.text // ""')

# Check if prompt mentions database-related keywords (case-insensitive)
if echo "$USER_PROMPT" | grep -qiE '\b(database|schema|sql|table|column|migration|supabase)\b'; then
  SCHEMA_FILE="supabase/schema.sql"
  
  if [[ -f "$SCHEMA_FILE" ]]; then
    SCHEMA_CONTENT=$(head -n 200 "$SCHEMA_FILE")
    
    # Output context injection as JSON
    jq -n --arg content "$SCHEMA_CONTENT" '{
      "context": {
        "description": "Database schema (first 200 lines of supabase/schema.sql)",
        "content": $content
      }
    }'
  fi
fi
EOF

# ============================================================================
# Hook 2: run-test.sh (AfterTool)
# Runs corresponding test file after write_file edits src/ files
# ============================================================================
cat > "$HOOKS_DIR/run-test.sh" << 'EOF'
#!/bin/bash
# AfterTool hook: Run tests after file edits

# Read the event JSON from stdin
EVENT_JSON=$(cat)

# Extract tool name and file path
TOOL_NAME=$(echo "$EVENT_JSON" | jq -r '.toolName // ""')
FILE_PATH=$(echo "$EVENT_JSON" | jq -r '.toolInput.path // .toolInput.filePath // ""')

# Only process write_file tool calls
if [[ "$TOOL_NAME" != "write_file" ]]; then
  exit 0
fi

# Only process files in src/
if [[ ! "$FILE_PATH" =~ ^src/ ]]; then
  exit 0
fi

# Extract the base filename without extension
BASENAME=$(basename "$FILE_PATH" | sed 's/\.[^.]*$//')

# Remove common suffixes like .types, .utils to find root name
ROOT_NAME=$(echo "$BASENAME" | sed -E 's/\.(types|utils|store|hook)$//')

# Look for matching test files
TEST_PATTERNS=(
  "tests/${ROOT_NAME}.test.js"
  "tests/${ROOT_NAME}.test.ts"
  "tests/${BASENAME}.test.js"
  "tests/${BASENAME}.test.ts"
)

TEST_FILE=""
for pattern in "${TEST_PATTERNS[@]}"; do
  if [[ -f "$pattern" ]]; then
    TEST_FILE="$pattern"
    break
  fi
done

# If no test file found, exit silently
if [[ -z "$TEST_FILE" ]]; then
  exit 0
fi

echo "Running test: $TEST_FILE" >&2

# Run the test and capture output
TEST_OUTPUT=$(npx jest "$TEST_FILE" --no-coverage 2>&1)
TEST_EXIT_CODE=$?

if [[ $TEST_EXIT_CODE -ne 0 ]]; then
  # Test failed - feed error back to agent
  jq -n --arg output "$TEST_OUTPUT" --arg file "$TEST_FILE" '{
    "error": {
      "message": ("Test failed: " + $file),
      "details": $output
    }
  }'
  exit 1
else
  # Test passed
  jq -n --arg file "$TEST_FILE" '{
    "message": ("Test passed: " + $file)
  }'
fi
EOF

# ============================================================================
# Hook 3: migration-guard.sh (BeforeTool)
# Prevents overwriting existing migration files
# ============================================================================
cat > "$HOOKS_DIR/migration-guard.sh" << 'EOF'
#!/bin/bash
# BeforeTool hook: Guard migration files from being overwritten

# Read the event JSON from stdin
EVENT_JSON=$(cat)

# Extract tool name and file path
TOOL_NAME=$(echo "$EVENT_JSON" | jq -r '.toolName // ""')
FILE_PATH=$(echo "$EVENT_JSON" | jq -r '.toolInput.path // .toolInput.filePath // ""')

# Only check write_file operations
if [[ "$TOOL_NAME" != "write_file" ]]; then
  exit 0
fi

# Check if targeting migrations directory
if [[ "$FILE_PATH" =~ ^supabase/migrations/ ]]; then
  # Check if file already exists (protecting existing migrations)
  if [[ -f "$FILE_PATH" ]]; then
    jq -n --arg file "$FILE_PATH" '{
      "deny": true,
      "reason": ("Migration file already exists and is immutable: " + $file + ". Create a new migration file instead.")
    }'
    exit 1
  fi
fi

# Allow the operation
exit 0
EOF

# Make all hooks executable
chmod +x "$HOOKS_DIR"/*.sh

echo "✅ Hooks created successfully in $HOOKS_DIR/"
echo ""
echo "Files created:"
ls -la "$HOOKS_DIR"
echo ""
echo "📋 Add the following to your .gemini/settings.json:"
echo ""
cat << 'SETTINGS'
{
  "hooks": {
    "beforeAgent": [
      {
        "command": ".gemini/hooks/inject-schema.sh",
        "description": "Inject database schema context for DB-related prompts"
      }
    ],
    "beforeTool": [
      {
        "command": ".gemini/hooks/migration-guard.sh",
        "description": "Prevent overwriting existing migration files"
      }
    ],
    "afterTool": [
      {
        "command": ".gemini/hooks/run-test.sh",
        "description": "Run corresponding tests after file edits"
      }
    ]
  }
}
SETTINGS
