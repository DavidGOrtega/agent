import { test, expect, vi } from 'vitest';
import {
  AgentDecision,
  AgentFeedbackInput,
  createAgent,
  TypesFromAgent,
} from './';
import { createActor, createMachine } from 'xstate';
import { LanguageModelV1CallOptions } from 'ai';
import { z } from 'zod';
import { dummyResponseValues, MockLanguageModelV1 } from './mockModel';

test('an agent has the expected interface', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: new MockLanguageModelV1(),
  });

  expect(agent.decide).toBeDefined();

  expect(agent.addMessage).toBeDefined();
  expect(agent.addObservation).toBeDefined();
  expect(agent.addFeedback).toBeDefined();
  expect(agent.addDecision).toBeDefined();

  expect(agent.getMessages).toBeDefined();
  expect(agent.getObservations).toBeDefined();
  expect(agent.getFeedback).toBeDefined();
  expect(agent.getDecisions).toBeDefined();

  expect(agent.interact).toBeDefined();
});

test('agent.addMessage() adds to message history', () => {
  const model = new MockLanguageModelV1();

  const agent = createAgent({
    id: 'test',
    events: {},
    model,
  });

  agent.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'msg 1' }],
  });

  const messageHistory = agent.addMessage({
    role: 'assistant',
    content: [{ type: 'text', text: 'response 1' }],
  });

  expect(messageHistory.episodeId).toEqual(agent.episodeId);

  expect(agent.getMessages()).toContainEqual(
    expect.objectContaining({
      content: [expect.objectContaining({ text: 'msg 1' })],
    })
  );

  expect(agent.getMessages()).toContainEqual(
    expect.objectContaining({
      content: [expect.objectContaining({ text: 'response 1' })],
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.addFeedback() adds to feedback', () => {
  const agent = createAgent({
    id: 'test',
    events: {
      play: z.object({
        position: z.number(),
      }),
    },
    model: {} as any,
  });

  const decision: AgentDecision<typeof agent> = {
    goal: 'Win the game',
    episodeId: agent.episodeId,
    goalState: { value: 'won' },
    id: 'decision-1',
    nextEvent: { type: 'play', position: 3 },
    paths: [],
    strategy: 'simple',
    timestamp: Date.now(),
  };

  const obs = agent.addObservation({
    decisionId: decision.id,
    prevState: { value: 'playing' },
    event: { type: 'play', position: 3 },
    state: { value: 'lost' },
  });

  const feedback = agent.addFeedback({
    score: 0,
    observationId: obs.id,
  });

  expect(feedback.episodeId).toEqual(agent.episodeId);

  expect(agent.getFeedback()).toContainEqual(
    expect.objectContaining({
      score: 0,
      observationId: obs.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.addObservation() adds to observations', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = agent.addObservation({
    prevState: { value: 'playing', context: {} },
    event: { type: 'play', position: 3 },
    state: { value: 'lost', context: {} },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(agent.episodeId);

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: { value: 'playing', context: {} },
      event: { type: 'play', position: 3 },
      state: { value: 'lost', context: {} },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.addObservation() adds to observations (initial state)', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = agent.addObservation({
    state: { value: 'lost' },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(agent.episodeId);

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      state: { value: 'lost', context: undefined },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test.skip('agent.addObservation() adds to observations with machine hash', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const machine = createMachine({
    initial: 'playing',
    states: {
      playing: {
        on: {
          play: 'lost',
        },
      },
      lost: {},
    },
  });

  const observation = agent.addObservation({
    prevState: { value: 'playing', context: {} },
    event: { type: 'play', position: 3 },
    state: { value: 'lost', context: {} },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(agent.episodeId);

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: { value: 'playing', context: {} },
      event: { type: 'play', position: 3 },
      state: { value: 'lost', context: {} },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.addInsight() adds to insights (with observation)', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = agent.addObservation({
    state: {
      value: 'playing',
    },
    goal: 'Win the game',
  });

  const insight = agent.addInsight({
    observationId: observation.id,
    attributes: {
      advantage: 50,
    },
  });

  expect(insight.episodeId).toEqual(agent.episodeId);

  expect(agent.getInsights()).toContainEqual(
    expect.objectContaining({
      attributes: { advantage: 50 },
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
  expect(agent.getInsights()).toContainEqual(
    expect.objectContaining({
      attributes: { advantage: 50 },
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.addFeedback() adds to feedback (with observation)', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = agent.addObservation({
    state: {
      value: 'playing',
    },
    goal: 'Win the game',
  });

  const feedback = agent.addFeedback({
    score: 0,
    observationId: observation.id,
  });

  expect(feedback.episodeId).toEqual(agent.episodeId);

  expect(agent.getFeedback()).toContainEqual(
    expect.objectContaining({
      score: 0,
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
  expect(agent.getFeedback()).toContainEqual(
    expect.objectContaining({
      score: 0,
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.interact() observes machine actors (no 2nd arg)', () => {
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        on: { NEXT: 'b' },
      },
      b: {},
    },
  });

  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const actor = createActor(machine);

  agent.interact(actor);

  actor.start();

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: undefined,
      state: expect.objectContaining({ value: 'a' }),
    })
  );
  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: undefined,
      state: expect.objectContaining({ value: 'a' }),
    })
  );

  actor.send({ type: 'NEXT' });

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: expect.objectContaining({ value: 'a' }),
      event: { type: 'NEXT' },
      state: expect.objectContaining({ value: 'b' }),
    })
  );
});

test('You can listen for feedback events', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  agent.onFeedback(fn);

  const feedback = agent.addFeedback({
    score: 1,
    observationId: 'obs-1',
    comment: 'Good move',
    attributes: { confidence: 'high' },
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      score: 1,
      observationId: 'obs-1',
      comment: 'Good move',
      attributes: { confidence: 'high' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('You can listen for decision events', async () => {
  const fn = vi.fn();
  const model = new MockLanguageModelV1({
    doGenerate: async (params: LanguageModelV1CallOptions) => {
      const keys =
        params.mode.type === 'regular'
          ? params.mode.tools?.map((tool) => tool.name)
          : [];

      return {
        ...dummyResponseValues,
        finishReason: 'tool-calls',
        toolCalls: [
          {
            toolCallType: 'function',
            toolCallId: 'call-1',
            toolName: keys![0],
            args: `{ "type": "${keys?.[0]}" }`,
          },
        ],
      } as any;
    },
  });

  const agent = createAgent({
    id: 'test',
    model,
    events: {
      WIN: z.object({}),
    },
  });

  agent.on('decision', fn);

  await agent.decide({
    goal: 'Win the game',
    state: {
      value: 'playing',
      context: {},
    },
    machine: createMachine({
      initial: 'playing',
      states: {
        playing: {
          on: {
            WIN: {
              target: 'won',
            },
          },
        },
        won: {},
      },
    }),
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      decision: expect.objectContaining({
        nextEvent: {
          type: 'WIN',
        },
      }),
    })
  );
});

test('agent.types provides context and event types', () => {
  const agent = createAgent({
    model: {} as any,
    events: {
      setScore: z.object({
        score: z.number(),
      }),
    },
    context: {
      score: z.number(),
    },
  });

  let types = {} as TypesFromAgent<typeof agent>;

  types satisfies { context: any; events: any };

  types.context satisfies { score: number };

  // @ts-expect-error
  types.context satisfies { score: string };
});

test('It allows unrecognized events', () => {
  const agent = createAgent({
    model: {} as any,
    events: {},
    context: {},
  });

  expect(() => {
    agent.send({
      // @ts-expect-error
      type: 'unrecognized',
    });
  }).not.toThrow();
});

test('You can listen for message events', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  agent.onMessage(fn);

  const message = {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test message' }],
  };

  agent.addMessage(message);

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'user',
      content: [{ type: 'text', text: 'test message' }],
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('agent.getDecisions() returns decisions from context', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
    strategy: async (agent) => {
      return {
        id: Date.now().toString(),
        episodeId: agent.episodeId,
        strategy: 'test-strategy',
        goal: '',
        goalState: undefined,
        paths: [
          {
            state: undefined,
            steps: [],
          },
        ],
        nextEvent: undefined,
        timestamp: Date.now(),
      };
    },
  });

  const decisions = agent.getDecisions();

  expect(decisions).toBeDefined();
  expect(Array.isArray(decisions)).toBe(true);
});

test('Event listeners can be unsubscribed', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = agent.on('message', fn);

  agent.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'first message' }],
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  agent.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'second message' }],
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('agent.observe() adds observations from actor snapshots', () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: { START: 'running' },
      },
      running: {},
    },
  });

  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const actor = createActor(machine);
  const subscription = agent.observe(actor);

  actor.start();
  actor.send({ type: 'START' });

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      state: expect.objectContaining({ value: 'idle' }),
    })
  );

  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: expect.objectContaining({ value: 'idle' }),
      event: { type: 'START' },
      state: expect.objectContaining({ value: 'running' }),
    })
  );

  subscription.unsubscribe();
});

test('agent.addObservation() accepts custom episodeId', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const customEpisodeId = 'custom-episode-123';
  const observation = agent.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
    episodeId: customEpisodeId,
  });

  expect(observation.episodeId).toEqual(customEpisodeId);
  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );
});

test('agent.addFeedback() accepts custom episodeId', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const customEpisodeId = 'custom-episode-123';
  const feedback = agent.addFeedback({
    score: 1,
    observationId: 'obs-1',
    episodeId: customEpisodeId,
  });

  expect(feedback.episodeId).toEqual(customEpisodeId);
  expect(agent.getFeedback()).toContainEqual(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );
});

test('agent.addObservation() accepts decisionId', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const decisionId = 'decision-123';
  const observation = agent.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
    decisionId,
  });

  expect(observation.decisionId).toEqual(decisionId);
  expect(agent.getObservations()).toContainEqual(
    expect.objectContaining({
      decisionId,
    })
  );
});

test('agent.addFeedback() accepts decisionId', () => {
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const decisionId = 'decision-123';
  const feedback = agent.addFeedback({
    score: 1,
    decisionId,
  });

  expect(feedback.decisionId).toEqual(decisionId);
  expect(agent.getFeedback()).toContainEqual(
    expect.objectContaining({
      decisionId,
    })
  );
});

test('You can listen for observation events', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  agent.onObservation(fn);

  const observation = agent.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      state: { value: 'playing' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('You can listen for decision events', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {
      MOVE: z.object({}),
    },
    model: {} as any,
  });

  agent.onDecision(fn);

  const decision = {
    id: 'decision-1',
    episodeId: agent.episodeId,
    strategy: 'test-strategy',
    goal: 'Win the game',
    goalState: { value: 'won' },
    paths: [],
    nextEvent: { type: 'MOVE' },
    timestamp: Date.now(),
  } satisfies AgentDecision<typeof agent>;

  agent.addDecision(decision);

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'decision-1',
      episodeId: agent.episodeId,
      strategy: 'test-strategy',
      goal: 'Win the game',
      nextEvent: { type: 'MOVE' },
    })
  );
});

test('Event listeners can be unsubscribed (onObservation)', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = agent.onObservation(fn);

  agent.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  agent.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game again',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Event listeners can be unsubscribed (onDecision)', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {
      MOVE: z.object({}),
    },
    model: {} as any,
  });

  const subscription = agent.onDecision(fn);

  const decision = {
    id: 'decision-1',
    episodeId: agent.episodeId,
    strategy: 'test-strategy',
    goal: 'Win the game',
    goalState: { value: 'won' },
    paths: [],
    nextEvent: { type: 'MOVE' },
    timestamp: Date.now(),
  } satisfies AgentDecision<typeof agent>;

  agent.addDecision(decision);

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  agent.addDecision({
    ...decision,
    id: 'decision-2',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Event listeners can be unsubscribed (onFeedback)', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = agent.onFeedback(fn);

  agent.addFeedback({
    score: 1,
    observationId: 'obs-1',
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  agent.addFeedback({
    score: 0,
    observationId: 'obs-2',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Feedback events include optional fields', () => {
  const fn = vi.fn();
  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
  });

  agent.onFeedback(fn);

  // Test with minimal feedback
  agent.addFeedback({
    score: 1,
    observationId: 'obs-1',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      score: 1,
      observationId: 'obs-1',
      comment: undefined,
      attributes: {},
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );

  // Test with all optional fields
  agent.addFeedback({
    score: 0,
    observationId: 'obs-2',
    comment: 'Could be better',
    attributes: { reason: 'suboptimal' },
  } satisfies AgentFeedbackInput);

  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      score: 0,
      observationId: 'obs-2',
      comment: 'Could be better',
      attributes: { reason: 'suboptimal' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('Feedback events maintain episodeId consistency', () => {
  const fn = vi.fn();
  const customEpisodeId = 'custom-episode-123';

  const agent = createAgent({
    id: 'test',
    events: {},
    model: {} as any,
    episodeId: customEpisodeId,
  });

  agent.onFeedback(fn);

  agent.addFeedback({
    score: 1,
    observationId: 'obs-1',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );

  // Test with explicit different episodeId
  const differentEpisodeId = 'different-episode-456';
  agent.addFeedback({
    score: 0,
    observationId: 'obs-2',
    episodeId: differentEpisodeId,
  });

  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      episodeId: differentEpisodeId,
    })
  );
});
