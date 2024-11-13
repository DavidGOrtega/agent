import { z } from 'zod';
import { createAgent, fromDecision, TypesFromAgent } from '../src';
import { openai } from '@ai-sdk/openai';
import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal } from './helpers/helpers';
import { chainOfThoughtStrategy } from '../src/strategies/chainOfThought';

const agent = createAgent({
  id: 'chain-of-thought',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.think': z.object({
      thought: z
        .string()
        .describe('The thought process to answering the question'),
    }),
    'agent.answer': z.object({
      answer: z.string().describe('The answer to the question'),
    }),
  },
  context: {
    question: z.string().nullable(),
  },
  strategy: chainOfThoughtStrategy,
});

const machine = setup({
  types: {} as TypesFromAgent<typeof agent>,
  actors: { getFromTerminal: fromTerminal },
}).createMachine({
  initial: 'asking',
  context: {
    question: null,
  },
  states: {
    asking: {
      invoke: {
        src: 'getFromTerminal',
        input: 'What would you like to ask?',
        onDone: {
          actions: assign({
            question: ({ event }) => event.output,
          }),
          target: 'answering',
        },
      },
    },
    answering: {
      on: {
        'agent.answer': {
          actions: log(({ event }) => `Answer: ${event.answer}`),
          target: 'answered',
        },
      },
    },
    answered: {
      type: 'final',
    },
  },
});

const actor = createActor(machine).start();

agent.onMessage(console.log);

agent.interact(actor, (obs) => {
  if (obs.state.matches('answering')) {
    return {
      goal: 'Answer the question',
      state: obs.state,
      messages: agent.getMessages(),
    };
  }
});
