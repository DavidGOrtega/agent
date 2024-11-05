import { z } from 'zod';
import { createAgent } from '../src';
import { openai } from '@ai-sdk/openai';

const agent = createAgent({
  id: 'chatbot',
  model: openai('gpt-4o-mini'),
  events: {
    submit: z.object({}).describe('Submit the form'),
    pressEnter: z.object({}).describe('Press the enter key'),
  },
  context: {
    userMessage: z.string(),
  },
});

agent.onMessage((msg) => {
  console.log(`Message`, msg.content);
});

agent.on('decision', ({ decision }) => {
  console.log(`Decision: ${decision.nextEvent?.type ?? '??'}`);
});

async function main() {
  let status = 'editing';
  let count = 0;

  while (status !== 'submitted') {
    console.log(`Attempt ${count} - ${status}`);
    if (count++ > 5) {
      break;
    }
    switch (status) {
      case 'editing': {
        const relevantObservations = await agent
          .getObservations()
          .filter((obs) => obs.prevState.value === 'editing');
        const relevantFeedback = await agent
          .getFeedback()
          .filter((f) =>
            relevantObservations.find((o) => o.id === f.observationId)
          );

        const decision = await agent.decide({
          goal: 'Submit the form. Take the feedback into consideration, and perform the action that will lead to the form being submitted.',
          state: {
            value: 'editing',
            context: {
              feedback: relevantFeedback.map((f) => {
                const observation = relevantObservations.find(
                  (o) => o.id === f.observationId
                );
                return {
                  prevState: observation?.prevState,
                  event: observation?.event,
                  state: observation?.state,
                  feedback: f.attributes.text,
                };
              }),
            },
          },
        });

        if (decision?.nextEvent?.type === 'submit') {
          const observation = await agent.addObservation({
            prevState: { value: 'editing' },
            event: { type: 'submit' },
            state: { value: 'editing' },
          });

          // don't change the status; pretend submit button is broken
          await agent.addFeedback({
            observationId: observation.id,
            goal: 'Submit the form',
            attributes: {
              text: 'Form not submitted',
            },
          });
        } else if (decision?.nextEvent?.type === 'pressEnter') {
          status = 'submitted';

          await agent.addObservation({
            prevState: { value: 'editing' },
            event: { type: 'pressEnter' },
            state: { value: 'submitted' },
          });
        }
        break;
      }
      case 'submitted':
        break;
    }
  }

  console.log('End of conversation.');
  process.exit();
}

main().catch(console.error);
