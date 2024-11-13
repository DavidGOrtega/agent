---
'@statelyai/agent': patch
---

The entire observed `state` must be provided, instead of only `context`, for any agent decision making functions:

```ts
agent.interact(actor, (obs) => {
  // ...
  return {
    goal: 'Some goal',
    // instead of context
    state: obs.state,
  };
});
```
