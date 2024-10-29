import { z } from 'zod';
import { createAgent, fromDecision } from '../src';
import { openai } from '@ai-sdk/openai';
import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal } from './helpers/helpers';

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
    thought: z.string().nullable(),
  },
});

const machine = setup({
  types: agent.types,
  actors: { getFromTerminal: fromTerminal },
}).createMachine({
  initial: 'asking',
  context: {
    question: null,
    thought: null,
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
          target: 'thinking',
        },
      },
    },
    thinking: {
      on: {
        'agent.think': {
          actions: [
            log(({ event }) => `Thought: ${event.thought}`),
            assign({
              thought: ({ event }) => event.thought,
            }),
          ],
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

agent.interact(actor, (obs) => {
  if (obs.state.matches('thinking')) {
    return {
      goal: 'Think step-by-step about how you would answer the question',
      context: obs.state.context,
      messages: agent.getMessages(),
    };
  }
  if (obs.state.matches('answering')) {
    return {
      goal: 'Answer the question',
      context: obs.state.context,
      messages: agent.getMessages(),
    };
  }
});
