import { createAgent, fromDecision } from '../src';
import { z } from 'zod';
import { setup, createActor, createMachine } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { chainOfThoughtStrategy } from '../src/strategies/chainOfThought';

const agent = createAgent({
  id: 'simple',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.thought': z.object({
      text: z.string().describe('The text of the thought'),
    }),
  },
});

const machine = createMachine({
  initial: 'thinking',
  states: {
    thinking: {
      on: {
        'agent.thought': {
          actions: ({ event }) => console.log(event.text),
          target: 'thought',
        },
      },
    },
    thought: {
      type: 'final',
    },
  },
});

const actor = createActor(machine).start();

agent.onMessage(console.log);

agent.interact(actor, (obs) => {
  if (obs.state.matches('thinking')) {
    return {
      goal: 'Think about a random topic, and then share that thought.',
    };
  }
});
