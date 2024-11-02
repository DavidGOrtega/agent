import { CoreMessage, generateText } from 'ai';
import { AgentPlan, AgentPlanInput, PromptTemplate, AnyAgent } from '../types';
import { randomId } from '../utils';
import { getNextSnapshot } from 'xstate';
import { defaultTextTemplate } from '../templates/defaultText';
import { getMessages } from '../text';
import { getToolMap } from '../decide';

const simplePlannerPromptTemplate: PromptTemplate<any> = (data) => {
  return `
${defaultTextTemplate(data)}

Make at most one tool call to achieve the above goal. If the goal cannot be achieved with any tool calls, do not make any tool call.
  `.trim();
};

export async function simplePlanner<T extends AnyAgent>(
  agent: T,
  input: AgentPlanInput<any>
): Promise<AgentPlan<any> | undefined> {
  const toolMap = getToolMap(agent, input);

  if (!toolMap) {
    // No valid transitions for the specified tools
    return undefined;
  }

  // Create a prompt with the given context and goal.
  // The template is used to ensure that a single tool call at most is made.
  const prompt = simplePlannerPromptTemplate({
    context: input.state.context,
    goal: input.goal,
  });

  const messages = await getMessages(agent, prompt, input);

  const model = input.model ? agent.wrap(input.model) : agent.model;

  const {
    state,
    machine,
    previousPlan,
    events,
    goal,
    model: _,
    ...rest
  } = input;

  const machineState = input.machine
    ? input.machine.resolveState({
        ...input.state,
        context: input.state.context,
      })
    : undefined;

  const result = await generateText({
    ...rest,
    system: input.system ?? agent.description,
    model,
    messages,
    tools: toolMap as any,
    toolChoice: input.toolChoice ?? 'required',
  });

  result.response.messages.forEach((m) => {
    const message: CoreMessage = m;

    agent.addMessage({
      ...message,
      id: randomId(),
      timestamp: Date.now(),
    });
  });

  const singleResult = result.toolResults[0];

  if (!singleResult) {
    // TODO: retries?
    console.warn('No tool call results returned');
    return undefined;
  }

  return {
    planner: 'simple',
    goal: input.goal,
    goalState: input.state,
    nextEvent: singleResult.result,
    episodeId: agent.episodeId,
    timestamp: Date.now(),
    paths: [
      {
        state: undefined,
        steps: [
          {
            event: singleResult.result,
            state:
              machine && machineState
                ? getNextSnapshot(machine, machineState, singleResult.result)
                : undefined,
          },
        ],
      },
    ],
  };
}
