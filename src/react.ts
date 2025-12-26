/**
 * React-specific logrect exports
 * These require React and should only be used in client components
 */

// Re-export core functionality
export * from './core';

// Hooks
export {
  useLogger,
  useLifecycleLogger,
  useRenderLogger,
  usePropChangeLogger,
  useStateLogger,
  useEffectLogger,
  useCallbackLogger,
  useMemoLogger,
  useTimer,
  useConditionalLogger,
  useWhyDidYouRender,
} from './hooks';

// HOCs
export {
  withLogger,
  withLoggerRef,
  withLoggerMemo,
  withErrorLogger,
} from './hoc';

// Decorators (for class components)
export {
  Log,
  LogClass,
  LogLifecycle,
  LogRender,
  LogState,
  LogErrors,
  LogAsync,
  LogDebounced,
  LogThrottled,
  LogWhen,
} from './decorators';

// Types
export type {
  DecoratorOptions,
  HOCOptions,
} from './types';

