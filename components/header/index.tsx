// components/header/index.tsx
import Logo from "@/components/logo";
import MobileNav from "@/components/header/mobile-nav";
import DesktopNav from "@/components/header/desktop-nav";
import BookmarkLink from "@/components/header/bookmark-link-fabric";
import { ModeToggle } from "@/components/menu-toggle";
import { fetchSanitySettings, fetchSanityNavigation } from "@/sanity/lib/fetch";

export default async function Header() {
  const settings = await fetchSanitySettings();
  const navigation = await fetchSanityNavigation();

  return (
    <>
      {/* Default: left side, drops 20px on hover */}
      <BookmarkLink href="/" side="left" />

    </>
  );
}
