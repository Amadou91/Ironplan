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
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 45%, #22c55e 100%)',
          borderRadius: 96,
          fontSize: 220,
          fontWeight: 800,
          letterSpacing: -12,
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
