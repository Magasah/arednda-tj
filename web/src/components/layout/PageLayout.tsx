import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

interface PageLayoutProps {
  children: React.ReactNode;
}

/** Хедер + main + футер. Ссылка «Перейти к содержимому» — в корневом layout */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
