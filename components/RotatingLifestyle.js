'use client'
import Image from 'next/image'
import { lifestyleImages } from '../lib/lifestyle'

// Picks today's image client-side — same for all visitors that day, changes at midnight.
// objectPosition crops the text (always left side) and shows the photo.
export default function RotatingLifestyle({ style, sizes, priority }) {
  const index = Math.floor(Date.now() / 86400000) % lifestyleImages.length
  const img = lifestyleImages[index]
  return (
    <Image
      src={img.src}
      alt={img.alt}
      fill
      priority={priority}
      sizes={sizes || '100vw'}
      style={{ objectFit: 'cover', objectPosition: '85% center', ...style }}
    />
  )
}
