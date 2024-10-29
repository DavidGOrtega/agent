import { createAgent } from '../src';
import { assign, createActor, setup } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { shortestPathPlanner } from '../src/planners/shortestPathPlanner';

const agent = createAgent({
  id: 'die-hard-solver',
  model: openai('gpt-4o'),
  events: {
    fill3: z.object({}).describe('Fill the 3-gallon jug'),
    fill5: z.object({}).describe('Fill the 5-gallon jug'),
    empty3: z.object({}).describe('Empty the 3-gallon jug'),
    empty5: z.object({}).describe('Empty the 5-gallon jug'),
    pour3to5: z
      .object({
        reasoning: z
          .string()
          .describe(
            'Very brief reasoning for pouring 3-gallon jug into 5-gallon jug'
          ),
      })
      .describe('Pour the 3-gallon jug into the 5-gallon jug'),
    pour5to3: z
      .object({
        reasoning: z
          .string()
          .describe(
            'Very brief reasoning for pouring 3-gallon jug into 5-gallon jug'
          ),
      })
      .describe('Pour the 5-gallon jug into the 3-gallon jug'),
  },
  context: {
    jug3: z.number().int().describe('Gallons of water in the 3-gallon jug'),
    jug5: z.number().int().describe('Gallons of water in the 5-gallon jug'),
  },
});

const waterJugMachine = setup({
  types: {
    context: agent.types.context,
    events: agent.types.events,
  },
}).createMachine({
  initial: 'solving',
  context: { jug3: 0, jug5: 0 },
  states: {
    solving: {
      always: {
        guard: ({ context }) => context.jug5 === 4,
        target: 'success',
      },
      on: {
        fill3: {
          actions: assign({ jug3: 3 }),
        },
        fill5: {
          actions: assign({ jug5: 5 }),
        },
        empty3: {
          actions: assign({ jug3: 0 }),
        },
        empty5: {
          actions: assign({ jug5: 0 }),
        },
        pour3to5: {
          actions: assign(({ context }) => {
            const total = context.jug3 + context.jug5;
            const newJug5 = Math.min(5, total);
            return {
              jug5: newJug5,
              jug3: total - newJug5,
            };
          }),
        },
        pour5to3: {
          actions: assign(({ context }) => {
            const total = context.jug3 + context.jug5;
            const newJug3 = Math.min(3, total);
            return {
              jug3: newJug3,
              jug5: total - newJug3,
            };
          }),
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
  const waterJugActor = createActor(waterJugMachine).start();

  while (waterJugActor.getSnapshot().value !== 'success') {
    maxTries++;
    if (maxTries > 20) {
      console.log('Max tries reached');
      throw new Error('Max tries reached');
    }
    const decision = await agent.decide({
      machine: waterJugMachine,
      goal: 'Get exactly 4 gallons of water in the 5-gallon jug',
      state: waterJugActor.getSnapshot(),
      planner: shortestPathPlanner,
    });

    console.log(decision?.nextEvent);

    if (decision?.nextEvent) {
      waterJugActor.send(decision.nextEvent);
      console.log(waterJugActor.getSnapshot().context);
    } else {
      console.log('No decision made');
    }
  }

  console.log('Done');
}

main();
