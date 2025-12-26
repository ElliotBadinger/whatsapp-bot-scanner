# Windsurf IDE EMCWA Multi-Agent Setup Guide

**Official Framework**: https://github.com/entrepeneur4lyf/engineered-meta-cognitive-workflow-architecture

## Prerequisites

- Windsurf IDE installed and running
- Access to a project workspace (whatsapp-bot-scanner)
- Git/curl for downloading official framework files

## Two Setup Approaches

### Option 1: Official EMCWA Framework (Recommended)

Use the official framework files directly from the GitHub repository for the most authentic implementation.

### Option 2: Custom Multi-Agent Prompt

Use the streamlined prompt I created for quick testing (what you'll use in this guide).

## Step 0: Choose Your Approach

### For Official EMCWA Framework:

```bash
# Download official framework
curl -L https://github.com/entrepeneur4lyf/engineered-meta-cognitive-workflow-architecture/archive/refs/heads/main.zip -o emcwa-framework.zip
unzip emcwa-framework.zip
cd engineered-meta-cognitive-workflow-architecture-main

# Set up global rules in Windsurf
# Copy .windsurfrules to your project root
cp .windsurfrules /path/to/whatsapp-bot-scanner/

# Optional: Set global AI rules in Windsurf settings with
# the contents of engineered-meta-cognitive-workflow-architecture-v3-windsurf.md
```

### For Quick Testing (This Guide):

Continue with the custom prompt approach below.

## Step 1: Copy the Setup Prompt

1. Open Windsurf IDE
2. Navigate to your whatsapp-bot-scanner project
3. Open the Cascade chat panel (Ctrl+L or Cmd+L)
4. Copy the entire contents of `windsurf-multi-agent-prompt.txt`
5. Paste it into the Cascade input field
6. Press Enter to execute

## Step 2: Monitor Memory Bank Creation

The system will automatically:

- Create `.windsurf/` directory structure
- Initialize core memory files
- Load memory layers
- Set up agent role definitions

## Step 3: Execute Test Workflow

Once initialization completes, the system will demonstrate multi-agent orchestration by:

1. **Master Agent**: Analyzing project and planning input validation feature
2. **Sub-Agent**: Implementing URL/file path validation logic
3. **Verifier Agent**: Validating code quality and security

## Step 4: Validate Context Separation

Watch for these indicators that context separation is working:

### ✅ Clean Agent Transitions

- Master agent focuses only on planning/orchestration
- Sub-agent sees only implementation context
- Verifier sees only validation criteria

### ✅ No Context Pollution

- Agents don't reference information outside their scope
- Previous agent context doesn't bleed into current agent
- Memory layers remain isolated per agent role

### ✅ Sequential Dependencies

- Sub-agent receives clear task assignments from master
- Verifier receives implementation outputs from sub-agent
- Master receives validation results from verifier

## Step 5: Verify Memory Persistence

After the workflow completes:

- Check `.windsurf/task-logs/` for agent-specific logs
- Verify `.windsurf/core/activeContext.md` updates appropriately
- Confirm memory bank accumulates knowledge

## Troubleshooting

### If Context Pollution Occurs

```
Symptoms: Agents reference out-of-scope information
Solution: Execute "context reset" command and reinitialize agent boundaries
```

### If Agent Focus Fails

```
Symptoms: Agent performs tasks outside its role
Solution: Check prompt templates and reinforce role boundaries
```

### If Memory Bank Issues

```
Symptoms: Missing files or inconsistent data
Solution: Run "SessionStart" workflow to recreate structure
```

## Expected Output Structure

After successful execution, you should see:

```
.windsurf/
├── core/
│   ├── projectbrief.md      # Project overview
│   ├── activeContext.md     # Current agent context
│   ├── progress.md          # Workflow progress
│   └── systemPatterns.md    # Agent orchestration patterns
├── task-logs/
│   ├── task-log_[date]_master_analysis.md
│   ├── task-log_[date]_sub_implementation.md
│   └── task-log_[date]_verifier_validation.md
└── memory-index.md          # Master memory index
```

## Success Indicators

The system is working correctly when:

1. **Context Isolation**: Each agent maintains strict role boundaries
2. **Sequential Flow**: Tasks progress logically from master → sub → verifier
3. **Quality Assurance**: Verifier provides objective scoring (0-23 scale)
4. **Memory Persistence**: Knowledge accumulates across executions
5. **Error Recovery**: System handles failures gracefully

## Next Steps

Once validated, you can:

- Scale to more complex multi-agent workflows
- Add specialized sub-agents for different tasks
- Integrate with external tools via MCP
- Customize agent roles for your specific needs

## Performance Monitoring

Track these metrics:

- **Context Pollution Incidents**: Should be 0
- **Agent Role Violations**: Should be 0
- **Task Completion Rate**: Should be 100%
- **Quality Scores**: Average should be ≥18/23
