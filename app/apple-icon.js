import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, background: '#0A0A0A',
        borderRadius: 38, display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,128,255,0.18) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <span style={{ fontFamily: 'sans-serif', fontSize: 118, fontWeight: 700, color: '#FAF7F2', letterSpacing: '-6px', lineHeight: 1, marginTop: 8 }}>m</span>
        <div style={{
          position: 'absolute', top: 22, right: 22, width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e080c8 0%, #80b8ff 22%, #70d890 44%, #f5d840 66%, #ff8cc0 88%, #a080ff 100%)',
          display: 'flex',
        }} />
      </div>
    ),
    { ...size }
  )
}
