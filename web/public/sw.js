// Service worker ขั้นต่ำ — ให้เบราว์เซอร์ยอมรับว่าเป็นแอปที่ติดตั้งได้
// ไม่เก็บแคชข้อมูล: ทุกคำขอวิ่งไปที่เซิร์ฟเวอร์ตามปกติ (ข้อมูลต้องสดเสมอ)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(
      () => new Response('<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">ออฟไลน์อยู่ — ต่ออินเทอร์เน็ตแล้วลองใหม่</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
