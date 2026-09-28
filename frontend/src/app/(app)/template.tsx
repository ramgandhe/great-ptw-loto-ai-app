/** Re-mounts on every route change, so each page settles in with the same short entrance. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
