export function ButtonLoading({ label }: { label: string }) {
  return <span className="button-loading" role="status" aria-live="polite">
    <span className="button-loading-mark" aria-hidden="true"><i /></span>
    <span>{label}</span>
  </span>
}
