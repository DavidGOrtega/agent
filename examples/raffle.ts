import { z } from 'zod';
import { createAgent, EventsFromAgent, fromDecision } from '../src';
import { openai } from '@ai-sdk/openai';
import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal } from './helpers/helpers';

const agent = createAgent({
  id: 'raffle-chooser',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.collectEntries': z.object({}).describe('Collect more entries'),
    'agent.draw': z.object({}).describe('Draw a winner'),
    'agent.reportWinner': z.object({
      winningEntry: z.string().describe('The winning entry'),
      firstRunnerUp: z.string().describe('The first runner up entry'),
      secondRunnerUp: z.string().describe('The second runner up entry'),
      explanation: z
        .string()
        .describe('Explanation for why you chose the winning entry'),
    }),
  },
});

const machine = setup({
  types: {
    context: {} as {
      lastInput: string | null;
      entries: string[];
    },
    events: {} as EventsFromAgent<typeof agent>,
  },
  actors: { agent: fromDecision(agent), getFromTerminal: fromTerminal },
}).createMachine({
  context: {
    lastInput: null,
    entries: [],
  },
  initial: 'entering',
  states: {
    entering: {
      entry: log(({ context }) => context.entries),
      invoke: {
        src: 'getFromTerminal',
        input: 'What technology are you most interested in right now?',
        onDone: [
          {
            actions: assign({
              lastInput: ({ event }) => event.output,
            }),
            target: 'determining',
          },
        ],
      },
    },
    determining: {
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context,
          goal: 'If the last input explicitly says to end the drawing and/or choose a winner, start the drawing process. Otherwise, get more entries.',
        }),
      },
      on: {
        'agent.collectEntries': {
          target: 'entering',
          actions: assign({
            entries: ({ context }) => [...context.entries, context.lastInput!],
            lastInput: null,
          }),
        },
        'agent.draw': 'drawing',
      },
    },
    drawing: {
      entry: log('And the winner is...'),
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context,
          goal: 'Choose the technology that sounds most exciting to you from the entries. Be as unbiased as possible in your choice. Explain why you chose the winning entry.',
        }),
      },
      on: {
        'agent.reportWinner': {
          actions: log(
            ({ event }) =>
              `\n🎉🎉🎉 ${event.winningEntry} 🎉🎉🎉\n\n${event.explanation}`
          ),
          target: 'winner',
        },
      },
    },
    winner: {
      type: 'final',
    },
  },
  exit: () => {
    process.exit(0);
  },
});

const actor = createActor(machine);

actor.start();
