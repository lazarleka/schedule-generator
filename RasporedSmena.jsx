import React, { useState, useEffect, useMemo, useRef } from "react";

const iconGlyphs = {
  Plus: "+",
  Trash2: "x",
  Printer: "P",
  Shuffle: "~",
  Eraser: "C",
  CalendarDays: "#",
  Clock: "o",
  Users: "@",
  AlertTriangle: "!"
};

function createIcon(name) {
  return function Icon({ size = 16, color = "currentColor" }) {
    return (
      <span
        aria-hidden="true"
        style={{
          alignItems: "center",
          color,
          display: "inline-flex",
          fontSize: Math.max(10, size * 0.75),
          fontWeight: 700,
          height: size,
          justifyContent: "center",
          lineHeight: 1,
          width: size
        }}
      >
        {iconGlyphs[name] || ""}
      </span>
    );
  };
}

const Plus = createIcon("Plus");
const Trash2 = createIcon("Trash2");
const Printer = createIcon("Printer");
const Shuffle = createIcon("Shuffle");
const Eraser = createIcon("Eraser");
const CalendarDays = createIcon("CalendarDays");
const Clock = createIcon("Clock");
const Users = createIcon("Users");
const AlertTriangle = createIcon("AlertTriangle");

const DAY_DEFS = [
  { key: "pon", label: "Ponedeljak", short: "PON" },
  { key: "uto", label: "Utorak", short: "UTO" },
  { key: "sre", label: "Sreda", short: "SRE" },
  { key: "cet", label: "Četvrtak", short: "ČET" },
  { key: "pet", label: "Petak", short: "PET" },
  { key: "sub", label: "Subota", short: "SUB" },
  { key: "ned", label: "Nedelja", short: "NED" },
];

const PALETTE = ["#E2A034", "#3E6259", "#4C7A9E", "#8A6FB0", "#B4562E", "#5C8A3C"];

let idSeed = 300;
const nextId = (p) => `${p}${idSeed++}`;

const DEFAULT_WORKERS = ["Orhan", "Lazar", "Adelin", "Andrija", "Amar", "Miloš", "Boris"];

const DEFAULT_SHIFTS = [
  { id: "s1", name: "I smena", from: "08:00", to: "15:00", needed: 2 },
  { id: "s2", name: "II smena", from: "15:00", to: "19:00", needed: 2 },
  { id: "s3", name: "Treća smena", from: "19:00", to: "23:00", needed: 2 },
];

const DAY_COLORS = ["#D98A3D", "#3E8272", "#4E7FA7", "#8A6FB0", "#B4562E", "#5C8A3C", "#A24D6B"];
const dayColor = (dayKey) => DAY_COLORS[DAY_DEFS.findIndex((d) => d.key === dayKey) % DAY_COLORS.length];

function emptySchedule(shifts) {
  const out = {};
  DAY_DEFS.forEach((d) => {
    out[d.key] = {};
    shifts.forEach((s) => (out[d.key][s.id] = []));
    out[d.key].off = [];
  });
  return out;
}

function cloneSchedule(data) {
  const out = {};
  Object.keys(data).forEach((day) => {
    out[day] = {};
    Object.keys(data[day]).forEach((k) => {
      out[day][k] = [...data[day][k]];
    });
  });
  return out;
}

function reshapeSchedule(prev, shifts) {
  const next = {};
  DAY_DEFS.forEach((d) => {
    next[d.key] = {};
    shifts.forEach((s) => {
      next[d.key][s.id] = (prev[d.key] && prev[d.key][s.id]) || [];
    });
    next[d.key].off = (prev[d.key] && prev[d.key].off) || [];
  });
  return next;
}

function formatDate(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}.`;
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function autoAssign(shifts, workerNames, lockedSchedule = emptySchedule(shifts)) {
  const n = workerNames.length;
  const schedule = {};
  const workerSet = new Set(workerNames);
  if (n === 0) {
    DAY_DEFS.forEach((d) => {
      schedule[d.key] = {};
      shifts.forEach((s) => (schedule[d.key][s.id] = []));
      schedule[d.key].off = [];
    });
    return schedule;
  }
  const workCounts = Object.fromEntries(workerNames.map((name) => [name, 0]));
  const shiftCounts = Object.fromEntries(
    workerNames.map((name) => [name, Object.fromEntries(shifts.map((s) => [s.id, 0]))])
  );
  const shiftTargets = Object.fromEntries(shifts.map((s) => [s.id, Math.ceil((DAY_DEFS.length * s.needed) / n)]));
  const lastShiftByWorker = Object.fromEntries(workerNames.map((name) => [name, null]));

  DAY_DEFS.forEach((day) => {
    const usedToday = new Set();
    schedule[day.key] = {};
    shifts.forEach((s) => {
      const lockedNames = (lockedSchedule[day.key]?.[s.id] || []).filter((name) => workerSet.has(name) && !usedToday.has(name));
      schedule[day.key][s.id] = lockedNames;
      lockedNames.forEach((name) => {
        usedToday.add(name);
        workCounts[name] += 1;
        shiftCounts[name][s.id] += 1;
        lastShiftByWorker[name] = s.id;
      });
    });

    const lockedOff = (lockedSchedule[day.key]?.off || []).filter((name) => workerSet.has(name) && !usedToday.has(name));
    lockedOff.forEach((name) => usedToday.add(name));

    shuffled(shifts).forEach((s) => {
      let count = schedule[day.key][s.id].length;
      const rankedCandidates = shuffled(workerNames)
        .filter((name) => !usedToday.has(name))
        .sort((a, b) => {
          const aRepeatsYesterday = lastShiftByWorker[a] === s.id ? 1 : 0;
          const bRepeatsYesterday = lastShiftByWorker[b] === s.id ? 1 : 0;
          const aUnderTarget = shiftCounts[a][s.id] < shiftTargets[s.id] ? 0 : 1;
          const bUnderTarget = shiftCounts[b][s.id] < shiftTargets[s.id] ? 0 : 1;
          return (
            aRepeatsYesterday - bRepeatsYesterday ||
            aUnderTarget - bUnderTarget ||
            shiftCounts[a][s.id] - shiftCounts[b][s.id] ||
            workCounts[a] - workCounts[b]
          );
        });
      const nonRepeatingCandidates = rankedCandidates.filter((name) => lastShiftByWorker[name] !== s.id);
      const candidates = nonRepeatingCandidates.length >= s.needed - count ? nonRepeatingCandidates : rankedCandidates;

      while (count < s.needed && candidates.length > 0) {
        const name = candidates.shift();
        schedule[day.key][s.id].push(name);
        usedToday.add(name);
        workCounts[name] += 1;
        shiftCounts[name][s.id] += 1;
        lastShiftByWorker[name] = s.id;
        count += 1;
      }
    });

    schedule[day.key].off = [...lockedOff, ...workerNames.filter((w) => !usedToday.has(w))];
  });

  return schedule;
}

function Chip({ name, origin, onGrab, onRemove, dimmed }) {
  return (
    <span
      onPointerDown={(e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        onGrab(name, origin, e.clientX, e.clientY);
      }}
      className="chip inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded-full select-none"
      style={{
        background: "#FFFFFF",
        border: "1px solid #D8D2C4",
        touchAction: "none",
        cursor: "grab",
        opacity: dimmed ? 0.35 : 1,
        minWidth: "88px",
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {name}
      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="no-print leading-none"
          aria-label={`Ukloni ${name}`}
        >
          <span style={{ color: "#C1502E", fontSize: "13px" }}>×</span>
        </button>
      )}
    </span>
  );
}

export default function App() {
  const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
  const [workers, setWorkers] = useState(DEFAULT_WORKERS);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [selectedDays, setSelectedDays] = useState(DAY_DEFS.map((d) => d.key));
  const [weekStart, setWeekStart] = useState("");
  const [scheduleData, setScheduleData] = useState(() => emptySchedule(DEFAULT_SHIFTS));
  const [lockedSchedule, setLockedSchedule] = useState(() => emptySchedule(DEFAULT_SHIFTS));

  // --- Drag state (pointer-events based: works with mouse AND touch) ---
  const [dragInfo, setDragInfo] = useState(null); // { name, origin }
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [hoverZone, setHoverZone] = useState(null);
  const dragInfoRef = useRef(null);
  dragInfoRef.current = dragInfo;

  useEffect(() => {
    setScheduleData((prev) => reshapeSchedule(prev, shifts));
    setLockedSchedule((prev) => reshapeSchedule(prev, shifts));
  }, [shifts]);

  const activeDays = useMemo(() => DAY_DEFS.filter((d) => selectedDays.includes(d.key)), [selectedDays]);

  const headerRange = useMemo(() => {
    if (!weekStart || activeDays.length === 0) return null;
    const base = new Date(weekStart + "T00:00:00");
    const firstIdx = DAY_DEFS.findIndex((d) => d.key === activeDays[0].key);
    const lastIdx = DAY_DEFS.findIndex((d) => d.key === activeDays[activeDays.length - 1].key);
    const first = new Date(base);
    first.setDate(first.getDate() + firstIdx);
    const last = new Date(base);
    last.setDate(last.getDate() + lastIdx);
    return `${formatDate(first)} – ${formatDate(last)}`;
  }, [weekStart, activeDays]);

  const dateForDay = (dayKey) => {
    if (!weekStart) return null;
    const idx = DAY_DEFS.findIndex((d) => d.key === dayKey);
    const base = new Date(weekStart + "T00:00:00");
    base.setDate(base.getDate() + idx);
    return formatDate(base);
  };

  const shiftColor = (i) => PALETTE[i % PALETTE.length];

  const updateShift = (id, patch) => setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addShift = () =>
    setShifts((prev) => [...prev, { id: nextId("s"), name: `Smena ${prev.length + 1}`, from: "08:00", to: "16:00", needed: 1 }]);
  const removeShift = (id) => setShifts((prev) => prev.filter((s) => s.id !== id));

  const addWorker = () => {
    const name = newWorkerName.trim();
    if (!name || workers.includes(name)) return;
    setWorkers((prev) => [...prev, name]);
    setNewWorkerName("");
  };

  const removeWorker = (name) => {
    setWorkers((prev) => prev.filter((w) => w !== name));
    setScheduleData((prev) => {
      const next = cloneSchedule(prev);
      Object.keys(next).forEach((day) => {
        Object.keys(next[day]).forEach((k) => {
          next[day][k] = next[day][k].filter((n) => n !== name);
        });
      });
      return next;
    });
    setLockedSchedule((prev) => {
      const next = cloneSchedule(prev);
      Object.keys(next).forEach((day) => {
        Object.keys(next[day]).forEach((k) => {
          next[day][k] = next[day][k].filter((n) => n !== name);
        });
      });
      return next;
    });
  };

  const toggleDay = (key) => {
    setSelectedDays((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key].sort((a, b) => DAY_DEFS.findIndex((d) => d.key === a) - DAY_DEFS.findIndex((d) => d.key === b))
    );
  };

  const moveWorker = (name, targetDay, targetKey, origin) => {
    setScheduleData((prev) => {
      const next = cloneSchedule(prev);
      if (origin && origin.day) {
        next[origin.day][origin.key] = next[origin.day][origin.key].filter((n) => n !== name);
      }
      if (targetDay) {
        Object.keys(next[targetDay]).forEach((k) => {
          next[targetDay][k] = next[targetDay][k].filter((n) => n !== name);
        });
        next[targetDay][targetKey] = [...next[targetDay][targetKey], name];
      }
      return next;
    });
    setLockedSchedule((prev) => {
      const next = cloneSchedule(prev);
      if (origin && origin.day) {
        next[origin.day][origin.key] = next[origin.day][origin.key].filter((n) => n !== name);
      }
      if (targetDay) {
        Object.keys(next[targetDay]).forEach((k) => {
          next[targetDay][k] = next[targetDay][k].filter((n) => n !== name);
        });
        next[targetDay][targetKey] = [...next[targetDay][targetKey], name];
      }
      return next;
    });
  };

  const handleAutoAssign = () => setScheduleData(autoAssign(shifts, workers, lockedSchedule));
  const handleClear = () => {
    const empty = emptySchedule(shifts);
    setScheduleData(empty);
    setLockedSchedule(empty);
  };
  const handlePrint = () => window.print();

  // --- Pointer drag lifecycle ---
  const handleGrab = (name, origin, x, y) => {
    setDragInfo({ name, origin });
    setGhostPos({ x, y });
  };

  useEffect(() => {
    if (!dragInfo) return;

    const findZone = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      const zoneEl = el && el.closest ? el.closest("[data-dropzone]") : null;
      return zoneEl ? zoneEl.getAttribute("data-dropzone") : null;
    };

    const handleMove = (e) => {
      const x = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
      const y = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY);
      if (x == null || y == null) return;
      setGhostPos({ x, y });
      setHoverZone(findZone(x, y));
    };

    const finishDrag = (clientX, clientY) => {
      const zone = findZone(clientX, clientY);
      const info = dragInfoRef.current;
      if (info) {
        if (zone === "roster") {
          moveWorker(info.name, null, null, info.origin);
        } else if (zone) {
          const [day, key] = zone.split(":");
          moveWorker(info.name, day, key, info.origin);
        }
      }
      setDragInfo(null);
      setHoverZone(null);
    };

    const handleUp = (e) => {
      const x = e.clientX ?? (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
      const y = e.clientY ?? (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY);
      finishDrag(x, y);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp, { passive: true });
    window.addEventListener("pointercancel", handleUp, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragInfo]);

  const isZoneActive = (zone) => hoverZone === zone;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F6F3EC", minHeight: "100vh", color: "#1B2430" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        .disp { font-family: 'Oswald', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .chip:active { cursor: grabbing; }
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        @media print {
          .no-print { display: none !important; }
          html,
          body,
          #root {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #root > div {
            min-height: auto !important;
            background: #fff !important;
          }
          #root > div > div {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          main {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-area {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
          }
          .print-area h2 {
            font-size: 20px !important;
            line-height: 1.1 !important;
            margin: 0 0 6mm 0 !important;
          }
          .print-area > div:last-child {
            overflow: visible !important;
            width: 100% !important;
          }
          table.sched {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            height: 175mm !important;
          }
          table.sched th,
          table.sched td {
            border: 1px solid #333 !important;
            color: #000 !important;
            background: #fff !important;
            padding: 5px 6px !important;
            vertical-align: top !important;
          }
          table.sched th:first-child,
          table.sched td:first-child {
            width: 14% !important;
          }
          table.sched th:last-child,
          table.sched td:last-child {
            width: 18% !important;
          }
          table.sched th .disp,
          table.sched td .font-semibold {
            font-size: 12px !important;
            line-height: 1.1 !important;
          }
          table.sched .mono {
            font-size: 9px !important;
            line-height: 1.1 !important;
          }
          table.sched td:first-child .mono {
            font-size: 14px !important;
            font-weight: 700 !important;
            line-height: 1.15 !important;
            margin-top: 2px !important;
          }
          .print-area .chip {
            min-width: 0 !important;
            padding: 3px 9px !important;
            font-size: 18px !important;
            font-weight: 600 !important;
            line-height: 1.15 !important;
            border-radius: 999px !important;
            gap: 5px !important;
            margin: 0 !important;
          }
          .print-area .chip button {
            display: none !important;
          }
          .print-area tbody tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            height: 24mm !important;
          }
        }
      `}</style>

      {dragInfo && (
        <div
          style={{
            position: "fixed",
            left: ghostPos.x + 12,
            top: ghostPos.y + 12,
            pointerEvents: "none",
            zIndex: 1000,
            background: "#1B2430",
            color: "#E2A034",
            padding: "5px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          }}
        >
          {dragInfo.name}
        </div>
      )}

      <header className="no-print px-6 py-7 sm:px-10" style={{ background: "#1B2430" }}>
        <div className="mx-auto flex items-center gap-3" style={{ maxWidth: "1500px" }}>
          <CalendarDays size={28} color="#E2A034" />
          <div>
            <h1 className="disp text-2xl sm:text-3xl tracking-wide" style={{ color: "#F6F3EC" }}>
              RASPORED SMENA
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#9AA5B1" }}>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-8" style={{ maxWidth: "1500px" }}>
        {/* Sidebar */}
        <aside className="no-print w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
          {/* Shifts */}
          <section className="rounded-lg p-5" style={{ background: "#FFFFFF", border: "1px solid #D8D2C4" }}>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} color="#3E6259" />
              <h2 className="disp text-lg tracking-wide">SMENE</h2>
            </div>
            <div className="flex flex-col gap-3">
              {shifts.map((s, i) => (
                <div key={s.id} className="rounded-md p-3" style={{ background: "#F6F3EC", borderLeft: `4px solid ${shiftColor(i)}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={s.name}
                      onChange={(e) => updateShift(s.id, { name: e.target.value })}
                      className="flex-1 text-sm font-medium bg-transparent outline-none border-b"
                      style={{ borderColor: "#D8D2C4" }}
                    />
                    <button onClick={() => removeShift(s.id)} aria-label="Ukloni smenu" className="p-1 rounded hover:opacity-70">
                      <Trash2 size={15} color="#C1502E" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm mono">
                    <input type="time" value={s.from} onChange={(e) => updateShift(s.id, { from: e.target.value })} className="bg-white rounded px-2 py-1 text-xs" style={{ border: "1px solid #D8D2C4" }} />
                    <span style={{ color: "#9AA5B1" }}>—</span>
                    <input type="time" value={s.to} onChange={(e) => updateShift(s.id, { to: e.target.value })} className="bg-white rounded px-2 py-1 text-xs" style={{ border: "1px solid #D8D2C4" }} />
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <label style={{ color: "#5A6472" }}>Potrebno radnika:</label>
                    <input
                      type="number"
                      min={1}
                      value={s.needed}
                      onChange={(e) => updateShift(s.id, { needed: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-14 bg-white rounded px-2 py-1"
                      style={{ border: "1px solid #D8D2C4" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addShift} className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-medium rounded-md py-2" style={{ border: "1px dashed #3E6259", color: "#3E6259" }}>
              <Plus size={15} /> Dodaj smenu
            </button>
          </section>

          {/* Days + week start */}
          <section className="rounded-lg p-5" style={{ background: "#FFFFFF", border: "1px solid #D8D2C4" }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={18} color="#3E6259" />
              <h2 className="disp text-lg tracking-wide">DANI</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {DAY_DEFS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => toggleDay(d.key)}
                  className="text-xs px-2.5 py-1.5 rounded-md"
                  style={{
                    background: selectedDays.includes(d.key) ? "#1B2430" : "#F6F3EC",
                    color: selectedDays.includes(d.key) ? "#E2A034" : "#9AA5B1",
                    border: "1px solid #D8D2C4",
                  }}
                >
                  {d.short}
                </button>
              ))}
            </div>
            <label className="text-xs" style={{ color: "#5A6472" }}>
              Datum ponedeljka (opciono)
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full mt-1 text-sm rounded-md px-3 py-2"
              style={{ border: "1px solid #D8D2C4" }}
            />
          </section>

          <div className="flex flex-col gap-2">
            <button onClick={handleAutoAssign} className="w-full flex items-center justify-center gap-2 rounded-lg py-3 disp text-base tracking-wide whitespace-nowrap" style={{ background: "#1B2430", color: "#E2A034" }}>
              RASPOREDI
            </button>
            <button onClick={handleClear} className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium whitespace-nowrap" style={{ border: "1px solid #D8D2C4", color: "#5A6472" }}>
              <Eraser size={15} /> Očisti raspored
            </button>
            <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium whitespace-nowrap" style={{ border: "1px solid #3E6259", color: "#3E6259" }}>
              <Printer size={15} /> Izvezi / štampaj PDF
            </button>
          </div>
        </aside>

        {/* Schedule table */}
        <main className="flex-1 min-w-0">
          {/* Worker roster — sits right above the schedule table for easy dragging */}
          <div className="no-print rounded-lg p-4 mb-5" style={{ background: "#FFFFFF", border: "1px solid #D8D2C4" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} color="#3E6259" />
              <h2 className="disp text-lg tracking-wide">RADNICI</h2>
              <span className="text-xs" style={{ color: "#9AA5B1" }}>
                — uhvati ime i prevuci ga u tabelu ispod
              </span>
            </div>
            <div
              data-dropzone="roster"
              className="flex flex-wrap gap-2 p-2 rounded-md"
              style={{
                background: isZoneActive("roster") ? "#EFEAE0" : "#F6F3EC",
                outline: isZoneActive("roster") ? "2px dashed #3E6259" : "none",
                outlineOffset: "-2px",
                minHeight: "44px",
              }}
            >
              {workers.map((name) => (
                <Chip
                  key={name}
                  name={name}
                  origin={null}
                  onGrab={handleGrab}
                  onRemove={() => removeWorker(name)}
                  dimmed={dragInfo && dragInfo.name === name && dragInfo.origin === null}
                />
              ))}
              {workers.length === 0 && (
                <p className="text-xs" style={{ color: "#9AA5B1" }}>
                  Dodaj radnike ispod.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWorker()}
                placeholder="Ime radnika"
                className="flex-1 text-sm rounded-md px-3 py-2"
                style={{ border: "1px solid #D8D2C4" }}
              />
              <button onClick={addWorker} className="rounded-md px-3" style={{ background: "#1B2430", color: "#E2A034" }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="print-area rounded-lg p-5" style={{ background: "#FFFFFF", border: "1px solid #D8D2C4" }}>
            <div className="mb-5">
              <h2 className="disp text-2xl tracking-wide">RASPORED{headerRange ? `: ${headerRange}` : ""}</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="sched" style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
                <thead>
                  <tr>
                    <th className="text-left disp text-sm tracking-wide p-3" style={{ borderBottom: "2px solid #1B2430" }}>
                      Dan
                    </th>
                    {shifts.map((s, i) => (
                      <th key={s.id} className="text-left p-3" style={{ borderBottom: `2px solid ${shiftColor(i)}`, background: `${shiftColor(i)}1A` }}>
                        <div className="disp text-sm tracking-wide">{s.name}</div>
                        <div className="mono text-xs" style={{ color: "#9AA5B1" }}>
                          {s.from}–{s.to}
                        </div>
                      </th>
                    ))}
                    <th className="text-left disp text-sm tracking-wide p-3" style={{ borderBottom: "2px solid #C1502E", background: "#C1502E14" }}>
                      Slobodan dan / napomena
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day, rowIdx) => (
                    <tr key={day.key}>
                      <td className="p-3 align-top" style={{ background: `${dayColor(day.key)}17`, borderLeft: `4px solid ${dayColor(day.key)}` }}>
                        <div className="font-semibold text-sm">{day.label}</div>
                        {dateForDay(day.key) && (
                          <div className="mono text-xs" style={{ color: "#9AA5B1" }}>
                            {dateForDay(day.key)}
                          </div>
                        )}
                      </td>
                      {shifts.map((s, i) => {
                        const names = scheduleData[day.key]?.[s.id] || [];
                        const understaffed = names.length < s.needed;
                        const zone = `${day.key}:${s.id}`;
                        return (
                          <td
                            key={s.id}
                            data-dropzone={zone}
                            className="p-3 align-top"
                            style={{
                              background: isZoneActive(zone) ? "#EAF1EC" : `${shiftColor(i)}0D`,
                              outline: isZoneActive(zone) ? "2px dashed #3E6259" : understaffed ? "1px dashed #C1502E" : "none",
                              outlineOffset: "-2px",
                              minHeight: "64px",
                            }}
                          >
                            <div className="flex flex-wrap gap-1.5">
                              {names.map((name) => (
                                <Chip
                                  key={name}
                                  name={name}
                                  origin={{ day: day.key, key: s.id }}
                                  onGrab={handleGrab}
                                  onRemove={() => moveWorker(name, null, null, { day: day.key, key: s.id })}
                                  dimmed={dragInfo && dragInfo.name === name && dragInfo.origin && dragInfo.origin.day === day.key && dragInfo.origin.key === s.id}
                                />
                              ))}
                              {names.length === 0 && (
                                <span className="text-sm" style={{ color: "#B8B2A2" }}>
                                  prevuci ovde
                                </span>
                              )}
                            </div>
                            {understaffed && (
                              <div className="no-print flex items-center gap-1.5 mt-2 text-xs" style={{ color: "#C1502E" }}>
                                <AlertTriangle size={11} /> nedostaje {s.needed - names.length}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const zone = `${day.key}:off`;
                        const offNames = scheduleData[day.key]?.off || [];
                        return (
                          <td
                            data-dropzone={zone}
                            className="p-3 align-top"
                            style={{
                              background: isZoneActive(zone) ? "#EAF1EC" : "#C1502E0A",
                              outline: isZoneActive(zone) ? "2px dashed #3E6259" : "none",
                              outlineOffset: "-2px",
                              minHeight: "64px",
                            }}
                          >
                            <div className="flex flex-wrap gap-1.5">
                              {offNames.map((name) => (
                                <Chip
                                  key={name}
                                  name={name}
                                  origin={{ day: day.key, key: "off" }}
                                  onGrab={handleGrab}
                                  onRemove={() => moveWorker(name, null, null, { day: day.key, key: "off" })}
                                  dimmed={dragInfo && dragInfo.name === name && dragInfo.origin && dragInfo.origin.day === day.key && dragInfo.origin.key === "off"}
                                />
                              ))}
                              {offNames.length === 0 && (
                                <span className="text-sm" style={{ color: "#B8B2A2" }}>
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="no-print flex flex-wrap gap-3 mt-5">
            {shifts.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-xs rounded-full px-3 py-1.5" style={{ background: "#FFFFFF", border: "1px solid #D8D2C4" }}>
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: shiftColor(i) }} />
                <span className="font-medium">{s.name}</span>
                <span className="mono" style={{ color: "#9AA5B1" }}>
                  {s.from}–{s.to}
                </span>
n              </div>
            ))}
          </div>
        </main>
      </div>

      <footer className="no-print text-center text-xs py-6" style={{ color: "#9AA5B1" }}>
      </footer>
    </div>
  );
}
