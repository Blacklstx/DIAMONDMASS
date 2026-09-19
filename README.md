# DiamondMass 16-Week Tracker — Next.js 15 Edition (Supabase SSR)

เว็บแอปติดตามผลการเปลี่ยนแปลงรูปร่างระยะ 16 สัปดาห์ (DiamondMass 16-Week Tracker) พัฒนาใหม่ด้วย **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, และ **Supabase (@supabase/ssr)**

---

## 🌟 ฟีเจอร์หลัก (Features)

- **Supabase Authentication & SSR:**
  - สมัครสมาชิก, เข้าสู่ระบบ, ลืมรหัสผ่าน
  - Middleware ป้องกันเส้นทางอัตโนมัติ (Route Protection)
- **16-Week Weekly Check-in:**
  - ชั่งน้ำหนักรายวัน 7 วัน พร้อมคำนวณค่าเฉลี่ยรายสัปดาห์ และเทียบผลต่างจากสัปดาห์ก่อนหน้าแบบ Real-time
  - บันทึกสัดส่วนร่างกาย (รอบเอว, สะโพก, อก, แขน, ต้นขา)
  - บันทึกการฝึกซ้อมแยกแท็บ 7 วัน (รองรับสูงสุด 10 ท่า/วัน พร้อมน้ำหนักและจำนวนครั้ง)
  - โภชนาการและกิจกรรม (แคลอรี่, โปรตีน, ก้าวเดิน, คาร์ดิโอ, การนอน, ระดับความเครียด)
  - ช่องบันทึกสรุปและข้อความถึงโค้ช
- **Private Progress Photos (Supabase Storage):**
  - อัปโหลดรูปถ่าย 4 มุม (หน้า, ซ้าย, ขวา, หลัง)
  - บีบอัดรูปภาพบนเบราว์เซอร์อัตโนมัติก่อนอัปโหลดเพื่อประหยัดพื้นที่และโหลดเร็ว
  - เก็บใน Storage Bucket แบบส่วนตัว พร้อมสร้าง Signed URL อัตโนมัติ
- **Dashboard & Trends:**
  - สรุปน้ำหนักเริ่มต้น, น้ำหนักปัจจุบัน, ผลต่างรวม, รอบเอว
  - แถบสถานะความคืบหน้า 16 สัปดาห์
  - วงแหวน Consistency Score พร้อมแถบความสม่ำเสมอแยกด้าน (การฝึก, โภชนาการ, การเช็คอิน)
  - กราฟแนวโน้มน้ำหนัก, รอบเอว, ก้าวเดิน และคาร์ดิโอ (Chart.js)
- **Photos Timeline & Compare:**
  - หน้ารวมไทม์ไลน์รูปภาพ กรองตามมุมกล้องได้
  - หน้าเปรียบเทียบรูปและสัดส่วน Before vs After ระหว่าง 2 สัปดาห์ใดๆ พร้อมตารางสรุปผลต่าง
- **Coach Share & Progress Card:**
  - ลิงก์สำหรับโค้ช (Read-Only) โค้ชเปิดดูแดชบอร์ด กราฟ และบันทึกได้โดยไม่ต้องล็อกอิน (ไม่แสดงรูปภาพส่วนตัว)
  - สร้าง Progress Card อัตราส่วน 9:16 ด้วย HTML5 Canvas เพื่อแชร์ลง Instagram Story หรือส่งให้โค้ช
- **i18n Multi-Language:**
  - สลับภาษาได้ทันทีระหว่าง **ไทย (TH)** และ **อังกฤษ (EN)**

---

## 🚀 วิธีติดตั้งและรันในเครื่อง (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าตัวแปรสภาพแวดล้อม (`.env.local`)
ไฟล์ `.env.local` ถูกสร้างไว้พร้อมค่าเชื่อมต่อ Supabase แล้ว:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. รันเซิร์ฟเวอร์สำหรับพัฒนา
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### 4. Build สำหรับ Production
```bash
npm run build
npm run start
```

---

## 📁 โครงสร้างโปรเจกต์ (Directory Structure)

```
local-app/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx          # หน้าล็อกอิน, สมัครสมาชิก, ลืมรหัสผ่าน
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Shell layout (Sidebar + Topbar + BottomNav)
│   │   │   ├── dashboard/page.tsx      # แดชบอร์ดสรุปสถิติ กราฟ และคะแนน
│   │   │   ├── checkin/[week]/page.tsx # เช็คอินรายสัปดาห์ (1-16)
│   │   │   ├── photos/page.tsx         # ไทม์ไลน์รูปถ่ายความคืบหน้า
│   │   │   ├── compare/page.tsx        # เปรียบเทียบ Before vs After
│   │   │   ├── onboarding/page.tsx     # ตั้งค่าเป้าหมายและโปรแกรมครั้งแรก
│   │   │   └── profile/page.tsx        # ตั้งค่าโปรไฟล์, จัดการลิงก์โค้ช
│   │   ├── coach/[token]/page.tsx      # หน้าดูผลสำหรับโค้ชแบบ Read-Only
│   │   ├── globals.css                 # สไตล์หลักและ Tailwind v4 Theme
│   │   ├── layout.tsx                  # Root Layout + Providers
│   │   └── page.tsx                    # Route redirecter
│   ├── components/
│   │   ├── layout/                     # Sidebar, MobileTopBar, BottomNav
│   │   ├── dashboard/                  # TrendChart (Chart.js)
│   │   └── coach/                      # ShareCardModal (Canvas 9:16 export)
│   ├── context/
│   │   ├── AuthContext.tsx             # จัดการ User Session, Profile และ Checkins
│   │   └── LanguageContext.tsx         # ระบบสลับภาษา (TH/EN)
│   ├── lib/
│   │   ├── supabase/                   # Client, Server, Middleware helpers
│   │   ├── i18n.ts                     # ชุดคำแปลภาษาไทยและอังกฤษ
│   │   └── image-compression.ts        # ฟังก์ชันย่อขนาดรูปภาพก่อนอัปโหลด
│   ├── types/
│   │   └── database.ts                 # Type definitions สำหรับ TypeScript
│   └── middleware.ts                   # Route Protection & Session Refresh
├── legacy/                             # สำรองไฟล์เดิม (app.js, index.html, config.js)
├── public/
│   └── logo.png                        # รูปโลโก้ Diamond
├── schema.sql                          # โครงสร้างฐานข้อมูล Supabase PostgreSQL
└── package.json
```
