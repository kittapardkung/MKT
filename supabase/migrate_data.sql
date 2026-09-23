-- MKT Content Manager — migrate data from Google Sheet (Marketing_Content_2026) into Supabase
-- รันหลังจาก schema.sql และ policies.sql แล้วเท่านั้น (SQL Editor เดียวกัน)
-- Posts/Ideas/Tags ใช้ ON CONFLICT DO NOTHING ปลอดภัยรันซ้ำได้
-- Log ไม่มี unique key จึงรันซ้ำแล้วข้อมูลจะซ้ำ — รันครั้งเดียวพอ

-- Posts (60 rows) — สถานะ READY ในชีตเดิม (3 แถว) แปลงเป็น APPROVED ให้ตรงกับ enum ปัจจุบัน
insert into posts (id, date, time, channel, title, format, status, owner, caption, tags, src_link, final_link, approved_by, approved_at, post_url) values
  ('P-20260814110404-2715', '2026-08-11 00:00:00', '09:00', 'Facebook, TikTok', 'คลิปส่งมอบรถสั้นๆ ลงTikTok // ทำแล้ว', 'วิดีโอ', 'PUBLISHED', 'Frong', '---option "ปิดการขาย"
🚘💙 อีกหนึ่งความประทับใจของวันส่งมอบ!

ขอขอบพระคุณลูกค้าที่ไว้วางใจเลือก WULING และให้เราได้เป็นส่วนหนึ่งของการเดินทางครั้งใหม่นะคะ ✨

อยากมีรถ EV คู่ใจแบบนี้ ทักมาคุยกับเราได้เลย 📩
พร้อมให้คำแนะนำตั้งแต่เลือกคันที่ใช่ จนถึงวันรับรถค่ะ 🥰

#WULING #WulingThailand #รถไฟฟ้า #รถEV #ส่งมอบรถ #ออกรถใหม่ #รถไฟฟ้าชลบุรี', NULL, NULL, 'https://drive.google.com/file/d/1082KYAVz2CGUHlLiREFY8saWpeCTZmiO/view?usp=sharing', NULL, NULL, NULL),
  ('P-20260814110618-8041', '2026-08-12 00:00:00', '09:00', 'Facebook', 'โพสต์วันหยุด วันแม่12สค', 'ภาพ', 'PUBLISHED', 'Frong', 'ประกาศวันหยุดทำการ 12 สิงหาคม 2026 💕', NULL, 'https://drive.google.com/file/d/1UHR-MbaaKVyCOJH6TejU42t85GGN8dg_/view?usp=sharing', NULL, NULL, NULL, 'https://www.facebook.com/share/p/1DBaWgMy2o/'),
  ('P-20260814111119-1577', '2026-08-14 00:00:00', '09:00', 'Facebook', 'WULING TEST DRIVE EVENT ครั้งที่ 9', 'วิดีโอ', 'PUBLISHED', 'Frong', '🔥 WULING TEST DRIVE EVENT ครั้งที่ 9 🔥
ชาว ศรีราชา ชลบุรี เรามาแล้วว 
.
📅 22 – 23 สิงหาคม 2569
📍 ชลละมุนคาเฟ่ Chon La Mun Cafe
📍 Location: https://maps.app.goo.gl/d7BFfsZw35qm3ugg8?g_st=ic
.
เปิดโอกาสให้คุณมาทดลองขับรถ EV ตัวจริง
บนเส้นทางจริง พร้อมสัมผัสความสะดวกสบายแบบใกล้ชิด
.
🚘 พบกับ 
✨ WULING Starlight Darion EV MPV ไฟฟ้า 7 ที่นั่ง เหมาะกับครอบครัว
✨ WULING Porta EV รถตู้ไฟฟ้า ตอบโจทย์ธุรกิจและการใช้งานหลากหลาย
.
🎁 พิเศษภายในงาน
☕ รับคูปองเครื่องดื่มฟรีสำหรับครอบครัว
🎁 ของที่ระลึกสำหรับผู้ลงทะเบียน
🔥 โปรโมชั่นพิเศษเฉพาะงาน
.
🚗 ทดลองขับฟรี!
ไม่ว่าคุณกำลังมองหารถสำหรับครอบครัว
หรือรถ EV สำหรับธุรกิจ
มาลองด้วยตัวเอง แล้วคุณอาจเจอ “คันที่ใช่” ที่ตามหาอยู่ก็ได้ 💙
📩 ลงทะเบียน / นัดหมายทดลองขับ
📞 082-324-7915
📞 081-160-4965 ดูน้อยลง', NULL, 'https://drive.google.com/file/d/1i8tpjLMmLFrjjX58x65tdNho830Q4CtO/view?usp=sharing', 'https://drive.google.com/file/d/1i8tpjLMmLFrjjX58x65tdNho830Q4CtO/view?usp=sharing', NULL, NULL, 'https://www.facebook.com/share/r/1C8tzkD7xA/'),
  ('P-20260814111405-7829', '2026-08-13 00:00:00', '09:00', 'Facebook', 'รูป Promotion', 'ภาพ', 'PUBLISHED', 'Frong', '🚚⚡ PORTA EV รถตู้บรรทุกไฟฟ้า 100% ที่เกิดมาเพื่อธุรกิจ!

💥 เริ่มต้นเพียง 6.59 แสนบาท
ขนส่งคุ้มค่า ประหยัดต้นทุน พร้อมลุยทุกงาน

✨ จุดเด่นที่คนทำธุรกิจต้องรู้
🔋 วิ่งได้ไกลสูงสุด 400 กม.
📦 รองรับน้ำหนักบรรทุกสูงสุด 1.2 ตัน
🚚 พื้นที่บรรทุกกว้าง ใช้งานได้จริง
🌱 ขับเคลื่อนด้วยพลังงานไฟฟ้า 100%
🛡️ มั่นใจด้วยการรับประกันคุณภาพ
🤝 พร้อมบริการหลังการขาย

🎁 ข้อเสนอสุดพิเศษ!
✅ ฟรี! รับประกันภัย
✅ ฟรี! บริการหลังการขาย
✅ ฟรี! ทดลองขับ

อยากรู้ว่า PORTA EV เหมาะกับธุรกิจของคุณแค่ไหน?
📲 ติดต่อ Wuling Chonburi ได้เลย
082-324-7915

📍 ศูนย์วู่หลิง ชลบุรี

#WULING #WulingChonburi #PORTAEV #PORTAEVชลบุรี #รถตู้ไฟฟ้า #รถบรรทุกไฟฟ้า #รถEV #รถเพื่อธุรกิจ #รถไฟฟ้า #รถไฟฟ้าชลบุรี #ธุรกิจขนส่ง #ทดลองขับ', NULL, 'https://drive.google.com/file/d/1trKf09GolxKGv9tFzcRYdvAHZLRbauXR/view?usp=drive_link, https://drive.google.com/file/d/1toWbkVD6GX5ZhomqCh8yEzdSFoIo2czj/view?usp=drive_link, https://drive.google.com/file/d/1ntjQHHPYFV_dcEK3pm7sLTTt3lfQAPlP/view?usp=drive_link, https://drive.google.com/file/d/1Tro_pNYhVdbpMOYTLDVpHPGztfVa0GRK/view?usp=drive_link', NULL, NULL, NULL, 'https://www.facebook.com/share/p/19MZzmbYKE/'),
  ('P-20260814111613-8910', '2026-08-17 00:00:00', '09:00', 'Facebook', 'คลิปสัมภาษณ์ลูกค้าจากการส่งมอบรถ', 'วิดีโอ', 'PUBLISHED', 'Frong', '❤️ ส่งมอบ PORTA EV และ ยินดีต้อนรับ ผู้ประกอบการยุคใหม่  ⚡⚡
สู่ครอบครัวของเรา WULING CHONBURI ❤️
.
ขอให้กิจการรุ่งเรืองๆ ทำมาค้าขึ้น เฮงๆ รวยๆ ทุกท่านครับ 
.
PORTA EV ⚡ถูกกว่า ประหยัดกว่า 
นัดรับจองถึงบ้าน แล้ววันนี้ !
.
รถตู้พลังงานไฟฟ้า 100%
เปลี่ยน “ค่าน้ำมัน” ให้กลายเป็น “กำไร” ทุกการวิ่ง 🚐
คุ้มตั้งแต่วันแรกที่ขับ
.
💸 ราคาเพียง 629,000.-
🔋 รับประกันแบตเตอรี่ 5 ปี / 200,000 กม.
🚗 รับประกันตัวรถ 3 ปี / 100,000 กม.
ถึงเวลาที่ธุรกิจต้องอัปเกรด!
.
ประหยัดกว่า วิ่งได้ไกลกว่า และดูทันสมัยกว่า
🔥 เปิดรับจองแล้ววันนี้ WURING CHONBURI
ทักแชทเพื่อสอบถามรายละเอียด
ติดต่อฝ่ายขาย : 082 324 7915', NULL, 'https://drive.google.com/file/d/11g3ZxahRzzZ6jMaRS36BWbAhLExjk2hy/view?usp=drive_link', 'https://drive.google.com/file/d/1IaWLTpgXgZqMV3HTV5textrjKuClkz6c/view?usp=sharing', NULL, NULL, 'https://www.facebook.com/share/r/1JNk41meS9/'),
  ('P-20260814111833-4518', '2026-08-15 00:00:00', '09:00', 'Facebook', 'บรรยากาศการTest Drive', 'ภาพ', 'PUBLISHED', 'Frong', '🔥 EVENT วันสุดท้าย ใครอยู่ "ฉะเชิงเทรา" และ พื้นที่ใกล้เคียง
🌟 WULING TEST DRIVE EVENT ครั้งที่ 8
🌟 ทดลองขับรถ EV ตัวจริงกับเราได้เลย !
.
🔥 WULING TEST DRIVE EVENT #8
.
📅 วันที่ 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans
.
LOCATION : https://maps.app.goo.gl/YL6EGTUg3Mue3yFk9
.
มาสัมผัส WULING แบบใกล้ชิด พร้อมทดลองขับบนเส้นทางจริง
ลองทั้งการขับขี่ ความสะดวกสบาย และพื้นที่ใช้งาน ก่อนตัดสินใจเลือกรถที่เหมาะกับคุณ
.
🚗 ภายในงานพบกับ
.
✨ WULING Starlight Darion EV
รถ MPV ไฟฟ้า 7 ที่นั่ง สำหรับครอบครัว
.
✨ WULING Porta EV
รถตู้ไฟฟ้าสำหรับธุรกิจ ขนของ และการใช้งานในชีวิตประจำวัน
.
พร้อมสิทธิพิเศษภายในงาน
.
🎁 ของที่ระลึกสำหรับผู้ลงทะเบียน
☕ คูปองเครื่องดื่มฟรีสำหรับครอบครัว
🔥 โปรโมชั่นพิเศษเฉพาะภายในงาน
🚗 ทดลองขับ Darion EV และ Porta EV ฟรี!
.
📩 **ลงทะเบียนล่วงหน้าได้แล้ววันนี้**
.
แล้วพบกัน
📅 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans**
.
สนใจทดลองขับ / สอบถามโปรโมชั่น
ทักแชทหาเราได้เลย
.
📞 ติดต่อฝ่ายขาย
082 324 7915
081 160 4965
.
WULING CHONBURI
พาคุณมาสัมผัสรถจริง ทดลองขับจริง ก่อนตัดสินใจ', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1UJeShseZ9MdmgsjfppsnHL3-Pr_t2i5h/view?usp=sharing', NULL, NULL, 'https://www.facebook.com/share/p/1B55373sGx/'),
  ('P-20260814111926-7740', '2026-08-20 00:00:00', '09:00', 'Facebook', 'คลิปสัมภาษณ์จากลูกค้าที่ทดลองขับจริงในงาน // ส่งกุ้ง', 'วิดีโอ', 'PUBLISHED', 'Frong', '🎤 เสียงจากลูกค้าหลังได้ลองขับจริง!
🚗⚡ ลองแล้วเป็นยังไง? ชอบอะไรใน WULING?
วันนี้พาไปฟังความรู้สึกจากลูกค้าที่ได้มาสัมผัสประสบการณ์ Test Drive รถไฟฟ้า WULING ด้วยตัวเอง
เพราะเราเชื่อว่า…
คำตอบที่ดีที่สุด ไม่ใช่แค่คำโฆษณา แต่คือประสบการณ์จากคนที่ได้ลองขับจริง 💙
ทั้งความนุ่ม เงียบ การขับขี่ และฟังก์ชันต่าง ๆ
มาฟังกันว่าหลังจากทดลองขับแล้ว ลูกค้ารู้สึกอย่างไรกับ WULING 🚙✨
ขอบคุณลูกค้าทุกท่านที่มาร่วมสัมผัสประสบการณ์กับเราในครั้งนี้นะคะ 🙏🏻💙
📍 WULING CHONBURI
⚡ PORTA EV | STARLIGHT DARION EV
#WulingChonburi #WulingTestDrive #WulingEV #TestDrive #ทดลองขับรถไฟฟ้า #รถไฟฟ้า #รถEV #StarlightDarionEV #PortaEV #รีวิวรถไฟฟ้า #เสียงจากลูกค้า', NULL, 'ttps://drive.google.com/file/d/1-074pCa_t8vxGqTtueeht5PZCeydIp4w/view?usp=sharing', 'ttps://drive.google.com/file/d/1-074pCa_t8vxGqTtueeht5PZCeydIp4w/view?usp=sharing', NULL, NULL, 'https://www.facebook.com/share/v/1JJYNwkzEP/'),
  ('P-20260814112029-1606', '2026-08-17 00:00:00', '09:00', 'Facebook', 'โพสต์ขอบคุณลูกค้าที่เข้าร่วมกิจกรรม', 'ภาพ', 'PUBLISHED', 'Frong', '💙 ขอบพระคุณลูกค้าทุกท่านจากใจ WULING Chonburi 💙

ขอบคุณที่สละเวลามาร่วมงาน **WULING TEST DRIVE EVENT** ในวันที่ **15–16 สิงหาคม** และมาร่วมสัมผัสประสบการณ์การขับขี่รถยนต์ไฟฟ้า WULING ด้วยตัวเอง 🚗⚡

ทุกการทดลองขับ ทุกคำถาม และทุกความสนใจของลูกค้า คือกำลังใจสำคัญของเรา 🥰

หวังว่าทุกท่านจะได้รับทั้งความประทับใจและประสบการณ์ดี ๆ กลับไปนะคะ

สำหรับใครที่พลาดงานครั้งนี้ ไม่ต้องเสียดาย!
สามารถติดต่อทีมงาน **WULING Chonburi** เพื่อสอบถามรายละเอียดและนัดหมายทดลองขับได้เลย 💙

📍 แล้วพบกันในกิจกรรมครั้งต่อไปนะคะ

**WULING Chonburi — ให้ทุกการเดินทางเป็นเรื่องง่ายกว่าที่คิด ⚡**

#WulingChonburi #WulingTestDrive #WulingEV #รถไฟฟ้าWuling #TestDrive #WulingThailand', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/drive/folders/17I28c2VfK4ImaNGWeQEU2dCQO699BxlC?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/p/1UFz8A79Tq/'),
  ('P-20260814112113-4943', '2026-08-16 00:00:00', '09:00', 'Facebook', 'ภาพบรรยากาศภายในงาน // ภาพรวมงาน', 'ภาพ', 'PUBLISHED', 'Forng', NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/p/14mu2R4Hb2Q/'),
  ('P-20260814112252-9095', '2026-08-31 00:00:00', '09:00', 'Facebook', 'คลิป“รถคันนี้เหมาะกับธุรกิจในยุคนี้อย่างไร”', 'วิดีโอ', 'DRAFT', 'Frong', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814113213-5292', '2026-08-21 00:00:00', '09:00', 'Facebook', 'คลิปเชิญชวนจอง Test Drive + โปรโมชั่นพิเศษ', 'วิดีโอ', 'REVIEW', 'Frong', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814113305-8282', '2026-08-18 00:00:00', '09:00', 'Facebook, TikTok', 'ทำไมWuling Chonburi ชอบจัดงานTest Drive บ่อยๆ', 'วิดีโอ', 'PUBLISHED', 'frong', '❓ ทำไม **WULING Chonburi** ถึงจัดงาน TEST DRIVE บ่อยจัง?

เพราะเราอยากให้คุณ **“ลองก่อนตัดสินใจ”** 🚗⚡

รถ EV ไม่ใช่แค่ดูจากรูปหรือฟังรีวิวแล้วจะรู้ว่าเหมาะกับเราหรือไม่
ต้องมาลองขับจริง! สัมผัสจริง! แล้วคุณจะรู้ว่า…

✨ ขับง่ายแค่ไหน
✨ นั่งสบายหรือเปล่า
✨ ฟีลลิ่งตอนขับเป็นยังไง
✨ ฟังก์ชันตอบโจทย์ชีวิตประจำวันไหม
✨ และที่สำคัญ… **เหมาะกับคุณหรือเปล่า?**

นี่แหละเหตุผลที่เราจัด **WULING TEST DRIVE EVENT** อยู่บ่อย ๆ 💙

เพราะเราอยากให้ทุกคนได้มีโอกาสสัมผัสรถ WULING ด้วยตัวเอง ก่อนตัดสินใจเป็นเจ้าของ

📅 พบกันวันที่ **22–23 สิงหาคม 2569**
📍 **คาเฟ่ ชลละมุน ศรีราชา ชลบุรี**
⏰ 09:00–18:00 น.

🎁 มาร่วมทดลองขับ พร้อมรับสิทธิพิเศษภายในงาน

**อยากรู้ว่ารถ WULING เหมาะกับคุณไหม?
คำตอบง่ายที่สุด… “มาลองขับเองเลย!”** 💙⚡

#WulingChonburi #WulingTestDrive #WulingEV #TestDrive #รถไฟฟ้าWuling #WulingThailand #ศรีราชา #ชลบุรี', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1Q8Ga6zuS-mJlTnb9k0Lr9hCJUiyUVssG/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/r/1K5XQfzrrw/'),
  ('P-20260814113354-5315', '2026-08-19 00:00:00', '09:00', 'Facebook', '🚗⚡ รถครอบครัวยุคใหม่ เริ่มต้นเพียง 839,000 บาท!', 'ภาพ', 'PUBLISHED', 'frong', NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/p/19FU6DoPyR/'),
  ('P-20260814113513-1698', '2026-08-21 00:00:00', '09:00', 'Facebook', 'Story รีวิวความรู้สึกหลังทดลองขับ', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814113607-8153', '2026-08-31 00:00:00', '09:00', 'Facebook', 'Q&A : ตอบคำถามที่ลูกค้าถามบ่อย 1–3 ข้อ', 'ภาพ', 'DRAFT', 'frong', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814113829-5961', '2026-08-22 00:00:00', '09:00', 'Facebook', 'เก็บ Footage ลูกค้า + รถ + ทีมขาย ไว้ทำคอนเทนต์ต่อ', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814113908-5964', '2026-08-23 00:00:00', '09:00', 'TikTok', 'บรรยากาศ Test Drive', 'ภาพ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260814131920-5484', '2026-08-15 00:00:00', '09:00', 'Facebook, TikTok', 'SHORT - ภาพบรรยากาศ งาน TEST DRIVE', 'วิดีโอ', 'PUBLISHED', 'FRONG', '🚗⚡️ **บรรยากาศวันแรกของ WULING TEST DRIVE EVENT มาแล้ว!**

วันนี้บอกเลยว่าคึกคักมาก 💙
ลูกค้าแวะมาสัมผัสรถไฟฟ้า WULING ตัวจริง พร้อมทดลองขับและพูดคุยกับทีมงานอย่างใกล้ชิด

✨ ได้ลองขับจริง
✨ ได้สัมผัสเทคโนโลยี EV
✨ ได้สอบถามข้อมูลและโปรโมชั่นพิเศษภายในงาน

ใครกำลังมองหารถ EV อยู่ อย่าเพิ่งตัดสินใจจากแค่รูปหรือรีวิว… **มาลองขับด้วยตัวเอง แล้วคุณจะรู้ว่า WULING เหมาะกับคุณแค่ไหน!** ⚡️

📍 Good Barista & Coffee Beans
📅 14–15 สิงหาคม 2569
⏰ 10.00–18.00 น.

**งานยังมีพรุ่งนี้อีก 1 วันนะคะ 💙 แวะมาทดลองขับกันได้เลย!**

#WulingChonburi #WulingTestDrive #TestDriveEvent #WulingEV #รถไฟฟ้าWuling #รถEV #ทดลองขับ #รถไฟฟ้าชลบุรี', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1oH4XoF1WC1-DKoYf6zmJqCWZF4gzvkNU/view?usp=drivesdk', NULL, NULL, 'https://www.facebook.com/share/r/1H9HS2wjDW/'),
  ('P-20260814132536-6867', '2026-08-16 00:00:00', '09:00', 'Facebook, TikTok', 'SHORT - ภาพบรรยากาศ งาน TEST DRIVE', 'ภาพ', 'PUBLISHED', 'panpan14158@gmail.com', '🔥 EVENT เริ่มแล้ว ใครอยู่ "ฉะเชิงเทรา" และ พื้นที่ใกล้เคียง
🌟 WULING TEST DRIVE EVENT ครั้งที่ 8
🌟 ทดลองขับรถ EV ตัวจริงกับเราได้เลย !
.
🔥 WULING TEST DRIVE EVENT #8
.
📅 วันที่ 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans
.
LOCATION : https://maps.app.goo.gl/YL6EGTUg3Mue3yFk9
.
มาสัมผัส WULING แบบใกล้ชิด พร้อมทดลองขับบนเส้นทางจริง
ลองทั้งการขับขี่ ความสะดวกสบาย และพื้นที่ใช้งาน ก่อนตัดสินใจเลือกรถที่เหมาะกับคุณ
.
🚗 ภายในงานพบกับ
.
✨ WULING Starlight Darion EV
รถ MPV ไฟฟ้า 7 ที่นั่ง สำหรับครอบครัว
.
✨ WULING Porta EV
รถตู้ไฟฟ้าสำหรับธุรกิจ ขนของ และการใช้งานในชีวิตประจำวัน
.
พร้อมสิทธิพิเศษภายในงาน
.
🎁 ของที่ระลึกสำหรับผู้ลงทะเบียน
☕ คูปองเครื่องดื่มฟรีสำหรับครอบครัว
🔥 โปรโมชั่นพิเศษเฉพาะภายในงาน
🚗 ทดลองขับ Darion EV และ Porta EV ฟรี!
.
📩 **ลงทะเบียนล่วงหน้าได้แล้ววันนี้**
.
แล้วพบกัน
📅 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans**
.
สนใจทดลองขับ / สอบถามโปรโมชั่น
ทักแชทหาเราได้เลย
.
📞 ติดต่อฝ่ายขาย
082 324 7915
081 160 4965
.
WULING CHONBURI
พาคุณมาสัมผัสรถจริง ทดลองขับจริง ก่อนตัดสินใจ', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1t1dhEix91nSu8Pl9DbTq3kBxq2TRvElX/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/p/1FEZcc54bn/'),
  ('P-20260814135430-4906', '2026-08-24 00:00:00', '09:00', 'Facebook', '" ทำไม WULING CHONBURI ชอบจัดงาน TEST DRIVE ? "', 'วิดีโอ', 'PUBLISHED', 'panpan14158@gmail.com', '🎤 เสียงจากลูกค้าหลังได้ลองขับจริง!
🚗⚡ ลองแล้วเป็นยังไง? ชอบอะไรใน WULING?
วันนี้พาไปฟังความรู้สึกจากลูกค้าที่ได้มาสัมผัสประสบการณ์ Test Drive รถไฟฟ้า WULING ด้วยตัวเอง
เพราะเราเชื่อว่า…
คำตอบที่ดีที่สุด ไม่ใช่แค่คำโฆษณา แต่คือประสบการณ์จากคนที่ได้ลองขับจริง 💙
ทั้งความนุ่ม เงียบ การขับขี่ และฟังก์ชันต่าง ๆ
มาฟังกันว่าหลังจากทดลองขับแล้ว ลูกค้ารู้สึกอย่างไรกับ WULING 🚙✨
ขอบคุณลูกค้าทุกท่านที่มาร่วมสัมผัสประสบการณ์กับเราในครั้งนี้นะคะ 🙏🏻💙
📍 WULING CHONBURI
⚡ PORTA EV | STARLIGHT DARION EV
#WulingChonburi #WulingTestDrive #WulingEV #TestDrive #ทดลองขับรถไฟฟ้า #รถไฟฟ้า #รถEV #StarlightDarionEV #PortaEV #รีวิวรถไฟฟ้า #เสียงจากลูกค้า', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1ecuedyo9Ju7dBoT6QJ3hvlZ2RTFeNKQw/view', NULL, NULL, 'https://www.facebook.com/share/v/1EsL8AhMbE/'),
  ('P-20260821161941-3081', '2026-08-24 00:00:00', '09:00', 'Facebook, TikTok', 'คลิป “3 เหตุผลที่คนมีครอบครัวควรลองขับ DARION EV”', 'วิดีโอ', 'PUBLISHED', NULL, '### 3 เหตุผลที่ควรมี STARLIGHT DARION EV 🚙✨

เพราะรถครอบครัวยุคใหม่…ต้องตอบโจทย์มากกว่าแค่ “พาไปถึง” 💙

1️⃣ **พื้นที่กว้าง นั่งสบาย** — รองรับการเดินทางของครอบครัวได้อย่างลงตัว
2️⃣ **ขับเคลื่อนด้วยพลังงานไฟฟ้า 100%** — ประหยัดค่าใช้จ่ายในการเดินทาง พร้อมความเงียบและนุ่มนวล
3️⃣ **วิ่งไกลสูงสุด 540 กม./ชาร์จ** — เดินทางไกลได้อย่างมั่นใจ ไม่ต้องแวะชาร์จบ่อย

✨ เปลี่ยนทุกการเดินทางให้สะดวก สบาย และคุ้มค่ากว่าเดิม
**STARLIGHT DARION EV — รถไฟฟ้าสำหรับครอบครัวยุคใหม่**

📩 สนใจรายละเอียด / นัดชมรถ / ทดลองขับ ทักหาเราได้เลย

#WULING #STARLIGHTDARIONEV #DARIONEV #รถไฟฟ้า #รถครอบครัว #รถEV #รถไฟฟ้าครอบครัว #WulingChonburi', NULL, 'https://drive.google.com/drive/folders/1yiBLYDPHyMss46qCMM7jleFeRx4ozXs8?usp=drive_link', 'https://drive.google.com/file/d/1yaILx3fBnY5V1J4rQGBGweun93gHhSt0/view?usp=drive_link', NULL, NULL, NULL),
  ('P-20260821162043-3046', '2026-08-26 00:00:00', '09:00', 'Facebook, TikTok', '🎤 “ถามคนที่ลองขับจริง!” ใช้ฟุตเทจจากงาน Test Drive วันที่ 22–23 ส.ค. ถามสั้น ๆ', 'วิดีโอ', 'PUBLISHED', NULL, '🎤 เสียงจากลูกค้าหลังได้ลองขับจริง!
🚗⚡ ลองแล้วเป็นยังไง? ชอบอะไรใน WULING?
วันนี้พาไปฟังความรู้สึกจากลูกค้าที่ได้มาสัมผัสประสบการณ์ Test Drive รถไฟฟ้า WULING ด้วยตัวเอง
เพราะเราเชื่อว่า…
คำตอบที่ดีที่สุด ไม่ใช่แค่คำโฆษณา แต่คือประสบการณ์จากคนที่ได้ลองขับจริง 💙
ทั้งความนุ่ม เงียบ การขับขี่ และฟังก์ชันต่าง ๆ
มาฟังกันว่าหลังจากทดลองขับแล้ว ลูกค้ารู้สึกอย่างไรกับ WULING 🚙✨
ขอบคุณลูกค้าทุกท่านที่มาร่วมสัมผัสประสบการณ์กับเราในครั้งนี้นะคะ 🙏🏻💙
📍 WULING CHONBURI
⚡ PORTA EV | STARLIGHT DARION EV
#WulingChonburi #WulingTestDrive #WulingEV #TestDrive #ทดลองขับรถไฟฟ้า #รถไฟฟ้า #รถEV #StarlightDarionEV #PortaEV #รีวิวรถไฟฟ้า #เสียงจากลูกค้า', NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/v/1BSSduprh2/'),
  ('P-20260821162308-9895', '2026-08-28 00:00:00', '09:00', 'Facebook', 'คลิปแนว Luxury Walkaround ดีไซต์รถ ฟังก์ชั่น', 'วิดีโอ', 'APPROVED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260821163106-4886', '2026-08-25 00:00:00', '09:00', 'Facebook', 'Q&A Series: STARLIGHT DARION EV', 'วิดีโอ', 'PUBLISHED', NULL, '💬 **Q&A : STARLIGHT DARION EV** ⚡🚙
คำถามที่หลายคนสงสัยเกี่ยวกับรถไฟฟ้าสำหรับครอบครัว…มีคำตอบให้แล้ว! 👀✨

ไม่ว่าจะเป็นเรื่อง **พื้นที่ภายใน | ระยะทางต่อการชาร์จ | ความสะดวกในการขับขี่**
DARION EV ถูกออกแบบมาให้ตอบโจทย์การเดินทางของครอบครัวยุคใหม่ 💙

📌 เลื่อนดูโพสต์ แล้วมาดูกันว่า **DARION EV มีอะไรที่คุณยังไม่รู้?**

สนใจ DARION EV หรืออยากนัดชมรถ/ทดลองขับ
📩 ทักหาเราได้เลย!

#WULING #STARLIGHTDARIONEV #DARIONEV #รถไฟฟ้า #รถครอบครัว #WULINGEV #QandA', NULL, 'https://drive.google.com/drive/folders/1yiBLYDPHyMss46qCMM7jleFeRx4ozXs8?usp=drive_link', 'https://drive.google.com/file/d/1sMemJkXbuotR6-KgJQTyOGtAFmZYSzXS/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/r/1FR95NrdSr/'),
  ('P-20260821163157-5012', '2026-08-24 00:00:00', '09:00', 'Facebook', 'ภาพบรรยากาศงานTest Drive', 'ภาพ', 'PUBLISHED', NULL, '💙 ขอบคุณทุกความไว้วางใจที่เกิดขึ้นในงาน WULING TEST DRIVE
จบลงไปแล้วกับบรรยากาศสุดประทับใจในงาน WULING TEST DRIVE
📍 ชลละมุน ศรีราชา ชลบุรี
📅 วันที่ 22–23 สิงหาคม 2569
ขอขอบคุณลูกค้าทุกท่านและทุกครอบครัวที่สละเวลามาร่วมทดลองขับ
ได้สัมผัสประสบการณ์รถไฟฟ้า WULING กันแบบใกล้ชิด 🚗⚡
ทุกคำถาม ทุกความคิดเห็น และทุกการทดลองขับ
คือกำลังใจสำคัญของทีมงาน WULING ชลบุรี 💙
หวังว่าเราจะได้มีโอกาสต้อนรับทุกท่านอีกครั้งในกิจกรรมครั้งต่อไปนะคะ
แล้วพบกันใหม่ในกิจกรรมหน้า! 🥰
#WULINGChonburi #WULING #WULINGTestDrive #TestDrive #DARIONEV #PORTAEV #รถไฟฟ้า #รถครอบครัว #รถEV', NULL, 'https://drive.google.com/drive/folders/1yiBLYDPHyMss46qCMM7jleFeRx4ozXs8?usp=drive_link', 'https://drive.google.com/drive/folders/1mm6rhj-PwUFd53MtTR4o1-Go9S_1o80h?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/p/1DefbF291V/'),
  ('P-20260821163901-7164', '2026-08-29 00:00:00', '09:00', 'Facebook', '“3 อย่างที่ทำให้ชีวิตดีขึ้น เมื่อมี STARLIGHT DARION EV”', 'ภาพ', 'APPROVED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260821164031-2378', '2026-08-27 00:00:00', '09:00', 'Facebook', '“5 เรื่องที่ควรรู้ก่อนซื้อรถ EV”', 'วิดีโอ', 'PUBLISHED', NULL, '🚗⚡️ **5 ข้อควรรู้ ก่อนมีรถ EV!**

กำลังลังเลจะเปลี่ยนมาใช้รถไฟฟ้า แต่ยังมีคำถามอยู่ในใจ? 🤔
คลิปนี้รวม 5 เรื่องสำคัญที่ควรรู้ก่อนตัดสินใจ ตั้งแต่การชาร์จ ค่าใช้จ่าย ไปจนถึงการดูแลแบตเตอรี่ 🔋

ดูให้จบ แล้วคุณจะรู้ว่า… **EV เหมาะกับไลฟ์สไตล์ของคุณแค่ไหน?** 💙

📌 เซฟคลิปนี้ไว้ดู ก่อนตัดสินใจเลือกรถ EV คันแรกของคุณ!

#WULING #WulingEV #รถไฟฟ้า #รถEV #รถยนต์ไฟฟ้า #EV #รถไฟฟ้าชลบุรี #Wulingชลบุรี #5ข้อควรรู้ก่อนซื้อEV', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1J3CN8zJjGmdt7fVqpfri_jZmzQF1-KfF/view?usp=drive_link', NULL, NULL, NULL),
  ('P-20260823153452-7075', '2026-08-26 00:00:00', '09:00', 'Facebook', 'ภาพส่งมอบรถ WULING porta & darion', 'ภาพ', 'PUBLISHED', NULL, '❤️ ส่งมอบ PORTA EV และ ยินดีต้อนรับ ผู้ประกอบการยุคใหม่  ⚡⚡
สู่ครอบครัวของเรา WULING CHONBURI ❤️
.
ขอให้กิจการรุ่งเรืองๆ ทำมาค้าขึ้น เฮงๆ รวยๆ ทุกท่านครับ 
.
PORTA EV ⚡ถูกกว่า ประหยัดกว่า 
นัดรับจองถึงบ้าน แล้ววันนี้ !
.
รถตู้พลังงานไฟฟ้า 100%
เปลี่ยน “ค่าน้ำมัน” ให้กลายเป็น “กำไร” ทุกการวิ่ง 🚐
คุ้มตั้งแต่วันแรกที่ขับ
.
💸 ราคาเพียง 629,000.-
🔋 รับประกันแบตเตอรี่ 5 ปี / 200,000 กม.
🚗 รับประกันตัวรถ 3 ปี / 100,000 กม.
ถึงเวลาที่ธุรกิจต้องอัปเกรด!
.
ประหยัดกว่า วิ่งได้ไกลกว่า และดูทันสมัยกว่า
🔥 เปิดรับจองแล้ววันนี้ WURING CHONBURI
ทักแชทเพื่อสอบถามรายละเอียด
ติดต่อฝ่ายขาย : 082 324 7915', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/drive/folders/1zarceFm8XzWcMnkdWi7EHNLGAAAsZm7y?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/p/1D7gQNNjhF/'),
  ('P-20260824170253-8901', '2026-08-24 00:00:00', '09:00', 'Facebook', 'เช็คระยะแล้วหรือยัง', 'ภาพ', 'PUBLISHED', NULL, NULL, NULL, NULL, 'https://drive.google.com/file/d/1T3B5h8Q53qZ3YdZuzJ7l5_zZHq8VuBYN/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/p/1MWo6D9uwn/'),
  ('P-20260830143654-3362', '2026-09-04 00:00:00', '09:00', 'Facebook, TikTok', 'ส่งมอบรถธุรกิจส่งผัก', 'วิดีโอ', 'PUBLISHED', NULL, '🥬🚚 ส่งมอบความคล่องตัวให้ธุรกิจผักไฮโดรโปนิกส์
อีกหนึ่งความไว้วางใจจากลูกค้าธุรกิจ ที่เลือก WULING PORTA EV เป็นผู้ช่วยคู่ใจในการขนส่งผักไฮโดรโปนิกส์ 🌱⚡
เพราะธุรกิจที่ต้องส่งของทุกวัน…การมีรถที่พร้อมใช้งาน คล่องตัว และช่วยควบคุมต้นทุนการเดินทาง ก็เป็นอีกหนึ่งตัวช่วยสำคัญในการเดินหน้าธุรกิจ 💚
ขอขอบคุณลูกค้าที่ไว้วางใจ WULING PORTA EV
ให้เราได้เป็นส่วนหนึ่งในการเติบโตของธุรกิจนะคะ 🙏✨
PORTA EV — รถไฟฟ้าเพื่อธุรกิจยุคใหม่
⚡ ขับเคลื่อนธุรกิจให้ไปได้ไกลกว่าเดิม
#WulingPortaEV #WulingChonburi #รถไฟฟ้าเพื่อธุรกิจ #รถไฟฟ้าเชิงพาณิชย์ #รถส่งของ #ธุรกิจผักไฮโดรโปนิกส์ #Hydroponic #ส่งมอบรถ #Wuling', NULL, 'https://drive.google.com/drive/folders/1mXnQvnHvSxXh7rGMRx_yIRQShjS2J4L7?usp=drive_link', 'https://drive.google.com/file/d/1ZVPxzEBV2xjlv8TSsZX-9SL2qy7pGS7V/view', NULL, NULL, 'https://www.facebook.com/share/r/18CrYoFSEi/'),
  ('P-20260830143857-1950', '2026-09-01 00:00:00', '09:00', 'Facebook', 'คลิปสั้นมีมตลก Pov:รถไฟฟ้าประหยัด', 'วิดีโอ', 'PUBLISHED', NULL, 'รถไฟฟ้าประหยัดไหม?
ประหยัดจนสงสัย…แล้วเงินหายไปไหนหมด 🤣💸
#WulingPortaEV #WulingChonburi #รถไฟฟ้าเพื่อธุรกิจ #รถไฟฟ้าเชิงพาณิชย์ #รถส่งของ #ธุรกิจผักไฮโดรโปนิกส์ #Hydroponic #ส่งมอบรถ #Wuling', NULL, NULL, 'https://drive.google.com/file/d/1h9PeuX4QRTKu-a5tOYeglnIskACmtA-f/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/r/19iCKn2nnY/'),
  ('P-20260903092330-5944', '2026-09-15 00:00:00', '09:00', 'Facebook', 'รถ Porta เหมาะกับธุรกิจในยุคนี้อย่างไร', 'วิดีโอ', 'PUBLISHED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/r/19M96qNDjD/'),
  ('P-20260903092530-6286', '2026-09-06 00:00:00', '09:00', 'Facebook', 'โปรโมชั่นกันยายน porta EV', 'วิดีโอ', 'PUBLISHED', NULL, '🚚 ธุรกิจยุคนี้…ต้องลดต้นทุนให้เป็น!
เปลี่ยนจากรถน้ำมัน มาเป็น WULING PORTA EV⚡
ให้ทุกการขนส่งคุ้มค่ามากขึ้น พร้อมตอบโจทย์ธุรกิจที่ต้องวิ่งงานทุกวัน
🔥 โปรโมชั่นพิเศษ
✨ Roadside Assistance นานสุด 3 ปี
✨ ฟรีประกันภัย
✨ Wall Charger ราคาพิเศษ จาก 25,000.- เหลือเพียง 10,000.-
ไม่ว่าจะส่งของ ส่งสินค้า หรือวิ่งงานทุกวัน
ถึงเวลามองหารถที่ช่วยให้ธุรกิจไปต่อได้แบบคุ้มกว่า 💙
📩 สนใจ PORTA EV ทักแชตหาเราได้เลย
#WulingPortaEV #WulingChonburi #รถไฟฟ้าเพื่อธุรกิจ #รถEVเพื่อธุรกิจ #ลดต้นทุนธุรกิจ #Wuling', NULL, NULL, 'https://drive.google.com/file/d/1KPOIpquf56LKNyp4f_t1hlcTuYdAtdBd/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/r/1HcHn83pgh/'),
  ('P-20260903153119-7845', '2026-09-11 00:00:00', '09:00', 'Facebook', 'ENENT TEST DRIVE #10 HWH.SRI', 'ภาพ', 'APPROVED', 'panpan14158@gmail.com', NULL, 'Test Drive', NULL, NULL, NULL, NULL, NULL),
  ('P-20260903153151-8671', '2026-09-12 00:00:00', '09:00', 'Facebook, Instagram, TikTok', 'ENENT TEST DRIVE #10 HWH.SRI', 'ภาพ', 'APPROVED', 'panpan14158@gmail.com', NULL, 'Test Drive', NULL, NULL, NULL, NULL, NULL),
  ('P-20260903153239-8868', '2026-09-13 00:00:00', '09:00', 'Facebook, Instagram, TikTok', 'ENENT TEST DRIVE #10 HWH.SRI', 'ภาพ', 'APPROVED', 'panpan14158@gmail.com', NULL, 'Test Drive', NULL, NULL, NULL, NULL, NULL),
  ('P-20260905144010-8572', '2026-09-05 00:00:00', '09:00', 'Facebook', 'เชิญชวน เข้าร่วม EVENT TEST DRIVE ครั้งที่ 10', 'วิดีโอ', 'PUBLISHED', NULL, '🏖️ EVENT TEST DRIVE ชลบุรี มาแล้วจ้าาาาา 🚗⚡️
มาทดลองขับ WULING กันที่ชลบุรีกับเรา
WULING CHONBURI TEST DRIVE EVENT #10
📅 วันที่ 10-12 กันยายน 2569
📍https://maps.app.goo.gl/8xoZniq41guCsVoM9 
นี่คือโอกาสที่จะได้สัมผัสรถ WULING ตัวจริง ทดลองขับบนเส้นทางจริง และพูดคุยกับทีมงานแบบใกล้ชิด 💙
ภายในงานรับ
🎁 ของที่ระลึกสำหรับผู้ลงทะเบียน
☕ คูปองเครื่องดื่ม/สิทธิพิเศษภายในงาน
🔥 โปรโมชั่นพิเศษเฉพาะภายในงาน
🚗 ทดลองขับ **STARLIGHT DARION EV และ PORTA EV**
📩 ลงทะเบียนล่วงหน้าได้แล้ววันนี้
แล้วพบกันที่ **HARDWAY HOUSE ศรีราชา**
มาลองขับจริง แล้วเลือกคันที่ใช่สำหรับคุณ! 💙
LOCATION : **HARDWAY HOUSE ศรีราชา**
🔥 เปิดรับจองแล้ววันนี้ **WULING CHONBURI**
ทักแชทเพื่อสอบถามรายละเอียด
📞 ติดต่อฝ่ายขาย : 082 324 7915 , 081 160 496
#WulingChonburi #WulingTestDrive #TestDriveครั้งที่10 #WulingEV #StarlightDarionEV #PortaEV #รถไฟฟ้า #รถไฟฟ้าชลบุรี #ศรีราชา', NULL, NULL, 'https://drive.google.com/file/d/189UFs1-85sBVQhJWoGjd8iXq4R7dS9aq/view?usp=drive_link', NULL, NULL, NULL),
  ('P-20260905144732-4129', '2026-09-06 00:00:00', '09:00', 'Facebook', 'ส่งมอบรถ Porta 5 คัน ชำชำ ออนไลน์', 'วิดีโอ', 'PUBLISHED', NULL, '🚚⚡️ ส่งมอบความสำเร็จแบบจัดเต็ม! 5 คันรวด 🎉

ขอขอบพระคุณลูกค้าที่ไว้วางใจเลือก WULING PORTA EV ให้เป็นส่วนหนึ่งในการขับเคลื่อนธุรกิจ 💙

5 คันในครั้งเดียว!
พร้อมลุย พร้อมส่ง พร้อมสร้างโอกาสให้ธุรกิจเติบโตไปอีกขั้น 📦✨

เพราะรถที่ดี…ไม่ใช่แค่พาเราไปถึงจุดหมาย
แต่ต้องช่วยให้ “ธุรกิจไปได้ไกลกว่าเดิม” ⚡️

สนใจ PORTA EV สำหรับธุรกิจ
ทักหาเราได้เลย 📩
#WulingPortaEV #WulingChonburi #รถไฟฟ้าเพื่อธุรกิจ #รถไฟฟ้า #ส่งมอบรถ #EVForBusiness', NULL, NULL, 'https://drive.google.com/file/d/13M9BCaEVOiaV6CJvLC7FgXJEJEISSMjL/view?usp=drive_link', NULL, NULL, 'https://www.facebook.com/share/r/1Ej9J7Ee4z/'),
  ('P-20260906153927-2551', '2026-09-08 00:00:00', '09:00', 'Facebook, TikTok', 'คลิปความรู้สึกของลูกค้าที่ใช้จริง รับรถไปแล้ว 3 เดือน', 'วิดีโอ', 'PUBLISHED', NULL, '🚗💙 เสียงจากคนใช้จริง… DARION EV เป็นยังไง?
ไม่ต้องเชื่อจากโฆษณา มาฟังจากประสบการณ์ของลูกค้าที่เลือกใช้ WULING STARLIGHT DARION EV กันจริง ๆ ✨
ทั้งเรื่องความสบายในการขับ การใช้งานในชีวิตประจำวัน และความรู้สึกหลังได้ลองใช้จริง
อะไรคือเหตุผลที่ทำให้ตัดสินใจเลือก DARION EV? 👀
🎥 ดูให้จบ แล้วคุณอาจได้คำตอบว่า
DARION EV เหมาะกับเราไหม?
#Wuling #WulingDarion #DarionEV #StarlightDarion #รถไฟฟ้า #รถEV #รีวิวรถไฟฟ้า #ใช้จริงรีวิวจริง #ลูกค้าใช้จริง #WulingChonburi', NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/r/19JkY1yU1i/'),
  ('P-20260906154104-9864', '2026-09-29 00:00:00', '09:00', 'Facebook', 'พาชมระบบในห้องโดยสาร Darion มีฟังก์ชั่นอะไรบ้าง', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260906154653-8528', '2026-09-07 00:00:00', '09:00', 'Facebook, TikTok', 'คลิป มีมสั้นๆ ทุกปัญหามีทางออกเสมอ', 'วิดีโอ', 'PUBLISHED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.tiktok.com/@wuling_chonburi/video/7682713331244862721?is_from_webapp=1&sender_device=pc'),
  ('P-20260906160532-6386', '2026-09-11 00:00:00', '09:00', 'Facebook', 'บรรยากาศงานวันแรก', 'วิดีโอ', 'PUBLISHED', NULL, '🚗⚡ TEST DRIVE ครั้งที่ 10 เริ่มแล้ว!
วันนี้พาทุกคนมาสัมผัสประสบการณ์ขับจริง ทดลองจริง กับรถไฟฟ้า Wuling ที่ HardwareHouse ศรีราชา 💙
ไม่ว่าจะเป็น
✨ Starlight Darion EV รถครอบครัว 7 ที่นั่ง
⚡ Porta EV รถไฟฟ้าคู่ใจสำหรับธุรกิจ
แวะมาทดลองขับ พร้อมพูดคุยกับทีมงาน Wuling Chonburi ได้เลยค่ะ
📍 HardwareHouse ศรีราชา
📅 11–13 กันยายน 2569
⏰ 09:00–18:00 น.
อยากรู้ว่าคันไหนเหมาะกับคุณ ต้องมาลองขับเองแล้ว! 🥰
#WulingChonburi #Wuling #TestDriveครั้งที่10 #StarlightDarionEV #PortaEV #รถไฟฟ้า #ทดลองขับ #HardwareHouseศรีราชา #รถครอบครัว #รถไฟฟ้าเพื่อธุรกิจ', NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/r/1HghBx1ukc/'),
  ('P-20260906160622-7652', '2026-09-13 00:00:00', '09:00', 'Facebook', 'ภาพรวมงานทั้ง 3 วัน + โพสขอบคุณ', 'ภาพ', 'PUBLISHED', NULL, 'ขอบคุณลูกค้าทุกท่านที่ให้ความสนใจและเข้าร่วมงาน Test Drive ครั้งที่ 10 🚗⚡
ณ Hardwarehouse ศรีราชา
ขอบคุณสำหรับทุกการพูดคุย ทุกคำถาม และทุกความไว้วางใจที่มีให้กับ Wuling Chonburi 🙏🏻💙
หวังว่าทุกท่านจะได้รับประสบการณ์ดี ๆ และได้พบกับรถที่ตอบโจทย์ไลฟ์สไตล์และธุรกิจของคุณ
แล้วพบกันใหม่ในกิจกรรมครั้งต่อไปนะคะ 💙✨
#WulingChonburi #Wuling #TestDrive #TestDriveครั้งที่10 #Hardwarehouseศรีราชา #WulingEV #รถไฟฟ้า #ขอบคุณลูกค้าทุกท่าน', NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/p/1G5JPMAzR5/'),
  ('P-20260906160828-9314', '2026-09-14 00:00:00', '09:00', 'Facebook', 'ลงคลิปส่งมอบรถ porta บริษัท Sun vending', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260908090310-9212', '2026-09-17 00:00:00', '09:00', 'Facebook', 'รับแก้ปัญหาตู้หลัง Porta ของธุรกิจซักผ้า', 'ภาพ', 'PUBLISHED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/v/1DpBQWHGDG/'),
  ('P-20260908144551-4585', '2026-09-09 00:00:00', '09:00', 'Facebook', 'พื้นที่ภายในห้องโดยสาร', 'ภาพ', 'PUBLISHED', NULL, '🚗💨ทริปครอบครัวจะสนุกขึ้น
เมื่อทุกคนมีที่นั่งสบาย และสัมภาระก็มีพื้นที่ของตัวเอง 🤎
DARION EV พร้อมพาทุกความสุขออกเดินทาง🧳🌴
-----------------------------------------------------------------
#Wuling #WulingChonburi #WulingThailand #StarlightDarionEV #DarionEV #DARION #รถไฟฟ้า #รถยนต์ไฟฟ้า #รถไฟฟ้า7ที่นั่ง #รถครอบครัว #รถครอบครัวไฟฟ้า #พื้นที่กว้างขวาง #พื้นที่เก็บของ #สายเที่ยว #รถเที่ยวครอบครัว #EVThailand #Chonburi #ชลบุรี', NULL, NULL, NULL, NULL, NULL, 'https://www.facebook.com/share/p/1EbMLSsLfF/'),
  ('P-20260908145026-8451', '2026-09-08 00:00:00', '09:00', 'TikTok', 'คอนเท้นตลก ทำงานหนักจะเป็นบ้าจริง', 'วิดีโอ', 'PUBLISHED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260918095551-3282', '2026-09-28 00:00:00', '09:00', 'Facebook', 'Q&A EP.2 // 3คำถามเกี่ยวกับ Starlight Darion', 'ภาพ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260921113256-3908', '2026-09-21 00:00:00', '09:00', 'Facebook', 'คลิปเชิญชวนเข้าร่วมงาน Test Drive 26-28', 'วิดีโอ', 'PUBLISHED', NULL, 'ชวนทุกคนมาสัมผัสประสบการณ์ WULING TEST DRIVE
พร้อมแวะจิบกาแฟ กินของอร่อยที่ Wizdom by เชฟลูกแพร์ ☕✨
🚗 ทดลองขับรถ Wuling รุ่นที่สนใจ
⚡ สัมผัสสมรรถนะรถไฟฟ้าด้วยตัวเอง
🍰 เพลิดเพลินกับบรรยากาศคาเฟ่
🎁 พร้อมสิทธิพิเศษภายในงาน
📅 26–28 ก.ย. 2569
📍 Wizdom by เชฟลูกแพร์
https://maps.app.goo.gl/nsSv4djdSZoHLXaM7?g_st=ic
ไม่ต้องฟังจากใคร…มาลองขับเอง แล้วจะรู้ว่า Wuling คันไหนที่ใช่สำหรับคุณ 💙
แล้วเจอกันที่งาน Test Drive! 🚙⚡
#WulingChonburi #WulingTestDrive #TestDrive #WizdomByเชฟลูกแพร์ #รถไฟฟ้าWuling #WulingEV #ทดลองขับ #รถไฟฟ้าชลบุรี', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260921135103-3895', '2026-09-21 00:00:00', '09:00', 'Facebook', 'เชิญร่วมงาน Test Drivr', 'ภาพ', 'PUBLISHED', NULL, '💖ชวนทุกคนมาสัมผัสประสบการณ์ WULING TEST DRIVE
พร้อมแวะจิบกาแฟ กินของอร่อยที่ Wizdom by เชฟลูกแพร์ ☕✨
🚗 ทดลองขับรถ Wuling รุ่นที่สนใจ
⚡ สัมผัสสมรรถนะรถไฟฟ้าด้วยตัวเอง
🍰 เพลิดเพลินกับบรรยากาศคาเฟ่
🎁 พร้อมสิทธิพิเศษภายในงาน
📅 26–28 ก.ย. 2569
📍 Wizdom by เชฟลูกแพร์
https://maps.app.goo.gl/nsSv4djdSZoHLXaM7?g_st=ic
ไม่ต้องฟังจากใคร…มาลองขับเอง แล้วจะรู้ว่า Wuling คันไหนที่ใช่สำหรับคุณ 💙
แล้วเจอกันที่งาน Test Drive! 🚙⚡
#WulingChonburi #WulingTestDrive #TestDrive #WizdomByเชฟลูกแพร์ #รถไฟฟ้าWuling #WulingEV #ทดลองขับ #รถไฟฟ้าชลบุรี', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922111644-6429', '2026-09-22 00:00:00', '09:00', 'Facebook', 'พบกับ WULING EKSION EV ⚡️', 'วิดีโอ', 'PUBLISHED', NULL, 'พบกับ WULING EKSION EV ⚡️
SUV ไฟฟ้า 100% ที่ออกแบบมาเพื่อคนยุคใหม่
ทั้งดีไซน์โดดเด่น พื้นที่กว้างขวาง และพลังการขับขี่ที่พร้อมพาคุณไปได้ไกลกว่าเดิม
⚡️ EV 100%
👨‍👩‍👧‍👦 7 ที่นั่ง
💪 150 kW | 310 Nm
🔋 แบตเตอรี่ 69.2 kWh
นี่ไม่ใช่แค่รถคันใหม่…
แต่คืออีกหนึ่งก้าวของการเดินทางในแบบที่เป็นคุณ
WULING EKSION EV
เปิดประสบการณ์ใหม่ของ SUV ไฟฟ้า 7 ที่นั่ง ✨
📍 พบกับ EKSION EV ได้ที่ Wuling Chonburi
#WulingEKSIONEV #EKSIONEV #WulingChonburi #WulingThailand #รถไฟฟ้า100เปอร์เซ็นต์ #SUVไฟฟ้า #รถไฟฟ้า7ที่นั่ง', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922111912-5628', '2026-09-21 00:00:00', '09:00', 'Facebook', 'เตรียมพบกับ Wuling Eksion EV ในอีก 7 วัน', 'ภาพ', 'PUBLISHED', NULL, 'เตรียมพบกับ Wuling Eksion EV ในอีก 7 วัน🎊
นับถอยหลังสู่การเปิดตัว Wuling Eksion EV อย่างเป็นทางการในประเทศไทย
เตรียมพบกันเร็ว ๆ นี้！
#WulingEksion #WulingThailand #GOBIGGOEKSION #รถไฟฟ้า #รถSUVไฟฟ้า #รถ7ที่นั่ง #รถใหม่มาแล้ว', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922112033-3739', '2026-09-20 00:00:00', '09:00', 'Facebook', '💖ชวนทุกคนมาสัมผัสประสบการณ์ WULING TEST DRIVE', 'ภาพ', 'PUBLISHED', NULL, '💖ชวนทุกคนมาสัมผัสประสบการณ์ WULING TEST DRIVE
พร้อมแวะจิบกาแฟ กินของอร่อยที่ Wizdom by เชฟลูกแพร์ ☕✨
🚗 ทดลองขับรถ Wuling รุ่นที่สนใจ
⚡ สัมผัสสมรรถนะรถไฟฟ้าด้วยตัวเอง
🍰 เพลิดเพลินกับบรรยากาศคาเฟ่
🎁 พร้อมสิทธิพิเศษภายในงาน
📅 26–28 ก.ย. 2569
📍 Wizdom by เชฟลูกแพร์
https://maps.app.goo.gl/nsSv4djdSZoHLXaM7?g_st=ic
ไม่ต้องฟังจากใคร…มาลองขับเอง แล้วจะรู้ว่า Wuling คันไหนที่ใช่สำหรับคุณ 💙
แล้วเจอกันที่งาน Test Drive! 🚙⚡
#WulingChonburi #WulingTestDrive #TestDrive #WizdomByเชฟลูกแพร์ #รถไฟฟ้าWuling #WulingEV #ทดลองขับ #รถไฟฟ้าชลบุรี', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922112328-9700', '2026-09-22 00:00:00', '09:00', 'TikTok', 'ทรงช่างที่เธอใฝ่ฝัน คงไม่ใช่ฉันที่เป็นอยู่', 'วิดีโอ', 'PUBLISHED', NULL, 'ทรงช่างที่เธอใฝ่ฝัน คงไม่ใช่ฉันที่เป็นอยู่', NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922112430-7631', '2026-09-26 00:00:00', '09:00', 'Facebook, TikTok', 'Test Drive', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922112505-4917', '2026-09-27 00:00:00', '09:00', 'Facebook', 'Test Drive', 'ภาพ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922112539-3041', '2026-09-28 00:00:00', '09:00', 'Facebook', 'Test Drive', 'ภาพ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922113654-1485', '2026-09-24 00:00:00', '09:00', 'Facebook', 'ทดลองขับได้แล้วครั้งแรก', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922114343-3151', '2026-09-25 00:00:00', '09:00', 'Facebook', '“รีวิว Wuling EKSION EV — พิเศษยังไง?”', 'วิดีโอ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-20260922114554-3725', '2026-09-25 00:00:00', '09:00', 'Facebook', 'รูปeksion ev สี + สเปก', 'ภาพ', 'DRAFT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
on conflict (id) do nothing;

-- Ideas (6 rows)
insert into ideas (id, created_at, created_by, title, category, note, score, promoted_post_id) values
  ('I-20260814144512-6726', '2026-08-14 14:45:12', 'panpan14158@gmail.com', 'เอา รถ PORTA ไปทำรถให้เช่า สาย camping', 'PORTA', NULL, 5, NULL),
  ('I-20260814144747-8610', '2026-08-14 14:47:47', 'panpan14158@gmail.com', 'เอา DARION ไปขาย กลุ่มรถเช่า', 'DARION', NULL, 5, NULL),
  ('I-20260817212622-8386', '2026-08-17 21:26:22', 'panpan14158@gmail.com', 'ทำ app ช่วยลูกค้าคำนวนต้นทุน ให้ โทรหาเซลล์', NULL, NULL, 5, NULL),
  ('I-20260817212720-2604', '2026-08-17 21:27:20', 'panpan14158@gmail.com', 'เจาะตลาด พื้นที่ อย่ามองตลาดเป็น “ชลบุรี” ก้อนเดียว', NULL, NULL, 5, NULL),
  ('I-20260823165847-9952', '2026-08-23 16:58:47', NULL, 'ทำระบบค่าแนะนำ_กำนันผู้ใหญ่บ้าน', NULL, NULL, 5, NULL),
  ('I-20260827184113-7678', '2026-08-27 18:41:13', 'panpan14158@gmail.com', 'ปักตะกร้า ซื้อรถ', NULL, NULL, 5, NULL)
on conflict (id) do nothing;

-- Tags (5 rows)
insert into tags (tag, active, created_at) values
  ('โปรโมชัน', TRUE, '2026-08-13 21:15:16'),
  ('ความรู้', TRUE, '2026-08-13 21:15:16'),
  ('รีวิวจากลูกค้า', TRUE, '2026-08-13 21:15:16'),
  ('Test Drive', TRUE, '2026-08-13 21:15:16'),
  ('แนะนำรุ่นใหม่', TRUE, '2026-08-13 21:15:16')
on conflict (tag) do nothing;

-- Log (191 rows) — 12 รายการอ้างถึงโพสต์ที่ถูกลบไปแล้วในชีต ใส่ post_id เป็น NULL แทนเพื่อรักษาประวัติไว้
insert into log (at, who, post_id, action, from_status, to_status, comment) values
  ('2026-08-13 21:51:03', 'panpan14158@gmail.com', NULL, 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-13 21:52:26', 'panpan14158@gmail.com', NULL, 'STATUS_CHANGE', 'ร่าง', 'อนุมัติแล้ว', NULL),
  ('2026-08-14 11:04:04', NULL, 'P-20260814110404-2715', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:06:18', NULL, 'P-20260814110618-8041', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:06:51', NULL, 'P-20260814110618-8041', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 11:07:09', NULL, 'P-20260814110404-2715', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 11:11:19', NULL, 'P-20260814111119-1577', 'CREATE', NULL, 'เผยแพร่แล้ว', NULL),
  ('2026-08-14 11:14:05', NULL, 'P-20260814111405-7829', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:16:14', NULL, 'P-20260814111613-8910', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:18:33', NULL, 'P-20260814111833-4518', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:19:26', NULL, 'P-20260814111926-7740', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:20:30', NULL, 'P-20260814112029-1606', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:21:14', NULL, 'P-20260814112113-4943', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:22:53', NULL, 'P-20260814112252-9095', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:32:13', NULL, 'P-20260814113213-5292', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:33:05', NULL, 'P-20260814113305-8282', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:33:54', NULL, 'P-20260814113354-5315', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:34:26', NULL, 'P-20260814113354-5315', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 11:35:13', NULL, 'P-20260814113513-1698', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:36:07', NULL, 'P-20260814113607-8153', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:37:31', NULL, 'P-20260814113607-8153', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 11:38:29', NULL, 'P-20260814113829-5961', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:39:09', NULL, 'P-20260814113908-5964', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 11:39:32', NULL, 'P-20260814113908-5964', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 11:40:07', NULL, NULL, 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 13:05:45', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:08:05', 'panpan14158@gmail.com', 'P-20260814113354-5315', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:09:30', 'panpan14158@gmail.com', 'P-20260814112113-4943', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:16:22', 'panpan14158@gmail.com', 'P-20260814111926-7740', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:19:21', 'panpan14158@gmail.com', 'P-20260814131920-5484', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 13:25:37', 'panpan14158@gmail.com', 'P-20260814132536-6867', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 13:38:59', 'panpan14158@gmail.com', 'P-20260814113305-8282', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:40:22', 'panpan14158@gmail.com', 'P-20260814113354-5315', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:43:48', 'panpan14158@gmail.com', 'P-20260814113607-8153', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 13:54:30', 'panpan14158@gmail.com', 'P-20260814135430-4906', 'CREATE', NULL, 'ร่าง', NULL),
  ('2026-08-14 13:54:55', 'panpan14158@gmail.com', 'P-20260814135430-4906', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 14:55:17', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 15:13:32', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 15:14:02', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 15:24:27', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'STATUS_CHANGE', 'ร่าง', 'อนุมัติแล้ว', NULL),
  ('2026-08-14 15:29:19', 'panpan14158@gmail.com', NULL, 'DELETE', 'อนุมัติแล้ว', NULL, 'บริษัท ACS จำกัด'),
  ('2026-08-14 15:30:13', 'panpan14158@gmail.com', 'P-20260814111119-1577', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 17:17:33', 'panpan14158@gmail.com', 'P-20260814110618-8041', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-14 17:17:48', 'panpan14158@gmail.com', 'P-20260814110404-2715', 'STATUS_CHANGE', 'อนุมัติแล้ว', 'PUBLISHED', NULL),
  ('2026-08-14 17:18:01', 'panpan14158@gmail.com', 'P-20260814111405-7829', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-14 17:18:28', 'panpan14158@gmail.com', 'P-20260814111613-8910', 'STATUS_CHANGE', 'ร่าง', 'SCHEDULED', NULL),
  ('2026-08-14 17:20:24', 'panpan14158@gmail.com', 'P-20260814111613-8910', 'STATUS_CHANGE', 'SCHEDULED', 'PUBLISHED', NULL),
  ('2026-08-14 17:27:39', 'panpan14158@gmail.com', 'P-20260814111613-8910', 'STATUS_CHANGE', 'PUBLISHED', 'SCHEDULED', NULL),
  ('2026-08-14 17:39:35', 'panpan14158@gmail.com', 'P-20260814111405-7829', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-14 17:40:08', 'panpan14158@gmail.com', 'P-20260814110618-8041', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-15 11:24:58', NULL, 'P-20260814131920-5484', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-15 11:25:39', NULL, 'P-20260814131920-5484', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-15 12:48:35', NULL, 'P-20260814131920-5484', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-16 11:29:56', NULL, 'P-20260814113213-5292', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-17 09:03:29', NULL, 'P-20260814112029-1606', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-17 10:18:19', NULL, 'P-20260814112029-1606', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-17 12:52:05', NULL, 'P-20260814112029-1606', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-17 12:52:22', NULL, 'P-20260814112029-1606', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-17 12:59:09', NULL, 'P-20260814113305-8282', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-17 13:25:28', NULL, 'P-20260814112029-1606', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-08-17 13:28:37', NULL, 'P-20260814111613-8910', 'STATUS_CHANGE', 'SCHEDULED', 'PUBLISHED', NULL),
  ('2026-08-17 13:30:31', NULL, 'P-20260814111833-4518', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-17 13:32:04', NULL, 'P-20260814131920-5484', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', '🔥 EVENT วันสุดท้าย ใครอยู่ "ฉะเชิงเทรา" และ พื้นที่ใกล้เคียง
🌟 WULING TEST DRIVE EVENT ครั้งที่ 8
🌟 ทดลองขับรถ EV ตัวจริงกับเราได้เลย !
.
🔥 WULING TEST DRIVE EVENT #8
.
📅 วันที่ 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans
.
LOCATION : https://maps.app.goo.gl/YL6EGTUg3Mue3yFk9
.
มาสัมผัส WULING แบบใกล้ชิด พร้อมทดลองขับบนเส้นทางจริง
ลองทั้งการขับขี่ ความสะดวกสบาย และพื้นที่ใช้งาน ก่อนตัดสินใจเลือกรถที่เหมาะกับคุณ
.
🚗 ภายในงานพบกับ
.
✨ WULING Starlight Darion EV
รถ MPV ไฟฟ้า 7 ที่นั่ง สำหรับครอบครัว
.
✨ WULING Porta EV
รถตู้ไฟฟ้าสำหรับธุรกิจ ขนของ และการใช้งานในชีวิตประจำวัน
.
พร้อมสิทธิพิเศษภายในงาน
.
🎁 ของที่ระลึกสำหรับผู้ลงทะเบียน
☕ คูปองเครื่องดื่มฟรีสำหรับครอบครัว
🔥 โปรโมชั่นพิเศษเฉพาะภายในงาน
🚗 ทดลองขับ Darion EV และ Porta EV ฟรี!
.
📩 **ลงทะเบียนล่วงหน้าได้แล้ววันนี้**
.
แล้วพบกัน
📅 15 - 16 สิงหาคม 2569
📍  Good Barista & Coffee Beans**
.
สนใจทดลองขับ / สอบถามโปรโมชั่น
ทักแชทหาเราได้เลย
.
📞 ติดต่อฝ่ายขาย
082 324 7915
081 160 4965
.
WULING CHONBURI
พาคุณมาสัมผัสรถจริง ทดลองขับจริง ก่อนตัดสินใจ'),
  ('2026-08-17 13:35:00', NULL, 'P-20260814132536-6867', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-17 13:38:18', NULL, 'P-20260814113305-8282', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-17 14:21:39', NULL, 'P-20260814112252-9095', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-17 19:45:40', 'panpan14158@gmail.com', 'P-20260814113213-5292', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-18 11:56:46', NULL, 'P-20260814113305-8282', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-18 16:53:11', NULL, 'P-20260814113354-5315', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-19 20:54:13', 'panpan14158@gmail.com', 'P-20260814113305-8282', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-08-19 20:55:16', 'panpan14158@gmail.com', 'P-20260814113354-5315', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-08-19 20:56:12', 'panpan14158@gmail.com', 'P-20260814111926-7740', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-19 20:56:35', 'panpan14158@gmail.com', 'P-20260814113354-5315', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-19 20:57:37', 'panpan14158@gmail.com', 'P-20260814112113-4943', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-20 09:05:07', NULL, 'P-20260814113213-5292', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:05:28', NULL, 'P-20260814113213-5292', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:09:00', NULL, 'P-20260814111926-7740', 'STATUS_CHANGE', 'PUBLISHED', 'EDITING', NULL),
  ('2026-08-20 09:09:22', NULL, 'P-20260814113305-8282', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:10:06', NULL, 'P-20260814113354-5315', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:10:31', NULL, 'P-20260814111926-7740', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:14:24', NULL, 'P-20260814113607-8153', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-20 09:17:37', NULL, 'P-20260814113213-5292', 'STATUS_CHANGE', 'DRAFT', 'REVIEW', NULL),
  ('2026-08-20 09:17:59', NULL, 'P-20260814112252-9095', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 09:18:44', NULL, 'P-20260814113607-8153', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-20 10:12:29', NULL, 'P-20260814111926-7740', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 16:19:41', NULL, 'P-20260821161941-3081', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:20:44', NULL, 'P-20260821162043-3046', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:23:09', NULL, 'P-20260821162308-9895', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:30:23', NULL, 'P-20260821162308-9895', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 16:31:07', NULL, 'P-20260821163106-4886', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:31:58', NULL, 'P-20260821163157-5012', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:39:01', NULL, 'P-20260821163901-7164', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:40:31', NULL, 'P-20260821164031-2378', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:41:02', NULL, 'P-20260821163901-7164', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 16:42:00', NULL, 'P-20260821164031-2378', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 16:43:10', NULL, NULL, 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-21 16:58:43', NULL, 'P-20260821163106-4886', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 18:02:19', 'panpan14158@gmail.com', 'P-20260814113213-5292', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-21 18:02:46', 'panpan14158@gmail.com', 'P-20260814111926-7740', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-23 15:15:22', NULL, 'P-20260821161941-3081', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:15:52', NULL, 'P-20260821163157-5012', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:16:55', NULL, 'P-20260821163106-4886', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:30:07', NULL, 'P-20260821162043-3046', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:30:39', NULL, 'P-20260821164031-2378', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:31:00', NULL, 'P-20260821162308-9895', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-23 15:31:20', NULL, 'P-20260821162308-9895', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:31:58', NULL, 'P-20260821163901-7164', 'STATUS_CHANGE', 'DRAFT', 'APPROVED', NULL),
  ('2026-08-23 15:34:53', NULL, 'P-20260823153452-7075', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-23 15:39:52', NULL, 'P-20260823153452-7075', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-23 15:41:09', NULL, NULL, 'UPDATE', NULL, NULL, NULL),
  ('2026-08-24 14:07:47', NULL, 'P-20260814135430-4906', 'STATUS_CHANGE', 'ร่าง', 'PUBLISHED', NULL),
  ('2026-08-24 14:08:30', NULL, 'P-20260814113908-5964', 'STATUS_CHANGE', 'ร่าง', 'DRAFT', NULL),
  ('2026-08-24 17:02:54', NULL, 'P-20260824170253-8901', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-24 17:04:31', NULL, 'P-20260824170253-8901', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-25 08:57:37', NULL, 'P-20260824170253-8901', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-08-25 09:28:48', NULL, 'P-20260821163901-7164', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-25 14:33:27', NULL, 'P-20260821161941-3081', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-25 14:38:18', NULL, 'P-20260821163157-5012', 'STATUS_CHANGE', 'APPROVED', 'PUBLISHED', NULL),
  ('2026-08-25 14:40:00', NULL, 'P-20260821163106-4886', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-25 14:41:16', NULL, 'P-20260814111926-7740', 'STATUS_CHANGE', 'EDITING', 'PUBLISHED', NULL),
  ('2026-08-25 15:26:03', NULL, 'P-20260821164031-2378', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-26 16:27:39', 'panpan14158@gmail.com', 'P-20260821161941-3081', 'STATUS_CHANGE', 'APPROVED', 'PUBLISHED', NULL),
  ('2026-08-28 16:47:53', NULL, 'P-20260821163106-4886', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-29 12:38:02', NULL, 'P-20260821163106-4886', 'STATUS_CHANGE', 'APPROVED', 'PUBLISHED', NULL),
  ('2026-08-29 12:39:02', NULL, 'P-20260821162043-3046', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-29 12:39:46', NULL, 'P-20260821162043-3046', 'STATUS_CHANGE', 'APPROVED', 'PUBLISHED', NULL),
  ('2026-08-29 12:42:26', NULL, 'P-20260823153452-7075', 'UPDATE', NULL, NULL, NULL),
  ('2026-08-29 12:43:00', NULL, 'P-20260823153452-7075', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-08-29 12:53:26', NULL, 'P-20260821164031-2378', 'STATUS_CHANGE', 'APPROVED', 'PUBLISHED', NULL),
  ('2026-08-30 13:26:56', 'panpan14158@gmail.com', NULL, 'CREATE', NULL, 'IDEA', NULL),
  ('2026-08-30 13:28:41', 'panpan14158@gmail.com', NULL, 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-30 14:35:25', NULL, NULL, 'DELETE', 'DRAFT', NULL, 'starlight darion ev ระบบความปลอดภัยอะไรบ้าง? // ไม่ผ่าน'),
  ('2026-08-30 14:36:54', NULL, 'P-20260830143654-3362', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-30 14:38:57', NULL, 'P-20260830143857-1950', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-31 08:35:19', NULL, NULL, 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-08-31 08:35:40', NULL, NULL, 'UPDATE', NULL, NULL, NULL),
  ('2026-09-03 09:18:13', NULL, NULL, 'DELETE', 'DRAFT', NULL, 'ส่งมอบรถ ธุรกิจผัก ไฮโดรโปรนิก'),
  ('2026-09-03 09:23:31', NULL, 'P-20260903092330-5944', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-03 09:25:31', NULL, 'P-20260903092530-6286', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-03 09:58:45', NULL, 'P-20260830143654-3362', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-03 15:31:19', 'panpan14158@gmail.com', 'P-20260903153119-7845', 'CREATE', NULL, 'READY', NULL),
  ('2026-09-03 15:31:51', 'panpan14158@gmail.com', 'P-20260903153151-8671', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-03 15:32:40', 'panpan14158@gmail.com', 'P-20260903153239-8868', 'CREATE', NULL, 'READY', NULL),
  ('2026-09-03 15:33:00', 'panpan14158@gmail.com', 'P-20260903153151-8671', 'STATUS_CHANGE', 'DRAFT', 'READY', NULL),
  ('2026-09-05 14:40:10', NULL, 'P-20260905144010-8572', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-05 14:43:55', NULL, 'P-20260830143857-1950', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-05 14:44:12', NULL, 'P-20260830143857-1950', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-05 14:44:31', NULL, 'P-20260830143654-3362', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-05 14:47:33', NULL, 'P-20260905144732-4129', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 14:39:34', NULL, 'P-20260905144732-4129', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-06 15:39:27', NULL, 'P-20260906153927-2551', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 15:41:04', NULL, 'P-20260906154104-9864', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 15:46:53', NULL, 'P-20260906154653-8528', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 16:04:26', NULL, 'P-20260903092530-6286', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-06 16:05:33', NULL, 'P-20260906160532-6386', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 16:06:22', NULL, 'P-20260906160622-7652', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 16:08:28', NULL, 'P-20260906160828-9314', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-06 16:09:03', NULL, 'P-20260906153927-2551', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-07 08:27:48', NULL, 'P-20260903092530-6286', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-07 13:20:02', NULL, 'P-20260903092330-5944', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-08 09:03:10', NULL, 'P-20260908090310-9212', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-08 09:05:56', NULL, 'P-20260908090310-9212', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-08 14:45:51', NULL, 'P-20260908144551-4585', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-08 14:47:12', NULL, 'P-20260906154653-8528', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-08 14:48:00', NULL, 'P-20260906153927-2551', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-08 14:50:26', NULL, 'P-20260908145026-8451', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-10 11:36:39', NULL, 'P-20260908144551-4585', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-15 09:01:08', NULL, 'P-20260906154104-9864', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-15 09:24:09', NULL, 'P-20260906160622-7652', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-15 09:24:28', NULL, 'P-20260906160622-7652', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-15 13:01:38', NULL, 'P-20260906160532-6386', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-18 09:55:51', NULL, 'P-20260918095551-3282', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-21 11:31:09', NULL, 'P-20260903092330-5944', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-21 11:31:36', NULL, 'P-20260908090310-9212', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-21 11:32:56', NULL, 'P-20260921113256-3908', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-21 13:51:04', NULL, 'P-20260921135103-3895', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-21 13:51:20', NULL, 'P-20260921113256-3908', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-22 11:15:07', NULL, 'P-20260906154104-9864', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-22 11:15:30', NULL, 'P-20260918095551-3282', 'UPDATE', NULL, NULL, NULL),
  ('2026-09-22 11:16:45', NULL, 'P-20260922111644-6429', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:17:02', NULL, 'P-20260922111644-6429', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-22 11:19:13', NULL, 'P-20260922111912-5628', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:20:33', NULL, 'P-20260922112033-3739', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-22 11:22:36', NULL, 'P-20260922111912-5628', 'STATUS_CHANGE', 'DRAFT', 'PUBLISHED', NULL),
  ('2026-09-22 11:23:28', NULL, 'P-20260922112328-9700', 'CREATE', NULL, 'PUBLISHED', NULL),
  ('2026-09-22 11:24:30', NULL, 'P-20260922112430-7631', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:25:06', NULL, 'P-20260922112505-4917', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:25:40', NULL, 'P-20260922112539-3041', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:36:54', NULL, 'P-20260922113654-1485', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:43:44', NULL, 'P-20260922114343-3151', 'CREATE', NULL, 'DRAFT', NULL),
  ('2026-09-22 11:45:55', NULL, 'P-20260922114554-3725', 'CREATE', NULL, 'DRAFT', NULL);
