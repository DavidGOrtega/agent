import { createAgent, fromDecision } from '../src';
import { assign, createActor, setup } from 'xstate';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { fromTerminal } from './helpers/helpers';

const agent = createAgent({
  id: 'summarizing-chat',
  model: openai('gpt-4o'),
  events: {
    'agent.respond': z.object({
      response: z.string().describe('The response from the agent'),
    }),
    'agent.summarize': z.object({
      summary: z.string().describe('Summary of the conversation history'),
    }),
  },
  context: {
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    ),
    summary: z.string().nullable(),
  },
});

const machine = setup({
  types: {
    context: agent.types.context,
    events: agent.types.events,
  },
  actors: {
    agent: fromDecision(agent),
    fromTerminal,
  },
}).createMachine({
  initial: 'user',
  context: {
    messages: [],
    summary: null,
  },
  states: {
    user: {
      invoke: {
        src: 'fromTerminal',
        input: 'Enter a message:',
        onDone: {
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              { role: 'user', content: event.output },
            ],
          }),
          target: 'chatting',
        },
      },
    },
    chatting: {
      always: {
        guard: ({ context }) => context.messages.length > 10,
        target: 'summarizing',
      },
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          goal: 'Respond to the user message',
          context: {
            messages: context.messages,
            summary: context.summary,
          },
        }),
      },
      on: {
        'agent.respond': {
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              { role: 'assistant', content: event.response },
            ],
          }),
          target: 'user',
        },
      },
    },
    summarizing: {
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          goal: 'Create a concise summary of the conversation history',
          context: {
            messages: context.messages,
            previousSummary: context.summary,
          },
        }),
      },
      on: {
        'agent.summarize': {
          actions: assign({
            summary: ({ event }) => event.summary,
            messages: ({ context }) => context.messages.slice(-3), // Keep last 3 messages
          }),
          target: 'chatting',
        },
      },
    },
  },
});

const actor = createActor(machine);
actor.subscribe((state) => {
  console.log('Current state:', state.value);
  console.log(
    'Messages:',
    state.context.messages.map((msg) => `${msg.role}: ${msg.content}`)
  );
  console.log('Summary:', state.context.summary);
});

actor.start();
