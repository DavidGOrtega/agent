import { generateObject, generateText } from 'ai';
import { getToolMap } from '../decide';
import {
  AnyAgent,
  AgentDecideInput,
  AgentDecision,
  PromptTemplate,
} from '../types';
import { defaultTextTemplate } from '../templates/defaultText';
import { getMessages } from '../text';
import { simpleStrategy } from './simple';
import { convertToXml } from '../utils';

const chainOfThoughtPromptTemplate: PromptTemplate<any> = ({
  context,
  goal,
}) => {
  return `
${convertToXml({ context, goal })}

How would you achieve the goal? Think step-by-step.
`.trim();
};

export async function chainOfThoughtStrategy<T extends AnyAgent>(
  agent: T,
  input: AgentDecideInput<any>
): Promise<AgentDecision<any> | undefined> {
  const prompt = chainOfThoughtPromptTemplate({
    context: input.state.context,
    goal: input.goal,
  });

  const messages = await getMessages(agent, prompt, input);

  const model = input.model ? agent.wrap(input.model) : agent.model;

  const result = await generateText({
    model,
    system: input.system ?? agent.description,
    messages,
  });

  const decision = await simpleStrategy(agent, {
    ...input,
    messages: messages.concat(result.response.messages),
  });

  return decision;
}
