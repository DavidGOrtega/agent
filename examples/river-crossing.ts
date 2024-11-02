import { createAgent } from '../src';
import { assign, createActor, setup } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { experimental_createShortestPathStrategy } from '../src/strategies/shortestPath';

const agent = createAgent({
  id: 'river-crossing-solver',
  model: openai('gpt-4'),
  events: {
    takeWolf: z
      .object({
        reasoning: z.string().describe('Reasoning for taking the wolf across'),
      })
      .describe('Take wolf across the river'),
    takeGoat: z
      .object({
        reasoning: z.string().describe('Reasoning for taking the goat across'),
      })
      .describe('Take goat across the river'),
    takeCabbage: z
      .object({
        reasoning: z
          .string()
          .describe('Reasoning for taking the cabbage across'),
      })
      .describe('Take cabbage across the river'),
    returnEmpty: z
      .object({
        reasoning: z.string().describe('Reasoning for returning alone'),
      })
      .describe('Return across river alone'),
  },
  context: {
    leftBank: z
      .array(z.enum(['wolf', 'goat', 'cabbage']))
      .describe('Items on the left bank'),
    rightBank: z
      .array(z.enum(['wolf', 'goat', 'cabbage']))
      .describe('Items on the right bank'),
    farmerPosition: z
      .enum(['left', 'right'])
      .describe('Which bank the farmer is on'),
  },
});

const riverCrossingMachine = setup({
  types: {
    context: agent.types.context,
    events: agent.types.events,
  },
}).createMachine({
  initial: 'solving',
  context: {
    leftBank: ['wolf', 'goat', 'cabbage'],
    rightBank: [],
    farmerPosition: 'left',
  },
  states: {
    solving: {
      always: {
        guard: ({ context }) => context.rightBank.length === 3,
        target: 'success',
      },
      on: {
        takeWolf: {
          guard: ({ context }) =>
            context.leftBank.includes('wolf') &&
            context.farmerPosition === 'left',
          actions: assign(({ context }) => ({
            leftBank: context.leftBank.filter((item) => item !== 'wolf'),
            rightBank: [...context.rightBank, 'wolf'],
            farmerPosition: 'right',
          })),
        },
        takeGoat: {
          guard: ({ context }) =>
            context.leftBank.includes('goat') &&
            context.farmerPosition === 'left',
          actions: assign(({ context }) => ({
            leftBank: context.leftBank.filter((item) => item !== 'goat'),
            rightBank: [...context.rightBank, 'goat'],
            farmerPosition: 'right',
          })),
        },
        takeCabbage: {
          guard: ({ context }) =>
            context.leftBank.includes('cabbage') &&
            context.farmerPosition === 'left',
          actions: assign(({ context }) => ({
            leftBank: context.leftBank.filter((item) => item !== 'cabbage'),
            rightBank: [...context.rightBank, 'cabbage'],
            farmerPosition: 'right',
          })),
        },
        returnEmpty: {
          actions: assign(({ context }) => ({
            farmerPosition:
              context.farmerPosition === 'left' ? 'right' : 'left',
          })),
        },
      },
    },
    success: {
      type: 'final',
    },
  },
});

let maxTries = 0;
async function main() {
  const riverActor = createActor(riverCrossingMachine).start();

  while (riverActor.getSnapshot().value !== 'success') {
    maxTries++;
    if (maxTries > 20) {
      console.log('Max tries reached');
      throw new Error('Max tries reached');
    }
    const decision = await agent.decide({
      machine: riverCrossingMachine,
      goal: 'Get all items safely across the river. Remember: Cannot leave wolf with goat or goat with cabbage unattended.',
      state: riverActor.getSnapshot(),
      strategy: experimental_createShortestPathStrategy(),
    });

    console.log(decision?.nextEvent);

    if (decision?.nextEvent) {
      riverActor.send(decision.nextEvent);
      console.log(riverActor.getSnapshot().context);
    } else {
      console.log('No decision made');
    }
  }

  console.log('Successfully crossed the river!');
}

main();
