import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyChef, patchMyChef, uploadPortfolioPhoto, addPortfolioPhotos, deletePortfolioPhoto, chefPhotoUrl } from '../api/chefs'

type WorkFormat = 'home_visit' | 'delivery'

const FORMAT_LABELS: Record<WorkFormat, string> = {
  home_visit: 'Выезд на дом',
  delivery: 'Доставка',
}

export default function ChefOnboardingPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  const [bio, setBio] = useState('')
  const [cuisineTags, setCuisineTags] = useState<string[]>([])
  const [workFormats, setWorkFormats] = useState<WorkFormat[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [avgPrice, setAvgPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [portfolioMediaIds, setPortfolioMediaIds] = useState<string[]>([])
  const [chefId, setChefId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pre-fill form if profile already exists
  useEffect(() => {
    getMyChef()
      .then((profile) => {
        if (profile.bio) setBio(profile.bio)
        setCuisineTags(profile.cuisineTags)
        setWorkFormats(profile.workFormats as WorkFormat[])
        setDistricts(profile.districts)
        if (profile.avgPrice) setAvgPrice(profile.avgPrice)
        setIsActive(profile.isActive)
        setPortfolioMediaIds(profile.portfolioMediaIds)
        setChefId(profile.id)
      })
      .catch(() => {
        // 404 — new profile, form stays empty
      })
      .finally(() => setLoadingProfile(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await patchMyChef({
        bio: bio || undefined,
        cuisineTags,
        workFormats,
        districts,
        avgPrice: avgPrice ? Number(avgPrice) : undefined,
      })
      // Update role in context if user was a customer
      if (user && user.role !== 'chef') {
        setUser({ ...user, role: 'chef' })
      }
      navigate('/profile')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function toggleFormat(fmt: WorkFormat) {
    setWorkFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    )
  }

  async function handleToggleStatus() {
    setTogglingStatus(true)
    try {
      const updated = await patchMyChef({ isActive: !isActive })
      setIsActive(updated.isActive)
    } catch (err) {
      console.error(err)
    } finally {
      setTogglingStatus(false)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // reset so the same file can be picked again
    e.target.value = ''
    setUploadingPhoto(true)
    try {
      const { fileId } = await uploadPortfolioPhoto(file)
      const { portfolioMediaIds: updated } = await addPortfolioPhotos([fileId])
      setPortfolioMediaIds(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleDeletePhoto(mediaId: string) {
    try {
      const { portfolioMediaIds: updated } = await deletePortfolioPhoto(mediaId)
      setPortfolioMediaIds(updated)
    } catch (err) {
      console.error(err)
    }
  }

  if (loadingProfile) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>
  }

  return (
    <div style={{ padding: '24px 16px', paddingBottom: 80 }}>
      <h2 style={{ margin: '0 0 6px' }}>Анкета повара</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
        Заполните профиль, чтобы заказчики могли вас найти
      </p>

      <form onSubmit={handleSubmit}>
        {/* Bio */}
        <Field label='О себе'>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder='Кратко о себе, опыте и специализации'
            maxLength={1000}
            style={textareaStyle}
          />
        </Field>

        {/* Cuisine tags */}
        <Field label='Кухни (нажмите Enter для добавления)'>
          <ChipInput
            value={cuisineTags}
            onChange={setCuisineTags}
            placeholder='Например: грузинская, итальянская'
          />
        </Field>

        {/* Work formats */}
        <Field label='Формат работы'>
          {(['home_visit', 'delivery'] as WorkFormat[]).map((fmt) => (
            <label key={fmt} style={checkboxLabelStyle}>
              <input
                type='checkbox'
                checked={workFormats.includes(fmt)}
                onChange={() => toggleFormat(fmt)}
                style={{ marginRight: 8 }}
              />
              {FORMAT_LABELS[fmt]}
            </label>
          ))}
        </Field>

        {/* Districts */}
        <Field label='Районы работы (нажмите Enter для добавления)'>
          <ChipInput
            value={districts}
            onChange={setDistricts}
            placeholder='Например: Ваке, Сабуртало'
          />
        </Field>

        {/* Average price */}
        <Field label='Средний чек (GEL)'>
          <input
            type='number'
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder='150'
            min={0}
            style={inputStyle}
          />
        </Field>

        <button
          type='submit'
          disabled={saving}
          style={{ ...buttonStyle, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Сохранение…' : 'Сохранить анкету'}
        </button>
      </form>

      {/* ── Status toggle (only for existing chef profiles) ── */}
      {chefId !== null && (
        <div style={statusSectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {isActive ? '🟢 Принимаю заказы' : '🔴 В отпуске'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
                {isActive ? 'Вы видны заказчикам' : 'Вы скрыты из каталога'}
              </div>
            </div>
            <button
              type='button'
              disabled={togglingStatus}
              onClick={handleToggleStatus}
              style={{
                ...toggleBtnStyle,
                background: isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-hint-color)',
                opacity: togglingStatus ? 0.6 : 1,
              }}
            >
              {isActive ? 'Пауза' : 'Включить'}
            </button>
          </div>
        </div>
      )}

      {/* ── Portfolio (only for existing chef profiles) ── */}
      {chefId !== null && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Портфолио</div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 14 }}>
            Фото блюд — максимум 10
          </div>

          <div style={portfolioGridStyle}>
            {portfolioMediaIds.map(id => (
              <div key={id} style={photoThumbStyle}>
                <img
                  src={chefPhotoUrl(chefId, id)}
                  alt='portfolio'
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
                />
                <button
                  type='button'
                  onClick={() => handleDeletePhoto(id)}
                  style={deletePhotoBtnStyle}
                  aria-label='Удалить'
                >
                  ×
                </button>
              </div>
            ))}

            {portfolioMediaIds.length < 10 && (
              <button
                type='button'
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                style={{ ...addPhotoBtnStyle, opacity: uploadingPhoto ? 0.6 : 1 }}
              >
                {uploadingPhoto ? '…' : '+'}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />
        </div>
      )}
    </div>
  )
}

// ─── Chip input ───────────────────────────────────────────────────────────────

function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const chip = input.trim().replace(/,$/, '')
      if (chip && !value.includes(chip)) {
        onChange([...value, chip])
      }
      setInput('')
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {value.map((chip) => (
            <span key={chip} style={chipStyle}>
              {chip}
              <button
                type='button'
                onClick={() => onChange(value.filter((c) => c !== chip))}
                style={chipRemoveStyle}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  boxSizing: 'border-box',
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: 'vertical',
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 15,
  padding: '8px 0',
  cursor: 'pointer',
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 20,
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 13,
}

const chipRemoveStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 8,
}

const statusSectionStyle: React.CSSProperties = {
  marginTop: 28,
  padding: '14px 16px',
  borderRadius: 12,
  background: 'var(--tg-theme-secondary-bg-color)',
}

const toggleBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 10,
  border: 'none',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const portfolioGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
}

const photoThumbStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'var(--tg-theme-secondary-bg-color)',
}

const deletePhotoBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontSize: 16,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const addPhotoBtnStyle: React.CSSProperties = {
  aspectRatio: '1',
  borderRadius: 10,
  border: '2px dashed var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-hint-color)',
  fontSize: 32,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
