import type { OrderStatus } from '../types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:            'Черновик',
  awaiting_payment: 'Ожидает оплаты',
  paid:             'Оплачен',
  in_progress:      'В процессе',
  completed:        'Завершён',
  dispute_pending:  'Спор',
  refunded:         'Возврат',
  cancelled:        'Отменён',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft:            '#8e8e93',
  awaiting_payment: '#e67e00',
  paid:             '#007aff',
  in_progress:      '#34c759',
  completed:        '#34c759',
  dispute_pending:  '#ff3b30',
  refunded:         '#8e8e93',
  cancelled:        '#8e8e93',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}
