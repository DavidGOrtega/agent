import {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  experimental_wrapLanguageModel as wrapLanguageModel,
} from 'ai';
import { AnyAgent } from './types';

export function createAgentMiddleware(agent: AnyAgent) {
  const middleware: LanguageModelV1Middleware = {
    transformParams: async ({ params, type }) => {
      return params;
    },
    wrapGenerate: async ({ doGenerate, params }) => {
      params.headers;
      console.log('doGenerate called');
      console.log(`params: ${JSON.stringify(params, null, 2)}`);

      const result = await doGenerate();

      console.log('doGenerate finished');
      console.log(`generated text: ${result.text}`);

      return result;
    },

    wrapStream: async ({ doStream, params }) => {
      console.log('doStream called');
      console.log(`params: ${JSON.stringify(params, null, 2)}`);

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
          console.log('doStream finished');
          console.log(`generated text: ${generatedText}`);
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

const wrappedLanguageModel = wrapLanguageModel({
  model: {} as any,
  middleware: createAgentMiddleware({} as any),
});
