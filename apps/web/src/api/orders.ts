import { apiFetch } from './client'
import type { Order } from '../types'

export interface CreateOrderInput {
  chefProfileId: number
  type: 'home_visit' | 'delivery'
  city: string
  scheduledAt: string
  persons: number
  address?: string
  description?: string
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getOrders(): Promise<{ data: Order[] }> {
  return apiFetch<{ data: Order[] }>('/orders')
}

export function getOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`)
}

export function createInvoice(orderId: number): Promise<{ invoiceUrl: string }> {
  return apiFetch<{ invoiceUrl: string }>('/payments/invoice', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export function completeOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/complete`, { method: 'POST' })
}

export function patchOrderStatus(id: number, status: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
