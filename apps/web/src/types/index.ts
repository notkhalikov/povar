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
  verificationStatus: 'pending' | 'approved' | 'rejected'
}

export interface ChefProfile extends ChefListItem {
  portfolioMediaIds: string[]
  verificationStatus: 'pending' | 'approved' | 'rejected'
}

export interface MyChefProfile {
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
  verificationStatus: 'pending' | 'approved' | 'rejected'
  isActive: boolean
  portfolioMediaIds: string[]
}

export interface ChefsResponse {
  data: ChefListItem[]
  limit: number
  offset: number
}

export type DisputeStatus = 'open' | 'awaiting_other_party' | 'support_review' | 'resolved'
export type DisputeResolutionType = 'full_refund' | 'partial_refund' | 'no_refund'

export interface Dispute {
  id: number
  orderId: number
  openedBy: 'customer' | 'chef'
  reasonCode: string
  description: string | null
  attachments: string[]
  status: DisputeStatus
  resolutionType: DisputeResolutionType | null
  resolutionComment: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewItem {
  id: number
  orderId: number
  rating: number
  tagsQuality: string[]
  text: string | null
  photoIds: string[]
  chefReply: string | null
  createdAt: string
  authorName: string
}

export interface RequestItem {
  id: number
  city: string
  district: string | null
  scheduledAt: string
  format: 'home_visit' | 'delivery'
  persons: number
  description: string | null
  budget: string | null
  status: 'open' | 'closed'
  createdAt: string
  responseCount: number
  hasResponded?: boolean
}

export interface ChefResponseItem {
  id: number
  chefId: number
  chefProfileId: number
  proposedPrice: string | null
  comment: string | null
  status: 'new' | 'accepted' | 'rejected'
  createdAt: string
  chefName: string
  ratingCache: string
}

export interface RequestDetail extends Omit<RequestItem, 'responseCount'> {
  customerId: number
  responses: ChefResponseItem[]
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
