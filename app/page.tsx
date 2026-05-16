import { getSlides } from '@/lib/slides'
import { SlideCounter } from './slide-counter'

export default async function Page() {
  const slides = await getSlides()
  return (
    <>
      <div className="bg-grid" aria-hidden />
      <img className="deck-logo" src="/gauntlet-logo.png" alt="" aria-hidden />
      <main className="deck">
        {slides.map((slide) => (
          <section
            key={slide.order}
            className={`slide slide--${slide.variant}`}
            aria-label={slide.title}
          >
            {slide.variant === 'content' && slide.topic ? (
              <div className="topic-label">{slide.topic}</div>
            ) : null}
            <div
              className={slide.variant === 'content' ? 'evidence' : undefined}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local markdown
              dangerouslySetInnerHTML={{ __html: slide.html }}
            />
          </section>
        ))}
      </main>
      <SlideCounter total={slides.length} />
    </>
  )
}
