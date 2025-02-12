import { Link } from "wouter";
import Logo from "./logo";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 h-16">
          <Link href="/" className="h-full flex items-center">
            <Logo className="h-8 md:h-10" />
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}