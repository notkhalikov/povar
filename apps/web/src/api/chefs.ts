import { apiFetch } from './client'
import type { ChefProfile, ChefsResponse } from '../types'

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
