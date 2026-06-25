import { ImageResponse } from 'next/og'

export const alt = "Marker: for experienced people who'd quite like their evenings back"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default async function Image() {
  // Load Space Grotesk 500 from Google Fonts
  let fontMedium
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ).then(r => r.text())
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
    if (url) fontMedium = await fetch(url).then(r => r.arrayBuffer())
  } catch {}

  const font = fontMedium ? [{ name: 'SG', data: fontMedium, weight: 500, style: 'normal' }] : []
  const ff = fontMedium ? 'SG' : 'sans-serif'

  const rainbow = 'linear-gradient(90deg, #b060d8 0%, #5090f0 18%, #50c878 36%, #e8c830 54%, #e05898 72%, #8060e8 90%, #b060d8 100%)'
  const dotGrad = 'linear-gradient(135deg, #e080c8 0%, #80b8ff 22%, #70d890 44%, #f5d840 66%, #ff8cc0 88%, #a080ff 100%)'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', background: '#0A0A0A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Corner glows */}
        <div style={{
          position: 'absolute', top: -240, right: -240,
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(100,140,255,0.10) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -240, left: -240,
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,100,255,0.09) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Top rainbow band */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          background: rainbow, display: 'flex',
        }} />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 36 }}>
          <span style={{
            fontFamily: ff, fontSize: 112, fontWeight: 500,
            color: '#FAF7F2', letterSpacing: '-5px', lineHeight: 1,
          }}>
            marker
          </span>
          {/* Holo dot */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: dotGrad,
            marginLeft: 5, marginTop: 8,
            display: 'flex',
          }} />
        </div>

        {/* Divider hairline */}
        <div style={{
          width: 480, height: 1.5, marginBottom: 36,
          background: 'linear-gradient(90deg, transparent, #b060d8 20%, #5090f0 40%, #50c878 60%, #e05898 80%, transparent)',
          display: 'flex',
        }} />

        {/* Tagline */}
        <div style={{
          fontFamily: ff, fontSize: 27, fontWeight: 500,
          color: '#6B6863', letterSpacing: '-0.3px',
          textAlign: 'center', maxWidth: 780, lineHeight: 1.45,
          display: 'flex',
        }}>
          For experienced people who&apos;d quite like their evenings back
        </div>

        {/* Bottom rainbow band */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
          background: rainbow, display: 'flex',
        }} />
      </div>
    ),
    { ...size, fonts: font }
  )
}
