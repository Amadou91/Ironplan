import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(140deg, #ef6a1b 0%, #f59e0b 48%, #126145 100%)',
          borderRadius: 96,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            transform: 'rotate(-30deg)',
          }}
        >
          <div style={{ width: 72, height: 210, borderRadius: 20, background: 'rgba(255,255,255,0.96)' }} />
          <div style={{ width: 50, height: 168, borderRadius: 14, background: 'rgba(255,255,255,0.78)' }} />
          <div
            style={{
              width: 64,
              height: 36,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.62)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 28, height: 6, borderRadius: 3, background: '#166534' }} />
          </div>
          <div style={{ width: 50, height: 168, borderRadius: 14, background: 'rgba(255,255,255,0.78)' }} />
          <div style={{ width: 72, height: 210, borderRadius: 20, background: 'rgba(255,255,255,0.96)' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
