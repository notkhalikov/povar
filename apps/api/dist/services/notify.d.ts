import type { OrderStatus } from '../types/index.js';
export declare function statusNotifyText(status: OrderStatus, orderId: number): string;
export declare function notifyUser(telegramId: number, text: string, orderId: number): Promise<void>;
//# sourceMappingURL=notify.d.ts.map