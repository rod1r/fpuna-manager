import { useState } from "react";
import { Header } from "./components/layout/Header";
import { BottomNav, type AppView } from "./components/layout/BottomNav";
import { ExplorerView } from "./components/explorer/ExplorerView";
import { ScheduleView } from "./components/schedule/ScheduleView";
import { GradesView } from "./components/grades/GradesView";
import "./styles.css";

export default function App() {
  const [view, setView] = useState<AppView>("explore");
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content">
        {view === "explore" && <ExplorerView />}
        {view === "schedule" && <ScheduleView />}
        {view === "grades" && <GradesView />}
      </main>
      <BottomNav view={view} onChange={setView} />
    </div>
  );
}
