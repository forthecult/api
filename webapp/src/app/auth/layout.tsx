export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-w-0 overflow-x-hidden">{children}</div>;
}
