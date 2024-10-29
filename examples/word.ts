import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal } from './helpers/helpers';
import { createAgent, fromDecision } from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const agent = createAgent({
  id: 'word',
  model: openai('gpt-4o-mini'),
  context: {
    word: z.string().nullable().describe('The word to guess'),
    guessedWord: z.string().nullable().describe('The guessed word'),
    lettersGuessed: z.array(z.string()).describe('The letters guessed'),
  },
  events: {
    'agent.guessLetter': z.object({
      letter: z.string().min(1).max(1).describe('The letter guessed'),
      reasoning: z.string().describe('The reasoning behind the guess'),
    }),

    'agent.guessWord': z.object({
      word: z.string().describe('The word guessed'),
    }),

    'agent.respond': z.object({
      response: z
        .string()
        .describe(
          'The response from the agent, detailing why the guess was correct or incorrect based on the letters guessed.'
        ),
    }),
  },
});

const context = {
  word: null,
  guessedWord: null,
  lettersGuessed: [],
} satisfies typeof agent.types.context;

const wordGuesserMachine = setup({
  types: {
    context: agent.types.context,
    events: agent.types.events,
  },
  actors: {
    agent: fromDecision(agent),
    getFromTerminal: fromTerminal,
  },
  actions: {
    resetContext: assign(context),
  },
}).createMachine({
  initial: 'providingWord',
  context,
  states: {
    providingWord: {
      entry: 'resetContext',
      invoke: {
        src: 'getFromTerminal',
        input: 'Enter a word, and an agent will try to guess it.',
        onDone: {
          actions: assign({
            word: ({ event }) => event.output,
          }),
          target: 'guessing',
        },
      },
    },
    guessing: {
      always: {
        guard: ({ context }) => context.lettersGuessed.length > 10,
        target: 'finalGuess',
      },
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context: {
            wordLength: context.word!.length,
            lettersGuessed: context.lettersGuessed,
            lettersMatched: context
              .word!.split('')
              .map((letter) =>
                context.lettersGuessed.includes(letter.toUpperCase())
                  ? letter.toUpperCase()
                  : '_'
              )
              .join(''),
          },
          goal: `You are trying to guess the word. Please make your next guess - guess a letter or, if you think you know the word, guess the full word. You can only make 10 total guesses. If you are confident you know the word, it is better to guess the word.`,
        }),
      },
      on: {
        'agent.guessLetter': {
          actions: [
            assign({
              lettersGuessed: ({ context, event }) => {
                return [...context.lettersGuessed, event.letter.toUpperCase()];
              },
            }),
            log(({ event }) => event),
          ],
          target: 'guessing',
          reenter: true,
        },
        'agent.guessWord': {
          actions: [
            assign({
              guessedWord: ({ event }) => event.word,
            }),
            log(({ event }) => event),
          ],
          target: 'gameOver',
        },
      },
    },
    finalGuess: {
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context: {
            lettersGuessed: context.lettersGuessed,
          },
          goal: `You have used all 10 guesses. These letters matched: ${context
            .word!.split('')
            .map((letter) =>
              context.lettersGuessed.includes(letter.toUpperCase())
                ? letter.toUpperCase()
                : '_'
            )
            .join('')}. Guess the word.`,
        }),
      },
      on: {
        'agent.guessWord': {
          actions: [
            assign({
              guessedWord: ({ event }) => event.word,
            }),
            log(({ event }) => event),
          ],
          target: 'gameOver',
        },
      },
    },
    gameOver: {
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context,
          goal: `Why do you think you won or lost?`,
        }),
      },
      entry: log(({ context }) => {
        if (
          context.guessedWord?.toUpperCase() === context.word?.toUpperCase()
        ) {
          return 'The agent won!';
        } else {
          return 'The agent lost! The word was ' + context.word;
        }
      }),
      on: {
        'agent.respond': {
          actions: log(({ event }) => event.response),
          target: 'providingWord',
        },
      },
    },
  },
  exit: () => process.exit(),
});

const game = createActor(wordGuesserMachine);

game.start();
