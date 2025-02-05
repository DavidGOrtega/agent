import { assign, setup, createActor } from 'xstate';
import { z } from 'zod';
import { createAgent, EventFromAgent, fromDecision } from '../src';
import { openai } from '@ai-sdk/openai';
import { fromTerminal } from './helpers/helpers';

const agent = createAgent({
  id: 'todo',
  model: openai('gpt-4o-mini'),
  events: {
    addTodo: z.object({
      title: z.string().min(1).max(100).describe('The title of the todo'),
      content: z.string().min(1).max(100).describe('The content of the todo'),
    }),
    deleteTodo: z.object({
      index: z.number().describe('The index of the todo to delete'),
    }),
    toggleTodo: z
      .object({
        index: z.number().describe('The index of the todo to toggle'),
      })
      .describe('Toggle whether the todo item is done or not'),
    doNothing: z.object({}).describe('Do nothing'),
  },
});

interface Todo {
  title: string;
  content: string;
  done: boolean;
}

const machine = setup({
  types: {
    context: {} as {
      todos: Todo[];
      command: string | null;
    },
    events: {} as
      | EventFromAgent<typeof agent>
      | { type: 'assist'; command: string },
  },
  actors: { agent: fromDecision(agent), getFromTerminal: fromTerminal },
}).createMachine({
  context: {
    command: null,
    todos: [],
  },
  on: {
    addTodo: {
      actions: assign({
        todos: ({ context, event }) => [
          ...context.todos,
          {
            title: event.title,
            content: event.content,
            done: false,
          },
        ],
        command: null,
      }),
      target: '.idle',
    },
    deleteTodo: {
      actions: assign({
        todos: ({ context, event }) => {
          const todos = [...context.todos];
          todos.splice(event.index, 1);
          return todos;
        },
        command: null,
      }),
      target: '.idle',
    },
    toggleTodo: {
      actions: assign({
        todos: ({ context, event }) => {
          const todos = context.todos.map((todo, i) => {
            if (i === event.index) {
              return {
                ...todo,
                done: !todo.done,
              };
            }
            return todo;
          });

          return todos;
        },
        command: null,
      }),
      target: '.idle',
    },
    doNothing: { target: '.idle' },
  },
  initial: 'idle',
  states: {
    idle: {
      invoke: {
        src: 'getFromTerminal',
        input: '\nEnter a command:',
        onDone: {
          actions: assign({
            command: ({ event }) => event.output,
          }),
          target: 'assisting',
        },
      },
      on: {
        assist: {
          target: 'assisting',
          actions: assign({
            command: ({ event }) => event.command,
          }),
        },
      },
    },
    assisting: {
      invoke: {
        src: 'agent',
        input: ({ context }) => ({
          context: {
            command: context.command,
            todos: context.todos,
          },
          goal: 'Interpret the command as an action for this todo list; for example, "I need donuts" would add a todo item with the message "Get donuts".',
        }),
      },
    },
  },
});

const actor = createActor(machine);
actor.subscribe((s) => {
  console.log(s.context.todos);
});
actor.start();
