import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { PostListingFab } from "./PostListingButton";

interface PageLayoutProps {
  children: React.ReactNode;
}

/** Хедер + main + футер. Ссылка «Перейти к содержимому» — в корневом layout */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <Navbar />
      {/* Не ниже экрана: футер не мелькает в первом экране и не «прыгает», пока грузится контент (CLS) */}
      <main id="main" tabIndex={-1} className="min-h-[100svh] flex-1 focus-visible:outline-none">
        {children}
      </main>
      <Footer />
      <PostListingFab />
    </>
  );
}
