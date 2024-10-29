import { assign, createActor, fromCallback, log, setup } from 'xstate';
import { createAgent, fromDecision } from '../src';
import { loadingAnimation } from './helpers/loader';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { fromTerminal } from './helpers/helpers';

export function getRandomFunnyPhrase() {
  const funnyPhrases = [
    'Concocting chuckles...',
    'Brewing belly laughs...',
    'Fabricating funnies...',
    'Assembling amusement...',
    'Molding merriment...',
    'Whipping up wisecracks...',
    'Generating guffaws...',
    'Inventing hilarity...',
    'Cultivating chortles...',
    'Hatching howlers...',
  ];
  return funnyPhrases[Math.floor(Math.random() * funnyPhrases.length)]!;
}

export function getRandomRatingPhrase() {
  const ratingPhrases = [
    'Assessing amusement...',
    'Evaluating hilarity...',
    'Ranking chuckles...',
    'Classifying cackles...',
    'Scoring snickers...',
    'Rating roars...',
    'Judging jollity...',
    'Measuring merriment...',
    'Rating rib-ticklers...',
  ];
  return ratingPhrases[Math.floor(Math.random() * ratingPhrases.length)]!;
}

const loader = fromCallback(({ input }: { input: string }) => {
  const anim = loadingAnimation(input);

  return () => {
    anim.stop();
  };
});

const agent = createAgent({
  id: 'joke-teller',
  model: openai('gpt-4o-mini'),
  events: {
    askForTopic: z
      .object({
        topic: z.string().describe('The topic for the joke'),
      })
      .describe('Ask for a new topic, because the last joke rated 6 or lower'),
    'agent.tellJoke': z.object({
      joke: z.string().describe('The joke text'),
    }),
    'agent.endJokes': z
      .object({})
      .describe('End the jokes, since the last joke rated 7 or higher'),
    'agent.rateJoke': z.object({
      rating: z.number().min(1).max(10),
      explanation: z.string(),
    }),
    'agent.continue': z.object({}).describe('Continue'),
    'agent.markRelevancy': z.object({
      relevant: z.boolean().describe('Whether the joke was relevant'),
      explanation: z
        .string()
        .describe('The explanation for why the joke was relevant or not'),
    }),
  },
  context: {
    topic: z.string().describe('The topic for the joke'),
    jokes: z.array(z.string()).describe('The jokes told so far'),
    desire: z.string().nullable().describe('The user desire'),
    lastRating: z.number().nullable().describe('The last joke rating'),
    loader: z.string().nullable().describe('The loader text'),
  },
});

const jokeMachine = setup({
  types: agent.types,
  actors: {
    agent: fromDecision(agent),
    loader,
    getFromTerminal: fromTerminal,
  },
}).createMachine({
  id: 'joke',
  context: () => ({
    topic: '',
    jokes: [],
    desire: null,
    lastRating: null,
    loader: null,
  }),
  initial: 'waitingForTopic',
  states: {
    waitingForTopic: {
      invoke: {
        src: 'getFromTerminal',
        input: 'Give me a joke topic.',
        onDone: {
          actions: assign({
            topic: ({ event }) => event.output,
          }),
          target: 'tellingJoke',
        },
      },
    },
    tellingJoke: {
      invoke: {
        src: 'loader',
        input: getRandomFunnyPhrase,
      },

      on: {
        'agent.tellJoke': {
          actions: [
            assign({
              jokes: ({ context, event }) => [...context.jokes, event.joke],
            }),
            log(({ event }) => event.joke),
          ],
          target: 'relevance',
        },
      },
    },
    relevance: {
      on: {
        'agent.markRelevancy': [
          {
            guard: ({ event }) => !event.relevant,
            actions: log(
              ({ event }) => 'Irrelevant joke: ' + event.explanation
            ),
            target: 'waitingForTopic',
            description: 'Continue',
          },
          { target: 'rateJoke' },
        ],
      },
    },
    rateJoke: {
      invoke: {
        src: 'loader',
        input: getRandomRatingPhrase,
      },

      on: {
        'agent.rateJoke': {
          actions: [
            assign({
              lastRating: ({ event }) => event.rating,
            }),
            log(
              ({ event }) => `Rating: ${event.rating}\n\n${event.explanation}`
            ),
          ],
          target: 'decide',
        },
      },
    },
    decide: {
      on: {
        askForTopic: {
          target: 'waitingForTopic',
          actions: log("That joke wasn't good enough. Let's try again."),
        },
        'agent.endJokes': {
          target: 'end',
          actions: log('That joke was good enough. Goodbye!'),
        },
      },
    },
    end: {
      type: 'final',
    },
  },
  exit: () => {
    process.exit();
  },
});

const actor = createActor(jokeMachine);

agent.interact(actor, (observed) => {
  if (observed.state.matches('tellingJoke')) {
    return {
      goal: 'Tell me a joke about the topic. Do not make any joke that is not relevant to the topic.',
      context: {
        topic: observed.state.context.topic,
      },
    };
  }

  if (observed.state.matches('relevance')) {
    return {
      goal: 'An irrelevant joke has no reference to the topic. If the last joke is completely irrelevant to the topic, ask for a new joke topic. Otherwise, continue.',
      context: {
        topic: observed.state.context.topic,
        lastJoke: observed.state.context.jokes.at(-1),
      },
    };
  }

  if (observed.state.matches('rateJoke')) {
    return {
      goal: 'Rate the last joke on a scale of 1 to 10.',
      context: {
        lastJoke: observed.state.context.jokes.at(-1),
      },
    };
  }

  if (observed.state.matches('decide')) {
    return {
      goal: 'Choose what to do next, given the previous rating of the joke.',
      context: {
        lastRating: observed.state.context.lastRating,
      },
    };
  }
});

actor.start();
