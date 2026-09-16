# Codex Multi-Agent Orchestration Profile: Plus Plan

## System Settings
- Primary Master: GPT-6 Astra (Reasoning: Light)
- Subagent Engine: GPT-5.6 Luna (Reasoning: Max)
- Routine Worker: Terra

## Tool Integrations
- Structural Analysis: NexGenis (`/analyze`)
- Token Optimizer: Caveman (`/caveman`)

## Orchestration & Pipeline Execution
1. BEFORE planning, use NexGenis via `/analyze` to map out the code path in DokkanCustom. 
2. GPT-6 Astra (Light) acts exclusively as the High-Level Architect. It must outline the execution steps and pause for user approval.
3. Upon approval, Astra MUST delegate all core script writing and logic edits to GPT-5.6 Luna (Max).
4. All agents must enforce `/caveman` compression mechanics on their outputs:
   - Eliminate filler text, pleasantries, and lengthy explanations.
   - Output raw code blocks, file changes, and telegraphic fragments only.
   - Keep technical accuracy byte-exact while cutting verbose commentary.
5. Terra handles minor routine tasks, asset organizing, or file cleaning under the same compressed rules.
