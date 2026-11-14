// Intro-bullet dedupe (Phase 10 visual check, 2026-11-14): the survey and
// booking intros list auto-generated facts and then the admin's highlights
// lines. A highlight that restates an auto fact showed the same line twice.
import { describe, expect, it } from "vitest";

import { dedupeBullets } from "@/lib/utils";

describe("dedupeBullets", () => {
  it("drops exact duplicates and keeps the first occurrence", () => {
    expect(
      dedupeBullets([
        "8 câu hỏi, khoảng 5 phút",
        "Không thu thập thông tin cá nhân",
        "8 câu hỏi, khoảng 5 phút",
        "Có thể quay lại sửa câu trả lời",
        "Có thể quay lại sửa câu trả lời",
      ]),
    ).toEqual([
      "8 câu hỏi, khoảng 5 phút",
      "Không thu thập thông tin cá nhân",
      "Có thể quay lại sửa câu trả lời",
    ]);
  });

  it("drops a longer rewording of an earlier bullet (either direction)", () => {
    expect(
      dedupeBullets([
        "Không thu thập thông tin cá nhân",
        "Không thu thập thông tin cá nhân ngoài câu trả lời",
      ]),
    ).toEqual(["Không thu thập thông tin cá nhân"]);
    expect(
      dedupeBullets([
        "Không thu thập thông tin cá nhân ngoài câu trả lời",
        "Không thu thập thông tin cá nhân",
      ]),
    ).toEqual(["Không thu thập thông tin cá nhân ngoài câu trả lời"]);
  });

  it("drops a one-word-different restatement and keeps distinct bullets", () => {
    // Booking intro set: the "8 câu hỏi, khoảng 5 phút" highlight restates
    // the "8 câu hỏi ngắn, khoảng 5 phút" auto bullet (one word differs).
    // The "Không thu thập…" highlight is kept by the dedupe — it is removed
    // from the demo seed instead, because on the booking page it would
    // wrongly claim no personal data is collected (booking does collect it).
    expect(
      dedupeBullets([
        "8 câu hỏi ngắn, khoảng 5 phút",
        "Có thể quay lại sửa câu trả lời",
        "Thông tin liên hệ chỉ dùng để tư vấn viên liên hệ với bạn.",
        "Trên lịch công khai chỉ hiện tên hoa, không hiện tên thật của bạn",
        "Tư vấn 1-1 · 30 phút",
        "8 câu hỏi, khoảng 5 phút",
        "Không thu thập thông tin cá nhân ngoài câu trả lời",
      ]),
    ).toEqual([
      "8 câu hỏi ngắn, khoảng 5 phút",
      "Có thể quay lại sửa câu trả lời",
      "Thông tin liên hệ chỉ dùng để tư vấn viên liên hệ với bạn.",
      "Trên lịch công khai chỉ hiện tên hoa, không hiện tên thật của bạn",
      "Tư vấn 1-1 · 30 phút",
      "Không thu thập thông tin cá nhân ngoài câu trả lời",
    ]);
  });

  it("skips empty lines and never collapses short lines by containment", () => {
    expect(dedupeBullets(["", "  ", "Có", "Có thể quay lại"])).toEqual(["Có", "Có thể quay lại"]);
  });
});
