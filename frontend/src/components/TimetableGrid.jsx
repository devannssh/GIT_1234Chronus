const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetableGrid({ entries, onCellClick, showTeacher = true }) {
  const periods = [...new Set(entries.map((e) => e.period))].sort((a, b) => a - b);
  const times = {};
  entries.forEach((e) => {
    times[e.period] = `${e.start || ""} – ${e.end || ""}`;
  });
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const at = (day, period) => entries.find((e) => e.day === day && e.period === period);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#ececec] bg-white" data-testid="timetable-grid">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="bg-mist">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ash">
              Period
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                className={`px-3 py-3 text-left text-sm ${
                  d === today ? "font-semibold text-ink" : "font-medium text-ash"
                }`}
              >
                {d}
                {d === today && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-peach align-middle" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p} className="border-t border-[#ececec]">
              <td className="whitespace-nowrap px-4 py-2 align-top">
                <div className="text-[13px] font-medium text-ink">P{p}</div>
                <div className="text-[13px] text-steel">{times[p]}</div>
              </td>
              {DAYS.map((d) => {
                const e = at(d, p);
                if (!e)
                  return (
                    <td key={d} className={`px-2 py-2 ${d === today ? "bg-fog" : ""}`}>
                      <div className="rounded-lg bg-fog px-3 py-3 text-[13px] italic text-smoke">—</div>
                    </td>
                  );
                const isFree = e.subject === "Free";
                return (
                  <td key={d} className={`px-2 py-2 ${d === today ? "bg-fog" : ""}`}>
                    <div
                      data-testid={`tt-cell-${d}-${p}`}
                      onClick={() => onCellClick && onCellClick(e)}
                      className={`rounded-lg px-3 py-2.5 transition-colors ${
                        isFree
                          ? "border border-dashed border-ash/50 bg-mist"
                          : "border border-[#ececec] bg-white hover:border-ink/25"
                      } ${onCellClick ? "cursor-pointer" : ""}`}
                    >
                      <div
                        className={`text-[15px] ${
                          isFree ? "italic text-smoke" : "font-medium text-ink"
                        }`}
                      >
                        {e.subject}
                      </div>
                      {!isFree && (
                        <div className="mt-0.5 text-[13px] leading-snug text-steel">
                          {showTeacher && e.teacher_name && <div>{e.teacher_name}</div>}
                          {e.room && <div>{e.room}</div>}
                          {!showTeacher && e.branch && <div>{e.branch}</div>}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
