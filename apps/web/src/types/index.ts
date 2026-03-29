export interface ApiUser {
  id: number
  role: 'customer' | 'chef' | 'support' | 'admin'
  name: string
}

export interface ChefListItem {
  id: number
  userId: number
  name: string
  city: string | null
  bio: string | null
  cuisineTags: string[]
  workFormats: string[]
  districts: string[]
  avgPrice: string | null
  ratingCache: string
  ordersCount: number
}

export interface ChefProfile extends ChefListItem {
  portfolioMediaIds: string[]
  verificationStatus: 'pending' | 'approved' | 'rejected'
}

export interface ChefsResponse {
  data: ChefListItem[]
  limit: number
  offset: number
}

export type OrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'dispute_pending'
  | 'refunded'
  | 'cancelled'

export interface Order {
  id: number
  customerId: number
  chefId: number
  type: 'home_visit' | 'delivery'
  city: string
  district: string | null
  address: string | null
  scheduledAt: string
  persons: number
  description: string | null
  agreedPrice: string | null
  productsBuyer: 'customer' | 'chef' | null
  productsBudget: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
  chefName?: string
  customerName?: string
}
