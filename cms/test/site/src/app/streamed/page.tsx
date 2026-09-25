import { setTimeout as sleep } from 'node:timers/promises'
import { Suspense } from 'react'

// A page whose content streams in after the shell, and is bigger than what React
// puts in place without a script
export default function Streamed() {
  return (
    <Suspense fallback={<p>Loading</p>}>
      <Items />
    </Suspense>
  )
}

async function Items() {
  await sleep(50)
  return (
    <ol>
      {Array.from({ length: 500 }, (_, i) => (
        <li key={i}>{`Item ${i}, of a list long enough to stream out of place`}</li>
      ))}
    </ol>
  )
}
