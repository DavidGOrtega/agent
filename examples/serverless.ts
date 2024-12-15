import { openai } from '@ai-sdk/openai';
import {
  AgentDecision,
  AgentFeedback,
  AgentMessage,
  AgentObservation,
  createAgent,
} from '../src';
import { z } from 'zod';

const agent = createAgent({
  id: 'simple',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.moveLeft': z.object({}),
    'agent.moveRight': z.object({}),
    'agent.doNothing': z.object({}),
  },
});

const db = {
  observations: [] as AgentObservation<any>[],
  feedbackItems: [] as AgentFeedback[],
  decisions: [] as AgentDecision[],
  messages: [] as AgentMessage[],
};

async function postObservation(req) {}

async function getDecision(req: {
  query: {
    episodeId: string;
    goal: string;
  };
}) {
  const lastObs = db.observations
    .filter((obs) => obs.episodeId === req.query.episodeId)
    .at(-1);

  const similarObservations = db.observations.filter(
    (obs) => obs.prevState?.value === lastObs?.prevState?.value
  );

  const similarFeedback = db.feedbackItems.filter((fb) => {
    fb.observationId &&
      similarObservations.map((obs) => obs.id).includes(fb.observationId);
  });

  agent.onDecision(async (d) => {
    db.decisions.push(d);
    return;
  });

  agent.onMessage(async (m) => {
    db.messages.push(m);
  });

  const decision = await agent.decide({
    goal: req.query.goal,
    state: lastObs?.state,
    observations: similarObservations,
    feedback: similarFeedback,
    allowedEvents: ['agent.moveLeft', 'agent.moveRight'],
  });

  return decision;
}
