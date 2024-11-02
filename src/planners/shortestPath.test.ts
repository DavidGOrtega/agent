import { createAgent } from '..';
import { assign, createActor, setup } from 'xstate';
import { z } from 'zod';
import { experimental_createShortestPathPlanner } from './shortestPath';
import { test, expect } from 'vitest';
import { dummyResponseValues, MockLanguageModelV1 } from '../mockModel';

test.skip('should find shortest path to goal', async () => {
  const agent = createAgent({
    id: 'counter',
    model: new MockLanguageModelV1({
      doGenerate: async () => {
        return {
          ...dummyResponseValues,
        };
      },
    }),
    events: {
      increment: z.object({}).describe('Increment the counter by 1'),
      decrement: z.object({}).describe('Decrement the counter by 1'),
    },
    context: {
      count: z.number().int().describe('Current count value'),
    },
  });

  const counterMachine = setup({
    types: {
      context: agent.types.context,
      events: agent.types.events,
    },
  }).createMachine({
    initial: 'counting',
    context: { count: 0 },
    states: {
      counting: {
        always: {
          guard: ({ context }) => context.count === 3,
          target: 'success',
        },
        on: {
          increment: {
            actions: assign({ count: ({ context }) => context.count + 1 }),
          },
          decrement: {
            actions: assign({ count: ({ context }) => context.count - 1 }),
          },
        },
      },
      success: {
        type: 'final',
      },
    },
  });

  const counterActor = createActor(counterMachine).start();

  const decision = await agent.decide({
    machine: counterMachine,
    model: new MockLanguageModelV1({
      defaultObjectGenerationMode: 'tool',
      doGenerate: async () => {
        return {
          ...dummyResponseValues,
          text: JSON.stringify({
            type: 'object',
            properties: {
              count: {
                type: 'number',
                const: 3,
              },
            },
            required: ['count'],
          }),
        };
      },
    }),
    goal: 'Get the counter to exactly 3',
    state: counterActor.getSnapshot(),
    planner: experimental_createShortestPathPlanner(),
  });

  expect(decision?.nextEvent?.type).toBe('increment');
});
