'use client'

import { useEffect, useState } from 'react'

type Props = { total: number }

export function SlideCounter({ total }: Props) {
  const [current, setCurrent] = useState(1)

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.deck > .slide'))
    if (sections.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            const idx = sections.indexOf(e.target as HTMLElement)
            if (idx >= 0) setCurrent(idx + 1)
          }
        }
      },
      { threshold: [0.5, 0.75, 1] },
    )

    for (const s of sections) io.observe(s)
    return () => io.disconnect()
  }, [])

  return (
    <div className="slide-counter" aria-live="polite">
      <span className="current">{String(current).padStart(2, '0')}</span>
      <span className="sep">/</span>
      <span className="total">{String(total).padStart(2, '0')}</span>
    </div>
  )
}
