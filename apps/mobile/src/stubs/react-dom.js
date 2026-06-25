// Stub for react-dom on React Native — only flushSync is used by @tamagui/popper
export function flushSync(fn) {
  return fn();
}

export default { flushSync };
