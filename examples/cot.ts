import { z } from 'zod';
import { createAgent } from '../src';
import { openai } from '@ai-sdk/openai';
import { getFromTerminal } from './helpers/helpers';
import { chainOfThoughtStrategy } from '../src/strategies/chainOfThought';

const agent = createAgent({
  id: 'chain-of-thought',
  model: openai('gpt-4o'),
  events: {
    'agent.answer': z.object({
      answer: z.string().describe('The answer to the question'),
    }),
  },
  context: {
    question: z.string().nullable(),
  },
  strategy: chainOfThoughtStrategy,
});

// agent.onMessage((msg) => console.log(msg.content));

async function main() {
  const msg = await getFromTerminal('what?');

  const decision = await agent.decide({
    messages: agent.getMessages(),
    goal: 'Answer the question.',
    state: {
      value: 'thinking',
      context: {
        question: msg,
      },
    },
  });

  console.log(decision?.nextEvent?.answer);
}

main();
