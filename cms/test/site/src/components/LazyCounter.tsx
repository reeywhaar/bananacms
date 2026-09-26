'use client'

import { useState } from 'react'

// a client component that a server component loads with React.lazy
export default function LazyCounter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Lazy clicks: {count}</button>
}
