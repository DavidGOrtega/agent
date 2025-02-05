# @statelyai/agent

## 2.0.0-next.4

### Major Changes

- [`4a79bac`](https://github.com/statelyai/agent/commit/4a79bacbda33340b34a4b6271c2bd0fa2673ce25) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - The `machine` and `machineHash` properties were removed from `AgentObservation` and `AgentObservationInput`
  - The `defaultOptions` property was removed from `Agent`
  - `AgentDecideOptions` was renamed to `AgentDecideInput`
  - The `execute` property was removed from `AgentDecideInput`
  - The `episodeId` optional property was added to `AgentDecideInput`, `AgentObservationInput`, and `AgentFeedbackInput`
  - `decisionId` was added to `AgentObservationInput` and `AgentFeedbackInput`

## 2.0.0-next.3

### Major Changes

- [`bf6b468`](https://github.com/statelyai/agent/commit/bf6b468d66d58bf53629d70d1b2a273948c9ba1e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `state` can no longer be specified in `agent.interact(...)`, since the actual state value is already observed and passed to the `strategy` function.

  The `context` provided to agent decision functions, like `agent.decide({ context })` and in `agent.interact(...)`, is now used solely to override the `state.context` provided to the prompt template.

### Minor Changes

- [`1287a6d`](https://github.com/statelyai/agent/commit/1287a6d405ed3bd6be37a61aaa9d54d963b5b1cd) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `score` and `comment` fields for feedback

### Patch Changes

- [`5b5a8e7`](https://github.com/statelyai/agent/commit/5b5a8e7012d550f5b05d0fefc9eade7731202577) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `score` is now required for feedback:

  ```ts
  agent.addFeedback({
    score: 0.5,
    goal: "Win the game",
    observationId: "...",
  });
  ```

- [`5b5a8e7`](https://github.com/statelyai/agent/commit/5b5a8e7012d550f5b05d0fefc9eade7731202577) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The entire observed `state` must be provided, instead of only `context`, for any agent decision making functions:

  ```ts
  agent.interact(actor, (obs) => {
    // ...
    return {
      goal: "Some goal",
      // instead of context
      state: obs.state,
    };
  });
  ```

- [`9d65d71`](https://github.com/statelyai/agent/commit/9d65d71e41f9f0f84f637ea7e0a0e22ccf67f264) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Remove `goal` from feedback input

## 2.0.0-next.2

### Minor Changes

- [`4d870fe`](https://github.com/statelyai/agent/commit/4d870fe38ad0c906bafb2e0f6b2dabb745900ad3) Thanks [@davidkpiano](https://github.com/davidkpiano)! - planner -> strategy
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

- [`f1189cb`](https://github.com/statelyai/agent/commit/f1189cb980e52fa909888d27d3300dcd913ea47f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - For feedback, the `goal`, `observationId`, and `attributes` are now required, and `feedback` and `reward` are removed since they are redundant.

- [`7b16326`](https://github.com/statelyai/agent/commit/7b163266c61bfc8125ed4d00924680d932001e27) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can specify `allowedEvents` in `agent.decide(...)` to allow from a list of specific events to be sent to the agent. This is useful when using `agent.decide(...)` without a state machine.

  ```ts
  const agent = createAgent({
    // ...
    events: {
      PLAY: z.object({}).describe("Play a move"),
      SKIP: z.object({}).describe("Skip a move"),
      FORFEIT: z.object({}).describe("Forfeit the game"),
    },
  });

  // ...
  const decision = await agent.decide({
    // Don't allow the agent to send `FORFEIT` or other events
    allowedEvents: ["PLAY", "SKIP"],
    // ...
  });
  ```

## 2.0.0-next.1

### Minor Changes

- [`6a9861d`](https://github.com/statelyai/agent/commit/6a9861d959ce295114f53c95c5bdaa097348bacb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can specify `maxAttempts` in `agent.decide({ maxAttempts: 5 })`. This will allow the agent to attempt to make a decision up to the specified number of `maxAttempts` before giving up. The default value is `2`.

### Patch Changes

- [`8c3eab8`](https://github.com/statelyai/agent/commit/8c3eab8950cb85e662c6afb5d8cefb1d5ef54dd8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `name` field in `createAgent({ name: '...' })` has been renamed to `id`.

- [`8c3eab8`](https://github.com/statelyai/agent/commit/8c3eab8950cb85e662c6afb5d8cefb1d5ef54dd8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `description` field in `createAgent({ description: '...' })` is now used for the `system` prompt in agent decision making when a `system` prompt is not provided.

## 2.0.0-next.0

### Major Changes

- [#51](https://github.com/statelyai/agent/pull/51) [`574b6fd`](https://github.com/statelyai/agent/commit/574b6fd62e8a41df311aa1ea00fae60c32ad595e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - `agent.generateText(…)` is removed in favor of using the AI SDK's `generateText(…)` function with a wrapped model.
  - `agent.streamText(…)` is removed in favor of using the AI SDK's `streamText(…)` function with a wrapped model.
  - Custom adapters are removed for now, but may be re-added in future releases. Using the AI SDK is recommended for now.
  - Correlation IDs are removed in favor of using [OpenTelemetry with the AI SDK](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry#telemetry).
  - The `createAgentMiddleware(…)` function was introduced to facilitate agent message history. You can also use `agent.wrap(model)` to wrap a model with Stately Agent middleware.

## 1.1.6

### Patch Changes

- [#54](https://github.com/statelyai/agent/pull/54) [`140fdce`](https://github.com/statelyai/agent/commit/140fdceb879dea5a32f243e89a8d87a9c524e454) Thanks [@XavierDK](https://github.com/XavierDK)! - - Addressing an issue where the fullStream property was not properly copied when using the spread operator (...). The problem occurred because fullStream is an iterator, and as such, it was not included in the shallow copy of the result object.
  - Update all packages

## 1.1.5

### Patch Changes

- [#49](https://github.com/statelyai/agent/pull/49) [`ae505d5`](https://github.com/statelyai/agent/commit/ae505d56b432a92875699507fb694628ef4d773d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update `ai` package

## 1.1.4

### Patch Changes

- [#47](https://github.com/statelyai/agent/pull/47) [`185c149`](https://github.com/statelyai/agent/commit/185c1498f63aef15a3194032df3dcdcb2b33d752) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update `ai` and `xstate` packages

## 1.1.3

### Patch Changes

- [#45](https://github.com/statelyai/agent/pull/45) [`3c271f3`](https://github.com/statelyai/agent/commit/3c271f306c4ed9553c155e66cec8aa4284e9c813) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix reading the actor logic

## 1.1.2

### Patch Changes

- [#43](https://github.com/statelyai/agent/pull/43) [`8e7629c`](https://github.com/statelyai/agent/commit/8e7629c347b29b704ae9576aa1af97e6cd693bc7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update dependencies

## 1.1.1

### Patch Changes

- [#41](https://github.com/statelyai/agent/pull/41) [`b2f2b73`](https://github.com/statelyai/agent/commit/b2f2b7307e96d7722968769aae9db2572ede8ce7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update dependencies

## 1.1.0

### Minor Changes

- [#39](https://github.com/statelyai/agent/pull/39) [`3cce30f`](https://github.com/statelyai/agent/commit/3cce30fc77d36dbed0abad805248de9f64bf8086) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added four new methods for easily retrieving agent messages, observations, feedback, and plans:

  - `agent.getMessages()`
  - `agent.getObservations()`
  - `agent.getFeedback()`
  - `agent.getPlans()`

  The `agent.select(…)` method is deprecated in favor of these methods.

- [#40](https://github.com/statelyai/agent/pull/40) [`8b7c374`](https://github.com/statelyai/agent/commit/8b7c37482d5c35b2b3addc2f88e198526f203da7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Correlation IDs are now provided as part of the result from `agent.generateText(…)` and `agent.streamText(…)`:

  ```ts
  const result = await agent.generateText({
    prompt: "Write me a song",
    correlationId: "my-correlation-id",
    // ...
  });

  result.correlationId; // 'my-correlation-id'
  ```

  These correlation IDs can be passed to feedback:

  ```ts
  // ...

  agent.addFeedback({
    reward: -1,
    correlationId: result.correlationId,
  });
  ```

- [#40](https://github.com/statelyai/agent/pull/40) [`8b7c374`](https://github.com/statelyai/agent/commit/8b7c37482d5c35b2b3addc2f88e198526f203da7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Changes to agent feedback (the `AgentFeedback` interface):

  - `goal` is now optional
  - `observationId` is now optional
  - `correlationId` has been added (optional)
  - `reward` has been added (optional)
  - `attributes` are now optional

- [#38](https://github.com/statelyai/agent/pull/38) [`21fb17c`](https://github.com/statelyai/agent/commit/21fb17c65fac1cbb4a8b08a04a58480a6930a0a9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now add `context` Zod schema to your agent. For now, this is meant to be passed directly to the state machine, but in the future, the schema can be shared with the LLM agent to better understand the state machine and its context for decision making.

  Breaking: The `context` and `events` types are now in `agent.types` instead of ~~`agent.eventTypes`.

  ```ts
  const agent = createAgent({
    // ...
    context: {
      score: z.number().describe("The score of the game"),
      // ...
    },
  });

  const machine = setup({
    types: agent.types,
  }).createMachine({
    context: {
      score: 0,
    },
    // ...
  });
  ```

### Patch Changes

- [`5f863bb`](https://github.com/statelyai/agent/commit/5f863bb0d89d90f30d0a9aa1f0dd2a35f0eeb45b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Use nanoid

- [#37](https://github.com/statelyai/agent/pull/37) [`dafa815`](https://github.com/statelyai/agent/commit/dafa8157cc1b5adbfb222c146dbc84ab2eed8894) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Messages are now properly included in `agent.decide(…)`, when specified.

## 0.1.0

### Minor Changes

- [#32](https://github.com/statelyai/agent/pull/32) [`537f501`](https://github.com/statelyai/agent/commit/537f50111b5f8edc1a309d1abb8fffcdddddbc03) Thanks [@davidkpiano](https://github.com/davidkpiano)! - First minor release of `@statelyai/agent`! The API has been simplified from experimental earlier versions. Here are the main methods:

  - `createAgent({ … })` creates an agent
  - `agent.decide({ … })` decides on a plan to achieve the goal
  - `agent.generateText({ … })` generates text based on a prompt
  - `agent.streamText({ … })` streams text based on a prompt
  - `agent.addObservation(observation)` adds an observation and returns a full observation object
  - `agent.addFeedback(feedback)` adds a feedback and returns a full feedback object
  - `agent.addMessage(message)` adds a message and returns a full message object
  - `agent.addPlan(plan)` adds a plan and returns a full plan object
  - `agent.onMessage(cb)` listens to messages
  - `agent.select(selector)` selects data from the agent context
  - `agent.interact(actorRef, getInput)` interacts with an actor and makes decisions to accomplish a goal

## 0.0.8

### Patch Changes

- [#22](https://github.com/statelyai/agent/pull/22) [`8a2c34b`](https://github.com/statelyai/agent/commit/8a2c34b8a99161bf47c72df8eed3f5d3b6a19f5f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createSchemas(…)` function has been removed. The `defineEvents(…)` function should be used instead, as it is a simpler way of defining events and event schemas using Zod:

  ```ts
  import { defineEvents } from "@statelyai/agent";
  import { z } from "zod";
  import { setup } from "xstate";

  const events = defineEvents({
    inc: z.object({
      by: z.number().describe("Increment amount"),
    }),
  });

  const machine = setup({
    types: {
      events: events.types,
    },
    schema: {
      events: events.schemas,
    },
  }).createMachine({
    // ...
  });
  ```

## 0.0.7

### Patch Changes

- [#18](https://github.com/statelyai/agent/pull/18) [`dcaabab`](https://github.com/statelyai/agent/commit/dcaababe69255b7eaff3347d0cf09469d3e6cc78) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `context` is now optional for `createSchemas(…)`

## 0.0.6

### Patch Changes

- [#16](https://github.com/statelyai/agent/pull/16) [`3ba5fb2`](https://github.com/statelyai/agent/commit/3ba5fb2392b51dee71f2585ed662b4ee9ecd6c41) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update to XState 5.8.0

## 0.0.5

### Patch Changes

- [#9](https://github.com/statelyai/agent/pull/9) [`d8e7b67`](https://github.com/statelyai/agent/commit/d8e7b673f6d265f37b2096b25d75310845860271) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `adapter.fromTool(…)`, which creates an actor that chooses agent logic based on a input.

  ```ts
  const actor = adapter.fromTool(() => "Draw me a picture of a donut", {
    // tools
    makeIllustration: {
      description: "Makes an illustration",
      run: async (input) => {
        /* ... */
      },
      inputSchema: {
        /* ... */
      },
    },
    getWeather: {
      description: "Gets the weather",
      run: async (input) => {
        /* ... */
      },
      inputSchema: {
        /* ... */
      },
    },
  });

  //...
  ```

## 0.0.4

### Patch Changes

- [#5](https://github.com/statelyai/agent/pull/5) [`ae473d7`](https://github.com/statelyai/agent/commit/ae473d73399a15ac3199d77d00eb44a0ea5626db) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Simplify API (WIP)

- [#5](https://github.com/statelyai/agent/pull/5) [`687bed8`](https://github.com/statelyai/agent/commit/687bed87f29bd1d13447cc53b5154da0fe6fdcab) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `createSchemas`, `createOpenAIAdapter`, and change `createAgent`

## 0.0.3

### Patch Changes

- [#1](https://github.com/statelyai/agent/pull/1) [`3dc2880`](https://github.com/statelyai/agent/commit/3dc28809a7ffd915a69d9f3374531c31fc1ee357) Thanks [@mellson](https://github.com/mellson)! - Adds a convenient way to run the examples with `pnpm example ${exampleName}`. If no example name is provided, the script will print the available examples. Also, adds a fun little loading animation to the joke example.

## 0.0.2

### Patch Changes

- e125728: Added `createAgent(...)`
