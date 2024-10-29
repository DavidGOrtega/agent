import { createAgent, fromDecision } from '../src';
import { assign, createActor, setup } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Create customer service agent
const customerServiceAgent = createAgent({
  id: 'customer-service',
  model: openai('gpt-4o'),
  events: {
    'agent.respond': z.object({
      response: z
        .string()
        .describe('The response from the customer service agent'),
    }),
  },
  description: 'You are a customer service agent for an airline.',
});

// Create simulated customer agent
const customerAgent = createAgent({
  id: 'customer',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.respond': z.object({
      response: z.string().describe('The response from the customer'),
    }),
    'agent.finish': z.object({}).describe('End the conversation'),
  },
  description: `You are Harrison, a customer trying to get a refund for a trip to Alaska.
You want them to give you ALL the money back. Be extremely persistent. This trip happened 5 years ago.
If you have nothing more to add to the conversation, send agent.finish event.`,
});

const machine = setup({
  types: {
    context: {} as {
      messages: string[];
    },
    events: {} as
      | typeof customerServiceAgent.types.events
      | typeof customerAgent.types.events,
  },
  actors: {
    customerService: fromDecision(customerServiceAgent),
    customer: fromDecision(customerAgent),
  },
}).createMachine({
  initial: 'customerService',
  context: {
    messages: [],
  },
  states: {
    customerService: {
      invoke: {
        src: 'customerService',
        input: ({ context }) => ({
          goal: 'Respond to the customer message',
          context,
        }),
      },
      on: {
        'agent.respond': {
          target: 'customer',
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              event.response,
            ],
          }),
        },
      },
    },
    customer: {
      invoke: {
        src: 'customer',
        input: ({ context }) => ({
          goal: 'Respond to the customer service agent, or finish the conversation if you have nothing more to add.',
          context,
        }),
      },
      on: {
        'agent.respond': {
          target: 'customerService',
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              event.response,
            ],
          }),
        },
        'agent.finish': 'done',
      },
    },
    done: {
      type: 'final',
    },
  },
});

const actor = createActor(machine);
actor.subscribe((state) => {
  console.log('State:', state.value);
  console.log('Messages:', state.context.messages);
});

actor.start();
