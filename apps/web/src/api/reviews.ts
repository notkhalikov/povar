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
