export const doesObjectHaveKey = <T extends object, K extends string>(
  o: T,
  k: K,
): o is T & { [k in K]: unknown } => {
  // Object.hasOwn doesn't provide type inference when used
  // in an if statement, so we need to add it in manually
  return Object.hasOwn(o, k)
}
