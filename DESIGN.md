# Design

Hệ thống nhìn cho trang public FunCafe. Giữ bản sắc cafe ấm sẵn có (identity-preservation), thêm nhịp và điểm nhấn để hết đơn điệu. Tham chiếu cảm giác: Notion/Linear (thân thiện, nhiều minh hoạ, phân cấp rõ).

## Theme
Một theme sáng (light) khoá toàn trang. Các mảng nâu đậm / ảnh chỉ là điểm nhấn tạo nhịp, không lật theme giữa trang.

## Color
Token trong `globals.css` (`@theme`). **Thương hiệu xanh dương** (KiotViet-style),
neutral trung tính mát (không còn nâu). Tên token giữ nguyên (`bean` = accent) để
tương thích ~600 chỗ dùng; chỉ đổi giá trị.

- **Nền:** paper `#F8FAFC` (slate-50), white `#FFFFFF`, sand `#F1F5F9` (slate-100)
- **Mực/chữ:** ink `#1F2933` (heading + body chính), slate `#475569` (body phụ)
- **Accent chính (bean = xanh dương):** `#2563EB` (blue-600), bean-dark `#1D4ED8` (blue-700), bean-tint `#EFF4FF` — nút, link, active, mảng đậm
- **Nền tối trung tính (footer):** ink-deep `#0F172A` (slate-950) — tách bạch với CTA xanh
- **Accent phụ (điểm nhấn nhỏ):** pine `#2F6F5E` (trạng thái tích cực, dấu check), gold `#D6A85A` (sao đánh giá, điểm nhấn ấm)
- **Đường kẻ:** line `#E2E8F0` (slate-200)

Quy tắc:
- **1 accent chính = bean (xanh dương).** Pine/gold chỉ là điểm nhấn nhỏ, không tranh vai bean (color-lock).
- **Không đặt footer trùng màu CTA:** CTA = bean-dark (xanh), footer = ink-deep (slate-950) để 2 khối cuối trang tách bạch.
- **Sửa lỗi gray-on-tint:** body trên nền sáng phải nghiêng về ink, đạt ≥4.5:1. Không dùng `text-ink/50` cho đoạn văn dài.
- **Banner ảnh:** scrim slate/blue-đen đều (`.photo-tint`) + `banner-title` drop-shadow; **nội dung phải có `z-10`** để nổi trên scrim (nếu không chữ bị lớp phủ đè thành xám).

## Typography
- **Family:** Be Vietnam Pro (một họ, nhiều weight — chuẩn tiếng Việt, không pha 2 sans giống nhau).
- **Hierarchy:** hero ≤ ~3.5rem (text-4xl→5xl), section heading text-2xl→3xl, body 16–18px.
- **Đo dòng:** đoạn văn ≤ ~70ch (`max-w-xl`/`max-w-2xl`).
- **Weight:** 700 cho heading, 500–600 cho nhãn, 400 cho body.

## Layout & Spacing
- Container `max-w-6xl` cho nội dung, `max-w-5xl` cho khu hẹp.
- Nhịp section dọc `py-16 md:py-20`.
- Nền xen kẽ tạo nhịp: paper-textured → white → ảnh/bean-dark → white.
- Mobile (<768px): mọi lưới/zigzag/split collapse 1 cột.

## Texture & Surface
- `.bg-paper-textured`: nền kem + chấm tròn rất nhạt để section không phẳng lì.
- Card: bo `rounded-2xl`, viền `line`, shadow nhuộm tông nâu ấm (không đen thuần). Hover `.lift`.
- Một hệ bo góc nhất quán (2xl cho card, lg cho nút/ô nhỏ, full cho pill).

## Motion
- Mức nhẹ-có-gừ (Notion/Linear). Reveal-on-scroll (IntersectionObserver), hover lift, carousel review.
- Chỉ animate transform/opacity. Honor `prefers-reduced-motion` (đã có trong globals + Reveal).

## Imagery
- 5 ảnh quán cafe thật (đã xác minh) tại `public/banners/`: cafe-interior, cafe-busy, cafe-street, cafe-counter, coffee-cheers.
- Mini-UI sản phẩm (FeatureShots) làm "ảnh minh hoạ chức năng" — đúng tinh thần Notion nhiều minh hoạ.
- Avatar review: ảnh chân dung (pravatar) + fallback chữ cái.
- Mọi ảnh có alt nghĩa; ảnh hero không lazy (LCP), ảnh dưới fold lazy.

## UX & Accessibility
- **Form:** mỗi `<label htmlFor>` khớp `<input id>`; `autoComplete` đúng chuẩn
  (`email`/`current-password`/`new-password`/`name`/`tel`); `autoFocus` ô đầu; nút
  hiện/ẩn mật khẩu có `aria-label` + `aria-pressed`. Lỗi báo **inline dưới ô**
  (không chỉ toast); validate mật khẩu ngay khi rời ô.
- **"Ghi nhớ đăng nhập" có tác dụng thật:** nhớ → `localStorage`, không nhớ →
  `sessionStorage` (xem `api-client` + `AuthContext.login(_, _, remember)`).
- **Điều hướng:** có skip-link "Bỏ qua tới nội dung chính" + `id="main"` trên `<main>`.
- **Tải dữ liệu:** danh sách gói có skeleton khi fetch; pricing render sẵn card fallback
  (không blank/nhảy layout).

## Components (tái sử dụng)
- `Banner`: banner ảnh dùng chung, contrast chuẩn (nội dung `z-10` trên scrim).
- `AuthAside`: panel ảnh + overlay xanh dương cho trang login/register.
- `CtaPanel`: khối kêu gọi hành động cuối trang — **kiểu DUY NHẤT** cho mọi trang
  public. Bố cục **ngang** (chữ trái · nút phải), đệm trên rất mỏng (`pt-2 md:pt-4`)
  vì section phía trên đã có `py-16/20`; khối canh giữa cao lênh khênh + cộng dồn
  hai lớp đệm là lý do cuối trang từng nhìn thô và cách nội dung quá xa.
  Nền `from-bean-dark to-[#1E3A8A]` (đậm hơn bean để chữ trắng đạt AA),
  chữ phụ `text-white/85`. Không tự dựng biến thể CTA mới trong từng trang.
- **Đánh giá (`ReviewsCarousel`) chỉ đặt ở TRANG CHỦ.** Đặt thêm ở trang giá là lặp
  y hệt, làm trang dài vô ích.
- `AppShot`: khung "cửa sổ ứng dụng" bao ảnh chụp giao diện thật (thanh 3 chấm +
  nhãn). Dùng ở trang chủ và trang hỗ trợ.
- `Reveal`, `ReviewsCarousel`, `Avatar`, `FeatureShots` (giữ).

## Ngưỡng an toàn (kiểm bằng số, không ước lượng bằng mắt)
- **Chữ trên nền sáng: sàn là `text-ink/70`.** `text-ink/60` chỉ đạt 4.07:1 — TRƯỢT
  AA. Không dùng `/60` trở xuống cho chữ; icon mang nghĩa cũng nên ≥ `/70`.
- **Chữ trắng trên xanh:** trên `bean #2563EB` thì `text-white/75` chỉ đạt 3.6:1.
  Nền xanh có chữ phụ phải dùng `bean-dark` trở lên, chữ ≥ `text-white/85`.
- **Vùng chạm ≥ 44px** cho nút trên di động (`min-h-11` / `h-11 w-11`).
- **z-index:** dùng token `z-sticky / z-dropdown / z-drawer-backdrop / z-drawer /
  z-modal-backdrop / z-modal / z-toast` (namespace `--z-index-*` trong `@theme`),
  không viết `z-50` tuỳ tiện.
- **Không cuộn ngang ở 390px.** Hai bẫy đã gặp: (1) quầng sáng `absolute -inset-*`
  quanh ảnh → bọc section bằng `overflow-x-clip`; (2) `sr-only` (position:absolute)
  đặt trong vùng `overflow-x-auto` sẽ THOÁT ra ngoài và kéo giãn cả trang → dùng
  `role="img" + aria-label` trên icon thay cho `<span class="sr-only">`.
- Kiểm lại bằng `node scripts/shot-public.mjs` (cần dev server): tự dò tràn ngang,
  lỗi console, trạng thái menu di động, và chụp 6 trang × 3 bề rộng.
