import { AnyActor, AnyMachineSnapshot, fromPromise } from 'xstate';
import {
  AnyAgent,
  AgentDecideOptions,
  AgentDecisionLogic,
  AgentDecisionInput,
  AgentPlanner,
  AgentPlan,
  EventsFromZodEventMapping,
  AgentPlanInput,
  TransitionData,
} from './types';
import { simplePlanner } from './planners/simple';
import { getTransitions } from './utils';
import { CoreTool, tool } from 'ai';

export async function agentDecide<T extends AnyAgent>(
  agent: T,
  options: AgentDecideOptions<T>
): Promise<AgentPlan<EventsFromZodEventMapping<T['events']>> | undefined> {
  const resolvedOptions = {
    ...agent.defaultOptions,
    ...options,
  };
  const {
    planner = simplePlanner as AgentPlanner<any>,
    goal,
    events = agent.events,
    state,
    machine,
    model = agent.model,
    ...otherPlanInput
  } = resolvedOptions;

  const plan = await planner(agent, {
    model,
    goal,
    events,
    state,
    machine,
    ...otherPlanInput,
  });

  if (plan?.nextEvent) {
    agent.addPlan(plan);
    await resolvedOptions.execute?.(plan.nextEvent);
  }

  return plan;
}

export function fromDecision(
  agent: AnyAgent,
  defaultInput?: AgentDecisionInput
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
    const state = {
      value: snapshot.value,
      context: resolvedInput.context,
    };

    const plan = await agentDecide(agent, {
      machine: (parentRef as AnyActor).logic,
      state,
      execute: async (event) => {
        parentRef.send(event);
      },
      ...resolvedInput,
    });

    return plan;
  }) as AgentDecisionLogic<any>;
}

export function getToolMap<T extends AnyAgent>(
  _agent: T,
  input: AgentPlanInput<any>
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
