export type UserRole = 'customer' | 'chef' | 'support' | 'admin'
export type UserStatus = 'active' | 'banned'
export type WorkFormat = 'home_visit' | 'delivery'
export type VerificationStatus = 'pending' | 'approved' | 'rejected'
export type OrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'dispute_pending'
  | 'refunded'
  | 'cancelled'
export type ProductsBuyer = 'customer' | 'chef'
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}
