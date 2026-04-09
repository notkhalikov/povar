"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransition = canTransition;
// Allowed next statuses for each current status
const TRANSITIONS = {
    draft: ['awaiting_payment', 'cancelled'],
    awaiting_payment: ['paid', 'cancelled'],
    paid: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'dispute_pending'],
    completed: [],
    dispute_pending: ['in_progress', 'refunded', 'cancelled'],
    refunded: [],
    cancelled: [],
};
// Which roles may trigger each transition
const ROLE_GUARDS = {
    'draft->awaiting_payment': ['customer'],
    'draft->cancelled': ['customer'],
    'awaiting_payment->cancelled': ['customer'],
    'awaiting_payment->paid': ['customer', 'admin'], // real payment via webhook later
    'paid->in_progress': ['chef'],
    'paid->cancelled': ['customer', 'chef'],
    'in_progress->completed': ['customer'],
    'in_progress->dispute_pending': ['customer', 'chef'],
    'dispute_pending->in_progress': ['support', 'admin'],
    'dispute_pending->refunded': ['support', 'admin'],
    'dispute_pending->cancelled': ['support', 'admin'],
};
function canTransition(from, to, role) {
    const allowed = TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from "${from}" to "${to}"`,
        };
    }
    const key = `${from}->${to}`;
    const allowedRoles = ROLE_GUARDS[key];
    if (allowedRoles && !allowedRoles.includes(role)) {
        return {
            code: 'FORBIDDEN',
            message: `Role "${role}" cannot perform this transition`,
        };
    }
    return null;
}
