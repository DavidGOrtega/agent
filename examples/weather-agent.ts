import { z } from 'zod';
import { createAgent } from '../src';
import { assign, createActor, fromPromise, setup } from 'xstate';
// import { anthropic } from '@ai-sdk/anthropic';
import { fromTerminal } from './helpers/helpers';
import { openai } from '@ai-sdk/openai';

// Create the weather agent
const agent = createAgent({
  id: 'weather-agent',
  model: openai('gpt-4o'),
  events: {
    'weather.check': z.object({
      location: z.string().describe('The location to check weather for'),
    }),
    'weather.report': z.object({
      temperature: z.string(),
      conditions: z.string(),
    }),
    'agent.respond': z.object({
      response: z.string(),
    }),
  },
});

// Create the weather tool/service
const getWeather = (location: string) => {
  if (
    location.toLowerCase().includes('sf') ||
    location.toLowerCase().includes('san francisco')
  ) {
    return {
      temperature: '60 degrees',
      conditions: 'foggy',
    };
  }
  return {
    temperature: '90 degrees',
    conditions: 'sunny',
  };
};

// Create the state machine
const machine = setup({
  types: {
    context: {} as {
      input: string | null;
      location: string | null;
      weather: any;
    },
  },
  actors: {
    getFromTerminal: fromTerminal,
    getWeather: fromPromise(async ({ input }: { input: string }) => {
      return getWeather(input);
    }),
  },
}).createMachine({
  context: {
    input: null,
    location: null,
    weather: null,
  },
  initial: 'user',
  states: {
    user: {
      invoke: {
        src: 'getFromTerminal',
        input: 'Ask me about the weather!',
        onDone: {
          actions: assign({
            input: ({ event }) => event.output,
          }),
          target: 'processing',
        },
      },
    },
    processing: {
      entry: () => console.log('Processing...'),
      on: {
        'weather.check': {
          actions: assign({
            input: ({ event }) => event.location,
          }),
          target: 'checking',
        },
        'agent.respond': {
          actions: ({ event }) => console.log(event.response),
          target: 'responded',
        },
      },
    },
    checking: {
      entry: ({ event }) => console.log('Checking weather...', event),
      invoke: {
        src: 'getWeather',
        input: ({ context }) => context.input!,
        onDone: {
          actions: assign({
            weather: ({ event }) => event.output,
          }),
          target: 'responding',
        },
      },
    },
    responding: {
      on: {
        'agent.respond': {
          actions: ({ event }) => console.log(event.response),
          target: 'responded',
        },
      },
    },
    responded: {
      after: {
        1000: { target: 'user' },
      },
    },
  },
});

// Create and start the actor
const actor = createActor(machine).start();

agent.interact(actor, ({ state }) => {
  if (state.matches('processing')) {
    return {
      goal: 'Determine if user is asking about weather and for which location. If so, get the weather. Otherwise, respond to the user.',
      state,
      messages: agent.getMessages(),
    };
  }

  if (state.matches('responding')) {
    return {
      goal: 'Provide a natural response about the weather in ${context.location}',
      state,
      messages: agent.getMessages(),
    };
  }
});
