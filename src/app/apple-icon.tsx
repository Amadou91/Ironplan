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
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 45%, #22c55e 100%)',
          borderRadius: 36,
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: -3,
          color: '#fff'
        }}
      >
        IP
      </div>
    ),
    {
      ...size
    }
  )
}
