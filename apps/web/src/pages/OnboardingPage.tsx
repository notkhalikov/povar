import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { useAuth } from '../context/AuthContext'

// ─── SVG Illustrations ────────────────────────────────────────────────────────

function ChefIllustration() {
  return (
    <svg width='160' height='180' viewBox='0 0 160 180' fill='none' xmlns='http://www.w3.org/2000/svg'>
      {/* Toque (chef hat) — cylinder top */}
      <rect x='52' y='18' width='56' height='36' rx='4' fill='var(--tg-theme-button-color)' opacity='.9' />
      {/* Toque puff (dome) */}
      <ellipse cx='80' cy='20' rx='32' ry='18' fill='var(--tg-theme-button-color)' />
      {/* Hat brim */}
      <rect x='44' y='50' width='72' height='10' rx='5' fill='var(--tg-theme-button-color)' opacity='.7' />
      {/* Head */}
      <circle cx='80' cy='82' r='28' fill='#FDDBB4' />
      {/* Eyes */}
      <circle cx='70' cy='78' r='3.5' fill='#3a3a3c' />
      <circle cx='90' cy='78' r='3.5' fill='#3a3a3c' />
      {/* Smile */}
      <path d='M70 90 Q80 99 90 90' stroke='#3a3a3c' strokeWidth='2.5' strokeLinecap='round' fill='none' />
      {/* Neck */}
      <rect x='72' y='108' width='16' height='10' rx='4' fill='#FDDBB4' />
      {/* Body (apron) */}
      <rect x='44' y='116' width='72' height='52' rx='12' fill='var(--tg-theme-button-color)' opacity='.85' />
      {/* Apron strings */}
      <rect x='72' y='116' width='16' height='52' rx='4' fill='white' opacity='.25' />
      {/* Left arm */}
      <rect x='20' y='120' width='26' height='14' rx='7' fill='var(--tg-theme-button-color)' opacity='.85' />
      {/* Right arm */}
      <rect x='114' y='120' width='26' height='14' rx='7' fill='var(--tg-theme-button-color)' opacity='.85' />
      {/* Pot in right hand */}
      <rect x='126' y='112' width='24' height='16' rx='4' fill='#8e8e93' />
      <rect x='122' y='110' width='32' height='5' rx='2.5' fill='#636366' />
      {/* Steam lines */}
      <path d='M132 107 Q134 102 132 97' stroke='#c7c7cc' strokeWidth='2' strokeLinecap='round' fill='none' />
      <path d='M138 107 Q140 101 138 95' stroke='#c7c7cc' strokeWidth='2' strokeLinecap='round' fill='none' />
      <path d='M144 107 Q146 102 144 97' stroke='#c7c7cc' strokeWidth='2' strokeLinecap='round' fill='none' />
      {/* Legs */}
      <rect x='56' y='164' width='20' height='14' rx='6' fill='#636366' />
      <rect x='84' y='164' width='20' height='14' rx='6' fill='#636366' />
    </svg>
  )
}

function SearchIllustration() {
  return (
    <svg width='160' height='160' viewBox='0 0 160 160' fill='none' xmlns='http://www.w3.org/2000/svg'>
      {/* Magnifier circle */}
      <circle cx='68' cy='68' r='44' stroke='var(--tg-theme-button-color)' strokeWidth='8' fill='none' />
      <circle cx='68' cy='68' r='36' fill='var(--tg-theme-button-color)' opacity='.08' />
      {/* Handle */}
      <line x1='102' y1='102' x2='136' y2='136' stroke='var(--tg-theme-button-color)' strokeWidth='10' strokeLinecap='round' />
      {/* Stars inside */}
      <text x='45' y='62' fontSize='18' fill='var(--tg-theme-button-color)'>★</text>
      <text x='64' y='76' fontSize='14' fill='var(--tg-theme-button-color)' opacity='.7'>★</text>
      <text x='76' y='60' fontSize='12' fill='var(--tg-theme-button-color)' opacity='.5'>★</text>
    </svg>
  )
}

function ShieldIllustration() {
  return (
    <svg width='160' height='160' viewBox='0 0 160 160' fill='none' xmlns='http://www.w3.org/2000/svg'>
      {/* Shield body */}
      <path
        d='M80 16 L134 38 L134 82 C134 112 80 144 80 144 C80 144 26 112 26 82 L26 38 Z'
        fill='var(--tg-theme-button-color)'
        opacity='.12'
        stroke='var(--tg-theme-button-color)'
        strokeWidth='5'
        strokeLinejoin='round'
      />
      {/* Checkmark */}
      <path
        d='M54 82 L72 100 L108 64'
        stroke='var(--tg-theme-button-color)'
        strokeWidth='8'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />
      {/* Coin */}
      <circle cx='116' cy='116' r='22' fill='var(--tg-theme-button-color)' opacity='.9' />
      <text x='107' y='122' fontSize='18' fill='white' fontWeight='700'>₾</text>
    </svg>
  )
}

const SLIDE_ILLUSTRATIONS = [
  <ChefIllustration />,
  <SearchIllustration />,
  <ShieldIllustration />,
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const t                    = useT()
  const navigate             = useNavigate()
  const { completeOnboarding } = useAuth()
  const [slide, setSlide]    = useState(0)
  const touchStartX          = useRef(0)
  const touchEndX            = useRef(0)

  function finish() {
    completeOnboarding()
    navigate('/', { replace: true })
  }

  function goNext() {
    if (slide < t.onboarding.slides.length - 1) setSlide(s => s + 1)
    else finish()
  }

  function goPrev() {
    if (slide > 0) setSlide(s => s - 1)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX
    const delta = touchStartX.current - touchEndX.current
    if (Math.abs(delta) > 50) {
      if (delta > 0) goNext()
      else goPrev()
    }
  }

  const isLast = slide === t.onboarding.slides.length - 1
  const current = t.onboarding.slides[slide]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--tg-theme-bg-color)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0' }}>
        {!isLast && (
          <button
            onClick={finish}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 15,
              color: 'var(--tg-theme-hint-color)',
              cursor: 'pointer',
              padding: '8px 4px',
              minHeight: 44,
            }}
          >
            {t.common.skip}
          </button>
        )}
      </div>

      {/* Slide content */}
      <div
        key={slide}
        className='page-slide-forward'
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px',
          textAlign: 'center',
          gap: 24,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          {SLIDE_ILLUSTRATIONS[slide]}
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>
          {current.title}
        </h1>
        <p style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.6,
          color: 'var(--tg-theme-hint-color)',
          maxWidth: 300,
        }}>
          {current.subtitle}
        </p>
      </div>

      {/* Dots + CTA */}
      <div style={{
        padding: '0 24px calc(max(32px, env(safe-area-inset-bottom)) + 16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
      }}>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {t.onboarding.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: i === slide
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-hint-color)',
                opacity: i === slide ? 1 : 0.35,
                transition: 'width .25s ease, opacity .25s ease, background .25s ease',
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          className='btn-primary'
          onClick={goNext}
          style={{ maxWidth: 320, width: '100%' }}
        >
          {isLast ? t.common.start : t.common.next}
        </button>
      </div>
    </div>
  )
}
