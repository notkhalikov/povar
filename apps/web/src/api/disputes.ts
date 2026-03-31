import { apiFetch } from './client'
import type { Dispute } from '../types'

export interface CreateDisputeInput {
  orderId: number
  reasonCode: string
  description: string
  attachments?: string[]
}

export function createDispute(input: CreateDisputeInput): Promise<Dispute> {
  return apiFetch<Dispute>('/disputes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getDispute(id: number): Promise<Dispute> {
  return apiFetch<Dispute>(`/disputes/${id}`)
}

export function getDisputeByOrder(orderId: number): Promise<Dispute> {
  return apiFetch<Dispute>(`/disputes/by-order/${orderId}`)
}
