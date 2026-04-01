import { apiFetch } from './client'
import type { ReviewItem } from '../types'

export interface CreateReviewInput {
  orderId: number
  rating: number
  tagsQuality?: string[]
  text?: string
}

export function createReview(input: CreateReviewInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>('/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function replyToReview(reviewId: number, reply: string): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/reviews/${reviewId}/reply`, {
    method: 'PATCH',
    body: JSON.stringify({ reply }),
  })
}

export function reportReview(reviewId: number): Promise<void> {
  return apiFetch<void>(`/reviews/${reviewId}/report`, { method: 'POST' })
}
