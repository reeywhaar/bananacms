'use client'

import styles from './Carousel.module.css'

interface CarouselProps {
  className?: string
  /** Array of image URLs to display. */
  images: { src: string; srcSet?: string }[]
  /**
   * Duration in seconds for one full left-to-right cycle.
   * Lower = faster. Defaults to 20.
   */
  speed?: number
}

export default function Carousel({ className, images, speed = 40 }: CarouselProps) {
  if (images.length === 0) return null

  // Duplicate the list so the loop is seamless: the track is 2× wide and
  // translateX animates across the first half (-50% → 0%), giving the
  // illusion of an endless left-to-right scroll.
  const track = [...images, ...images]

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      <div className={styles.track} style={{ animationDuration: `${100 / speed}s` }}>
        {track.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            {...src}
            alt=""
            aria-hidden="true"
            className={styles.image}
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}
