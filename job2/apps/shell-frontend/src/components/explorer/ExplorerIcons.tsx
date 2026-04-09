import React from "react";

type Props = { size?: number; title?: string };

const common = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  xmlns: "http://www.w3.org/2000/svg",
});

export function IconFile({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M7 3h7l3 3v15H7V3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconFolder({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path
        d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function IconUploadFile({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconUploadFolder({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path
        d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 11v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 11v9a2 2 0 0 0 2 2h6" stroke="currentColor" strokeWidth="2" />
      <path d="M21 13v7a2 2 0 0 1-2 2h-5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconIPFS({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path
        d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 9.2 12 7l3.5 2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 14.8 12 17l3.5-2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconHTTP({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M7 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 14h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronRight({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconDoc({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M7 3h7l3 3v15H7V3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Remix-like square menu button */
export function IconWorkspaceMenu({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 9h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconBackup({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRestore({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M4 11a8 8 0 1 0 2.34-5.66L4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrash({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEdit({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m12 6 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconDownload({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <path d="M12 4v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconClone({ size = 16, title }: Props) {
  return (
    <svg {...common(size)} aria-label={title}>
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}