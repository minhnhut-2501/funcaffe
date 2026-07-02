'use client';

import { useState } from 'react';

/** Tông nền dự phòng cho avatar chữ cái, suy ra từ tên để mỗi người một màu ổn định. */
const tones = [
  'bg-bean text-white',
  'bg-pine text-white',
  'bg-gold text-bean-dark',
  'bg-bean-dark text-white',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? '';
  const first = parts[0]?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Avatar người review: ưu tiên ảnh thật (nếu có avatarUrl), nếu không dùng ảnh
 * chân dung deterministic theo tên; lỗi tải thì rơi về avatar chữ cái có màu brand.
 */
export default function Avatar({
  name,
  src,
  size = 44,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  const seed = encodeURIComponent(name || 'cafe');
  const photo = src || `https://i.pravatar.cc/${size * 2}?u=${seed}`;
  const [failed, setFailed] = useState(false);
  const tone = tones[hash(name) % tones.length];

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${tone}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0 ring-2 ring-white"
      style={{ width: size, height: size }}
    />
  );
}
