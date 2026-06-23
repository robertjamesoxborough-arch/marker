import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: 32, height: 32, background: '#0A0A0A',
        borderRadius: 7, display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative',
      }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: 21, fontWeight: 700, color: '#FAF7F2', letterSpacing: '-1px', lineHeight: 1, marginTop: 1 }}>m</span>
        <div style={{
          position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e080c8 0%, #80b8ff 30%, #70d890 60%, #f5d840 100%)',
          display: 'flex',
        }} />
      </div>
    ),
    { ...size }
  )
}
