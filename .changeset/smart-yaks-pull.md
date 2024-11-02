---
'@statelyai/agent': minor
---

You can specify `allowedEvents` in `agent.decide(...)` to allow from a list of specific events to be sent to the agent. This is useful when using `agent.decide(...)` without a state machine.

```ts
const agent = createAgent({
  // ...
  events: {
    PLAY: z.object({}).describe('Play a move'),
    SKIP: z.object({}).describe('Skip a move'),
    FORFEIT: z.object({}).describe('Forfeit the game'),
  },
});

// ...
const decision = await agent.decide({
  // Don't allow the agent to send `FORFEIT` or other events
  allowedEvents: ['PLAY', 'SKIP'],
  // ...
});
```
