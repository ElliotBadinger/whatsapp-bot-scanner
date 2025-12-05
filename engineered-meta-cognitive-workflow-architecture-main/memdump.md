## Memory ID: 9fad9ad6-bc7c-460f-9c26-a1521cc1bc2c

We investigated the length of the global rules file (/home/stonedoubt/.codeium/windsurf/memories/global_rules.md) which contains the Engineered Meta-Cognitive Workflow Architecture. The file is 5502 tokens, which is approaching the limit of 6000 tokens for global rules documentation. 

The user reported receiving warnings that the file is too long, suggesting possible truncation when loaded into Cascade's context. We examined the file which contains:
1. Memory Bank structure and Three-Layer Memory System
2. Task Log formats and Performance Standards
3. Self-Healing System mechanisms
4. Event Handlers in XML format
5. Function Maps (extensive XML definitions)
6. Workflow Definitions in XML
7. Multiple Mermaid flowcharts for workflows
8. Structured Decision Optimization principles

I created an optimized version at /home/stonedoubt/workspace/code-prompt-project/optimized_global_rules.md, but this removed essential operational components (XML function maps, workflow definitions, and diagrams) which the user identified as vital to the architecture.

We discussed two potential approaches:
1. Splitting the file into modules (main file + references to implementation details)
2. Restructuring/optimizing without removing functional components

The user expressed concern about what parts of the rules might be getting cut off or not properly loaded. We were unable to determine exactly which parts might be truncated without access to Cascade's internal processing logs or more specific error messages.

The user considered reloading the IDE to see if that would resolve the issue.

## Additional Memories

Memory ID: 056e361c-43f9-4173-96d8-6aa4439bd1c9
The project is being refactored to organize code into submodules by concern, using the `wmm_` prefix for each module. Current modules include:

- wmm_agents
- wmm_error
- wmm_indexer
- wmm_knowledge
- wmm_scraper
- wmm_search
- wmm_server
- wmm_workflow

The lib.rs file currently uses flat module declarations that don't match the directory structure. The refactoring will align the module declarations with the directory structure and ensure proper imports between modules.

Key dependencies include:
- headless_browser = "0.1.10" (replacing headless_chrome)
- headless_browser_lib = "0.1.10"
- spider = { version = "2.33.10", features = ["sync", "spoof"] }
- mcp-attr = "0.0.3"
- rswarm = "0.1.7"

Memory ID: 13a3cdcf-3f04-40e0-a9b2-27b91df2d626
The project requires chrome-headless-shell to be installed via NPX. A build script has been added to automate this installation during the build process with the command: `npx @puppeteer/browsers install chrome-headless-shell@stable`. This is essential for the web scraping functionality to work properly.

The project dependencies include:
- headless_browser = "0.1.10": Browser functionality
- headless_browser_lib = "0.1.10": Supporting library for browser functionality
- spider = { version = "2.33.10", features = ["sync", "spoof"] }: For web crawling with spoof feature enabled

The build script will attempt to install chrome-headless-shell during the build process, but users can also install it manually if needed.

Memory ID: 217c4e46-75d9-46d7-a7cb-fc9de8e1b443
The project is being migrated from using headless_chrome to headless_browser and headless_browser_lib. This involves:

1. Removing all references to headless_chrome in the codebase
2. Updating the error handling in error.rs (changed from headless_chrome::Timeout::Error to String)
3. Updating the web_scraper.rs implementation to use the new libraries
4. Ensuring the build.rs script installs chrome-headless-shell via NPX

The headless_browser (0.1.10) and headless_browser_lib (0.1.10) crates provide browser automation functionality and are designed to work with the spider ecosystem.

Memory ID: 52273830-3821-46ac-b6fa-2f66f5ddc2f5
Key dependencies from Cargo.toml:
- rswarm = "0.1.7"
- mcp-attr = "0.0.3"
- headless_chrome = "1.0.17"
- spider = "2.33.10"
- fast_html2md = "0.0.48"
- anyhow = "1.0.97"

Memory ID: d054e458-589b-4655-9c4b-be3cf9afc66a
Key imports from mcp-attr:
- use mcp_attr::server::{mcp_server, McpServer, serve_stdio}
- use mcp_attr::Result

Key patterns:
- #[mcp_server] attribute for server implementations
- #[prompt] for client-facing descriptions
- #[resource] for resource handling
- #[tool] for tool implementations
