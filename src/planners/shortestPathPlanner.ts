import { generateObject } from 'ai';
import { getToolMap } from '../decide';
import { AgentPlan, AgentPlanInput, AnyAgent } from '../types';
import { getShortestPaths } from '@xstate/graph';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Ajv from 'ajv';

const ajv = new Ajv();

export async function shortestPathPlanner<T extends AnyAgent>(
  agent: T,
  input: AgentPlanInput<any>
): Promise<AgentPlan<any> | undefined> {
  const toolMap = getToolMap(agent, input);

  if (!input.machine) {
    return;
  }

  const contextSchema = zodToJsonSchema(z.object(agent.context));

  const result = await generateObject({
    model: agent.model,
    prompt: `
<goal>
${input.goal}
</goal>
<contextSchema>
${contextSchema}
</contextSchema>
<stateMachine>
${JSON.stringify(input.machine)}
</stateMachine>


Return a JSON Schema representing the goal state criteria, where the state is an XState state.

For the value schema: Define which finite state value(s) represent the goal state.
For the context schema: Use "const" for exact required values and define ranges/types for flexible conditions.

Examples:
1. For "user is logged in with admin role":
{
  "valueSchema": "{"type": "string", "enum": ["loggedIn"]}",
  "contextSchema": "{"type": "object", "properties": {"role": {"const": "admin"}, "lastLogin": {"type": "string"}}, "required": ["role"]}"
}

2. For "score is above 100":
{
  "valueSchema": "{"type": "string", "enum": ["playing"]}",
  "contextSchema": "{"type": "object", "properties": {"score": {"type": "number", "minimum": 100}}, "required": ["score"]}"
}
    `.trim(),
    schema: z.object({
      valueSchema: z
        .string()
        .describe('The JSON Schema representing the goal state value'),
      contextSchema: z
        .string()
        .describe('The JSON Schema representing the goal state context'),
    }),
    // state: z
    //   .object({
    //     value: z.string().describe('The state value'),
    //     context: z.object({}).describe('The state context'),
    //   })
    //   .describe('The goal state'),
    // events: z
    //   .array(
    //     z.union(
    //       Object.keys(input.events).map((key) =>
    //         z.object({
    //           type: z.literal(key).describe('The event type'),
    //         })
    //       ) as any
    //     )
    //   )
    //   .describe('The possible events'),
    // }),
  });

  console.log(result.object);

  const validateContext = ajv.compile(JSON.parse(result.object.contextSchema));

  const paths = getShortestPaths(input.machine, {
    toState: (state) => validateContext(state.context),
  });

  const leastWeightPath = paths.slice().sort((a, b) => a.weight - b.weight)[0];

  return {
    episodeId: agent.episodeId,
    goal: input.goal,
    goalState: paths[0]?.state,
    nextEvent: leastWeightPath?.steps[0]?.event,
    paths,
    timestamp: Date.now(),
  };
}
