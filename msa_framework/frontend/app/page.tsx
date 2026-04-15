import { AppShell } from "../src/components/AppShell";
import { ContentThemeProvider } from "../src/context/ContentThemeContext";
import { ToastProvider } from "../src/hooks/useToast";

export default function Home() {
  return (
    <ToastProvider>
      <ContentThemeProvider>
        <AppShell />
      </ContentThemeProvider>
    </ToastProvider>
  );
}
