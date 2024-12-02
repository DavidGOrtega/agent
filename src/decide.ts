import { AnyActor, AnyMachineSnapshot, fromPromise } from 'xstate';
import {
  AnyAgent,
  AgentDecisionLogic,
  AgentDecideInput,
  TransitionData,
} from './types';
import { getTransitions } from './utils';
import { CoreTool, tool } from 'ai';
import { ZodEventMapping } from './schemas';

export function fromDecision<TAgent extends AnyAgent>(
  agent: TAgent,
  defaultInput?: AgentDecideInput<TAgent>
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

    const decision = await agent.decide({
      machine: (parentRef as AnyActor).logic,
      state: snapshot,
      ...resolvedInput,
      // @ts-ignore
      messages: resolvedInput.messages,
    });

    if (decision?.nextEvent) {
      parentRef.send(decision.nextEvent);
    }

    return decision;
  }) as AgentDecisionLogic<any>;
}

export function getToolMap<TAgent extends AnyAgent>(
  agent: TAgent,
  input: AgentDecideInput<any>
): Record<string, CoreTool<any, any>> | undefined {
  const events = input.events ?? (agent.events as ZodEventMapping);
  // Get all of the possible next transitions
  const transitions: TransitionData[] = input.machine
    ? getTransitions(input.state, input.machine)
    : Object.entries(events).map(([eventType, { description }]) => ({
        eventType,
        description,
      }));

  // Only keep the transitions that match the event types that are in the event mapping
  // TODO: allow for custom filters
  const filter = (eventType: string) => Object.keys(events).includes(eventType);

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
