import {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from 'ai';
import {
  AnyAgent,
  LanguageModelV1TextPart,
  LanguageModelV1ToolCallPart,
} from './types';
import { randomId } from './utils';

export function createAgentMiddleware(agent: AnyAgent) {
  const middleware: LanguageModelV1Middleware = {
    transformParams: async ({ params }) => {
      return params;
    },
    wrapGenerate: async ({ doGenerate, params }) => {
      const id = randomId();

      params.prompt.forEach((message) => {
        agent.addMessage({
          id,
          ...message,
          timestamp: Date.now(),
        });
      });

      const result = await doGenerate();

      return result;
    },

    wrapStream: async ({ doStream, params }) => {
      const id = randomId();

      params.prompt.forEach((message) => {
        message.content;
        agent.addMessage({
          id,
          ...message,
          timestamp: Date.now(),
        });
      });

      const { stream, ...rest } = await doStream();

      let generatedText = '';

      const transformStream = new TransformStream<
        LanguageModelV1StreamPart,
        LanguageModelV1StreamPart
      >({
        transform(chunk, controller) {
          if (chunk.type === 'text-delta') {
            generatedText += chunk.textDelta;
          }

          controller.enqueue(chunk);
        },

        flush() {
          const content: (
            | LanguageModelV1TextPart
            | LanguageModelV1ToolCallPart
          )[] = [];

          if (generatedText) {
            content.push({
              type: 'text',
              text: generatedText,
            });
          }

          agent.addMessage({
            id: randomId(),
            timestamp: Date.now(),
            role: 'assistant',
            content,
            responseId: id,
          });
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
  return middleware;
}
