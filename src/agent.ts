import {
  Actor,
  ActorRefLike,
  EventObject,
  fromTransition,
  SnapshotFrom,
  Subscription,
} from 'xstate';
import { ZodContextMapping, ZodEventMapping } from './schemas';
import {
  AgentLogic,
  AgentMessage,
  AgentStrategy,
  EventsFromZodEventMapping,
  GenerateTextOptions,
  AgentLongTermMemory,
  ObservedState,
  AgentObservationInput,
  AgentMemoryContext,
  AgentObservation,
  ContextFromZodContextMapping,
  AgentFeedback,
  AgentMessageInput,
  AgentFeedbackInput,
  AgentDecision,
  AnyAgent,
  AgentInteractInput,
  AgentDecideInput,
  EventFromAgent,
} from './types';
import { simpleStrategy } from './strategies/simpleStrategy';
import { isActorRef, isMachineActor, randomId } from './utils';
import {
  CoreMessage,
  experimental_wrapLanguageModel,
  LanguageModel,
  LanguageModelV1,
} from 'ai';
import { createAgentMiddleware } from './middleware';

export const agentLogic: AgentLogic<any> = fromTransition(
  (state, event, { emit }) => {
    switch (event.type) {
      case 'agent.feedback': {
        state.feedback.push(event.feedback);
        emit({
          type: 'feedback',
          // @ts-ignore TODO: fix types in XState
          feedback: event.feedback,
        });
        break;
      }
      case 'agent.observe': {
        state.observations.push(event.observation);
        emit({
          type: 'observation',
          // @ts-ignore TODO: fix types in XState
          observation: event.observation,
        });
        break;
      }
      case 'agent.message': {
        state.messages.push(event.message);
        emit({
          type: 'message',
          // @ts-ignore TODO: fix types in XState
          message: event.message,
        });
        break;
      }
      case 'agent.decision': {
        state.decisions.push(event.decision);
        emit({
          type: 'decision',
          decision: event.decision,
        });
        break;
      }
      default: {
        // unrecognized
        console.warn('Unrecognized event', event);
        break;
      }
    }
    return state;
  },
  () =>
    ({
      feedback: [],
      messages: [],
      observations: [],
      decisions: [],
    } as AgentMemoryContext<any>)
);

export function createAgent<
  const TContextSchema extends ZodContextMapping,
  const TEventSchemas extends ZodEventMapping,
  TAgent extends AnyAgent = Agent<TContextSchema, TEventSchemas>
>({
  id,
  description: description,
  model,
  events,
  context,
  episodeId,
  strategy = simpleStrategy,
  logic = agentLogic,
}: {
  /**
   * The unique identifier for the agent.
   *
   * This should be the same across all sessions of a specific agent, as it can be
   * used to retrieve memory for previous episodes of this agent.
   *
   * @example
   * ```ts
   * const agent = createAgent({
   *  id: 'recipe-assistant',
   *  // ...
   * });
   * ```
   */
  id?: string;
  /**
   * A description of the role of the agent
   */
  description?: string;
  /**
   * Events that the agent can cause (send) in an environment
   * that the agent knows about.
   */
  events: TEventSchemas;
  context?: TContextSchema;
  strategy?: AgentStrategy<Agent<TContextSchema, TEventSchemas>>;
  stringify?: typeof JSON.stringify;
  /**
   * A function that retrieves the agent's long term memory
   */
  getMemory?: (
    agent: Agent<TContextSchema, TEventSchemas>
  ) => AgentLongTermMemory<TAgent>;
  /**
   * Agent logic
   */
  logic?: AgentLogic<TAgent>;
  model: LanguageModel;
  episodeId?: string;
}): Agent<TContextSchema, TEventSchemas> {
  return new Agent({
    id,
    context,
    events,
    description,
    strategy: strategy,
    model,
    logic,
    episodeId,
  }) as any;
}

export class Agent<
  const TContextSchema extends ZodContextMapping,
  const TEventSchemas extends ZodEventMapping
> extends Actor<AgentLogic<any>> {
  /**
   * The name of the agent. All agents with the same name are related and
   * able to share experiences (observations, feedback) with each other.
   */
  public name?: string;
  /**
   * The unique identifier for the agent.
   */
  public episodeId: string;
  public description?: string;
  public events: TEventSchemas;
  public context?: TContextSchema;
  public strategy: AgentStrategy<Agent<TContextSchema, TEventSchemas>>;
  public model: LanguageModel;
  public memory: AgentLongTermMemory<this> | undefined;

  constructor({
    logic = agentLogic as AgentLogic<any>,
    id,
    name,
    description,
    model,
    events,
    context,
    episodeId,
    strategy = simpleStrategy,
  }: {
    logic: AgentLogic<any>;
    id?: string;
    name?: string;
    description?: string;
    model: GenerateTextOptions['model'];
    events: TEventSchemas;
    context?: TContextSchema;
    strategy?: AgentStrategy<Agent<TContextSchema, TEventSchemas>>;
    episodeId?: string;
  }) {
    super(logic);
    this.model = model;
    this.episodeId = episodeId ?? randomId('episode-');
    this.name = name;
    this.description = description;
    this.events = events;
    this.context = context;
    this.strategy = strategy;
    this.id = id ?? randomId();

    this.start();
  }

  /**
   * Called whenever the agent (LLM assistant) receives or sends a message.
   */
  public onMessage(fn: (message: AgentMessage) => void) {
    return this.on('message', (ev) => fn(ev.message));
  }

  /**
   * Called whenever the agent (LLM assistant) receives some feedback.
   */
  public onFeedback(fn: (feedback: AgentFeedback) => void) {
    return this.on('feedback', (ev) => fn(ev.feedback));
  }

  /**
   * Retrieves messages from the agent's short-term (local) memory.
   */
  public addMessage(messageInput: AgentMessageInput) {
    const message = {
      ...messageInput,
      id: messageInput.id ?? randomId(),
      timestamp: messageInput.timestamp ?? Date.now(),
      episodeId: this.episodeId,
    } satisfies AgentMessage;
    this.send({
      type: 'agent.message',
      message,
    });

    return message;
  }

  public getMessages() {
    return this.getSnapshot().context.messages;
  }

  public addFeedback(feedbackInput: AgentFeedbackInput) {
    const feedback = {
      ...feedbackInput,
      comment: feedbackInput.comment ?? undefined,
      attributes: { ...feedbackInput.attributes },
      timestamp: feedbackInput.timestamp ?? Date.now(),
      episodeId: feedbackInput.episodeId ?? this.episodeId,
    } satisfies AgentFeedback;
    this.send({
      type: 'agent.feedback',
      feedback,
    });
    return feedback;
  }

  /**
   * Retrieves feedback from the agent's short-term (local) memory.
   */
  public getFeedback() {
    return this.getSnapshot().context.feedback;
  }

  public addObservation(
    observationInput: AgentObservationInput<this>
  ): AgentObservation<any> {
    const { prevState, event, state } = observationInput;
    const observation = {
      prevState,
      event,
      state,
      id: observationInput.id ?? randomId(),
      episodeId: observationInput.episodeId ?? this.episodeId,
      timestamp: observationInput.timestamp ?? Date.now(),
      decisionId: observationInput.decisionId,
      // machineHash: observationInput.machine
      //   ? getMachineHash(observationInput.machine)
      //   : undefined,
    } satisfies AgentObservation<any>;

    this.send({
      type: 'agent.observe',
      observation,
    });

    return observation;
  }

  /**
   * Retrieves observations from the agent's short-term (local) memory.
   */
  public getObservations() {
    return this.getSnapshot().context.observations;
  }

  public addDecision(decision: AgentDecision<this>) {
    this.send({
      type: 'agent.decision',
      decision,
    });
  }
  /**
   * Retrieves strategies from the agent's short-term (local) memory.
   */
  public getDecisions() {
    return this.getSnapshot().context.decisions;
  }

  /**
   * Interacts with this state machine actor by inspecting state transitions and storing them as observations.
   *
   * Observations contain the `prevState`, `event`, and current `state` of this
   * actor, as well as other properties that are useful when recalled.
   * These observations are stored in the `agent`'s short-term (local) memory
   * and can be retrieved via `agent.getObservations()`.
   *
   * @example
   * ```ts
   * // Only observes the actor's state transitions
   * agent.interact(actor);
   *
   * actor.start();
   * ```
   */
  public interact<TActor extends ActorRefLike>(actorRef: TActor): Subscription;
  /**
   * Interacts with this state machine actor by:
   * 1. Inspecting state transitions and storing them as observations
   * 2. Deciding what to do next (which event to send the actor) based on
   * the agent input returned from `getInput(observation)`, if `getInput(…)` is provided as the 2nd argument.
   *
   * Observations contain the `prevState`, `event`, and current `state` of this
   * actor, as well as other properties that are useful when recalled.
   * These observations are stored in the `agent`'s short-term (local) memory
   * and can be retrieved via `agent.getObservations()`.
   *
   * @example
   * ```ts
   * // Observes the actor's state transitions and
   * // makes a decision if on the "summarize" state
   * agent.interact(actor, observed => {
   *   if (observed.state.matches('summarize')) {
   *     return {
   *       context: observed.state.context,
   *       goal: 'Summarize the message'
   *     }
   *   }
   * });
   *
   * actor.start();
   * ```
   */
  public interact<TActor extends ActorRefLike>(
    actorRef: TActor,
    getInput: (
      observation: AgentObservation<TActor>
    ) => AgentInteractInput<this> | void
  ): Subscription;
  public interact<TActor extends ActorRefLike>(
    actorRef: TActor,
    getInput?: (
      observation: AgentObservation<TActor>
    ) => AgentInteractInput<this> | void
  ): Subscription {
    const actorRefCheck = isActorRef(actorRef) && actorRef.src;
    const machine = isMachineActor(actorRef) ? actorRef.src : undefined;

    let prevState: ObservedState<this> | undefined = undefined;
    let subscribed = true;

    const agent = this;

    const handleObservation = async (
      observationInput: AgentObservationInput<any>
    ) => {
      const observation = agent.addObservation(observationInput);

      const interactInput = getInput?.(observation);

      if (interactInput) {
        const decision = await this.decide({
          machine,
          state: observation.state,
          ...interactInput,
        });

        if (decision?.nextEvent) {
          // @ts-ignore
          decision.nextEvent['_decision'] = decision.id;
          actorRef.send(decision.nextEvent);
        }
      }

      prevState = observationInput.state;
    };

    // Inspect system, but only observe specified actor
    const sub = actorRefCheck
      ? actorRef.system.inspect({
          next: async (inspEvent) => {
            if (
              !subscribed ||
              inspEvent.actorRef !== actorRef ||
              inspEvent.type !== '@xstate.snapshot'
            ) {
              return;
            }

            const decisionId = inspEvent.event['_decision'] as
              | string
              | undefined;

            const decisions = agent.getDecisions();

            const decision = decisionId
              ? decisions.find((d) => d.id === decisionId)
              : undefined;

            const observationInput = {
              event: inspEvent.event,
              prevState,
              state: inspEvent.snapshot as SnapshotFrom<TActor>,
              goal: decision?.goal,
              decisionId,
            } satisfies AgentObservationInput<any>;

            await handleObservation(observationInput);
          },
        })
      : undefined;

    // If actor already started, interact with current state
    if ((actorRef as any)._processingStatus === 1) {
      handleObservation({
        decisionId: undefined,
        prevState: undefined,
        event: undefined,
        state: actorRef.getSnapshot(),
      });
    }

    return {
      unsubscribe: () => {
        sub?.unsubscribe();
        subscribed = false;
      },
    };
  }

  public observe<TActor extends ActorRefLike>(actorRef: TActor): Subscription {
    let prevState: ObservedState<this> = actorRef.getSnapshot();
    const actorRefCheck = isActorRef(actorRef);

    const sub = actorRefCheck
      ? actorRef.system.inspect({
          next: async (inspEvent) => {
            if (
              inspEvent.actorRef !== actorRef ||
              inspEvent.type !== '@xstate.snapshot'
            ) {
              return;
            }

            const decisionId = inspEvent.event['_decision'] as
              | string
              | undefined;

            const decisions = this.getDecisions();

            const decision = decisionId
              ? decisions.find((d) => d.id === decisionId)
              : undefined;

            const observationInput = {
              decisionId,
              event: inspEvent.event,
              prevState,
              state: inspEvent.snapshot as SnapshotFrom<TActor>,
              goal: decision?.goal,
            } satisfies AgentObservationInput<this>;

            prevState = observationInput.state;

            this.addObservation(observationInput);
          },
        })
      : undefined;

    return sub ?? { unsubscribe: () => {} };
  }

  public wrap(modelToWrap: LanguageModelV1) {
    return experimental_wrapLanguageModel({
      model: modelToWrap,
      middleware: createAgentMiddleware(this),
    });
  }

  /**
   * Resolves with an `AgentDecision` based on the information provided in the `options`, including:
   *
   * - The `goal` for the agent to achieve
   * - The observed current `state`
   * - The `machine` (e.g. a state machine) that specifies what can happen next
   * - Additional `context`
   */
  public async decide(
    input: AgentDecideInput<this>
  ): Promise<AgentDecision<this> | undefined> {
    const resolvedOptions = input;
    const {
      strategy = this.strategy,
      goal,
      allowedEvents,
      events = this.events,
      state,
      machine,
      model = this.model,
      messages,
      episodeId = this.episodeId,
      maxAttempts = 2,
      ...otherDecideInput
    } = resolvedOptions;

    const filteredEventSchemas = allowedEvents
      ? Object.fromEntries(
          Object.entries(events).filter(([key]) => {
            return allowedEvents.includes(key as EventFromAgent<this>['type']);
          })
        )
      : events;

    let attempts = 0;

    let decision: AgentDecision<any> | undefined;

    const minimalState = {
      value: state.value,
      context: state.context,
    };

    while (attempts++ < maxAttempts) {
      decision = await strategy(this, {
        episodeId,
        model,
        goal,
        events: filteredEventSchemas,
        state: minimalState,
        machine,
        messages: messages as CoreMessage[], // TODO: fix UIMessage thing
        ...otherDecideInput,
      });

      if (decision?.nextEvent) {
        this.addDecision(decision);
        break;
      }
    }

    return decision;
  }
}
