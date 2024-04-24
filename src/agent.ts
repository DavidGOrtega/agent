import {
  ActorRef,
  AnyActorLogic,
  AnyActorRef,
  AnyEventObject,
  AnyMachineSnapshot,
  EventFrom,
  EventObject,
  fromPromise,
  PromiseActorLogic,
  SnapshotFrom,
} from 'xstate';
import OpenAI from 'openai';
import { getToolCalls } from './adapters/openai';
import { ZodEventTypes } from './schemas';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';

// export type AgentExperiences<TState, TReward> = Record<
//   string, // serialized state
//   Record<
//     string, // serialized event
//     {
//       state: TState;
//       reward: TReward;
//     }
//   >
// >;
export interface AgentExperience<TState, TEvent extends AnyEventObject> {
  prevState: TState | undefined;
  event: TEvent;
  nextState: TState;
}

export type AgentPlan<TState, TEvent extends EventObject> = Array<{
  /**
   * The current state
   */
  state: TState;
  /**
   * The event to execute
   */
  event: TEvent;
  /**
   * The expected next state
   */
  nextState?: TState;
}>;

export interface AgentModel<
  // TLogic extends AnyActorLogic,
  TReward,
  TState,
  TEvent extends EventObject
> {
  // policy: ({
  //   logic,
  //   state,
  //   goal,
  // }: {
  //   logic: TLogic;
  //   state: TState;
  //   goal: string;
  // }) => Promise<AgentPlan<TState>>;
  getExperiences: () => Promise<Array<AgentExperience<TState, TEvent>>>; // TODO: TLogic instead?
  addExperience: (experience: AgentExperience<TState, TEvent>) => void;
  getLogic: ({
    experiences,
  }: {
    experiences: Array<AgentExperience<TState, TEvent>>; // TODO: TLogic instead?
  }) => Promise<AnyActorLogic>;
  getNextEvents: ({
    logic,
    state,
  }: {
    logic: AnyActorLogic;
    state: TState;
  }) => Promise<AnyEventObject[]>;
  getPlans: ({
    logic,
    state,
    goals,
  }: {
    logic: AnyActorLogic;
    state: TState;
    goals: string[];
  }) => Promise<Array<AgentPlan<TState, TEvent>>>;
  getReward: ({
    logic,
    state,
    goals,
    action,
  }: {
    logic: AnyActorLogic;
    state: TState;
    goals: string[];
    action: EventObject;
  }) => Promise<TReward>;
}

export interface AgentLogic<T> {
  /**
   * The next possible actions (represented by events) that the agent can take
   * based on the current state of the environment
   */
  getActions(state: T): Promise<AnyEventObject[]>;
  getPlan(state: T, goal: any): Promise<Array<[T, EventObject]>>;
}

export interface Agent<
  TState extends AnyMachineSnapshot,
  TEvent extends EventObject
> {
  act: (env: ActorRef<TState, TEvent>) => Promise<void>;
}

export function createAgent2<TEnvironment extends AnyActorRef>(
  openai: OpenAI,
  // logic: AnyActorLogic,
  // input: InputFrom<TLogic>,
  getGoals: (state: SnapshotFrom<TEnvironment>) => string | string[],
  schemas: ZodEventTypes
): Agent<SnapshotFrom<TEnvironment>, EventFrom<TEnvironment>> {
  const experiences: Array<AgentExperience<any, any>> = [];

  const agentModel: AgentModel<
    any,
    SnapshotFrom<TEnvironment>,
    EventFrom<TEnvironment>
  > = {
    // policy: async ({ logic, state, goal }) => {
    //   const toolEvents = await getToolCalls(
    //     openai,
    //     goal,
    //     state,
    //     'gpt-4-1106-preview',
    //     (eventType) => eventType.startsWith('agent.'),
    //     schemas
    //   );
    //   console.log(toolEvents);
    //   return toolEvents.map((te) => ({
    //     state,
    //     event: te as EventFromLogic<TLogic>,
    //   }));
    // },
    addExperience: (experience) => {
      experiences.push(experience);
    },
    getExperiences: async () => experiences,
    getLogic: async ({ experiences }) => {
      return null as any; // TODO
    },
    getNextEvents: async ({ logic, state }) => {
      return [];
    },
    getReward: async ({ logic, state, goals, action }) => {
      return 0;
    },
    getPlans: async ({ logic, state, goals }) => {
      if (!goals[0]) {
        return [];
      }

      const toolEvents = await getToolCalls(
        openai,
        goals[0] + '\nOnly make a single tool call.',
        state as any,
        'gpt-3.5-turbo-16k-0613',
        (eventType) => eventType.startsWith('agent.'),
        schemas
      );

      console.log(toolEvents);

      return [
        toolEvents.map((toolEvent) => ({
          state,
          event: toolEvent as EventFrom<TEnvironment>,
        })),
      ];
    },
  };

  // const actor = createActor(logic, {
  //   input,
  //   inspect: (inspEv) => {
  //     if (inspEv.type === '@xstate.snapshot') {
  //       agentModel.addExperience({
  //         prevState: experiences[experiences.length - 1]?.nextState,
  //         nextState: (inspEv.snapshot as AnyMachineSnapshot).value,
  //         event: inspEv.event as EventFromLogic<TLogic>,
  //       });
  //     }
  //   },
  // });

  return {
    act: async (actorRef) => {
      const state = actorRef.getSnapshot();
      // @ts-ignore
      console.log(state.value, state.context);
      const experiences = await agentModel.getExperiences();
      const goals = toArray(getGoals(state));
      console.log('Goal:', goals);

      const nextPlans = await agentModel.getPlans({
        logic: await agentModel.getLogic({ experiences }),
        goals,
        state,
      });

      const nextStep = nextPlans?.[0]?.[0];

      // TODO: race conditions!
      if (nextStep) {
        console.log('nextStep', nextStep?.event);
        actorRef.send(nextStep.event);
      } else {
        console.log('No next step');
      }
    },
  } satisfies Agent<SnapshotFrom<TEnvironment>, EventFrom<TEnvironment>>; // TODO: fix types
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function createAgent(
  openai: OpenAI,
  {
    model,
  }: {
    model: ChatCompletionCreateParamsBase['model'];
  }
): PromiseActorLogic<
  void,
  {
    goal: string;
    model?: ChatCompletionCreateParamsBase['model'];
  }
> {
  return fromPromise(async ({ input, self }) => {
    const parentRef = self._parent;
    if (!parentRef) {
      return;
    }
    const state = parentRef.getSnapshot() as AnyMachineSnapshot;

    const toolEvents = await getToolCalls(
      openai,
      input.goal + '\nOnly make a single tool call.',
      state,
      input.model ?? model,
      (eventType) => eventType.startsWith('agent.'),
      (state.machine.schemas as any)?.events
    );

    if (toolEvents.length > 0) {
      parentRef.send(toolEvents[0]);
    }

    return;
  });
}
