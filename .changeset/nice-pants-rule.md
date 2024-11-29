---
'@statelyai/agent': major
---

- The `machine` and `machineHash` properties were removed from `AgentObservation` and `AgentObservationInput`
- The `defaultOptions` property was removed from `Agent`
- `AgentDecideOptions` was renamed to `AgentDecideInput`
- The `execute` property was removed from `AgentDecideInput`
- The `episodeId` optional property was added to `AgentDecideInput`, `AgentObservationInput`, and `AgentFeedbackInput`
- `decisionId` was added to `AgentObservationInput` and `AgentFeedbackInput`
