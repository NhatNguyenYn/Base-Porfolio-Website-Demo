import Link from "next/link";

export type SocialLinkItem = {
  id: string;
  platform: string;
  url: string;
  label: string;
};

const ICON_PATHS: Record<string, React.ReactNode> = {
  github: (
    <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.51 2.87 8.33 6.84 9.68.5.1.68-.22.68-.49 0-.24-.01-1.03-.01-1.87-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.23C22 6.58 17.52 2 12 2z" />
  ),
  linkedin: (
    <>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
      <path d="M3 9.5h4V21H3z" />
      <path d="M9.5 9.5H13v1.6c.55-1 1.75-1.9 3.5-1.9 2.7 0 4 1.8 4 4.9V21h-4v-6.2c0-1.5-.55-2.4-1.8-2.4-1.1 0-1.75.75-2 1.5-.1.25-.12.6-.12 1V21h-4z" />
    </>
  ),
  facebook: (
    <path d="M14.5 21v-7.2h2.6l.4-3h-3V8.9c0-.87.25-1.46 1.5-1.46h1.6V4.72c-.28-.04-1.23-.12-2.34-.12-2.32 0-3.9 1.4-3.9 3.98v2.22H8.5v3h2.86V21z" />
  ),
  instagram: (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.1" cy="6.9" r="1.1" />
    </>
  ),
  behance: (
    <path d="M8.4 6.5c1.5 0 2.6.7 2.6 2.1 0 .9-.45 1.5-1.15 1.85 1 .3 1.6 1.05 1.6 2.2 0 1.75-1.35 2.65-3.2 2.65H3V6.5zm-.35 3.5c.7 0 1.1-.3 1.1-.9s-.4-.85-1.1-.85H5.2V10zm.2 3.7c.8 0 1.25-.35 1.25-1.05 0-.7-.45-1.05-1.3-1.05H5.2v2.1zM15.4 8.2h5v1.25h-5zm5.1 4.2c0-1.9-1.15-3.4-3.35-3.4-2.05 0-3.45 1.5-3.45 3.55 0 2.1 1.35 3.55 3.55 3.55 1.65 0 2.8-.75 3.15-2.15h-1.85c-.15.5-.6.8-1.3.8-.85 0-1.4-.5-1.5-1.5h4.75zm-4.75-1.05c.15-.9.65-1.35 1.4-1.35.8 0 1.3.5 1.35 1.35z" />
  ),
  dribbble: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.2 7.6c2.4 2.6 4 5.7 4.7 9.6M8.9 4.2c3.1 2.1 5.8 5.2 7.6 9M20 10.6c-3.6-.5-7.1.3-10 2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  x: <path d="M17.3 3h3.2l-7 8 7.3 10h-5.7l-4.5-6.2L5.4 21H2.2l7.5-8.6L2.7 3H8.5l4.1 5.7zM16.1 19h1.8L7.9 4.9H6z" />,
  email: (
    <>
      <rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.6 6.6 12 12.7l8.4-6.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  other: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 12h17M12 3c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
};

export function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const content = ICON_PATHS[platform] ?? ICON_PATHS.other;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}

export function SocialLinks({ links, className = "" }: { links: SocialLinkItem[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((link) => (
        <li key={link.id}>
          <Link
            href={link.url}
            target={link.url.startsWith("http") ? "_blank" : undefined}
            rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={link.label}
            title={link.label}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <PlatformIcon platform={link.platform} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
