// MainLayout
// app/(main)/layout.tsx
import Header from "@/components/header";
import { draftMode } from "next/headers";
import SmoothScroller from "@/components/scroll/scroll-smoother";
import Cursor from "@/components/cursor";
import HomeLoader from "@/components/loader/home-loader-cc";
import PageEnterShell from "@/components/page-enter-shell";
import DomDebugger from "@/components/dom-debugger";
import UiRevealCoordinator from "@/components/ui/ui-reveal-coordinator";
import ScrollManager from "@/components/scroll/scroll-manager";
import Script from "next/script";

export const revalidate = 60;

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const isDraft = (await draftMode()).isEnabled;
  void isDraft;

  return (
    <>
      <Script
        id="js-class"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.classList.add('js');",
        }}
      />

      <div className="has-custom-cursor">
        <HomeLoader enable={true} />
        <UiRevealCoordinator />
        <div data-fouc>
          <DomDebugger />
          <Header />

          <div
            id="transition-layer"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[9999]"
          />

          <SmoothScroller>
            <ScrollManager />
            <PageEnterShell>
              <main id="page-root">{children}</main>
            </PageEnterShell>
          </SmoothScroller>

          <Cursor size={10} />
        </div>
      </div>
    </>
  );
}
