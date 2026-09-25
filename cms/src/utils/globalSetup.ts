export const globalSetup = <T>(label: string, factory: () => T) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gb = globalThis as any
  if (!gb[label]) {
    gb[label] = factory()
  }
  return gb[label] as T
}
