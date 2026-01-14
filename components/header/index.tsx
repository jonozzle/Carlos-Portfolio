// components/header/index.tsx
import Logo from "@/components/logo";
import MobileNav from "@/components/header/mobile-nav";
import DesktopNav from "@/components/header/desktop-nav";
import HomeBookmarkNav from "@/components/header/home-bookmark-nav";
import { ModeToggle } from "@/components/menu-toggle";
import { fetchSanitySettings, fetchSanityNavigation } from "@/sanity/lib/fetch";

export default async function Header() {
  const settings = await fetchSanitySettings();
  const navigation = await fetchSanityNavigation();

  return (
    <nav aria-label="Primary">
      <HomeBookmarkNav />
    </nav>
  );
}
