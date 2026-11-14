import type { Locale } from "@/i18n/config";

// Flower code name catalog (Phase 10, user supplement 2026-11-14 15:04).
//
// Static code, no DB table: the flower list is fixed reference data (names +
// stable codes), it never needs admin CRUD, and adding a flower must not
// require a migration. Adding a flower later = one line in this file.
// Removing/renaming a code while bookings reference it is forbidden —
// flowerNameFor falls back to the raw code so history never breaks.
//
// Codes are URL-safe ASCII slugs; `vi` is the display name in Vietnamese,
// `en` the English name. Booking.flowerCode stores the `code`.

export type Flower = { code: string; vi: string; en: string };

export const FLOWERS: Flower[] = [
  { code: "tulip", vi: "Tulip", en: "Tulip" },
  { code: "hong", vi: "Hồng", en: "Rose" },
  { code: "lan", vi: "Lan", en: "Orchid" },
  { code: "cuc", vi: "Cúc", en: "Chrysanthemum" },
  { code: "sen", vi: "Sen", en: "Lotus" },
  { code: "mai", vi: "Mai", en: "Apricot blossom" },
  { code: "dao", vi: "Đào", en: "Peach blossom" },
  { code: "huong-duong", vi: "Hướng dương", en: "Sunflower" },
  { code: "lavender", vi: "Lavender", en: "Lavender" },
  { code: "cam-chuong", vi: "Cẩm chướng", en: "Carnation" },
  { code: "ly", vi: "Ly", en: "Lily" },
  { code: "dong-tien", vi: "Đồng tiền", en: "Gerbera" },
  { code: "thach-thao", vi: "Thạch thảo", en: "Aster" },
  { code: "cam-tu-cau", vi: "Cẩm tú cầu", en: "Hydrangea" },
  { code: "mau-don", vi: "Mẫu đơn", en: "Peony" },
  { code: "tu-dang", vi: "Tử đằng", en: "Wisteria" },
  { code: "nhai", vi: "Nhài", en: "Jasmine" },
  { code: "phuong", vi: "Phượng", en: "Flamboyant" },
  { code: "bang-lang", vi: "Bằng lăng", en: "Crape myrtle" },
  { code: "su", vi: "Sứ", en: "Frangipani" },
  { code: "hoa-giay", vi: "Hoa giấy", en: "Bougainvillea" },
  { code: "luu-ly", vi: "Lưu ly", en: "Forget-me-not" },
  { code: "violet", vi: "Violet", en: "Violet" },
  { code: "van-tho", vi: "Vạn thọ", en: "Marigold" },
  { code: "cuc-hoa-mi", vi: "Cúc họa mi", en: "Daisy" },
  { code: "dien-vi", vi: "Diên vĩ", en: "Iris" },
  { code: "hoa-bi", vi: "Hoa bi", en: "Baby's breath" },
  { code: "freesia", vi: "Lan Nam Phi", en: "Freesia" },
  { code: "thuoc-duoc", vi: "Thược dược", en: "Dahlia" },
  { code: "anh-dao", vi: "Anh đào", en: "Cherry blossom" },
];

export const FLOWER_CODES = new Set(FLOWERS.map((f) => f.code));

export function flowerNameFor(code: string, locale: Locale): string {
  const flower = FLOWERS.find((f) => f.code === code);
  if (!flower) return code; // never crash on a stale code
  return locale === "en" ? flower.en : flower.vi;
}
