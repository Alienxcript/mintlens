# MINTLENS MCP Server

An MCP server that brings Bags.fm token intelligence directly into Claude.ai and Claude Code.

## Tools

| Tool | Description |
|---|---|
| `analyze_token` | Full due-diligence report for any token (score 0-100, sections, flags) |
| `get_token_feed` | Recent Bags.fm launches with optional score filter |
| `get_creator_profile` | Creator aggregate stats + full token history |
| `get_token_holders` | Holder count, top-10 concentration, ranked holder list |
| `compare_tokens` | Side-by-side comparison of two tokens with a winner verdict |

## Setup

1. Copy the root `.env.example` to `.env` in the `mcp/` directory (or set env vars):
   ```
   BAGS_API_KEY=...
   HELIUS_API_KEY=...
   ANTHROPIC_API_KEY=...
   ```

2. Install dependencies:
   ```bash
   cd mcp && npm install
   ```

3. Add to Claude Code:
   ```bash
   claude mcp add mintlens -- node /absolute/path/to/mintlens/mcp/index.js
   ```
   Or add to your Claude Code config (`~/.claude.json`):
   ```json
   {
     "mcpServers": {
       "mintlens": {
         "command": "node",
         "args": ["/absolute/path/to/mintlens/mcp/index.js"]
       }
     }
   }
   ```

4. Run standalone (for testing):
   ```bash
   node mcp/index.js
   ```

## Example Prompts (in Claude)

- "Analyze this Bags token: [mint address]"
- "What are the latest Bags.fm launches?"
- "Compare these two tokens: [mintA] vs [mintB]"
- "Show me the creator profile for @username"
- "What's the holder distribution for [mint]?"
