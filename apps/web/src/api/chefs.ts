import { apiFetch } from './client'
import type { ChefProfile, ChefsResponse, MyChefProfile, ReviewItem } from '../types'

const BASE_URL = import.meta.env.VITE_BASE_URL as string

export function getChefReviews(
  chefId: number,
  params: { limit?: number; offset?: number } = {},
): Promise<{ data: ReviewItem[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams()
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  return apiFetch(`/chefs/${chefId}/reviews${qs.size ? `?${qs}` : ''}`)
}

export interface PatchChefBody {
  bio?: string
  cuisineTags?: string[]
  workFormats?: string[]
  districts?: string[]
  avgPrice?: number
  isActive?: boolean
}

export function getMyChef(): Promise<MyChefProfile> {
  return apiFetch<MyChefProfile>('/chefs/me')
}

export function patchMyChef(body: PatchChefBody): Promise<MyChefProfile> {
  return apiFetch<MyChefProfile>('/chefs/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export interface ChefsQuery {
  city?: string
  district?: string
  cuisine?: string
  format?: 'home_visit' | 'delivery'
  sort?: 'rating' | 'price'
  limit?: number
  offset?: number
}

export function getChefs(query: ChefsQuery = {}): Promise<ChefsResponse> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.size ? `?${params}` : ''
  return apiFetch<ChefsResponse>(`/chefs${qs}`)
}

export function getChef(id: number): Promise<ChefProfile> {
  return apiFetch<ChefProfile>(`/chefs/${id}`)
}

export function addPortfolioPhotos(mediaIds: string[]): Promise<{ portfolioMediaIds: string[] }> {
  return apiFetch('/chefs/me/portfolio', {
    method: 'POST',
    body: JSON.stringify({ mediaIds }),
  })
}

export function deletePortfolioPhoto(mediaId: string): Promise<{ portfolioMediaIds: string[] }> {
  return apiFetch(`/chefs/me/portfolio/${encodeURIComponent(mediaId)}`, { method: 'DELETE' })
}

export async function uploadPortfolioPhoto(file: File): Promise<{ fileId: string }> {
  const data = await fileToBase64(file)
  return apiFetch('/chefs/portfolio/upload', {
    method: 'POST',
    body: JSON.stringify({ data, mimeType: file.type }),
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:image/...;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function chefPhotoUrl(chefId: number, fileId: string): string {
  return `${BASE_URL}/chefs/${chefId}/photo/${encodeURIComponent(fileId)}`
}
