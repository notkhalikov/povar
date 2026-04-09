import type { OrderStatus, UserRole } from '../types/index.js';
export interface TransitionError {
    code: 'INVALID_TRANSITION' | 'FORBIDDEN';
    message: string;
}
export declare function canTransition(from: OrderStatus, to: OrderStatus, role: UserRole): TransitionError | null;
//# sourceMappingURL=order-state.d.ts.map