import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180
}

export const contentType = 'image/png'

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            transform: 'rotate(-30deg)',
          }}
        >
          <div style={{ width: 30, height: 80, borderRadius: 8, background: 'rgba(255,255,255,0.95)' }} />
          <div
            style={{
              width: 38,
              height: 14,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 14, height: 3, borderRadius: 1.5, background: '#166534' }} />
          </div>
          <div style={{ width: 30, height: 80, borderRadius: 8, background: 'rgba(255,255,255,0.95)' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
