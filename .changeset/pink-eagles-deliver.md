---
'@statelyai/agent': patch
---

The `score` is now required for feedback:

```ts
agent.addFeedback({
  score: 0.5,
  goal: 'Win the game',
  observationId: '...',
});
```
