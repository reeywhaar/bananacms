'use client'

import { useNavigationPending } from '@reeywhaar/bananacms/client'
import classes from './PendingIndicator.module.scss'

// thin bar at the top of the page while an RSC request is in flight
export function PendingIndicator() {
  const isPending = useNavigationPending()
  return <div aria-hidden className={`${classes.bar} ${isPending ? classes.pending : ''}`} />
}
