import { CoreMessage, generateText } from 'ai';
import {
  AgentDecision,
  AgentDecideInput,
  PromptTemplate,
  AnyAgent,
} from '../types';
import { convertToXml, randomId } from '../utils';
import { transition } from 'xstate';
import { getMessages } from '../text';
import { getToolMap } from '../decide';

const simpleStrategyPromptTemplate: PromptTemplate<any> = (data) => {
  return `
${convertToXml(data)}

Make at most one tool call to achieve the above goal. If the goal cannot be achieved with any tool calls, do not make any tool call.
  `.trim();
};

export async function simpleStrategy<T extends AnyAgent>(
  agent: T,
  input: AgentDecideInput<any>
): Promise<AgentDecision<any> | undefined> {
  const toolMap = getToolMap(agent, input);

  if (!toolMap) {
    // No valid transitions for the specified tools
    return undefined;
  }

  // Create a prompt with the given context and goal.
  // The template is used to ensure that a single tool call at most is made.
  const prompt = simpleStrategyPromptTemplate({
    stateValue: input.state.value,
    context: input.context ?? input.state.context,
    goal: input.goal,
  });

  const messages = await getMessages(agent, prompt, input);

  const model = input.model ? agent.wrap(input.model) : agent.model;

  const { state, machine, events, goal, model: _, ...rest } = input;

  const machineState =
    input.machine && input.state
      ? input.machine.resolveState({
          ...input.state,
          context: input.state.context ?? {},
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
    agent.addMessage(m);
  });

  const singleResult = result.toolResults[0];

  if (!singleResult) {
    // TODO: retries?
    console.warn('No tool call results returned');
    return undefined;
  }

  const nextEvent = singleResult.result;

  return {
    id: randomId(),
    strategy: 'simple',
    goal: input.goal,
    goalState: input.state,
    nextEvent,
    episodeId: input.episodeId ?? agent.episodeId,
    timestamp: Date.now(),
    paths: [
      {
        state: undefined,
        steps: [
          {
            event: nextEvent,
            state:
              machine && machineState
                ? transition(machine, machineState, nextEvent)[0]
                : undefined,
          },
        ],
      },
    ],
  };
}
