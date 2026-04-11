import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { useAuth } from '../context/AuthContext'
import { getMyChef, patchMyChef, uploadPortfolioPhoto, addPortfolioPhotos, deletePortfolioPhoto, chefPhotoUrl, submitVerification } from '../api/chefs'
import { useT } from '../i18n'

type WorkFormat = 'home_visit' | 'delivery'

export default function ChefOnboardingPage() {
  const t = useT()
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
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [isNewProfile, setIsNewProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  // Verification form state
  const [showVerifyForm, setShowVerifyForm] = useState(false)
  const [sendingVerify, setSendingVerify] = useState(false)
  const [docFileId, setDocFileId] = useState<string | null>(null)
  const [selfieFileId, setSelfieFileId] = useState<string | null>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
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
        setVerificationStatus(profile.verificationStatus)
        setIsNewProfile(false)
      })
      .catch(() => {
        // 404 — new profile, form stays empty, isNewProfile stays true
      })
      .finally(() => setLoadingProfile(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await patchMyChef({
        bio: bio || undefined,
        cuisineTags,
        workFormats,
        districts,
        avgPrice: avgPrice ? Number(avgPrice) : undefined,
        isActive,
      })
      // Update role in context if user was a customer
      if (user && user.role !== 'chef') {
        setUser({ ...user, role: 'chef' })
      }
      WebApp.HapticFeedback.notificationOccurred('success')
      setSaved(true)
      setTimeout(() => navigate(isNewProfile ? '/' : '/profile', { replace: true }), 800)
    } catch (err) {
      WebApp.HapticFeedback.notificationOccurred('error')
      setSaveError(err instanceof Error ? err.message : t.errors.generic)
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

  async function handleVerifyPhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    setFileId: (id: string) => void,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const { fileId } = await uploadPortfolioPhoto(file)
      setFileId(fileId)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSubmitVerification(e: React.FormEvent) {
    e.preventDefault()
    if (!docFileId) { WebApp.showAlert(t.verification.noDoc); return }
    if (!selfieFileId) { WebApp.showAlert(t.verification.noSelfie); return }
    setSendingVerify(true)
    try {
      const { verificationStatus: status } = await submitVerification(docFileId, selfieFileId)
      setVerificationStatus(status as 'pending' | 'approved' | 'rejected')
      setShowVerifyForm(false)
      WebApp.showAlert(t.verification.successMsg)
    } catch (err: unknown) {
      WebApp.showAlert(err instanceof Error ? err.message : t.verification.errorMsg)
    } finally {
      setSendingVerify(false)
    }
  }

  if (loadingProfile) {
    return <div style={{ padding: 24, textAlign: 'center' }}>{t.common.loading}</div>
  }

  return (
    <div style={{ padding: '24px 16px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
      <h2 style={{ margin: '0 0 6px' }}>{t.chefOnboarding.title}</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
        {t.chefOnboarding.hint}
      </p>

      <form onSubmit={handleSubmit}>
        {/* Bio */}
        <Field label={t.chef.about}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t.chefOnboarding.bioPlaceholder}
            maxLength={1000}
            style={textareaStyle}
          />
        </Field>

        {/* Cuisine tags */}
        <Field label={t.chefOnboarding.cuisineLabel}>
          <ChipInput
            value={cuisineTags}
            onChange={setCuisineTags}
            placeholder={t.chefOnboarding.cuisinePlaceholder}
          />
        </Field>

        {/* Work formats */}
        <Field label={t.chef.workFormat}>
          {(['home_visit', 'delivery'] as WorkFormat[]).map((fmt) => (
            <label key={fmt} style={checkboxLabelStyle}>
              <input
                type='checkbox'
                checked={workFormats.includes(fmt)}
                onChange={() => toggleFormat(fmt)}
                style={{ marginRight: 8 }}
              />
              {fmt === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull}
            </label>
          ))}
        </Field>

        {/* Districts */}
        <Field label={t.chefOnboarding.districtsLabel}>
          <ChipInput
            value={districts}
            onChange={setDistricts}
            placeholder={t.chefOnboarding.districtsPlaceholder}
          />
        </Field>

        {/* Average price */}
        <Field label={t.chefOnboarding.avgPriceLabel}>
          <input
            type='number'
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder='150'
            min={0}
            style={inputStyle}
          />
        </Field>

        {saveError && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#ff3b3011', border: '1px solid #ff3b3033', color: '#ff3b30', fontSize: 14 }}>
            {saveError}
          </div>
        )}

        <button
          type='submit'
          disabled={saving || saved}
          style={{ ...buttonStyle, opacity: saving || saved ? 0.8 : 1, background: saved ? '#34c759' : undefined }}
        >
          {saved ? '✓ ' + t.chefOnboarding.save : saving ? t.chefOnboarding.saving : t.chefOnboarding.save}
        </button>
      </form>

      {/* ── Status toggle (only for existing chef profiles) ── */}
      {chefId !== null && (
        <div style={statusSectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {isActive ? t.profile.accepting : t.profile.vacation}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
                {isActive ? t.chefOnboarding.visible : t.chefOnboarding.hidden}
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
              {isActive ? t.chefOnboarding.pause : t.chefOnboarding.resume}
            </button>
          </div>
        </div>
      )}

      {/* ── Portfolio (only for existing chef profiles) ── */}
      {chefId !== null && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{t.chef.portfolio}</div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 14 }}>
            {t.chefOnboarding.portfolioHint}
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
                  aria-label={t.a11y.deletePhoto}
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

      {/* ── Verification section (only for existing profiles) ── */}
      {chefId !== null && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>
            {t.verification.sectionTitle}
          </div>

          {verificationStatus === 'approved' && (
            <div style={{ ...verifyBannerStyle, background: '#34c75911', border: '1px solid #34c75933' }}>
              <span style={{ color: '#34c759', fontWeight: 600, fontSize: 14 }}>{t.verification.approved}</span>
            </div>
          )}

          {verificationStatus === 'pending' && (
            <div style={{ ...verifyBannerStyle, background: '#007aff11', border: '1px solid #007aff33' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#007aff' }}>{t.verification.pending}</div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 4 }}>{t.verification.pendingHint}</div>
            </div>
          )}

          {(verificationStatus === 'rejected' || verificationStatus === null) && !showVerifyForm && (
            <div>
              {verificationStatus === 'rejected' && (
                <div style={{ ...verifyBannerStyle, background: '#ff3b3011', border: '1px solid #ff3b3033', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#ff3b30' }}>{t.verification.rejected}</div>
                  <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 4 }}>{t.verification.rejectedHint}</div>
                </div>
              )}
              <button
                type='button'
                style={{ ...buttonStyle }}
                onClick={() => setShowVerifyForm(true)}
              >
                {t.verification.submitBtn}
              </button>
            </div>
          )}

          {showVerifyForm && (
            <form onSubmit={handleSubmitVerification} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>{t.verification.formHint}</div>

              <VerifyPhotoField
                label={t.verification.docLabel}
                fileId={docFileId}
                onPick={() => docInputRef.current?.click()}
              />
              <input
                ref={docInputRef}
                type='file'
                accept='image/*'
                style={{ display: 'none' }}
                onChange={e => handleVerifyPhotoSelect(e, setDocFileId)}
              />

              <VerifyPhotoField
                label={t.verification.selfieLabel}
                fileId={selfieFileId}
                onPick={() => selfieInputRef.current?.click()}
              />
              <input
                ref={selfieInputRef}
                type='file'
                accept='image/*'
                style={{ display: 'none' }}
                onChange={e => handleVerifyPhotoSelect(e, setSelfieFileId)}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type='button'
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--tg-theme-hint-color)', background: 'transparent', color: 'var(--tg-theme-text-color)', fontSize: 15, cursor: 'pointer' }}
                  onClick={() => setShowVerifyForm(false)}
                  disabled={sendingVerify}
                >
                  {t.common.cancel}
                </button>
                <button
                  type='submit'
                  style={{ flex: 2, ...buttonStyle, opacity: sendingVerify ? 0.6 : 1 }}
                  disabled={sendingVerify}
                >
                  {sendingVerify ? t.verification.sending : t.verification.sendBtn}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function VerifyPhotoField({ label, fileId, onPick }: { label: string; fileId: string | null; onPick: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 8 }}>{label}</div>
      <button
        type='button'
        onClick={onPick}
        style={{
          width: '100%', padding: '14px', borderRadius: 12,
          border: `2px dashed ${fileId ? '#34c759' : 'var(--tg-theme-hint-color)'}`,
          background: fileId ? '#34c75911' : 'var(--tg-theme-secondary-bg-color)',
          color: fileId ? '#34c759' : 'var(--tg-theme-hint-color)',
          fontSize: 15, cursor: 'pointer', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {fileId ? '✓ Фото загружено' : '📷 Выбрать фото'}
      </button>
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

const verifyBannerStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  marginBottom: 4,
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
