---
'@statelyai/agent': major
---

The `state` can no longer be specified in `agent.interact(...)`, since the actual state value is already observed and passed to the `strategy` function.

The `context` provided to agent decision functions, like `agent.decide({ context })` and in `agent.interact(...)`, is now used solely to override the `state.context` provided to the prompt template.
