import { Github, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConnectionBadge } from './connection-badge';
import { LayoutModeToggle } from './layout-mode-toggle';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/cn';

const GITHUB_REPO = 'hloolx/codpl';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 gradient-mesh" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-border/60 bg-background/60 backdrop-blur-xl lg:flex">
          <SidebarHeader />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
            <SidebarNav />
            <SidebarGitHubLink />
          </div>
          <SidebarFooter />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3 lg:hidden">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo108.png" alt="CPB" className="h-8 w-8 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">Coding Plan Benchmark</span>
              <span className="truncate text-[10px] text-muted-foreground">定时静态快照</span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <LayoutModeToggle compact className="hidden sm:inline-flex" />
            <ThemeToggle compact />
            <Button size="icon" variant="outline" onClick={() => setMobileOpen(true)} aria-label="打开菜单">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-[80%] max-w-sm flex-col bg-background shadow-glow">
              <SidebarHeader onClose={() => setMobileOpen(false)} />
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
                <SidebarGitHubLink onClick={() => setMobileOpen(false)} />
              </div>
              <SidebarFooter />
            </aside>
          </div>
        ) : null}

        <main className="relative flex-1 min-w-0">
          <div className="mx-auto flex w-full flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-8 lg:py-10 content-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarGitHubLink({ onClick }: { onClick?: () => void }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-background/50 text-muted-foreground ring-1 ring-border/60">
          <Github className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">GitHub 仓库</span>
          <span className="truncate text-[11px] text-muted-foreground">{GITHUB_REPO}</span>
        </span>
      </a>
    </div>
  );
}

function SidebarHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-5 py-5">
      <Link to="/" className="flex items-center gap-3">
        <img src="/logo108.png" alt="CPB" className="h-10 w-10 rounded-lg" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Coding Plan Benchmark</span>
          <span className="text-[11px] text-muted-foreground">定时静态快照</span>
        </div>
      </Link>
      {onClose ? (
        <Button size="icon" variant="ghost" className="ml-auto" onClick={onClose} aria-label="关闭">
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className={cn('border-t border-border/60 px-4 py-4 space-y-3')}>
      <ConnectionBadge className="w-full justify-center" />
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle compact />
        <LayoutModeToggle />
      </div>
    </div>
  );
}
