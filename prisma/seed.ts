/**
 * Mock content seed.
 *
 * Every person, project and artwork below is placeholder material so the
 * product can be evaluated before real content exists. All of it is editable
 * (or removable) from the admin dashboard.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO = {
  profile: {
    email: "hello@example.com",
    phone: "+84 000 000 000",
    location: "Ho Chi Minh City, Vietnam",
  },
  vi: {
    fullName: "Tên Của Bạn",
    title: "Nhà thiết kế sản phẩm & kỹ sư phần mềm",
    shortBio:
      "Tôi xây dựng sản phẩm số ở giao điểm giữa kỹ thuật, thiết kế và nghệ thuật — nơi một hệ thống tốt cũng có thể là một trải nghiệm đẹp.",
  },
  en: {
    fullName: "Your Name",
    title: "Product designer & software engineer",
    shortBio:
      "I build digital products where engineering, design and art meet — where a well-built system can also be a beautiful experience.",
  },
};

const LONG_BIO_VI = `Tôi là một người làm sản phẩm, và cũng là một người vẽ. Công việc hằng ngày của tôi là biến những ý tưởng còn mơ hồ thành sản phẩm có thể sử dụng được: rõ ràng về cấu trúc, tử tế trong từng chi tiết, và đủ bền để sống cùng thời gian.

Trong hơn tám năm làm việc, tôi đã đi qua nhiều vai trò — từ lập trình viên frontend, thiết kế giao diện, đến kiến trúc hệ thống nội dung và dẫn dắt các nhóm nhỏ. Điều giữ tôi ở lại với nghề này không phải là công nghệ mới, mà là cảm giác khi một người dùng cuối cùng cũng hiểu được điều họ cần làm.

## Tôi đang làm gì

Hiện tại tôi tập trung vào ba việc: thiết kế hệ thống sản phẩm cho các nhóm đang tăng trưởng, xây dựng nền tảng nội dung có thể quản trị hoàn toàn, và dành thời gian còn lại cho tranh kỹ thuật số.

Tôi tin rằng một sản phẩm tốt bắt đầu từ việc hiểu đúng vấn đề. Mọi lựa chọn kỹ thuật sau đó — framework, cơ sở dữ liệu, cấu trúc thư mục — chỉ là hệ quả của sự hiểu biết đó.

## Cách tôi nhìn công việc

Tôi thích những hệ thống có thể giải thích được. Nếu một đồng nghiệp mới không hiểu được vì sao một module tồn tại, thì đó là lỗi thiết kế, không phải lỗi của họ.`;

const LONG_BIO_EN = `I am a product person, and also someone who draws. My daily work is turning half-formed ideas into products people can actually use: clear in structure, thoughtful in detail, and durable enough to live with time.

Across more than eight years, I have moved between roles — frontend engineer, interface designer, content architect, and lead of small teams. What keeps me in this craft is not the newest technology, but the moment someone finally understands what they came to do.

## What I am doing now

Three things hold most of my attention: product systems for growing teams, content platforms that can be fully managed by their owners, and digital painting with whatever time is left.

I believe good products start with understanding the problem correctly. Every technical choice after that — framework, database, folder structure — is a consequence of that understanding.

## How I look at the work

I like systems that can be explained. If a new teammate cannot understand why a module exists, that is a design failure, not theirs.`;

const INTERESTS_VI = `Kiến trúc sản phẩm | Hệ thống dễ hiểu, dễ bàn giao và đủ linh hoạt để sống lâu.
Nghệ thuật kỹ thuật số | Màu sắc, ánh sáng và hình khối như một cách kể chuyện khác.
Trải nghiệm đọc | Typography, nhịp điệu và khoảng trắng trong sản phẩm số.
Quản trị nội dung | Cho người sở hữu sản phẩm quyền tự thay đổi nội dung mà không cần lập trình viên.`;

const INTERESTS_EN = `Product architecture | Systems that are easy to reason about, hand over and keep alive.
Digital art | Colour, light and form as another way of telling a story.
Reading experiences | Typography, rhythm and whitespace in digital products.
Content management | Giving owners the power to change content without a developer.`;

const PHILOSOPHY_VI = `Tôi làm việc theo ba nguyên tắc đơn giản.

> Làm đúng vấn đề trước khi làm nhanh. Một giải pháp đúng nhưng chậm vẫn hữu ích; một giải pháp nhanh nhưng sai chỉ tạo ra nợ.

**Rõ ràng quan trọng hơn thông minh.** Tôi ưu tiên những đoạn code mà người khác có thể đọc hiểu vào lúc hai giờ sáng.

**Chi tiết là nơi sự tôn trọng được thể hiện.** Khoảng cách giữa hai đoạn văn, tốc độ một hiệu ứng, cách một thông báo lỗi được viết — tất cả đều là thông điệp gửi tới người dùng.`;

const PHILOSOPHY_EN = `I work by three simple principles.

> Solve the right problem before solving it quickly. A correct solution that is slow is still useful; a fast wrong one only creates debt.

**Clarity beats cleverness.** I favour code that another person can read at two in the morning.

**Details are where respect shows.** The space between paragraphs, the speed of an animation, the wording of an error — all of it is a message to the person using the product.`;

const GOALS_VI = `Trong vài năm tới, tôi muốn:

- Xây dựng một nền tảng cá nhân đủ bền để trở thành nơi lưu giữ toàn bộ công việc sáng tạo của mình.
- Xuất bản một bộ sưu tập tranh kỹ thuật số hoàn chỉnh, có câu chuyện và có hệ thống.
- Viết đều hơn — mỗi tháng ít nhất hai bài về kỹ thuật và quá trình làm nghề.
- Làm việc cùng những nhóm nhỏ tin vào chi tiết và sự tử tế trong sản phẩm.`;

const GOALS_EN = `Over the next few years I want to:

- Build a personal platform durable enough to hold all of my creative work.
- Publish a complete digital art collection with a story and a system behind it.
- Write more consistently — at least two essays a month on craft and engineering.
- Work with small teams that believe in detail and care in products.`;

const PROJECTS = [
  {
    slug: "aurora-design-system",
    category: "product",
    featured: true,
    status: "completed",
    start: "2024-02-01",
    end: "2025-05-20",
    tech: ["TypeScript", "React", "Storybook", "Tailwind CSS", "Figma"],
    cover: "project-01",
    vi: {
      name: "Aurora Design System",
      short: "Hệ thống thiết kế dùng chung cho bốn sản phẩm, giảm một nửa thời gian dựng giao diện mới.",
      role: "Design Engineer",
      full: `## Bối cảnh

Bốn sản phẩm trong cùng một công ty đang có bốn bộ component khác nhau. Mỗi lần ra mắt tính năng mới, nhóm phải quyết định lại từ đầu: dùng nút nào, khoảng cách bao nhiêu, trạng thái lỗi hiển thị ra sao.

## Cách tiếp cận

Tôi bắt đầu từ kiểm kê chứ không phải từ thư viện. Chúng tôi chụp lại toàn bộ giao diện hiện có, gom thành 14 nhóm vấn đề, rồi thiết kế token trước khi động tới component.

- **Design token** cho màu, chữ, khoảng cách và chuyển động, xuất tự động từ Figma.
- **Component có kiểm thử hình ảnh** để tránh lệch giao diện giữa các sản phẩm.
- **Tài liệu sống** — ví dụ code chạy được ngay trong trang tài liệu.

\`\`\`tsx
<Button variant="primary" size="md" loading>
  Xuất bản
</Button>
\`\`\`

## Kết quả

Thời gian dựng một màn hình mới giảm khoảng một nửa. Quan trọng hơn, nhóm thiết kế và nhóm kỹ thuật lần đầu nói cùng một ngôn ngữ về khoảng cách và màu sắc.`,
    },
    en: {
      name: "Aurora Design System",
      short: "A shared design system for four products, halving the time to build a new interface.",
      role: "Design Engineer",
      full: `## Context

Four products inside one company had four different component libraries. Every new feature meant deciding again: which button, which spacing scale, how errors should look.

## Approach

I started with an inventory rather than a library. We captured the existing interfaces, grouped them into 14 recurring problems, and designed tokens before touching a single component.

- **Design tokens** for colour, type, spacing and motion, exported automatically from Figma.
- **Visually tested components** so products cannot drift apart unnoticed.
- **Living documentation** with working code examples inside the docs.

\`\`\`tsx
<Button variant="primary" size="md" loading>
  Publish
</Button>
\`\`\`

## Outcome

Building a new screen became roughly twice as fast. More importantly, design and engineering finally shared one vocabulary for spacing and colour.`,
    },
  },
  {
    slug: "harbor-analytics",
    category: "platform",
    featured: true,
    status: "completed",
    start: "2023-06-12",
    end: "2024-01-30",
    tech: ["Next.js", "PostgreSQL", "Prisma", "Recharts", "Vercel"],
    cover: "project-02",
    vi: {
      name: "Harbor Analytics",
      short: "Bảng điều khiển dữ liệu cho nhóm vận hành, thay thế mười bảng tính rời rạc.",
      role: "Full-stack Developer",
      full: `## Vấn đề

Nhóm vận hành theo dõi đơn hàng bằng mười bảng tính, mỗi bảng do một người quản lý. Không ai biết con số nào là mới nhất.

## Giải pháp

Một ứng dụng đọc trực tiếp từ cơ sở dữ liệu vận hành, với mô hình phân quyền theo vai trò và khả năng xuất báo cáo theo lịch.

- Truy vấn tổng hợp được đánh index theo khoảng thời gian.
- Bộ lọc chia sẻ được qua URL để cả nhóm nhìn cùng một góc dữ liệu.
- Cảnh báo khi một chỉ số vượt ngưỡng đã đặt.

## Điều tôi học được

Phần khó nhất không phải biểu đồ, mà là định nghĩa thống nhất cho từng chỉ số. Chúng tôi viết một từ điển dữ liệu trước khi viết một dòng query nào.`,
    },
    en: {
      name: "Harbor Analytics",
      short: "An operations analytics dashboard that replaced ten disconnected spreadsheets.",
      role: "Full-stack Developer",
      full: `## Problem

The operations team tracked orders across ten spreadsheets, each owned by one person. Nobody knew which number was current.

## Solution

An application reading directly from the operational database, with role-based access and scheduled report exports.

- Aggregation queries indexed by time range.
- Shareable filter state in the URL so the whole team looks at the same slice.
- Threshold alerts when a metric moves outside its expected band.

## What I learned

The hard part was never the charts — it was agreeing on a definition for each metric. We wrote a data dictionary before writing a single query.`,
    },
  },
  {
    slug: "lantern-notes",
    category: "product",
    featured: true,
    status: "in_progress",
    start: "2025-08-01",
    end: null,
    tech: ["React Native", "Expo", "SQLite", "TypeScript"],
    cover: "project-03",
    vi: {
      name: "Lantern Notes",
      short: "Ứng dụng ghi chú ngoại tuyến, ưu tiên tốc độ mở và sự yên tĩnh.",
      role: "Product Designer & Developer",
      full: `## Ý tưởng

Một ứng dụng ghi chú không cần mạng, mở dưới một giây, và không cố gắng trở thành mạng xã hội.

## Hiện trạng

Đang trong giai đoạn thử nghiệm nội bộ. Các phần đã hoàn thành:

- Soạn thảo Markdown với chế độ xem trước.
- Tìm kiếm cục bộ theo toàn văn, chạy trên SQLite FTS.
- Đồng bộ thủ công qua tệp xuất, không tài khoản, không telemetry.

## Nguyên tắc thiết kế

Mọi thao tác phải hoàn thành trong một lần chạm. Không có màn hình chào mừng, không có hướng dẫn dài dòng.`,
    },
    en: {
      name: "Lantern Notes",
      short: "An offline-first notes app built around speed and quiet.",
      role: "Product Designer & Developer",
      full: `## Idea

A notes app that needs no network, opens in under a second, and never tries to become a social network.

## Current state

In internal beta. Completed so far:

- Markdown writing with a preview mode.
- Full-text local search on SQLite FTS.
- Manual sync through file export — no accounts, no telemetry.

## Design principle

Every action should take a single gesture. No welcome screens, no long onboarding.`,
    },
  },
  {
    slug: "signal-api",
    category: "experiment",
    featured: false,
    status: "completed",
    start: "2022-03-15",
    end: "2022-11-10",
    tech: ["Node.js", "Fastify", "Redis", "PostgreSQL", "Docker"],
    cover: "project-04",
    vi: {
      name: "Signal API",
      short: "Cổng API cho một sản phẩm thông báo, xử lý 4 triệu sự kiện mỗi ngày.",
      role: "Backend Engineer",
      full: `## Phạm vi

Thiết kế lại lớp API của một sản phẩm thông báo đang gặp giới hạn về thông lượng.

## Những thay đổi chính

- Hàng đợi có thứ tự ưu tiên, tách luồng gửi khỏi luồng nhận sự kiện.
- Giới hạn tần suất theo người nhận, cấu hình được mà không cần triển khai lại.
- Idempotency key cho mọi yêu cầu ghi, để việc thử lại là an toàn.

## Kết quả

Độ trễ p95 giảm từ 680ms xuống 140ms; số sự kiện mất mát trong giờ cao điểm gần như bằng không.`,
    },
    en: {
      name: "Signal API",
      short: "The API gateway for a notifications product handling four million events a day.",
      role: "Backend Engineer",
      full: `## Scope

Redesign the API layer of a notifications product that had reached its throughput ceiling.

## Key changes

- A priority queue that separates event ingestion from delivery.
- Per-recipient rate limits, configurable without redeploying.
- Idempotency keys on every write so retries are always safe.

## Outcome

p95 latency dropped from 680ms to 140ms, and events lost during peak hours went to roughly zero.`,
    },
  },
];

const COLLECTIONS = [
  {
    slug: "noise-and-light",
    cover: "collection-01",
    featured: true,
    order: 1,
    vi: { name: "Nhiễu và Ánh sáng", description: "Những bức tranh bắt đầu từ một lỗi render và kết thúc ở một thứ có cảm xúc." },
    en: { name: "Noise & Light", description: "Pieces that began as a render error and ended up as something with feeling." },
  },
  {
    slug: "quiet-cities",
    cover: "collection-02",
    featured: true,
    order: 2,
    vi: { name: "Thành phố lặng", description: "Hình khối đô thị nhìn từ một khoảng cách đủ xa để không còn tiếng ồn." },
    en: { name: "Quiet Cities", description: "Urban geometry seen from far enough away that the noise disappears." },
  },
  {
    slug: "soft-geometry",
    cover: "collection-03",
    featured: false,
    order: 3,
    vi: { name: "Hình khối mềm", description: "Thử nghiệm với độ mờ, lớp lang và những đường cong không hoàn chỉnh." },
    en: { name: "Soft Geometry", description: "Experiments with blur, layering and incomplete curves." },
  },
];

const ARTWORKS = [
  {
    slug: "after-the-rain",
    media: "art-01",
    collection: "noise-and-light",
    featured: true,
    order: 1,
    medium: "SVG, gradient mesh",
    date: "2025-09-18",
    tags: ["abstract", "light"],
    vi: {
      title: "Sau cơn mưa",
      description:
        "Một bầu trời vừa tạnh, khi mọi thứ còn ướt và ánh sáng bị bẻ cong qua hơi nước. Tôi giữ lại đúng hai đường tròn và một đường chân trời — phần còn lại là để người xem tự điền vào.",
    },
    en: {
      title: "After the Rain",
      description:
        "A sky that has just cleared, everything still wet and light bending through vapour. I kept only two circles and a horizon line; the rest is left for the viewer to fill in.",
    },
  },
  {
    slug: "terracotta-hours",
    media: "art-02",
    collection: "soft-geometry",
    featured: true,
    order: 2,
    medium: "SVG, vector",
    date: "2025-07-02",
    tags: ["warm", "geometry"],
    vi: {
      title: "Giờ đất nung",
      description:
        "Khoảng thời gian trong ngày khi tường nhà chuyển sang màu cam và mọi bề mặt đều ấm. Một nghiên cứu về sắc độ và sự tĩnh lặng.",
    },
    en: {
      title: "Terracotta Hours",
      description:
        "That part of the day when walls turn orange and every surface is warm. A study of hue and stillness.",
    },
  },
  {
    slug: "forest-signal",
    media: "art-03",
    collection: "noise-and-light",
    featured: true,
    order: 3,
    medium: "SVG, grain",
    date: "2025-05-14",
    tags: ["nature", "green"],
    vi: {
      title: "Tín hiệu rừng",
      description:
        "Nếu một khu rừng phát tín hiệu, nó sẽ không phải là âm thanh. Tôi hình dung nó như những vòng tròn lan ra chậm hơn nhịp thở.",
    },
    en: {
      title: "Forest Signal",
      description:
        "If a forest broadcast a signal, it would not be sound. I imagined it as rings expanding slower than breathing.",
    },
  },
  {
    slug: "the-observatory",
    media: "art-04",
    collection: "quiet-cities",
    featured: true,
    order: 4,
    medium: "SVG, composition",
    date: "2025-03-21",
    tags: ["night", "architecture"],
    vi: {
      title: "Đài quan sát",
      description:
        "Một căn phòng hình tròn, một cửa sổ duy nhất, và toàn bộ vũ trụ nằm ngoài đó. Bức tranh này là bài tập về việc dùng rất ít chi tiết để gợi rất nhiều không gian.",
    },
    en: {
      title: "The Observatory",
      description:
        "A circular room, a single window, and the entire universe beyond it. A study in using very few details to imply a great deal of space.",
    },
  },
  {
    slug: "concrete-morning",
    media: "art-05",
    collection: "quiet-cities",
    featured: false,
    order: 5,
    medium: "SVG, minimal",
    date: "2024-12-08",
    tags: ["monochrome", "urban"],
    vi: {
      title: "Buổi sáng bê tông",
      description:
        "Bê tông vào sáng sớm có một màu rất riêng: không hẳn xám, cũng không hẳn xanh. Tôi dành cả bức tranh chỉ để tìm đúng sắc độ đó.",
    },
    en: {
      title: "Concrete Morning",
      description:
        "Concrete at dawn has a colour of its own: not quite grey, not quite blue. The whole piece is an attempt to find that exact hue.",
    },
  },
  {
    slug: "tide-memory",
    media: "art-06",
    collection: "noise-and-light",
    featured: false,
    order: 6,
    medium: "SVG, gradient",
    date: "2024-10-19",
    tags: ["ocean", "memory"],
    vi: {
      title: "Ký ức thuỷ triều",
      description:
        "Nước rút để lại những đường mờ trên cát, giống như ký ức để lại những đường mờ trong trí nhớ. Cùng một cơ chế, hai vật liệu khác nhau.",
    },
    en: {
      title: "Tide Memory",
      description:
        "Water receding leaves faint lines in sand, the way memory leaves faint lines in a mind. The same mechanism in two different materials.",
    },
  },
  {
    slug: "field-notes-ochre",
    media: "art-07",
    collection: "soft-geometry",
    featured: false,
    order: 7,
    medium: "SVG, texture",
    date: "2024-08-30",
    tags: ["warm", "texture"],
    vi: {
      title: "Ghi chép màu đất",
      description:
        "Một trang giấy cũ, một cây bút chì và không có kế hoạch nào. Tôi muốn bức tranh trông như được tìm thấy chứ không phải được tạo ra.",
    },
    en: {
      title: "Ochre Field Notes",
      description:
        "An old page, a pencil, and no plan. I wanted the piece to look found rather than made.",
    },
  },
  {
    slug: "rose-static",
    media: "art-08",
    collection: "soft-geometry",
    featured: false,
    order: 8,
    medium: "SVG, grain overlay",
    date: "2024-06-11",
    tags: ["pink", "noise"],
    vi: {
      title: "Nhiễu hồng",
      description:
        "Một thử nghiệm về việc làm mềm một hình học cứng bằng nhiễu và độ mờ. Kết quả là một bề mặt gần như có thể chạm vào.",
    },
    en: {
      title: "Rose Static",
      description:
        "An experiment in softening hard geometry with noise and blur. The result is a surface that almost feels touchable.",
    },
  },
];

const CATEGORIES = [
  { slug: "technology", kind: "article", vi: "Công nghệ", en: "Technology" },
  { slug: "software-engineering", kind: "article", vi: "Kỹ thuật phần mềm", en: "Software Engineering" },
  { slug: "artificial-intelligence", kind: "article", vi: "Trí tuệ nhân tạo", en: "Artificial Intelligence" },
  { slug: "personal-development", kind: "article", vi: "Phát triển bản thân", en: "Personal Development" },
  { slug: "creative-work", kind: "article", vi: "Công việc sáng tạo", en: "Creative Work" },
  { slug: "personal-thoughts", kind: "article", vi: "Suy nghĩ cá nhân", en: "Personal Thoughts" },
  { slug: "abstract", kind: "artwork", vi: "Trừu tượng", en: "Abstract" },
  { slug: "urban", kind: "artwork", vi: "Đô thị", en: "Urban" },
];

const TAGS = [
  "design-systems",
  "architecture",
  "ai",
  "productivity",
  "creativity",
  "typography",
  "databases",
  "writing",
];

const ARTICLES = [
  {
    slug: "design-systems-start-before-components",
    category: "software-engineering",
    cover: "article-01",
    featured: true,
    publishedAt: "2026-10-02",
    tags: ["design-systems", "architecture", "typography"],
    vi: {
      title: "Hệ thống thiết kế không bắt đầu từ component",
      subtitle: "Nó bắt đầu từ những quyết định bạn không muốn phải đưa ra lần thứ hai.",
      excerpt:
        "Một thư viện component đẹp vẫn có thể thất bại. Điều quyết định thành công của design system là những quy ước nằm trước component — và cách chúng được ghi lại.",
        seoTitle: "Design system bền vững: quy ước trước, component sau",
        seoDescription: "Vì sao một thư viện component đẹp vẫn có thể thất bại, và ba câu hỏi cần trả lời trước khi viết component đầu tiên.",
      content: `Khi được hỏi về design system, hầu hết chúng ta nghĩ ngay tới một trang Storybook đầy button, input và modal. Nhưng một thư viện component chỉ là phần nổi. Phần chìm — thứ quyết định hệ thống có sống được hai năm hay không — là những quyết định đã được đóng gói lại.

## Ba câu hỏi trước khi viết component đầu tiên

1. **Ai được phép thay đổi token?** Nếu câu trả lời là "ai cũng được", bạn đang có một bộ biến CSS, không phải một hệ thống.
2. **Điều gì xảy ra khi hai sản phẩm cần hai kích thước khác nhau?** Câu trả lời đúng thường là "thiết kế lại thang đo", không phải "thêm một prop".
3. **Làm sao biết một component đang bị dùng sai?** Nếu không đo được, bạn sẽ không bao giờ sửa được.

## Token trước, component sau

Một thang khoảng cách có bảy bước thường đủ cho mọi giao diện. Một thang màu có ba cấp độ ngữ nghĩa — surface, content, border — thường đủ cho cả light và dark mode.

\`\`\`css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --surface: #ffffff;
  --content: #20242c;
}
\`\`\`

Khi token ổn định, component gần như tự viết ra chính nó.

> Một design system tốt không làm cho mọi thứ giống nhau. Nó làm cho những quyết định nhỏ trở nên hiển nhiên, để con người có thể dành sự chú ý cho những quyết định lớn.

## Ghi lại lý do, không chỉ kết quả

Tài liệu hữu ích nhất trong một design system là tài liệu giải thích **vì sao**. Vì sao nút chính chỉ có một kích thước? Vì sao không có nút màu đỏ? Vì sao khoảng cách giữa các section là 96px?

Sáu tháng sau, người đọc tài liệu đó có thể là chính bạn. Hãy viết cho người đó.

## Kết luận

Component là kết quả. Quy ước là sản phẩm. Nếu bạn chỉ có thời gian làm một trong hai, hãy làm quy ước trước.`,
    },
    en: {
      title: "Design systems do not start with components",
      subtitle: "They start with the decisions you refuse to make twice.",
      excerpt:
        "A beautiful component library can still fail. What decides a design system's fate are the conventions that sit before the components — and how they are written down.",
        seoTitle: "A design system that lasts: conventions before components",
        seoDescription: "Why a beautiful component library can still fail, and the three questions to answer before writing the first component.",
      content: `When people talk about design systems, they usually picture a Storybook page full of buttons, inputs and modals. But a component library is only the visible part. The submerged part — the thing that decides whether the system is still alive in two years — is a set of decisions made once and packaged.

## Three questions before the first component

1. **Who may change a token?** If the answer is "anyone", you have a pile of CSS variables, not a system.
2. **What happens when two products need two different sizes?** The right answer is usually "redesign the scale", not "add a prop".
3. **How do you know a component is being misused?** If you cannot measure it, you will never fix it.

## Tokens first, components after

A seven-step spacing scale is usually enough for any interface. A colour scale with three semantic levels — surface, content, border — is usually enough for both light and dark mode.

\`\`\`css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --surface: #ffffff;
  --content: #20242c;
}
\`\`\`

Once the tokens are stable, components almost write themselves.

> A good design system does not make everything look the same. It makes the small decisions obvious so people can spend attention on the large ones.

## Record reasons, not only results

The most useful document in a design system explains **why**. Why does the primary button have one size? Why is there no red button? Why is the gap between sections 96px?

Six months later, the person reading that document may be you. Write it for them.

## Closing

Components are the output. Conventions are the product. If you only have time for one, do conventions first.`,
    },
  },
  {
    slug: "ai-changes-how-we-think",
    category: "artificial-intelligence",
    cover: "article-02",
    featured: true,
    publishedAt: "2026-09-08",
    tags: ["ai", "architecture", "productivity"],
    vi: {
      title: "AI không thay thế kỹ sư — nó thay đổi cách chúng ta nghĩ",
      subtitle: "Khi việc viết code trở nên rẻ, việc quyết định viết gì trở nên đắt hơn.",
      excerpt:
        "Công cụ AI viết được hàm, viết được test, viết được cả một module. Nhưng nó không chịu trách nhiệm về kiến trúc — và đó là nơi giá trị của kỹ sư nằm lại.",
        seoTitle: "Viết code rẻ hơn, quyết định đắt hơn: làm việc cùng AI",
        seoDescription: "Khi AI viết code trong mười giây, giá trị của kỹ sư chuyển sang định nghĩa bài toán, ranh giới module và kiểm chứng.",
      content: `Tôi đã dùng các công cụ sinh code trong hơn hai năm. Chúng thật sự hữu ích. Và chúng cũng thật sự đã thay đổi việc tôi dành thời gian vào đâu.

## Chi phí viết code đang giảm

Khi một hàm 30 dòng có thể được viết trong mười giây, giá trị của việc gõ nhanh giảm xuống. Nhưng chi phí đọc, kiểm chứng và bảo trì thì không giảm chút nào. Trên thực tế, nó tăng lên — vì lượng code được sinh ra nhiều hơn lượng code được hiểu.

> Code do máy viết không miễn phí. Nó chỉ chuyển hoá đơn từ lúc viết sang lúc đọc.

## Ba việc trở nên quan trọng hơn

**Định nghĩa bài toán.** Một mô tả sai sẽ tạo ra code đúng cho một vấn đề không tồn tại.

**Ranh giới module.** Khi mọi file đều có thể được sinh ra, điều giữ hệ thống đứng vững là ranh giới rõ ràng giữa các phần.

**Kiểm chứng.** Test không còn là việc của người viết code. Test là cách duy nhất để biết một thay đổi sinh tự động có an toàn hay không.

## Một quy trình tôi đang dùng

1. Viết mô tả vấn đề bằng tiếng Việt, cho một đồng nghiệp đọc.
2. Chốt interface trước khi chốt implementation.
3. Sinh code, rồi đọc lại từng dòng như thể người khác viết.
4. Viết test cho hành vi, không cho implementation.

## Điều tôi không làm

Tôi không để công cụ quyết định schema cơ sở dữ liệu. Tôi không để nó chọn thư viện. Và tôi không merge bất cứ thứ gì tôi không thể giải thích cho một người mới trong ba phút.

Công cụ tốt giúp chúng ta nghĩ nhiều hơn về những thứ quan trọng. Nếu nó chỉ giúp chúng ta viết nhiều hơn, chúng ta đang dùng nó sai.`,
    },
    en: {
      title: "AI will not replace engineers — it changes how we think",
      subtitle: "When writing code gets cheap, deciding what to write gets expensive.",
      excerpt:
        "AI tools can write a function, write the tests, even write a module. What they do not own is architecture — and that is where an engineer's value remains.",
        seoTitle: "Cheaper code, costlier decisions: working with AI",
        seoDescription: "When AI writes code in ten seconds, an engineer's value moves to defining the problem, drawing module boundaries and verifying.",
      content: `I have used code generation tools for over two years. They are genuinely useful. They have also genuinely changed where I spend my time.

## The cost of writing is falling

When a thirty-line function can be produced in ten seconds, the value of typing quickly drops. But the cost of reading, verifying and maintaining does not drop at all. In practice it rises, because more code is generated than understood.

> Machine-written code is not free. It just moves the bill from writing to reading.

## Three things that matter more now

**Defining the problem.** A wrong description produces correct code for a problem that does not exist.

**Module boundaries.** When any file can be generated, what keeps a system standing is a clear boundary between parts.

**Verification.** Tests are no longer the writer's chore. They are the only way to know a generated change is safe.

## A workflow I am using

1. Describe the problem in plain language and have a colleague read it.
2. Settle the interface before the implementation.
3. Generate code, then read every line as if someone else wrote it.
4. Write tests for behaviour, not for implementation.

## What I do not delegate

I do not let a tool choose the database schema. I do not let it choose libraries. And I do not merge anything I cannot explain to a newcomer in three minutes.

Good tools help us think harder about what matters. If they only help us write more, we are using them wrong.`,
    },
  },
  {
    slug: "a-day-of-deep-work",
    category: "personal-development",
    cover: "article-03",
    featured: false,
    publishedAt: "2026-07-19",
    tags: ["productivity", "writing"],
    vi: {
      title: "Một ngày làm việc sâu",
      subtitle: "Không phải năng suất. Chỉ là một ngày không bị chia nhỏ.",
      excerpt:
        "Tôi đã thử nhiều hệ thống quản lý thời gian. Thứ duy nhất thay đổi chất lượng công việc của tôi là bảo vệ ba khối thời gian mỗi ngày.",
        seoTitle: "Làm việc sâu với ba khối 90 phút mỗi ngày",
        seoDescription: "Không cần tám tiếng tập trung: chỉ cần bảo vệ ba khối thời gian và bỏ những thứ làm mình xao nhãng.",
      content: `Có một câu hỏi tôi hỏi mình mỗi tối: hôm nay tôi đã làm được một việc có ý nghĩa, hay chỉ xử lý được nhiều việc nhỏ?

## Ba khối, không phải tám tiếng

Tôi không cố làm việc sâu tám tiếng. Tôi bảo vệ ba khối 90 phút:

- **Buổi sáng:** việc khó nhất — thiết kế, kiến trúc, viết.
- **Đầu giờ chiều:** việc cần phản hồi nhanh — review, trao đổi, sửa lỗi nhỏ.
- **Cuối giờ chiều:** việc có thể bỏ dở — tài liệu, dọn dẹp, chuẩn bị cho ngày mai.

Mọi thứ khác chen vào những khoảng giữa.

## Những thứ tôi đã bỏ

Tôi bỏ thông báo trên màn hình. Tôi bỏ việc mở email trước 10 giờ. Tôi bỏ thói quen trả lời tin nhắn ngay lập tức — trừ khi đó là một sự cố thật.

> Sự chú ý là tài nguyên duy nhất không thể mua thêm. Mỗi lần bị ngắt, chúng ta trả giá bằng thời gian quay lại, không chỉ thời gian bị mất.

## Điều bất ngờ

Khi làm ít việc hơn, tôi hoàn thành nhiều việc hơn. Không phải vì tôi nhanh hơn, mà vì tôi ít phải làm lại.

## Một lời khuyên

Đừng bắt đầu bằng một hệ thống phức tạp. Hãy chọn một khối 90 phút trong ngày mai, tắt mọi thứ, và xem điều gì xảy ra.`,
    },
    en: {
      title: "A day of deep work",
      subtitle: "Not productivity. Just a day that is not cut into pieces.",
      excerpt:
        "I have tried many time-management systems. The only thing that changed the quality of my work was protecting three blocks of time each day.",
        seoTitle: "Deep work in three 90-minute blocks a day",
        seoDescription: "You do not need eight focused hours: protect three blocks of time and remove the things that interrupt you.",
      content: `There is a question I ask myself every evening: did I do one meaningful thing today, or did I only get through many small ones?

## Three blocks, not eight hours

I do not try to do deep work for eight hours. I protect three ninety-minute blocks:

- **Morning:** the hardest thing — design, architecture, writing.
- **Early afternoon:** things that need a fast response — reviews, conversations, small fixes.
- **Late afternoon:** things that can be interrupted — documentation, tidying, preparing tomorrow.

Everything else goes between them.

## What I removed

I removed on-screen notifications. I stopped opening email before ten. I stopped answering messages instantly — unless it is a real incident.

> Attention is the only resource you cannot buy more of. Every interruption is paid for in recovery time, not just lost time.

## The surprise

Doing fewer things, I finish more. Not because I am faster, but because I redo less.

## One suggestion

Do not start with an elaborate system. Pick one ninety-minute block tomorrow, turn everything off, and see what happens.`,
    },
  },
  {
    slug: "colour-as-an-engineering-decision",
    category: "creative-work",
    cover: "article-04",
    featured: false,
    publishedAt: "2026-06-04",
    tags: ["creativity", "typography", "design-systems"],
    vi: {
      title: "Màu sắc như một quyết định kỹ thuật",
      subtitle: "Một bảng màu không phải là cảm hứng. Nó là một tập hợp các ràng buộc.",
      excerpt:
        "Chọn màu trong sản phẩm số khác với chọn màu trên canvas: bạn phải tính đến độ tương phản, dark mode, màn hình lỗi và cả những người không nhìn thấy màu.",
        seoTitle: "Màu sắc trong sản phẩm số: bắt đầu từ độ tương phản",
        seoDescription: "Bảng màu là hạ tầng, không phải cảm hứng: kiểm tra tương phản, đặt tên màu theo vai trò và dùng sắc nhấn thật tiết kiệm.",
      content: `Trong hội hoạ, màu là biểu cảm. Trong sản phẩm số, màu là hạ tầng. Nó phải hoạt động trong mọi trạng thái, trên mọi màn hình, với mọi người dùng.

## Bắt đầu từ độ tương phản, không từ sắc đẹp

Một cặp màu đẹp trên màn hình retina có thể không đọc được trên một chiếc laptop cũ ngoài trời. Tôi luôn kiểm tra tỷ lệ tương phản trước khi yêu thích một màu nào đó.

- Văn bản thường: tối thiểu 4.5:1.
- Văn bản lớn: tối thiểu 3:1.
- Đường viền và trạng thái focus: tối thiểu 3:1.

## Xây dựng theo cấp ngữ nghĩa

Thay vì đặt tên màu theo sắc độ, tôi đặt tên theo vai trò:

\`\`\`css
--surface: #ffffff;
--surface-muted: #f1f2ee;
--content: #20242c;
--content-muted: #777f8c;
--border: #e8eaf0;
--accent: #536dfe;
\`\`\`

Khi dark mode xuất hiện, tôi chỉ cần thay giá trị, không phải sửa component nào.

> Nếu một bảng màu không tồn tại được ở chế độ tối, nó chưa phải là một bảng màu — nó là một bản nháp.

## Một sắc nhấn, dùng thật tiết kiệm

Sắc nhấn mất giá trị khi xuất hiện ở mọi nơi. Tôi dành nó cho đúng ba việc: hành động chính, liên kết đang hoạt động, và trạng thái cần chú ý.

## Kết luận

Màu tốt không phải màu đẹp nhất. Màu tốt là màu mà bạn không phải nghĩ về nó khi đang đọc nội dung.`,
    },
    en: {
      title: "Colour as an engineering decision",
      subtitle: "A palette is not inspiration. It is a set of constraints.",
      excerpt:
        "Choosing colour in a digital product is not like choosing it on a canvas: you have to account for contrast, dark mode, bad screens, and people who cannot see colour.",
        seoTitle: "Colour in digital products: start with contrast",
        seoDescription: "A palette is infrastructure, not inspiration: check contrast, name colours by role, and spend the accent sparingly.",
      content: `In painting, colour is expression. In digital products, colour is infrastructure. It has to work in every state, on every screen, for every person.

## Start with contrast, not with beauty

A pair of colours that looks lovely on a retina display may be unreadable on an old laptop outdoors. I check contrast ratios before I fall in love with a hue.

- Body text: at least 4.5:1.
- Large text: at least 3:1.
- Borders and focus states: at least 3:1.

## Build with semantic levels

Rather than naming colours by hue, I name them by role:

\`\`\`css
--surface: #ffffff;
--surface-muted: #f1f2ee;
--content: #20242c;
--content-muted: #777f8c;
--border: #e8eaf0;
--accent: #536dfe;
\`\`\`

When dark mode arrives, I replace values and touch no component.

> If a palette cannot survive dark mode, it is not a palette yet — it is a draft.

## One accent, used sparingly

An accent loses its power when it appears everywhere. I reserve it for exactly three things: the primary action, the active link, and the state that needs attention.

## Closing

Good colour is not the prettiest colour. Good colour is the one you never have to think about while reading.`,
    },
  },
  {
    slug: "writing-to-think",
    category: "personal-thoughts",
    cover: "article-05",
    featured: false,
    publishedAt: "2026-04-27",
    tags: ["writing", "creativity"],
    vi: {
      title: "Viết để nghĩ",
      subtitle: "Tôi không viết vì đã hiểu. Tôi viết để hiểu.",
      excerpt:
        "Một trang giấy trống là công cụ suy nghĩ rẻ nhất và hiệu quả nhất mà tôi có. Bài viết này là về việc dùng nó thường xuyên hơn.",
        seoTitle: "Viết 200 từ mỗi sáng để nghĩ rõ hơn",
        seoDescription: "Một trang giấy trống là công cụ suy nghĩ rẻ nhất: viết buộc mỗi câu phải nối tiếp câu trước và phơi bày lỗ hổng trong lập luận.",
      content: `Có một khoảng cách giữa cảm giác "tôi hiểu rồi" và việc thực sự hiểu. Khoảng cách đó thường chỉ được lấp đầy khi tôi viết ra giấy.

## Vì sao viết hiệu quả hơn nghĩ

Khi nghĩ, chúng ta có thể nhảy qua các bước. Khi viết, mỗi câu phải nối tiếp câu trước. Những lỗ hổng trong lập luận trở nên rõ ràng ngay khi chúng xuất hiện trên trang.

> Nếu bạn không thể viết nó thành ba câu, bạn chưa hiểu nó.

## Thói quen nhỏ

Tôi viết 200 từ mỗi sáng, không sửa, không đăng. Mục đích không phải là tạo ra thứ gì hay, mà là làm cho suy nghĩ của ngày hôm đó hiện ra thành hình.

Thỉnh thoảng một đoạn trong số đó trở thành một bài viết. Phần lớn thì không. Cả hai đều ổn.

## Viết cho người đọc cụ thể

Bài viết tốt nhất của tôi là những bài viết cho một người cụ thể — một đồng nghiệp, một người bạn, một học viên. Khi có người đọc trong đầu, tôi không thể viết những câu vô nghĩa.

## Điều tôi học được

Viết không phải là bước cuối cùng của quá trình suy nghĩ. Nó là quá trình đó.

Nếu bạn đang băn khoăn về một quyết định, hãy viết một trang về nó. Bạn sẽ biết mình thật sự nghĩ gì trước khi hết trang.`,
    },
    en: {
      title: "Writing to think",
      subtitle: "I do not write because I understand. I write in order to understand.",
      excerpt:
        "A blank page is the cheapest and most effective thinking tool I own. This piece is about using it more often.",
        seoTitle: "Write 200 words each morning to think clearly",
        seoDescription: "A blank page is the cheapest thinking tool: writing forces each sentence to follow the last and exposes gaps in reasoning.",
      content: `There is a gap between feeling that I understand and actually understanding. That gap usually closes only when I write it down.

## Why writing beats thinking

When thinking, we can skip steps. When writing, each sentence has to follow the previous one. Gaps in the reasoning become visible the moment they land on the page.

> If you cannot write it in three sentences, you do not understand it yet.

## A small habit

I write 200 words every morning — no editing, no publishing. The point is not to produce something good, but to make that day's thinking take a shape.

Occasionally a paragraph becomes an essay. Most do not. Both are fine.

## Write for a specific reader

My best writing is addressed to one person — a colleague, a friend, a student. With a reader in mind, I cannot get away with empty sentences.

## What I learned

Writing is not the final step of thinking. It is thinking.

If you are stuck on a decision, write one page about it. You will know what you actually think before the page ends.`,
    },
  },
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function upsertMedia(key: string, width: number, height: number, titleText: string, mimeType = "image/svg+xml") {
  // 8C-8: demo media carries no per-locale alt text. Store alt as "" so the
  // rendering layer falls back to the localized title/name
  // (`cover.alt || article.title`, etc.) instead of an English-only alt.
  // The English label is kept as `title` for the admin media library.
  return prisma.media.upsert({
    where: { storageKey: `demo/${key}` },
    update: { url: `/demo/${key}`, width, height, alt: "" },
    create: {
      storageKey: `demo/${key}`,
      url: `/demo/${key}`,
      filename: `${key}`,
      mimeType,
      size: 12000,
      width,
      height,
      alt: "",
      title: titleText,
    },
  });
}

async function main() {
  console.log("Seeding demo content…");

  // ---------------------------------------------------------------- media
  const avatar = await upsertMedia("avatar.svg", 900, 1125, "Placeholder portrait");
  const artworksMedia = new Map<string, string>();
  for (const artwork of ARTWORKS) {
    const meta: Record<string, [number, number]> = {
      "art-01": [900, 1200],
      "art-02": [1200, 900],
      "art-03": [900, 1400],
      "art-04": [1000, 1000],
      "art-05": [1200, 800],
      "art-06": [900, 1100],
      "art-07": [1000, 1300],
      "art-08": [1200, 900],
    };
    const [width, height] = meta[artwork.media] ?? [1200, 1500];
    const media = await upsertMedia(`${artwork.media}.svg`, width, height, artwork.en.title);
    artworksMedia.set(artwork.media, media.id);
  }

  const projectMedia = new Map<string, string>();
  for (const project of PROJECTS) {
    const media = await upsertMedia(`${project.cover}.svg`, 1600, 1000, project.en.name);
    projectMedia.set(project.cover, media.id);
  }

  const articleMedia = new Map<string, string>();
  for (const article of ARTICLES) {
    const media = await upsertMedia(`${article.cover}.svg`, 1600, 1000, article.en.title);
    articleMedia.set(article.cover, media.id);
  }

  const collectionMedia = new Map<string, string>();
  for (const collection of COLLECTIONS) {
    const media = await upsertMedia(`${collection.cover}.svg`, 1600, 1000, collection.en.name);
    collectionMedia.set(collection.cover, media.id);
  }

  // -------------------------------------------------------------- profile
  const existingProfile = await prisma.profile.findFirst({ orderBy: { createdAt: "asc" } });
  const profile = existingProfile
    ? await prisma.profile.update({
        where: { id: existingProfile.id },
        data: {
          email: DEMO.profile.email,
          phone: DEMO.profile.phone,
          location: DEMO.profile.location,
          avatarMediaId: avatar.id,
          availableForWork: true,
        },
      })
    : await prisma.profile.create({
        data: {
          email: DEMO.profile.email,
          phone: DEMO.profile.phone,
          location: DEMO.profile.location,
          avatarMediaId: avatar.id,
          availableForWork: true,
        },
      });

  const profileTranslations = [
    {
      locale: "vi",
      fullName: DEMO.vi.fullName,
      title: DEMO.vi.title,
      shortBio: DEMO.vi.shortBio,
      longBio: LONG_BIO_VI,
      interests: INTERESTS_VI,
      philosophy: PHILOSOPHY_VI,
      futureGoals: GOALS_VI,
      seoTitle: "Portfolio của Tên Của Bạn — thiết kế sản phẩm, kỹ thuật & nghệ thuật số",
      seoDescription:
        "Portfolio cá nhân: hệ thống thiết kế, sản phẩm dữ liệu, tranh kỹ thuật số và bài viết về nghề làm sản phẩm.",
    },
    {
      locale: "en",
      fullName: DEMO.en.fullName,
      title: DEMO.en.title,
      shortBio: DEMO.en.shortBio,
      longBio: LONG_BIO_EN,
      interests: INTERESTS_EN,
      philosophy: PHILOSOPHY_EN,
      futureGoals: GOALS_EN,
      seoTitle: "Portfolio of Your Name — product design, engineering & digital art",
      seoDescription:
        "Personal portfolio: design systems, data products, digital art and essays on the craft of building products.",
    },
  ];

  for (const translation of profileTranslations) {
    await prisma.profileTranslation.upsert({
      where: { profileId_locale: { profileId: profile.id, locale: translation.locale } },
      update: translation,
      create: { profileId: profile.id, ...translation },
    });
  }

  // --------------------------------------------------------- skills & links
  const skills = [
    { name: "TypeScript", category: "engineering", level: 5, order: 1 },
    { name: "React / Next.js", category: "engineering", level: 5, order: 2 },
    { name: "Node.js", category: "engineering", level: 4, order: 3 },
    { name: "PostgreSQL & Prisma", category: "engineering", level: 4, order: 4 },
    { name: "Kiểm thử & CI", category: "engineering", level: 4, order: 5 },
    { name: "Thiết kế hệ thống", category: "design", level: 5, order: 1 },
    { name: "UI/UX & Prototyping", category: "design", level: 4, order: 2 },
    { name: "Design token", category: "design", level: 5, order: 3 },
    { name: "Typography", category: "design", level: 4, order: 4 },
    { name: "Digital painting", category: "art", level: 4, order: 1 },
    { name: "Colour & composition", category: "art", level: 4, order: 2 },
    { name: "Vector illustration", category: "art", level: 3, order: 3 },
    { name: "Figma", category: "tools", level: 5, order: 1 },
    { name: "Git & GitHub Actions", category: "tools", level: 4, order: 2 },
    { name: "Docker", category: "tools", level: 3, order: 3 },
    { name: "Procreate", category: "tools", level: 4, order: 4 },
  ];

  for (const skill of skills) {
    const existing = await prisma.skill.findFirst({ where: { name: skill.name } });
    if (existing) {
      await prisma.skill.update({ where: { id: existing.id }, data: skill });
    } else {
      await prisma.skill.create({ data: skill });
    }
  }

  const socialLinks = [
    // 8D-10: no placeholder example.com profiles. SocialLink.url is a
    // required column, so the placeholders keep an empty URL and are hidden
    // (visible: false) — getSocialLinks only returns visible rows, and the
    // layout's sameAs list filters out non-http URLs, so nothing renders.
    { platform: "github", url: "", label: "GitHub", visible: false },
    { platform: "linkedin", url: "", label: "LinkedIn", visible: false },
    { platform: "facebook", url: "", label: "Facebook", visible: false },
    { platform: "instagram", url: "", label: "Instagram", visible: false },
    { platform: "behance", url: "", label: "Behance", visible: false },
    { platform: "email", url: "mailto:hello@example.com", label: "Email", visible: true },
  ];

  for (const [index, link] of socialLinks.entries()) {
    const existing = await prisma.socialLink.findFirst({ where: { platform: link.platform } });
    if (existing) {
      await prisma.socialLink.update({ where: { id: existing.id }, data: { ...link, order: index } });
    } else {
      await prisma.socialLink.create({ data: { ...link, order: index } });
    }
  }

  // ------------------------------------------------------------ education
  const educationEntries = [
    {
      institution: "Đại học Bách khoa (demo)",
      location: "TP. Hồ Chí Minh",
      startYear: 2013,
      endYear: 2017,
      vi: { degree: "Kỹ sư", field: "Khoa học máy tính", description: "Chuyên ngành hệ thống thông tin. Đồ án tốt nghiệp về tìm kiếm toàn văn." },
      en: { degree: "BEng", field: "Computer Science", description: "Information systems track. Final project on full-text search." },
    },
    {
      institution: "Học viện thiết kế (demo)",
      location: "Trực tuyến",
      startYear: 2020,
      endYear: 2021,
      vi: { degree: "Chứng chỉ", field: "Thiết kế tương tác", description: "Chương trình một năm về thiết kế sản phẩm số và nghiên cứu người dùng." },
      en: { degree: "Certificate", field: "Interaction Design", description: "A one-year programme in digital product design and user research." },
    },
  ];

  for (const entry of educationEntries) {
    const existing = await prisma.education.findFirst({ where: { institution: entry.institution } });
    const common = {
      institution: entry.institution,
      location: entry.location,
      startYear: entry.startYear,
      endYear: entry.endYear,
      isCurrent: false,
      order: educationEntries.indexOf(entry),
      visible: true,
    };
    const record = existing
      ? await prisma.education.update({ where: { id: existing.id }, data: common })
      : await prisma.education.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      await prisma.educationTranslation.upsert({
        where: { educationId_locale: { educationId: record.id, locale } },
        update: entry[locale],
        create: { educationId: record.id, locale, ...entry[locale] },
      });
    }
  }

  // ----------------------------------------------------------- experience
  const experienceEntries = [
    {
      company: "Studio nội bộ (demo)",
      location: "TP. Hồ Chí Minh",
      startDate: new Date("2023-04-01"),
      endDate: null,
      isCurrent: true,
      vi: {
        role: "Design Engineer",
        summary: "Dẫn dắt hệ thống thiết kế và nền tảng nội dung cho ba sản phẩm.",
        achievements:
          "- Xây dựng design system dùng chung cho bốn sản phẩm.\n- Thiết kế kiến trúc CMS song ngữ phục vụ 12.000 lượt đọc mỗi tháng.\n- Dẫn dắt hai kỹ sư và một nhà thiết kế.",
      },
      en: {
        role: "Design Engineer",
        summary: "Leading the design system and content platform for three products.",
        achievements:
          "- Built a shared design system across four products.\n- Designed a bilingual CMS architecture serving 12,000 monthly reads.\n- Mentored two engineers and one designer.",
      },
    },
    {
      company: "Công ty sản phẩm (demo)",
      location: "TP. Hồ Chí Minh",
      startDate: new Date("2020-02-01"),
      endDate: new Date("2023-03-01"),
      isCurrent: false,
      vi: {
        role: "Frontend Engineer",
        summary: "Phụ trách giao diện cho bảng điều khiển dữ liệu và hệ thống phân quyền.",
        achievements:
          "- Chuyển kiến trúc frontend sang Next.js, giảm 40% thời gian tải trang đầu.\n- Xây dựng bộ component có kiểm thử hình ảnh.\n- Phối hợp với nhóm thiết kế để thống nhất thang khoảng cách.",
      },
      en: {
        role: "Frontend Engineer",
        summary: "Owned the interface for the analytics dashboard and access-control flows.",
        achievements:
          "- Migrated the frontend to Next.js, cutting first load by 40%.\n- Built a component library with visual regression tests.\n- Worked with design to unify the spacing scale.",
      },
    },
    {
      company: "Công ty phần mềm (demo)",
      location: "Hà Nội",
      startDate: new Date("2017-08-01"),
      endDate: new Date("2020-01-01"),
      isCurrent: false,
      vi: {
        role: "Software Engineer",
        summary: "Phát triển API và các dịch vụ nội bộ cho sản phẩm thông báo.",
        achievements:
          "- Thiết kế lại API gateway, giảm p95 từ 680ms xuống 140ms.\n- Viết thư viện nội bộ cho idempotency key.\n- Thiết lập pipeline CI đầu tiên của nhóm.",
      },
      en: {
        role: "Software Engineer",
        summary: "Built APIs and internal services for the notifications product.",
        achievements:
          "- Redesigned the API gateway, cutting p95 from 680ms to 140ms.\n- Wrote an internal idempotency-key library.\n- Set up the team's first CI pipeline.",
      },
    },
  ];

  for (const entry of experienceEntries) {
    const existing = await prisma.experience.findFirst({ where: { company: entry.company } });
    const common = {
      company: entry.company,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      order: experienceEntries.indexOf(entry),
      visible: true,
    };
    const record = existing
      ? await prisma.experience.update({ where: { id: existing.id }, data: common })
      : await prisma.experience.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      await prisma.experienceTranslation.upsert({
        where: { experienceId_locale: { experienceId: record.id, locale } },
        update: entry[locale],
        create: { experienceId: record.id, locale, ...entry[locale] },
      });
    }
  }

  // ------------------------------------------------------------ categories
  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: category.slug } });
    const record = existing
      ? await prisma.category.update({ where: { id: existing.id }, data: { kind: category.kind } })
      : await prisma.category.create({ data: { slug: category.slug, kind: category.kind } });

    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: record.id, locale: "vi" } },
      update: { name: category.vi, description: "" },
      create: { categoryId: record.id, locale: "vi", name: category.vi },
    });
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: record.id, locale: "en" } },
      update: { name: category.en, description: "" },
      create: { categoryId: record.id, locale: "en", name: category.en },
    });
    categoryIds.set(category.slug, record.id);
  }

  const tagIds = new Map<string, string>();
  for (const tag of TAGS) {
    const record = await prisma.tag.upsert({
      where: { slug: tag },
      update: {},
      create: { slug: tag, name: tag.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) },
    });
    tagIds.set(tag, record.id);
  }

  // --------------------------------------------------------------- admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "";
  if (adminPassword.length >= 10) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: process.env.SEED_ADMIN_NAME || "Site Owner",
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: "SUPER_ADMIN",
        },
      });
      console.log(`Created admin account ${adminEmail}`);
    } else {
      console.log(`Admin account ${adminEmail} already exists — password left unchanged.`);
    }
  } else {
    console.warn("SEED_ADMIN_PASSWORD is missing or too short: no admin account created.");
  }

  // -------------------------------------------------------------- projects
  for (const project of PROJECTS) {
    const existing = await prisma.project.findUnique({ where: { slug: project.slug } });
    const common = {
      slug: project.slug,
      category: project.category,
      thumbnailMediaId: projectMedia.get(project.cover) ?? null,
      status: project.status,
      startDate: new Date(project.start),
      completionDate: project.end ? new Date(project.end) : null,
      githubUrl: null,
      demoUrl: null,
      featured: project.featured,
      visibility: "public",
      order: PROJECTS.indexOf(project),
      publishedAt: daysAgo(30 + PROJECTS.indexOf(project) * 10),
      deletedAt: null,
    };
    const record = existing
      ? await prisma.project.update({ where: { id: existing.id }, data: common })
      : await prisma.project.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      const block = project[locale];
      await prisma.projectTranslation.upsert({
        where: { projectId_locale: { projectId: record.id, locale } },
        update: {
          name: block.name,
          shortDescription: block.short,
          fullDescription: block.full,
          role: block.role,
        },
        create: {
          projectId: record.id,
          locale,
          name: block.name,
          shortDescription: block.short,
          fullDescription: block.full,
          role: block.role,
        },
      });
    }

    await prisma.projectTechnology.deleteMany({ where: { projectId: record.id } });
    await prisma.projectTechnology.createMany({
      data: project.tech.map((name, index) => ({ projectId: record.id, name, order: index })),
    });
  }

  // ------------------------------------------------------------ collections
  const collectionIds = new Map<string, string>();
  for (const collection of COLLECTIONS) {
    const existing = await prisma.artworkCollection.findUnique({ where: { slug: collection.slug } });
    const common = {
      slug: collection.slug,
      coverMediaId: collectionMedia.get(collection.cover) ?? null,
      featured: collection.featured,
      order: collection.order,
      visibility: "public",
      deletedAt: null,
    };
    const record = existing
      ? await prisma.artworkCollection.update({ where: { id: existing.id }, data: common })
      : await prisma.artworkCollection.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      await prisma.collectionTranslation.upsert({
        where: { collectionId_locale: { collectionId: record.id, locale } },
        update: { name: collection[locale].name, description: collection[locale].description },
        create: {
          collectionId: record.id,
          locale,
          name: collection[locale].name,
          description: collection[locale].description,
        },
      });
    }
    collectionIds.set(collection.slug, record.id);
  }

  // -------------------------------------------------------------- artworks
  for (const artwork of ARTWORKS) {
    const existing = await prisma.artwork.findUnique({ where: { slug: artwork.slug } });
    const common = {
      slug: artwork.slug,
      imageMediaId: artworksMedia.get(artwork.media)!,
      thumbnailMediaId: null,
      collectionId: collectionIds.get(artwork.collection) ?? null,
      categoryId: categoryIds.get(artwork.slug === "concrete-morning" ? "urban" : "abstract") ?? null,
      medium: artwork.medium,
      createdDate: new Date(artwork.date),
      featured: artwork.featured,
      order: artwork.order,
      visibility: "public",
      deletedAt: null,
    };
    const record = existing
      ? await prisma.artwork.update({ where: { id: existing.id }, data: common })
      : await prisma.artwork.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      await prisma.artworkTranslation.upsert({
        where: { artworkId_locale: { artworkId: record.id, locale } },
        update: { title: artwork[locale].title, description: artwork[locale].description },
        create: {
          artworkId: record.id,
          locale,
          title: artwork[locale].title,
          description: artwork[locale].description,
        },
      });
    }

    await prisma.artworkTag.deleteMany({ where: { artworkId: record.id } });
    for (const tag of artwork.tags) {
      const record2 = await prisma.tag.upsert({
        where: { slug: tag },
        update: {},
        create: { slug: tag, name: tag.replace(/-/g, " ") },
      });
      await prisma.artworkTag.create({ data: { artworkId: record.id, tagId: record2.id } });
    }
  }

  // --------------------------------------------------------------- articles
  // The fallback editor account must be an upsert, not a plain create:
  // on a database that was seeded before (e.g. production, seeded 13:55
  // 14/11 without an admin), editor@example.com already exists and a
  // create() crashes the whole seed with P2002 before the Phase 10 demo
  // survey/service/slots below are reached. Re-runs reuse the account.
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const authorId =
    admin?.id ??
    (
      await prisma.user.upsert({
        where: { email: "editor@example.com" },
        update: {},
        create: {
          email: "editor@example.com",
          name: "Editor",
          passwordHash: await bcrypt.hash(`disabled-${Date.now()}-${Math.random()}`, 12),
          role: "ADMIN",
          isActive: false,
        },
      })
    ).id;

  for (const article of ARTICLES) {
    const existing = await prisma.article.findUnique({ where: { slug: article.slug } });
    const common = {
      slug: article.slug,
      coverMediaId: articleMedia.get(article.cover) ?? null,
      categoryId: categoryIds.get(article.category) ?? null,
      authorId,
      status: "published",
      // 8C-9: exactly one seed article uses the editorial template so it is
      // live-verifiable (the first/featured article). The rest stay default.
      template: ARTICLES.indexOf(article) === 0 ? "editorial" : "default",
      publishedAt: new Date(article.publishedAt),
      scheduledFor: null,
      featured: article.featured,
      visibility: "public",
      readingMinutes: Math.max(3, Math.round(article.vi.content.split(/\s+/).length / 200)),
      deletedAt: null,
    };
    const record = existing
      ? await prisma.article.update({ where: { id: existing.id }, data: common })
      : await prisma.article.create({ data: common });

    for (const locale of ["vi", "en"] as const) {
      const block = article[locale];
      await prisma.articleTranslation.upsert({
        where: { articleId_locale: { articleId: record.id, locale } },
        update: {
          title: block.title,
          subtitle: block.subtitle,
          excerpt: block.excerpt,
          content: block.content,
          seoTitle: block.seoTitle,
          seoDescription: block.seoDescription,
        },
        create: {
          articleId: record.id,
          locale,
          title: block.title,
          subtitle: block.subtitle,
          excerpt: block.excerpt,
          content: block.content,
          seoTitle: block.seoTitle,
          seoDescription: block.seoDescription,
        },
      });
    }

    await prisma.articleTag.deleteMany({ where: { articleId: record.id } });
    for (const tag of article.tags) {
      const tagId = tagIds.get(tag);
      if (tagId) await prisma.articleTag.create({ data: { articleId: record.id, tagId } });
    }
  }

  // -------------------------------------------------------------- settings
  const settings: Record<string, string> = {
    siteName: "Portfolio Studio",
    siteTagline: "Product design, engineering and digital art",
    seoTitle: "Portfolio Studio — Product designer & software engineer",
    seoDescription:
      "A personal portfolio with selected technology work, a digital art gallery and essays on design, engineering and creative practice.",
    seoKeywords: "portfolio, design system, software engineering, digital art, writing, next.js",
    footerText:
      "Một không gian cá nhân cho công việc thiết kế, kỹ thuật và nghệ thuật. Toàn bộ nội dung có thể thay thế từ trang quản trị.",
    footerTextEn:
      "A personal space for design, engineering and art work. Every piece of content can be replaced from the admin dashboard.",
    contactEmail: DEMO.profile.email,
    contactPhone: DEMO.profile.phone,
    contactLocation: DEMO.profile.location,
    logoMediaId: "",
    faviconMediaId: "",
    postsPerPage: "9",
    defaultTheme: "light",
    showDemoBadge: "true",
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // --------------------------------------------------------------- messages
  const demoMessages = [
    {
      name: "Demo Visitor",
      email: "visitor@example.com",
      subject: "Hỏi về thiết kế hệ thống",
      message:
        "Xin chào, tôi đang tìm hiểu về cách xây dựng design system cho một nhóm nhỏ. Bạn có nhận tư vấn trong tháng tới không?",
      status: "unread",
      days: 1,
    },
    {
      name: "Sample Recruiter",
      email: "recruiter@example.com",
      subject: "Vị trí Design Engineer",
      message:
        "Chúng tôi đang tìm một người vừa làm thiết kế vừa viết code cho sản phẩm B2B. Bạn có mở với cơ hội mới không?",
      status: "read",
      days: 4,
    },
    {
      name: "Art Collector (demo)",
      email: "collector@example.com",
      subject: "Về bộ sưu tập Nhiễu và Ánh sáng",
      message: "Tôi rất thích bộ sưu tập này. Các tác phẩm có phiên bản in giới hạn không?",
      status: "archived",
      days: 12,
    },
  ];

  for (const message of demoMessages) {
    const existing = await prisma.contactMessage.findFirst({ where: { email: message.email, subject: message.subject } });
    if (!existing) {
      await prisma.contactMessage.create({
        data: {
          name: message.name,
          email: message.email,
          subject: message.subject,
          message: message.message,
          status: message.status,
          createdAt: daysAgo(message.days),
          readAt: message.status === "unread" ? null : daysAgo(message.days - 0.5),
        },
      });
    }
  }

  // --------------------------------------------------------------- activity
  const existingLog = await prisma.activityLog.findFirst({ where: { entityType: "seed" } });
  if (!existingLog) {
    await prisma.activityLog.create({
      data: {
        userId: admin?.id ?? null,
        action: "create",
        entityType: "seed",
        summary: "Demo content seeded: profile, projects, gallery and articles",
      },
    });
  }

  // --------------------------------------- Phase 10 demo survey + booking
  // Idempotent demo data (upsert-style, like the rest of this file): one
  // published intake survey with all 8 question types across 2 sections,
  // one 30-minute booking service linked to it, and future slots for the
  // next 7 days at 09:00 and 14:00 Vietnam time (stored as UTC). No admin
  // user is created here and no existing seed data is changed. Safe to run
  // in CI / the Pages export: the survey + booking pages are staged out of
  // the static build, so this data is simply unused there.
  const DEMO_SURVEY_SLUG = "khao-sat-trai-nghiem-tu-van";
  const DEMO_SERVICE_SLUG = "tu-van-1-1";
  const existingDemoSurvey = await prisma.survey.findUnique({ where: { slug: DEMO_SURVEY_SLUG } });
  const demoSurvey = await prisma.survey.upsert({
    where: { slug: DEMO_SURVEY_SLUG },
    update: {
      status: "published",
      themePreset: "editorial-vn",
      layout: "editorial",
      progressStyle: "steps",
      brandName: "Portfolio Studio",
      estimatedMinutes: 5,
      isBookingIntake: true,
      publishedAt: existingDemoSurvey?.publishedAt ?? new Date(),
    },
    create: {
      slug: DEMO_SURVEY_SLUG,
      status: "published",
      themePreset: "editorial-vn",
      layout: "editorial",
      progressStyle: "steps",
      brandName: "Portfolio Studio",
      estimatedMinutes: 5,
      isBookingIntake: true,
      publishedAt: new Date(),
    },
  });
  const demoSurveyTranslations = {
    vi: {
      title: "Khảo sát trải nghiệm tư vấn",
      subtitle: "Phiếu khảo sát",
      description:
        "Vài câu hỏi ngắn giúp buổi tư vấn 1-1 hiệu quả hơn. Khảo sát này cũng là phiếu đầu vào khi bạn đặt lịch tư vấn.",
      introduction:
        "Cảm ơn bạn đã dành thời gian. Câu trả lời của bạn chỉ dùng để chuẩn bị cho buổi tư vấn và không được chia sẻ cho bên thứ ba.",
      completionMessage: "Cảm ơn bạn! Câu trả lời của bạn đã được ghi nhận và sẽ giúp buổi tư vấn hiệu quả hơn.",
      privacyNotice:
        "Khảo sát ẩn danh — chúng tôi không thu thập tên, email hay địa chỉ IP của bạn trong phiếu này. Thông tin liên hệ (nếu có) chỉ được thu thập ở bước đặt lịch, để tư vấn viên liên hệ với bạn.",
      // Distinct from the auto intro bullets (question count, anonymity,
      // go-back note): a highlight restating them showed the same line twice
      // on the intro page (Phase 10 visual check, 2026-11-14). The intake
      // survey feeds a booking that DOES collect contact info, so no
      // highlight may claim "no personal data is collected" here.
      highlights: "Câu trả lời giúp tư vấn viên chuẩn bị trước buổi hẹn",
    },
    en: {
      title: "Consultation experience survey",
      subtitle: "Survey",
      description:
        "A few short questions to make your 1-on-1 consultation more useful. This survey is also the intake form when you book a consultation.",
      introduction:
        "Thank you for your time. Your answers are only used to prepare for the consultation and are never shared with third parties.",
      completionMessage: "Thank you! Your answers have been recorded and will help make the consultation more useful.",
      privacyNotice:
        "This survey is anonymous — we do not collect your name, email or IP address in this form. Contact details (if any) are only collected at the booking step, so the consultant can reach you.",
      // Distinct from the auto intro bullets — see the vi note above.
      highlights: "Your answers help the consultant prepare before the session",
    },
  } as const;
  for (const locale of ["vi", "en"] as const) {
    const block = demoSurveyTranslations[locale];
    await prisma.surveyTranslation.upsert({
      where: { surveyId_locale: { surveyId: demoSurvey.id, locale } },
      update: { ...block },
      create: { surveyId: demoSurvey.id, locale, ...block },
    });
  }

  if (!existingDemoSurvey) {
    // Sections + questions are created only on first seed. Re-runs keep the
    // existing questions untouched (deleting them could break stored answers,
    // and SurveyAnswer.questionId is Restrict).
    const demoSections = [
      { order: 0, vi: { title: "Về bạn và nhu cầu tư vấn", description: "Giúp chúng tôi hiểu bạn cần gì." }, en: { title: "About you and your needs", description: "Help us understand what you need." } },
      { order: 1, vi: { title: "Đánh giá và phản hồi", description: "Cho chúng tôi biết trải nghiệm của bạn." }, en: { title: "Rating and feedback", description: "Tell us about your experience." } },
    ];
    const sectionIds: string[] = [];
    for (const section of demoSections) {
      const created = await prisma.surveySection.create({
        data: { surveyId: demoSurvey.id, order: section.order },
      });
      sectionIds.push(created.id);
      for (const locale of ["vi", "en"] as const) {
        await prisma.surveySectionTranslation.create({
          data: { sectionId: created.id, locale, ...section[locale] },
        });
      }
    }

    type DemoOption = { value: string; vi: string; en: string };
    type DemoQuestion = {
      section: number;
      order: number;
      type: string;
      required: boolean;
      maxLength?: number;
      minRating?: number;
      maxRating?: number;
      vi: { title: string; description: string; placeholder: string };
      en: { title: string; description: string; placeholder: string };
      options?: DemoOption[];
    };
    const demoQuestions: DemoQuestion[] = [
      {
        section: 0, order: 0, type: "short_text", required: true, maxLength: 500,
        vi: { title: "Bạn đang quan tâm đến vấn đề gì nhất?", description: "Một câu ngắn gọn là đủ.", placeholder: "Ví dụ: tôi muốn cải thiện quy trình làm việc của nhóm…" },
        en: { title: "What are you most interested in discussing?", description: "One short sentence is enough.", placeholder: "E.g. I want to improve my team's workflow…" },
      },
      {
        section: 0, order: 1, type: "long_text", required: false, maxLength: 5000,
        vi: { title: "Hãy mô tả ngắn gọn bối cảnh của bạn", description: "Càng cụ thể, buổi tư vấn càng hiệu quả.", placeholder: "Bối cảnh hiện tại, khó khăn đang gặp…" },
        en: { title: "Briefly describe your situation", description: "The more specific, the more useful the session.", placeholder: "Your current situation, the difficulties you face…" },
      },
      {
        section: 0, order: 2, type: "single_choice", required: true,
        vi: { title: "Mục đích chính của buổi tư vấn là gì?", description: "", placeholder: "" },
        en: { title: "What is the main purpose of this consultation?", description: "", placeholder: "" },
        options: [
          { value: "su-nghiep", vi: "Sự nghiệp", en: "Career" },
          { value: "du-an", vi: "Dự án", en: "Project" },
          { value: "kinh-doanh", vi: "Kinh doanh", en: "Business" },
          { value: "ca-nhan", vi: "Cá nhân", en: "Personal" },
        ],
      },
      {
        section: 0, order: 3, type: "dropdown", required: false,
        vi: { title: "Bạn biết đến dịch vụ tư vấn qua đâu?", description: "", placeholder: "" },
        en: { title: "How did you hear about this consultation service?", description: "", placeholder: "" },
        options: [
          { value: "ban-be", vi: "Bạn bè giới thiệu", en: "Referred by a friend" },
          { value: "mang-xa-hoi", vi: "Mạng xã hội", en: "Social media" },
          { value: "tim-kiem", vi: "Tìm kiếm trên Google", en: "Google search" },
          { value: "khac", vi: "Khác", en: "Other" },
        ],
      },
      {
        section: 1, order: 4, type: "rating", required: true, minRating: 1, maxRating: 5,
        vi: { title: "Bạn đánh giá thế nào về trải nghiệm đặt lịch trên trang này?", description: "Thang điểm từ 1 đến 5.", placeholder: "" },
        en: { title: "How would you rate the booking experience on this site?", description: "On a scale from 1 to 5.", placeholder: "" },
      },
      {
        section: 1, order: 5, type: "nps", required: true, minRating: 0, maxRating: 10,
        vi: { title: "Bạn có giới thiệu dịch vụ tư vấn này cho người khác không?", description: "0 là hoàn toàn không, 10 là chắc chắn giới thiệu.", placeholder: "" },
        en: { title: "Would you recommend this consultation service to others?", description: "0 means not at all, 10 means definitely.", placeholder: "" },
      },
      {
        section: 1, order: 6, type: "yes_no", required: true,
        vi: { title: "Bạn đã từng tham gia tư vấn 1-1 trước đây chưa?", description: "", placeholder: "" },
        en: { title: "Have you attended a 1-on-1 consultation before?", description: "", placeholder: "" },
      },
      {
        section: 1, order: 7, type: "multiple_choice", required: false,
        vi: { title: "Chủ đề bạn muốn trao đổi trong buổi tư vấn", description: "Chọn tất cả chủ đề phù hợp.", placeholder: "" },
        en: { title: "Topics you would like to discuss in the session", description: "Choose all that apply.", placeholder: "" },
        options: [
          { value: "thiet-ke", vi: "Thiết kế", en: "Design" },
          { value: "ky-thuat", vi: "Kỹ thuật", en: "Engineering" },
          { value: "nghe-thuat", vi: "Nghệ thuật", en: "Art" },
          { value: "chien-luoc", vi: "Chiến lược sản phẩm", en: "Product strategy" },
        ],
      },
    ];
    for (const question of demoQuestions) {
      const created = await prisma.surveyQuestion.create({
        data: {
          surveyId: demoSurvey.id,
          sectionId: sectionIds[question.section] ?? null,
          type: question.type,
          order: question.order,
          required: question.required,
          maxLength: question.maxLength ?? null,
          minRating: question.minRating ?? null,
          maxRating: question.maxRating ?? null,
        },
      });
      for (const locale of ["vi", "en"] as const) {
        await prisma.surveyQuestionTranslation.create({
          data: { questionId: created.id, locale, ...question[locale] },
        });
      }
      for (const [index, option] of (question.options ?? []).entries()) {
        const createdOption = await prisma.surveyQuestionOption.create({
          data: { questionId: created.id, value: option.value, order: index },
        });
        for (const locale of ["vi", "en"] as const) {
          await prisma.surveyQuestionOptionTranslation.create({
            data: { optionId: createdOption.id, locale, label: option[locale] },
          });
        }
      }
    }
  }

  const demoService = await prisma.bookingService.upsert({
    where: { slug: DEMO_SERVICE_SLUG },
    update: { durationMinutes: 30, active: true, intakeSurveyId: demoSurvey.id, order: 0 },
    create: { slug: DEMO_SERVICE_SLUG, durationMinutes: 30, active: true, intakeSurveyId: demoSurvey.id, order: 0 },
  });
  const demoServiceTranslations = {
    vi: { name: "Tư vấn 1-1", description: "Buổi tư vấn riêng 30 phút: trao đổi trực tiếp về vấn đề của bạn và nhận gợi ý cụ thể." },
    en: { name: "1-on-1 consultation", description: "A private 30-minute session: discuss your problem directly and get concrete suggestions." },
  } as const;
  for (const locale of ["vi", "en"] as const) {
    await prisma.bookingServiceTranslation.upsert({
      where: { serviceId_locale: { serviceId: demoService.id, locale } },
      update: { ...demoServiceTranslations[locale] },
      create: { serviceId: demoService.id, locale, ...demoServiceTranslations[locale] },
    });
  }

  // Future slots: next 7 days, 09:00 and 14:00 Vietnam time (= 02:00 and
  // 07:00 UTC). Upsert on the [serviceId, startsAt] unique key, so re-runs
  // never duplicate a slot. Past slots are never created (offset starts at
  // +1 day from the current UTC date, and 02:00 UTC is 09:00 VN the same day).
  const demoSlotHoursUtc = [2, 7];
  let demoSlotCount = 0;
  const nowUtc = new Date();
  const baseDayUtc = Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate());
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    for (const hourUtc of demoSlotHoursUtc) {
      const startsAt = new Date(baseDayUtc + dayOffset * 24 * 60 * 60 * 1000 + hourUtc * 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
      await prisma.bookingSlot.upsert({
        where: { serviceId_startsAt: { serviceId: demoService.id, startsAt } },
        update: {},
        create: { serviceId: demoService.id, startsAt, endsAt, status: "available" },
      });
      demoSlotCount++;
    }
  }

  console.log(`  Demo survey: ${DEMO_SURVEY_SLUG} (published, editorial-vn, intake)`);
  console.log(`  Demo service: ${DEMO_SERVICE_SLUG} (30 min) + ${demoSlotCount} slots, next 7 days 09:00/14:00 VN`);

  console.log("Seed complete.");
  console.log(`  Profile: ${DEMO.vi.fullName} / ${DEMO.en.fullName}`);
  console.log(`  Projects: ${PROJECTS.length}, artworks: ${ARTWORKS.length}, articles: ${ARTICLES.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
