import { z } from 'zod';
import { createAgent, fromDecision, TypesFromAgent } from '../src';
import { openai } from '@ai-sdk/openai';
import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal } from './helpers/helpers';

const agent = createAgent({
  id: 'chatbot',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.respond': z.object({
      response: z.string().describe('The response from the agent'),
    }),
    'agent.endConversation': z.object({}).describe('Stop the conversation'),
  },
  context: {
    userMessage: z.string(),
  },
});

const machine = setup({
  types: {} as TypesFromAgent<typeof agent>,
  actors: { getFromTerminal: fromTerminal },
}).createMachine({
  initial: 'listening',
  context: {
    userMessage: '',
  },
  states: {
    listening: {
      invoke: {
        src: 'getFromTerminal',
        input: 'User:',
        onDone: {
          actions: assign({
            userMessage: ({ event }) => event.output,
          }),
          target: 'responding',
        },
      },
    },
    responding: {
      on: {
        'agent.respond': {
          actions: log(({ event }) => `Agent: ${event.response}`),
          target: 'listening',
        },
        'agent.endConversation': 'finished',
      },
    },
    finished: {
      type: 'final',
    },
  },
  exit: () => {
    console.log('End of conversation.');
    process.exit();
  },
});

const actor = createActor(machine).start();

agent.interact(actor, () => ({
  goal: 'Respond to the user, unless they want to end the conversation.',
  messages: agent.getMessages(),
}));
