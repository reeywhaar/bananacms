let renders = 0

// breaks on every other render, so a retry gets through
export default function FlakyPage() {
  renders++
  if (renders % 2 === 1) throw new Error('Expected: the flaky page broke')
  return <h1>The flaky page is back</h1>
}
