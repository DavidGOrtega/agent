import {
  ActorLogic,
  ActorRefLike,
  AnyEventObject,
  AnyStateMachine,
  EventFrom,
  PromiseActorLogic,
  SnapshotFrom,
  StateValue,
  TransitionSnapshot,
  Values,
} from 'xstate';
import {
  CoreMessage,
  generateText,
  GenerateTextResult,
  LanguageModel,
  streamText,
} from 'ai';
import { ZodContextMapping, ZodEventMapping } from './schemas';
import { TypeOf } from 'zod';
import { Agent } from './agent';

export type GenerateTextOptions = Parameters<typeof generateText>[0];

export type StreamTextOptions = Parameters<typeof streamText>[0];

export type CostFunction<TAgent extends AnyAgent> = (
  path: AgentPath<TAgent>
) => number;

export type AgentDecideInput<TAgent extends AnyAgent> = Omit<
  AgentGenerateTextOptions<TAgent>,
  'model' | 'prompt' | 'tools'
> & {
  episodeId?: string;
  /**
   * The currently observed state.
   */
  state: ObservedState<TAgent>;
  /**
   * The context to provide in the prompt to the agent. This overrides the `state.context`.
   */
  context?: Record<string, any>;
  /**
   * The goal for the agent to accomplish.
   * The agent will make a decision based on this goal.
   */
  goal: string;
  /**
   * The events that the agent can trigger. This is a mapping of
   * event types to Zod event schemas.
   */
  events?: ZodEventMapping;
  allowedEvents?: Array<EventFromAgent<TAgent>['type']>;
  /**
   * The state machine that represents the environment the agent
   * is interacting with.
   */
  machine?: AnyStateMachine;

  /**
   * The total cost of the path to the goal state.
   */
  costFunction?: CostFunction<TAgent>;

  /**
   * The maximum number of attempts to make a decision.
   * Defaults to 2.
   */
  maxAttempts?: number;
  strategy?: AgentStrategy<TAgent>;
  model?: LanguageModel;
  /**
   * The previous relevant feedback from the agent.
   */
  feedback?: AgentFeedback[];
  /**
   * The previous relevant observations from the agent.
   */
  observations?: AgentObservation<any>[];
  decisions?: AgentDecision<TAgent>[];
};

export type AgentStep<TAgent extends AnyAgent> = {
  /** The event to take */
  event: EventFromAgent<TAgent>;
  /** The next expected state after taking the event */
  state: ObservedState<TAgent> | undefined;
};

export type AgentPath<TAgent extends AnyAgent> = {
  /** The expected ending state of the path */
  state: ObservedState<TAgent> | undefined;
  /** The steps to reach the ending state */
  steps: Array<AgentStep<TAgent>>;
  weight?: number;
};

export type AgentDecision<TAgent extends AnyAgent = AnyAgent> = {
  id: string;
  /**
   * The strategy used to generate the decision
   */
  strategy: string;
  goal: string;
  /**
   * The ending state of the decision.
   */
  goalState: ObservedState<TAgent> | undefined;
  /**
   * The next event that the agent decided needs to occur to achieve the `goal`.
   *
   * This next event is chosen from the
   */
  nextEvent: EventFromAgent<TAgent> | undefined;
  /**
   * The paths that the agent can take to achieve the goal.
   */
  paths: AgentPath<TAgent>[];
  episodeId: string;
  timestamp: number;
  // result: GenerateObjectResult<any>;
};

export interface TransitionData {
  eventType: string;
  description?: string;
  guard?: { type: string };
  target?: any;
}

export type PromptTemplate<TAgent extends AnyAgent> = (data: {
  goal: string;
  /**
   * The observed state
   */
  stateValue?: any;
  context?: Record<string, any>;
  /**
   * The state machine model of the observed environment
   */
  machine?: unknown;
  /**
   * The potential next transitions that can be taken
   * in the state machine
   */
  transitions?: TransitionData[];
  /**
   * Past observations
   */
  observations?: AgentObservation<any>[]; // TODO
  feedback?: AgentFeedback[];
  messages?: AgentMessage[];
  decisions?: AgentDecision<TAgent>[];
}) => string;

export type AgentStrategy<TAgent extends AnyAgent> = (
  agent: TAgent,
  input: AgentDecideInput<TAgent>
) => Promise<AgentDecision<TAgent> | undefined>;

export type AgentInteractInput<T extends AnyAgent> = Omit<
  AgentDecideInput<T>,
  'state'
> & {
  state?: never;
};

export type AgentFeedback = {
  score: number;
  comment: string | undefined;
  attributes: Record<string, any>;
  timestamp: number;
  episodeId: string;
} & (
  | { observationId: string; decisionId?: never }
  | { decisionId: string; observationId?: never }
);

export type AgentFeedbackInput = {
  episodeId?: string;
  score: number;
  comment?: string;
  attributes?: Record<string, any>;
  timestamp?: number;
} & (
  | { observationId: string; decisionId?: never }
  | { decisionId: string; observationId?: never }
);

export type AgentMessage = CoreMessage & {
  timestamp: number;
  id: string;
  /**
   * The response ID of the message, which references
   * which message this message is responding to, if any.
   */
  responseId?: string;
  result?: GenerateTextResult<any>;
  episodeId: string;
};

type JSONObject = {
  [key: string]: JSONValue;
};
type JSONArray = JSONValue[];
type JSONValue = null | string | number | boolean | JSONObject | JSONArray;

type LanguageModelV1ProviderMetadata = Record<
  string,
  Record<string, JSONValue>
>;

interface LanguageModelV1ImagePart {
  type: 'image';
  /**
Image data as a Uint8Array (e.g. from a Blob or Buffer) or a URL.
   */
  image: Uint8Array | URL;
  /**
Optional mime type of the image.
   */
  mimeType?: string;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

export interface LanguageModelV1TextPart {
  type: 'text';
  /**
The text content.
   */
  text: string;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

export interface LanguageModelV1ToolCallPart {
  type: 'tool-call';
  /**
ID of the tool call. This ID is used to match the tool call with the tool result.
 */
  toolCallId: string;
  /**
Name of the tool that is being called.
 */
  toolName: string;
  /**
Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
   */
  args: unknown;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}
interface LanguageModelV1ToolResultPart {
  type: 'tool-result';
  /**
ID of the tool call that this result is associated with.
 */
  toolCallId: string;
  /**
Name of the tool that generated this result.
  */
  toolName: string;
  /**
Result of the tool call. This is a JSON-serializable object.
   */
  result: unknown;
  /**
Optional flag if the result is an error or an error message.
   */
  isError?: boolean;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}
type LanguageModelV1Message = (
  | {
      role: 'system';
      content: string;
    }
  | {
      role: 'user';
      content: Array<LanguageModelV1TextPart | LanguageModelV1ImagePart>;
    }
  | {
      role: 'assistant';
      content: Array<LanguageModelV1TextPart | LanguageModelV1ToolCallPart>;
    }
  | {
      role: 'tool';
      content: Array<LanguageModelV1ToolResultPart>;
    }
) & {
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
};

export type AgentMessageInput = CoreMessage & {
  timestamp?: number;
  id?: string;
  /**
   * The response ID of the message, which references
   * which message this message is responding to, if any.
   */
  responseId?: string;
  result?: GenerateTextResult<any>;
};

export interface AgentObservation<TActor extends ActorRefLike> {
  id: string;
  episodeId: string;
  decisionId?: string | undefined;
  goal?: string;
  prevState: SnapshotFrom<TActor> | undefined;
  event: EventFrom<TActor> | undefined;
  state: SnapshotFrom<TActor>;
  // machineHash: string | undefined;
  timestamp: number;
}

export interface AgentObservationInput<TAgent extends AnyAgent> {
  id?: string;
  episodeId?: string;
  /**
   * The agent decision that the observation is relevant for
   */
  decisionId?: string | undefined;
  prevState?: ObservedState<TAgent>;
  event?: AnyEventObject;
  state: ObservedState<TAgent>;
  // machine?: AnyStateMachine;
  timestamp?: number;
  goal?: string | undefined;
}

export type AgentDecisionInput = {
  goal: string;
  model?: LanguageModel;
  context?: Record<string, any>;
} & Omit<Parameters<typeof generateText>[0], 'model' | 'tools' | 'prompt'>;

export type AgentDecisionLogic<TAgent extends AnyAgent> = PromiseActorLogic<
  AgentDecision<TAgent> | undefined,
  AgentDecisionInput | string
>;

export type AgentEmitted<TAgent extends AnyAgent> =
  | {
      type: 'feedback';
      feedback: AgentFeedback;
    }
  | {
      type: 'observation';
      observation: AgentObservation<any>; // TODO
    }
  | {
      type: 'message';
      message: AgentMessage;
    }
  | {
      type: 'decision';
      decision: AgentDecision<TAgent>;
    }
  | {
      type: 'insight';
      insight: AgentInsight;
    };

export type AgentLogic<TAgent extends AnyAgent> = ActorLogic<
  TransitionSnapshot<AgentMemoryContext<TAgent>>,
  | {
      type: 'agent.feedback';
      feedback: AgentFeedback;
    }
  | {
      type: 'agent.observe';
      observation: AgentObservation<any>; // TODO
    }
  | {
      type: 'agent.message';
      message: AgentMessage;
    }
  | {
      type: 'agent.decision';
      decision: AgentDecision<TAgent>;
    }
  | {
      type: 'agent.insight';
      insight: AgentInsight;
    },
  any, // TODO: input
  any,
  AgentEmitted<TAgent>
>;

export type EventsFromZodEventMapping<TEventSchemas extends ZodEventMapping> =
  Compute<
    Values<{
      [K in keyof TEventSchemas & string]: {
        type: K;
      } & TypeOf<TEventSchemas[K]>;
    }>
  >;

export type ContextFromZodContextMapping<
  TContextSchema extends ZodContextMapping
> = {
  [K in keyof TContextSchema & string]: TypeOf<TContextSchema[K]>;
};

export type AnyAgent = Agent<any, any>;

export type FromAgent<T> = T | ((agent: AnyAgent) => T | Promise<T>);

export type CommonTextOptions<TAgent extends AnyAgent> = {
  prompt: FromAgent<string>;
  model?: LanguageModel;
  messages?: FromAgent<CoreMessage[]>;
  template?: PromptTemplate<any>;
  context?: Record<string, any>;
};

export type AgentGenerateTextOptions<TAgent extends AnyAgent> = Omit<
  GenerateTextOptions,
  'model' | 'prompt' | 'messages'
> &
  CommonTextOptions<TAgent>;

export type AgentStreamTextOptions<TAgent extends AnyAgent> = Omit<
  StreamTextOptions,
  'model' | 'prompt' | 'messages'
> &
  CommonTextOptions<TAgent>;

export interface ObservedState<TAgent extends AnyAgent> {
  /**
   * The current state value of the state machine, e.g.
   * `"loading"` or `"processing"` or `"ready"`
   */
  value: StateValue;
  /**
   * Additional contextual data related to the current state
   */
  context?: ContextFromAgent<TAgent>;
}

export type ObservedStateFrom<TActor extends ActorRefLike> = Pick<
  SnapshotFrom<TActor>,
  'value' | 'context'
>;

export type AgentMemoryContext<TAgent extends AnyAgent> = {
  observations: AgentObservation<any>[]; // TODO
  messages: AgentMessage[];
  decisions: AgentDecision<TAgent>[];
  feedback: AgentFeedback[];
  insights: AgentInsight[];
};

export interface AgentLongTermMemory<TAgent extends AnyAgent> {
  get<K extends keyof AgentMemoryContext<TAgent>>(
    key: K
  ): Promise<AgentMemoryContext<TAgent>[K]>;
  append<K extends keyof AgentMemoryContext<TAgent>>(
    key: K,
    item: AgentMemoryContext<TAgent>[K][0]
  ): Promise<void>;
  set<K extends keyof AgentMemoryContext<TAgent>>(
    key: K,
    items: AgentMemoryContext<TAgent>[K]
  ): Promise<void>;
}

export type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;

export type MaybePromise<T> = T | Promise<T>;

export type EventFromAgent<T extends AnyAgent> = T extends Agent<
  infer _,
  infer TEventSchemas
>
  ? EventsFromZodEventMapping<TEventSchemas>
  : never;

export type TypesFromAgent<T extends AnyAgent> = T extends Agent<
  infer TContextSchema,
  infer TEventSchema
>
  ? {
      context: ContextFromZodContextMapping<TContextSchema>;
      events: EventsFromZodEventMapping<TEventSchema>;
    }
  : never;

export type ContextFromAgent<T extends AnyAgent> = T extends Agent<
  infer TContextSchema,
  infer _TEventSchema
>
  ? ContextFromZodContextMapping<TContextSchema>
  : never;

export interface StorageAdapter<TAgent extends AnyAgent, TQuery> {
  addObservation(
    observationInput: AgentObservationInput<TAgent>
  ): Promise<AgentObservation<any>>;
  getObservations(queryObject?: TQuery): Promise<AgentObservation<any>[]>;
  addFeedback(feedbackInput: AgentFeedbackInput): Promise<AgentFeedback>;
  getFeedback(queryObject?: TQuery): Promise<AgentFeedback[]>;
  addMessage(messageInput: AgentMessageInput): Promise<AgentMessage>;
  getMessages(queryObject?: TQuery): Promise<AgentMessage[]>;
  addDecision(
    decisionInput: AgentDecisionInput
  ): Promise<AgentDecision<TAgent>>;
  getDecisions(queryObject?: TQuery): Promise<AgentDecision<TAgent>[]>;
}

export type StorageAdapterQuery<T extends StorageAdapter<any, any>> =
  T extends StorageAdapter<infer _, infer TQuery> ? TQuery : never;

export type AgentInsightInput = {
  observationId: string;
  episodeId?: string;
  id?: string;
  timestamp?: number;
  attributes: Record<string, any>;
};

export interface AgentInsight {
  id: string;
  episodeId: string;
  observationId: string;
  timestamp: number;
}
