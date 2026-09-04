// Chrome-less shell for auth pages (login, and future password-reset flows)
// — no sidebar/header, kept as its own layout so those additions don't
// require touching the (app) group.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
