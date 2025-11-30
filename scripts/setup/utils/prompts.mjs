import enquirer from "enquirer";

export const { Confirm, Toggle, MultiSelect, Input } = enquirer;

export function createPromptHelpers(context) {
  return {
    async confirm(options) {
      if (context.flags.noninteractive) return options.initial ?? false;
      return new Confirm(options).run();
    },
    async input(options) {
      if (context.flags.noninteractive) return options.initial ?? "";
      return new Input(options).run();
    },
    async toggle(options) {
      if (context.flags.noninteractive) return options.initial ?? false;
      return new Toggle(options).run();
    },
  };
}
