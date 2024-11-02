import { test, expect } from 'vitest';
import { createAgent, fromDecision } from '.';
import { createActor, createMachine, waitFor } from 'xstate';
import { z } from 'zod';
import { LanguageModelV1CallOptions } from 'ai';
import { dummyResponseValues, MockLanguageModelV1 } from './mockModel';

const doGenerate = async (params: LanguageModelV1CallOptions) => {
  const keys =
    params.mode.type === 'regular' ? params.mode.tools?.map((t) => t.name) : [];

  return {
    ...dummyResponseValues,
    finishReason: 'tool-calls',
    toolCalls: [
      {
        toolCallType: 'function',
        toolCallId: 'call-1',
        toolName: keys![0],
        args: `{ "type": "${keys?.[0]}" }`,
      },
    ],
  } as any;
};

test('fromDecision() makes a decision', async () => {
  const model = new MockLanguageModelV1({
    doGenerate,
  });
  const agent = createAgent({
    id: 'test',
    model,
    events: {
      doFirst: z.object({}),
      doSecond: z.object({}),
    },
  });

  const machine = createMachine({
    initial: 'first',
    states: {
      first: {
        invoke: {
          src: fromDecision(agent),
        },
        on: {
          doFirst: 'second',
        },
      },
      second: {
        invoke: {
          src: fromDecision(agent),
        },
        on: {
          doSecond: 'third',
        },
      },
      third: {},
    },
  });

  const actor = createActor(machine);

  actor.start();

  await waitFor(actor, (s) => s.matches('third'));

  expect(actor.getSnapshot().value).toBe('third');
});

test('interacts with an actor', async () => {
  const model = new MockLanguageModelV1({
    doGenerate,
  });
  const agent = createAgent({
    id: 'test',
    model,
    events: {
      doFirst: z.object({}),
      doSecond: z.object({}),
    },
  });

  const machine = createMachine({
    initial: 'first',
    states: {
      first: {
        on: {
          doFirst: 'second',
        },
      },
      second: {
        on: {
          doSecond: 'third',
        },
      },
      third: {},
    },
  });

  const actor = createActor(machine);

  agent.interact(actor, () => ({
    goal: 'Some goal',
  }));

  actor.start();

  await waitFor(actor, (s) => s.matches('third'));

  expect(actor.getSnapshot().value).toBe('third');
});

test('interacts with an actor (late interaction)', async () => {
  const model = new MockLanguageModelV1({
    doGenerate,
  });
  const agent = createAgent({
    id: 'test',
    model,
    events: {
      doFirst: z.object({}),
      doSecond: z.object({}),
    },
  });

  const machine = createMachine({
    initial: 'first',
    states: {
      first: {
        on: {
          doFirst: 'second',
        },
      },
      second: {
        on: {
          doSecond: 'third',
        },
      },
      third: {},
    },
  });

  const actor = createActor(machine);

  actor.start();

  agent.interact(actor, () => ({
    goal: 'Some goal',
  }));

  await waitFor(actor, (s) => s.matches('third'));

  expect(actor.getSnapshot().value).toBe('third');
});

test('agent.decide() makes a decision based on goal and state (simple planner)', async () => {
  const model = new MockLanguageModelV1({
    doGenerate,
  });

  const agent = createAgent({
    id: 'test',
    model,
    events: {
      MOVE: z.object({}),
    },
  });

  const plan = await agent.decide({
    goal: 'Make the best move',
    state: {
      value: 'playing',
      context: {
        board: [0, 0, 0],
      },
    },
    machine: createMachine({
      initial: 'playing',
      states: {
        playing: {
          on: {
            MOVE: 'next',
          },
        },
        next: {},
      },
    }),
  });

  expect(plan).toBeDefined();
  expect(plan!.nextEvent).toEqual(
    expect.objectContaining({
      type: 'MOVE',
    })
  );
});

test.each([
  [undefined, true],
  [undefined, false],
  [3, true],
  [3, false],
])(
  'agent.decide() retries if a decision is not made (%i attempts, succeed: %s)',
  async (maxAttempts, succeed) => {
    let attempts = 0;
    const doGenerateWithRetry = async (params: LanguageModelV1CallOptions) => {
      const keys =
        params.mode.type === 'regular'
          ? params.mode.tools?.map((t) => t.name)
          : [];

      console.log('try', attempts, 'max', maxAttempts);

      const toolCalls =
        succeed && attempts++ === (maxAttempts ?? 2) - 1
          ? [
              {
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: keys![0],
                args: `{ "type": "${keys?.[0]}" }`,
              },
            ]
          : [];

      return {
        ...dummyResponseValues,
        finishReason: 'tool-calls',
        toolCalls,
      } as any;
    };
    const model = new MockLanguageModelV1({
      doGenerate: doGenerateWithRetry,
    });

    const agent = createAgent({
      id: 'test',
      model,
      events: {
        MOVE: z.object({}),
      },
    });

    const plan = await agent.decide({
      goal: 'Make the best move',
      state: {
        value: 'playing',
      },
      machine: createMachine({
        initial: 'playing',
        states: {
          playing: {
            on: {
              MOVE: 'win',
            },
          },
          win: {},
        },
      }),
      maxAttempts,
    });

    if (!succeed) {
      expect(plan).toBeUndefined();
    } else {
      expect(plan).toBeDefined();
      expect(plan!.nextEvent).toEqual(
        expect.objectContaining({
          type: 'MOVE',
        })
      );
    }
  }
);

test.each([['MOVE'], ['FORFEIT']] as const)(
  'agent.decide() respects allowedEvents constraint (event: %s)',
  async (allowedEventType) => {
    const model = new MockLanguageModelV1({
      doGenerate: async (params: LanguageModelV1CallOptions) => {
        const keys =
          params.mode.type === 'regular'
            ? params.mode.tools?.map((t) => t.name)
            : [];

        return {
          ...dummyResponseValues,
          finishReason: 'tool-calls',
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: keys![0],
              args: `{ "type": "${keys?.[0]}" }`,
            },
          ],
        } as any;
      },
    });

    const agent = createAgent({
      id: 'test',
      model,
      events: {
        MOVE: z.object({}),
        SKIP: z.object({}),
        FORFEIT: z.object({}),
      },
    });

    const decision = await agent.decide({
      goal: 'Make the best move',
      state: {
        value: 'playing',
        context: {},
      },
      allowedEvents: [allowedEventType],
    });

    expect(decision?.nextEvent?.type).toEqual(allowedEventType);
  }
);
