import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        data-ocid="app.header"
        className="bg-card border-b border-border sticky top-0 z-40"
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-mono text-lg font-bold tracking-tight text-foreground">
            Edge
          </span>
          <span className="font-mono text-lg font-bold tracking-tight text-primary">
            Stack
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground uppercase tracking-widest">
            v1.0
          </span>
        </div>
      </header>

      <main className="flex-1 bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">{children}</div>
      </main>

      <footer className="bg-muted/40 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center">
          <p className="text-xs font-mono text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors duration-200"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
