---
"@statelyai/agent": patch
---

The `description` field in `createAgent({ description: '...' })` is now used for the `system` prompt in agent decision making when a `system` prompt is not provided.
