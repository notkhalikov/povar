export function ChefCardSkeleton() {
  return (
    <div className='card' style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div className='sk' style={{ width: 56, height: 56, borderRadius: 28, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className='sk' style={{ height: 16, borderRadius: 6, width: '55%' }} />
        <div className='sk' style={{ height: 12, borderRadius: 6, width: '30%' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <div className='sk' style={{ height: 22, borderRadius: 11, width: 68 }} />
          <div className='sk' style={{ height: 22, borderRadius: 11, width: 80 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className='sk' style={{ height: 13, borderRadius: 6, width: 70 }} />
          <div className='sk' style={{ height: 30, borderRadius: 15, width: 100 }} />
        </div>
      </div>
    </div>
  )
}

export function OrderCardSkeleton() {
  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className='sk' style={{ height: 16, borderRadius: 6, width: '45%' }} />
        <div className='sk' style={{ height: 22, borderRadius: 11, width: 80 }} />
      </div>
      <div className='sk' style={{ height: 13, borderRadius: 6, width: '60%' }} />
      <div className='sk' style={{ height: 13, borderRadius: 6, width: '40%' }} />
    </div>
  )
}
