import { PromptTemplate } from '../types';
import { wrapInXml } from '../utils';

export const defaultTextTemplate: PromptTemplate<any> = (data) => {
  const preamble = [
    data.stateValue
      ? wrapInXml('stateValue', JSON.stringify(data.stateValue))
      : undefined,
    data.context
      ? wrapInXml('context', JSON.stringify(data.context))
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return `
${preamble}

${data.goal}
  `.trim();
};
