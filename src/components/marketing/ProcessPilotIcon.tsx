export function ProcessPilotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="8" y="8" width="48" height="48" rx="14" fill="#111318" />
      <path
        d="M18 32c0-7.732 6.268-14 14-14h1.5c4.971 0 9 4.029 9 9v4.5c0 4.971-4.029 9-9 9H32c-7.732 0-14-6.268-14-14Z"
        fill="#F05A34"
      />
      <path
        d="M32 18c7.732 0 14 6.268 14 14 0 7.732-6.268 14-14 14-7.732 0-14-6.268-14-14 0-7.732 6.268-14 14-14Z"
        fill="#FFFFFF"
      />
      <path
        d="M26 32c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="#3157D5"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
