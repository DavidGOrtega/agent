import { generateObject } from 'ai';
import { getToolMap } from '../decide';
import {
  AgentPlan,
  AgentPlanInput,
  AgentStep,
  AnyAgent,
  CostFunction,
  ObservedState,
} from '../types';
import { getShortestPaths } from '@xstate/graph';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Ajv from 'ajv';

const ajv = new Ajv();

function observedStatesEqual(state1: ObservedState, state2: ObservedState) {
  // check state value && state context
  return (
    JSON.stringify(state1.value) === JSON.stringify(state2.value) &&
    JSON.stringify(state1.context) === JSON.stringify(state2.context)
  );
}

function trimSteps(steps: AgentStep<any>[], currentState: ObservedState) {
  const index = steps.findIndex(
    (step) => step.state && observedStatesEqual(step.state, currentState)
  );

  if (index === -1) {
    return undefined;
  }

  return steps.slice(index + 1, steps.length);
}

export async function shortestPathPlanner<T extends AnyAgent>(
  agent: T,
  input: AgentPlanInput<any>
): Promise<AgentPlan<any> | undefined> {
  const costFunction: CostFunction<any> =
    input.costFunction ?? ((path) => path.weight ?? Infinity);
  const existingPlan = agent
    .getPlans()
    .find((p) => p.planner === 'shortestPath' && p.goal === input.goal);

  let paths = existingPlan?.paths;

  if (existingPlan) {
    console.log('Existing plan found');
  }

  if (!input.machine && !existingPlan) {
    return;
  }

  if (input.machine && !existingPlan) {
    const contextSchema = zodToJsonSchema(z.object(agent.context));
    const result = await generateObject({
      model: agent.model,
      system: input.system ?? agent.description,
      prompt: `
<goal>
${input.goal}
</goal>
<contextSchema>
${contextSchema}
</contextSchema>


Update the context JSON schema so that it validates the context to determine that it reaches the goal. Return the result as a diff.

The contextSchema properties must not change. Do not add or remove properties, or modify the name of the properties.
Use "const" for exact required values and define ranges/types for flexible conditions.

Examples:
1. For "user is logged in with admin role":
{
  "contextSchema": "{"type": "object", "properties": {"role": {"const": "admin"}, "lastLogin": {"type": "string"}}, "required": ["role"]}"
}

2. For "score is above 100":
{
  "contextSchema": "{"type": "object", "properties": {"score": {"type": "number", "minimum": 100}}, "required": ["score"]}"
}
    `.trim(),
      schema: z.object({
        // valueSchema: z
        //   .string()
        //   .describe('The JSON Schema representing the goal state value'),
        contextSchema: z
          .object({
            type: z.literal('object'),
            properties: z.object(
              Object.keys((contextSchema as any).properties).reduce(
                (acc, key) => {
                  acc[key] = z.any();
                  return acc;
                },
                {} as any
              )
            ),
            required: z.array(z.string()).optional(),
          })
          .describe('The JSON Schema representing the goal state context'),
      }),
    });

    console.log(result.object);
    const validateContext = ajv.compile(result.object.contextSchema);

    const resolvedState = input.machine.resolveState({
      ...input.state,
      context: input.state.context ?? {},
    });

    paths = getShortestPaths(input.machine, {
      fromState: resolvedState,
      toState: (state) => {
        const v = validateContext(state.context);
        return v;
      },
    });
  }

  if (!paths) {
    return undefined;
  }

  const trimmedPaths = paths
    .map((path) => {
      const trimmedSteps = trimSteps(path.steps, input.state);
      if (!trimmedSteps) {
        return undefined;
      }
      return {
        ...path,
        steps: trimmedSteps,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  // Sort paths from least weight to most weight
  const sortedPaths = trimmedPaths.sort(
    (a, b) => costFunction(a) - costFunction(b)
  );

  const leastWeightPath = sortedPaths[0];
  const nextStep = leastWeightPath?.steps[0];

  return {
    planner: 'shortestPath',
    episodeId: agent.episodeId,
    goal: input.goal,
    goalState: paths[0]?.state,
    nextEvent: nextStep?.event,
    paths,
    timestamp: Date.now(),
  };
}
