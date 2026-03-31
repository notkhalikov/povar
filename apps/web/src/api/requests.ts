import { apiFetch } from './client'
import type { RequestItem, RequestDetail } from '../types'

export interface CreateRequestInput {
  city: string
  district?: string
  scheduledAt: string
  format: 'home_visit' | 'delivery'
  persons: number
  description?: string
  budget?: number
}

export interface RespondInput {
  proposedPrice?: number
  comment?: string
}

export function getRequests(): Promise<{ data: RequestItem[] }> {
  return apiFetch('/requests')
}

export function getRequest(id: number): Promise<RequestDetail> {
  return apiFetch(`/requests/${id}`)
}

export function createRequest(input: CreateRequestInput): Promise<RequestItem> {
  return apiFetch('/requests', { method: 'POST', body: JSON.stringify(input) })
}

export function respondToRequest(id: number, input: RespondInput): Promise<unknown> {
  return apiFetch(`/requests/${id}/respond`, { method: 'POST', body: JSON.stringify(input) })
}

export function acceptResponse(requestId: number, responseId: number): Promise<{ orderId: number }> {
  return apiFetch(`/requests/${requestId}/accept-response/${responseId}`, { method: 'POST' })
}

export function closeRequest(id: number): Promise<RequestItem> {
  return apiFetch(`/requests/${id}/close`, { method: 'PATCH' })
}
