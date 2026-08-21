import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import api, { downloadBlob } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import TimetableGrid from "../components/TimetableGrid";
import { Spinner } from "../components/bits";

export default function TimetablePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/timetable").then((r) => setData(r.data)).catch(() => toast.error("Could not load timetable"));
  }, []);

  const download = async () => {
    const res = await api.get("/timetable/csv", { responseType: "blob" });
    downloadBlob(res.data, "timetable.csv");
    toast.success("Timetable CSV downloaded");
  };

  if (!data) return <Spinner />;

  return (
    <div data-testid="timetable-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Timetable</h1>
          <p className="mt-1 text-sm text-steel">
            {user.role === "teacher" ? "Your classes for this week." : "Your weekly schedule."}
            {data.meta?.last_updated && (
              <span className="text-ash"> · Last updated {data.meta.last_updated.slice(0, 10)}</span>
            )}
          </p>
        </div>
        <button data-testid="download-timetable-btn" onClick={download} className="btn-primary">
          <Download size={16} /> Download CSV
        </button>
      </div>
      <TimetableGrid entries={data.entries} showTeacher={user.role !== "teacher"} />
    </div>
  );
}
