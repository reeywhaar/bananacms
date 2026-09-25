import type { ReactNode } from 'react'
import classes from './BlockFrame.module.scss'

// shared card chrome for the home page's blocks; the footer says where in the
// CMS their content comes from
export function BlockFrame(props: { source: string; children: ReactNode }) {
  return (
    <section className={classes.frame}>
      {props.children}
      <footer className={classes.source}>
        <code>{props.source}</code>
      </footer>
    </section>
  )
}
