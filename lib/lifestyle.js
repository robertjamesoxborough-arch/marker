export const lifestyleImages = [
  { src: '/brand/lifestyle/ls-01-photo.png', alt: 'No Sunday dread' },
  { src: '/brand/lifestyle/ls-02-photo.png', alt: 'Better roles, more time for what matters' },
  { src: '/brand/lifestyle/ls-03-photo.png', alt: 'Ambitious by day, yours by night' },
  { src: '/brand/lifestyle/ls-04-photo.png', alt: "Work's done. Now you're home." },
  { src: '/brand/lifestyle/ls-07-photo.png', alt: 'No plans. No problem. Just us.' },
]

// Deterministic per-slug — each article always gets the same lifestyle image
export function getSlugImage(slug) {
  const index = slug.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % lifestyleImages.length
  return lifestyleImages[index]
}
