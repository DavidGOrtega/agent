---
'@statelyai/agent': minor
---

planner -> strategy
agent.addPlan -> agent.addDecision
agent.getPlans -> agent.getDecisions

The word "strategy" is now used instead of "planner" to make it more clear what the agent is doing: it uses a strategy to make decisions. The method `agent.addPlan(…)` has been renamed to `agent.addDecision(…)` and `agent.getPlans(…)` has been renamed to `agent.getDecisions(…)` to reflect this change. Additionally, you specify the `strategy` instead of the `planner` when creating an agent:

```diff
const agent = createAgent({
- planner: createSimplePlanner(),
+ strategy: createSimpleStrategy(),
  ...
});
```
