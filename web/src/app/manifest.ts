import type { MetadataRoute } from 'next';

// ทำให้ติดตั้งเป็นแอปบนมือถือได้ (Add to Home screen / ติดตั้งแอป)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MKT Content Manager',
    short_name: 'MKT',
    description: 'ระบบจัดการคอนเทนต์การตลาด · ทีม AI · ลีด',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fa',
    theme_color: '#ffffff',
    lang: 'th',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
