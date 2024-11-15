import { AnyActor, AnyMachineSnapshot, fromPromise } from 'xstate';
import {
  AnyAgent,
  AgentDecideOptions,
  AgentDecisionLogic,
  AgentDecision,
  AgentDecideInput,
  TransitionData,
  EventFromAgent,
} from './types';
import { getTransitions } from './utils';
import { CoreMessage, CoreTool, tool } from 'ai';

export async function agentDecide<TAgent extends AnyAgent>(
  agent: TAgent,
  options: AgentDecideOptions<TAgent>
): Promise<AgentDecision<TAgent> | undefined> {
  const resolvedOptions = {
    ...agent.defaultOptions,
    ...options,
  };
  const {
    strategy = agent.strategy,
    goal,
    allowedEvents,
    events = agent.events,
    state,
    machine,
    model = agent.model,
    messages,
    ...otherDecideInput
  } = resolvedOptions;

  const filteredEventSchemas = allowedEvents
    ? Object.fromEntries(
        Object.entries(events).filter(([key]) => {
          return allowedEvents.includes(key);
        })
      )
    : events;

  let attempts = 0;

  const maxAttempts = resolvedOptions.maxAttempts ?? 2;

  let decision: AgentDecision<any> | undefined;

  const minimalState = {
    value: state.value,
    context: state.context,
  };

  while (attempts++ < maxAttempts) {
    decision = await strategy(agent, {
      model,
      goal,
      events: filteredEventSchemas,
      state: minimalState,
      machine,
      messages: messages as CoreMessage[], // TODO: fix UIMessage thing
      ...otherDecideInput,
    });

    if (decision?.nextEvent) {
      agent.addDecision(decision);
      await resolvedOptions.execute?.(decision.nextEvent);
      break;
    }
  }

  return decision;
}

export function fromDecision<T extends AnyAgent>(
  agent: T,
  defaultInput?: AgentDecideInput<EventFromAgent<T>>
): AgentDecisionLogic<any> {
  return fromPromise(async ({ input, self }) => {
    const parentRef = self._parent;
    if (!parentRef) {
      return;
    }

    const snapshot = parentRef.getSnapshot() as AnyMachineSnapshot;
    const inputObject = typeof input === 'string' ? { goal: input } : input;
    const resolvedInput = {
      ...defaultInput,
      ...inputObject,
    };

    const decision = await agentDecide(agent, {
      machine: (parentRef as AnyActor).logic,
      state: snapshot,
      execute: async (event) => {
        parentRef.send(event);
      },
      ...resolvedInput,
      // @ts-ignore
      messages: resolvedInput.messages,
    });

    return decision;
  }) as AgentDecisionLogic<any>;
}

export function getToolMap<T extends AnyAgent>(
  _agent: T,
  input: AgentDecideInput<any>
): Record<string, CoreTool<any, any>> | undefined {
  // Get all of the possible next transitions
  const transitions: TransitionData[] = input.machine
    ? getTransitions(input.state, input.machine)
    : Object.entries(input.events).map(([eventType, { description }]) => ({
        eventType,
        description,
      }));

  // Only keep the transitions that match the event types that are in the event mapping
  // TODO: allow for custom filters
  const filter = (eventType: string) =>
    Object.keys(input.events).includes(eventType);

  // Mapping of each event type (e.g. "mouse.click")
  // to a valid function name (e.g. "mouse_click")
  const functionNameMapping: Record<string, string> = {};

  const toolTransitions = transitions
    .filter((t) => {
      return filter(t.eventType);
    })
    .map((t) => {
      const name = t.eventType.replace(/\./g, '_');
      functionNameMapping[name] = t.eventType;

      return {
        type: 'function',
        eventType: t.eventType,
        description: t.description,
        name,
      } as const;
    });

  // Convert the transition data to a tool map that the
  // Vercel AI SDK can use
  const toolMap: Record<string, CoreTool<any, any>> = {};
  for (const toolTransitionData of toolTransitions) {
    const toolZodType = input.events?.[toolTransitionData.eventType];

    if (!toolZodType) {
      continue;
    }

    toolMap[toolTransitionData.name] = tool({
      description: toolZodType?.description ?? toolTransitionData.description,
      parameters: toolZodType,
      execute: async (params: Record<string, any>) => {
        const event = {
          type: toolTransitionData.eventType,
          ...params,
        };

        return event;
      },
    });
  }

  if (!Object.keys(toolMap).length) {
    // No valid transitions for the specified tools
    return undefined;
  }

  return toolMap;
}
