import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Check, MapPin, Copy, ChevronRight, RotateCcw,
  ExternalLink, ArrowRight, X,
} from "lucide-react";

const ADDRESS = "경기도 광주시 퇴촌면 원당길43번길 12";

// 외부 링크를 Claude 팝업 없이 새 탭으로 바로 여는 헬퍼
//
// 원리:
// - window.open(blobUrl) 은 "blob://..." 으로 시작하는 same-origin URL이므로
//   Claude의 외부 링크 감지 로직(대개 http/https URL을 체크)에 걸리지 않음
// - 열린 새 탭 안에서 JS가 실제 URL로 replace 하는데, 이건 새 탭(다른 문서)의
//   이벤트라 Claude iframe의 감시 범위 밖 → 팝업 없이 바로 이동
const openExternal = (url) => {
  if (!url) return;

  // 1순위: Blob URL 래핑 + JS 리다이렉트
  try {
    const safeJson = JSON.stringify(url);
    const safeHtml = String(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>이동 중…</title><style>body{font-family:-apple-system,sans-serif;padding:24px;color:#404040}</style></head><body><script>window.location.replace(${safeJson});</script><noscript><meta http-equiv="refresh" content="0;url=${safeHtml}"><p>링크로 이동: <a href="${safeHtml}">${safeHtml}</a></p></noscript></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");
    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 30000);
    if (win) return;
  } catch (e) {}

  // 2순위: data URL 리다이렉트
  try {
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(
      `<!DOCTYPE html><html><body><script>window.location.replace(${JSON.stringify(url)});</script></body></html>`
    );
    const win = window.open(dataUrl, "_blank");
    if (win) return;
  } catch (e) {}

  // 폴백: 일반 window.open (이 경우 Claude 팝업이 뜰 수 있음)
  try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) {}
};

const DEFAULT_DATA = {
  tripTitle: "우리끼리 리트릿",
  tagline: "A quiet weekend away",
  startDate: "",
  endDate: "",
  participants: [
    { id: 1, name: "", role: "호스트", phone: "", note: "" },
    { id: 2, name: "", role: "총무", phone: "", note: "" },
    { id: 3, name: "", role: "요리", phone: "", note: "" },
    { id: 4, name: "", role: "사진", phone: "", note: "" },
    { id: 5, name: "", role: "플레이리스트", phone: "", note: "" },
    { id: 6, name: "", role: "참가자", phone: "", note: "" },
    { id: 7, name: "", role: "참가자", phone: "", note: "" },
    { id: 8, name: "", role: "참가자", phone: "", note: "" },
  ],
  schedule: {
    day1: [
      { id: 11, time: "15:00", activity: "체크인 · 짐 풀기", leader: "", linkedPlaceId: null },
      { id: 12, time: "16:00", activity: "동네 산책 · 마트 장보기", leader: "", linkedPlaceId: null },
      { id: 13, time: "18:30", activity: "바베큐 저녁", leader: "", linkedPlaceId: null },
      { id: 14, time: "21:00", activity: "보드게임 · 수다 타임", leader: "", linkedPlaceId: null },
      { id: 15, time: "23:30", activity: "야식 · 와인 한 잔", leader: "", linkedPlaceId: null },
      { id: 16, time: "01:30", activity: "취침", leader: "", linkedPlaceId: null },
    ],
    day2: [
      { id: 21, time: "09:30", activity: "늦은 기상 · 커피", leader: "", linkedPlaceId: null },
      { id: 22, time: "10:30", activity: "브런치", leader: "", linkedPlaceId: null },
      { id: 23, time: "12:00", activity: "팔당호 드라이브 · 카페", leader: "", linkedPlaceId: null },
      { id: 24, time: "14:00", activity: "점심 (근처 맛집)", leader: "", linkedPlaceId: null },
      { id: 25, time: "16:00", activity: "숙소 정리", leader: "", linkedPlaceId: null },
      { id: 26, time: "17:00", activity: "해산", leader: "", linkedPlaceId: null },
    ],
  },
  packingGroup: [
    { id: 101, name: "블루투스 스피커", assignee: "", checked: false },
    { id: 102, name: "보드게임", assignee: "", checked: false },
    { id: 103, name: "인스탁스 / 필름 카메라", assignee: "", checked: false },
    { id: 104, name: "고기 · 식재료", assignee: "", checked: false },
    { id: 105, name: "와인 · 맥주", assignee: "", checked: false },
    { id: 106, name: "간식 · 안주", assignee: "", checked: false },
    { id: 107, name: "멀티탭 · 일회용품", assignee: "", checked: false },
    { id: 108, name: "쓰레기봉투 · 분리수거 봉투", assignee: "", checked: false },
  ],
  packingPersonal: [
    { id: 201, name: "세면도구 · 수건", checked: false },
    { id: 202, name: "실내복 · 잠옷", checked: false },
    { id: 203, name: "갈아입을 옷", checked: false },
    { id: 204, name: "편한 운동화", checked: false },
    { id: 205, name: "충전기 · 보조배터리", checked: false },
    { id: 206, name: "마스크팩 · 스킨케어", checked: false },
    { id: 207, name: "가벼운 외투 (밤엔 쌀쌀)", checked: false },
    { id: 208, name: "슬리퍼", checked: false },
  ],
  meals: [
    { id: 301, when: "DAY 1 · 저녁", menu: "바베큐", chef: "", note: "삼겹살, 목살, 쌈채소, 버섯, 공깃밥" },
    { id: 302, when: "DAY 1 · 야식", menu: "라면 & 치즈", chef: "", note: "가볍게" },
    { id: 303, when: "DAY 2 · 브런치", menu: "토스트 & 커피", chef: "", note: "에그, 아보카도 등" },
    { id: 304, when: "DAY 2 · 점심", menu: "근처 맛집", chef: "외식", note: "식당 탭에서 확정" },
  ],
  places: { food: [], cafe: [], play: [] },
  expenses: [
    { id: 401, item: "숙소비", amount: 0, payer: "" },
    { id: 402, item: "마트 장보기", amount: 0, payer: "" },
    { id: 403, item: "주류 · 간식", amount: 0, payer: "" },
  ],
  feePerPerson: 50000,
  planHeadline: "낮엔 호숫가,\n밤엔 우리들의 거실.",
  planItems: [
    "체크인 후 동네 한 바퀴. 마트에 들러 저녁거리를 산다.",
    "마당에서 바베큐. 해가 완전히 지기 전에 불을 피운다.",
    "밤엔 보드게임이나 영화. 누가 먼저 잠드는지 시합.",
    "늦게 일어나 커피. 팔당호 드라이브와 카페 투어.",
    "정오의 맛집 한 곳을 정하고, 배부르게 먹고 해산.",
  ],
};

const SECTIONS = [
  { key: "home",     num: "01", label: "Overview",  kr: "홈" },
  { key: "people",   num: "02", label: "Guests",    kr: "참가자" },
  { key: "schedule", num: "03", label: "Itinerary", kr: "일정" },
  { key: "places",   num: "04", label: "Places",    kr: "장소" },
  { key: "packing",  num: "05", label: "Packing",   kr: "준비물" },
  { key: "meals",    num: "06", label: "Meals",     kr: "식사" },
  { key: "budget",   num: "07", label: "Budget",    kr: "회비" },
];

export default function RetreatPlanner() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(DEFAULT_DATA);
  const [toast, setToast] = useState("");

  const [lastSynced, setLastSynced] = useState(null);

  // 로드: 개인 저장소를 우선으로 읽음(팝업 없음) → 없으면 공유 저장소에서 1회(팝업 1회)
  useEffect(() => {
    (async () => {
      let loaded = null;
      let fromShared = false;

      // 1) 개인 저장소 (팝업 없음)
      try {
        const personalRes = await window.storage.get("retreat-plan-v4", false);
        if (personalRes?.value) loaded = JSON.parse(personalRes.value);
      } catch (e) {}

      // 2) 개인에 없으면 공유에서 최초 1회만
      if (!loaded) {
        try {
          const sharedRes = await window.storage.get("retreat-plan-v4", true);
          if (sharedRes?.value) {
            loaded = JSON.parse(sharedRes.value);
            fromShared = true;
            // 공유→개인 캐싱 (다음 방문부터 팝업 X)
            try { await window.storage.set("retreat-plan-v4", JSON.stringify(loaded), false); } catch (e) {}
          }
        } catch (e) {}
      }

      if (loaded) {
        const merged = {
          ...DEFAULT_DATA,
          ...loaded,
          places: { ...DEFAULT_DATA.places, ...(loaded.places || {}) },
        };
        setData(merged);
        if (fromShared) setLastSynced(JSON.stringify(merged));
      }
      setLoading(false);
    })();
  }, []);

  // 자동저장은 개인 저장소로만 (팝업 없음)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(async () => {
      try { await window.storage.set("retreat-plan-v4", JSON.stringify(data), false); }
      catch (e) {}
    }, 400);
    return () => clearTimeout(t);
  }, [data, loading]);

  // 공유 저장소에서 최신 가져오기 (명시적 · 팝업 1회)
  const pull = async () => {
    try {
      const res = await window.storage.get("retreat-plan-v4", true);
      if (res?.value) {
        const parsed = JSON.parse(res.value);
        const merged = {
          ...DEFAULT_DATA,
          ...parsed,
          places: { ...DEFAULT_DATA.places, ...(parsed.places || {}) },
        };
        setData(merged);
        setLastSynced(JSON.stringify(merged));
        showToast("최신 내용을 불러왔어요");
      } else {
        showToast("공유 저장소가 비어있어요 — 호스트가 먼저 Publish 필요");
      }
    } catch (e) {
      showToast("공유 저장소가 비어있어요 — 호스트가 먼저 Publish 필요");
    }
  };

  // 내 변경사항을 팀에게 공유 (명시적 · 팝업 1회)
  const publish = async () => {
    try {
      const json = JSON.stringify(data);
      await window.storage.set("retreat-plan-v4", json, true);
      setLastSynced(json);
      showToast("팀 전체에 공유됐어요 ✓");
    } catch (e) { showToast("공유 실패 — 잠시 후 다시 시도"); }
  };

  // 미공유 변경사항 여부
  const hasUnsyncedChanges = useMemo(() => {
    return lastSynced === null || JSON.stringify(data) !== lastSynced;
  }, [data, lastSynced]);

  // Data 모달 (export/import 공용)
  // { mode: 'export' | 'import', text: string } | null
  const [dataModal, setDataModal] = useState(null);

  // Export: JSON 텍스트를 모달로 표시 (클립보드 복사 + 수동 선택 가능)
  const exportJSON = () => {
    setDataModal({ mode: "export", text: JSON.stringify(data, null, 2) });
  };

  // Import: 텍스트 붙여넣기 모달 열기
  const importJSON = () => {
    setDataModal({ mode: "import", text: "" });
  };

  // Import 적용
  const applyImport = () => {
    try {
      const parsed = JSON.parse(dataModal.text);
      setData({
        ...DEFAULT_DATA,
        ...parsed,
        places: { ...DEFAULT_DATA.places, ...(parsed.places || {}) },
      });
      setDataModal(null);
      showToast("불러오기 완료 · Publish 버튼으로 팀에 공유");
    } catch (err) {
      showToast("JSON 형식이 올바르지 않아요");
    }
  };

  // 클립보드 복사 (실패 시 수동 선택 안내)
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(dataModal.text);
      showToast("클립보드에 복사됐어요");
    } catch (e) {
      showToast("자동 복사 실패 — 창에서 직접 선택해 복사하세요");
    }
  };

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const dDay = useMemo(() => {
    if (!data.startDate) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const start = new Date(data.startDate);
    return Math.round((start - today) / (1000*60*60*24));
  }, [data.startDate]);

  // 장소를 일정에 추가
  const addPlaceToSchedule = (day, time, place) => {
    if (!time) return;
    const newItem = {
      id: Date.now(),
      time,
      activity: place.name || "장소",
      leader: "",
      linkedPlaceId: place.id,
    };
    const next = [...data.schedule[day], newItem].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    update({ schedule: { ...data.schedule, [day]: next } });
    showToast(`${day === "day1" ? "Day 1" : "Day 2"} ${time}에 "${place.name || "장소"}" 추가됨`);
  };

  // 장소가 이미 일정에 있는지 체크
  const isPlaceInSchedule = (placeId) => {
    return [...data.schedule.day1, ...data.schedule.day2].some(i => i.linkedPlaceId === placeId);
  };

  // 장소 데이터 가져오기 (linked id로)
  const getPlaceById = (id) => {
    for (const cat of ["food", "cafe", "play"]) {
      const p = (data.places[cat] || []).find(pl => pl.id === id);
      if (p) return p;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FAFAFA" }}>
        <div style={{ color: "#737373", fontFamily: "'IBM Plex Sans KR', sans-serif" }}>loading…</div>
      </div>
    );
  }

  const current = SECTIONS.find(s => s.key === tab);

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA", color: "#0A0A0A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300;1,9..144,500&family=IBM+Plex+Sans+KR:wght@200;300;400;500&family=Nanum+Myeongjo:wght@400;700;800&family=JetBrains+Mono:wght@300;400&display=swap');

        html, body { -webkit-font-smoothing: antialiased; background: #FAFAFA; }

        .f-display { font-family: 'Nanum Myeongjo', 'Fraunces', serif; letter-spacing: -0.02em; }
        .f-serif   { font-family: 'Fraunces', 'Nanum Myeongjo', serif; }
        .f-body    { font-family: 'IBM Plex Sans KR', -apple-system, sans-serif; font-weight: 300; }
        .f-body-m  { font-family: 'IBM Plex Sans KR', -apple-system, sans-serif; font-weight: 400; }
        .f-mono    { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .cap { font-family: 'Fraunces', serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.22em; color: #737373; }
        .italic-s { font-family: 'Fraunces', serif; font-style: italic; font-weight: 300; }

        .divider       { border-color: rgba(0,0,0,0.08); }
        .divider-mid   { border-color: rgba(0,0,0,0.12); }
        .divider-soft  { border-color: rgba(0,0,0,0.05); }

        .ink-btn {
          background-color: #0A0A0A;
          color: #FFFFFF;
          transition: opacity 0.15s ease;
        }
        .ink-btn:hover { opacity: 0.82; }

        .ghost-btn {
          color: #0A0A0A;
          border: 1px solid rgba(0,0,0,0.18);
          transition: all 0.15s ease;
          background: transparent;
        }
        .ghost-btn:hover { background-color: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.4); }

        .soft-bg { background-color: rgba(0,0,0,0.03); }

        input, textarea, select {
          background-color: transparent;
          border: none;
          outline: none;
          color: #0A0A0A;
          font-family: 'IBM Plex Sans KR', sans-serif;
          font-weight: 300;
        }
        input::placeholder, textarea::placeholder { color: #A3A3A3; font-weight: 300; }
        .ufield { border-bottom: 1px solid rgba(0,0,0,0.14); padding: 4px 0; transition: border-color 0.15s ease; }
        .ufield:focus-within { border-color: #0A0A0A; }

        select { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: 18px; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='none' stroke='%230A0A0A' stroke-width='1' d='M1 1l4 4 4-4'/></svg>"); background-repeat: no-repeat; background-position: right center; }

        input[type="date"] { cursor: pointer; min-width: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.35; cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 0.8; }
        input[type="time"] { cursor: pointer; min-width: 0; }
        input[type="time"]::-webkit-calendar-picker-indicator { opacity: 0.35; cursor: pointer; }

        @keyframes fadeSlide { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .fade { animation: fadeSlide 0.35s ease; }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* stats grid dividers */
        .stats-grid > * { border-right: 1px solid rgba(0,0,0,0.08); }
        .stats-grid > *:nth-child(2n) { border-right: none; }
        .stats-grid > *:nth-child(-n+2) { border-bottom: 1px solid rgba(0,0,0,0.08); }
        @media (min-width: 768px) {
          .stats-grid > * { border-right: 1px solid rgba(0,0,0,0.08) !important; border-bottom: none !important; }
          .stats-grid > *:last-child { border-right: none !important; }
        }

        .kb { word-break: keep-all; }
      `}</style>

      {/* HEADER */}
      <header className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 pt-10 sm:pt-14 lg:pt-16">
        <div className="flex items-center gap-3 mb-4 sm:mb-6 flex-wrap">
          <span className="cap whitespace-nowrap">Est. 2026</span>
          <span className="w-8 sm:w-12 h-px" style={{ backgroundColor: "#A3A3A3" }} />
          <input
            value={data.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
            className="italic-s text-sm flex-1 min-w-0"
            style={{ color: "#737373" }}
            placeholder="A short tagline…"
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 sm:pb-8 border-b divider">
          <div className="flex-1 min-w-0">
            <input
              value={data.tripTitle}
              onChange={(e) => update({ tripTitle: e.target.value })}
              className="f-display font-bold text-3xl sm:text-5xl lg:text-6xl w-full"
              style={{ lineHeight: 1.05 }}
            />
          </div>
          {dDay !== null && (
            <div className="flex items-baseline gap-3 md:flex-col md:items-end md:gap-0 md:text-right flex-shrink-0">
              <div className="cap">{dDay > 0 ? "Countdown" : dDay === 0 ? "Today" : "Since"}</div>
              <div className="f-serif text-3xl sm:text-4xl lg:text-5xl" style={{ fontWeight: 300, letterSpacing: "-0.03em" }}>
                {dDay > 0 ? `D−${dDay}` : dDay === 0 ? "D-DAY" : `D+${Math.abs(dDay)}`}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* NAV */}
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 mt-4 sm:mt-6 sticky top-0 z-20 backdrop-blur"
        style={{ backgroundColor: "rgba(250,250,250,0.9)" }}>
        <div className="flex gap-x-5 sm:gap-x-7 lg:gap-x-8 overflow-x-auto py-3 hide-scrollbar">
          {SECTIONS.map(s => {
            const active = tab === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setTab(s.key)}
                className="flex items-baseline gap-1.5 whitespace-nowrap transition-all pb-1"
                style={{
                  color: active ? "#0A0A0A" : "#737373",
                  borderBottom: active ? "1px solid #0A0A0A" : "1px solid transparent",
                }}
              >
                <span className="f-mono text-[10px] sm:text-[11px]" style={{ opacity: 0.55 }}>{s.num}</span>
                <span className="f-body-m text-sm">{s.kr}</span>
                <span className="italic-s text-xs hidden lg:inline" style={{ color: active ? "#0A0A0A" : "#A3A3A3" }}>— {s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 mt-8 sm:mt-10 fade" key={tab}>
        <div className="mb-6 sm:mb-8">
          <div className="flex items-baseline gap-3 sm:gap-4">
            <span className="f-mono text-sm" style={{ color: "#0A0A0A" }}>{current.num}</span>
            <span className="cap">— {current.label}</span>
          </div>
        </div>

        {tab === "home"     && <HomeTab     data={data} update={update} />}
        {tab === "people"   && <PeopleTab   data={data} update={update} />}
        {tab === "schedule" && <ScheduleTab data={data} update={update} getPlaceById={getPlaceById} />}
        {tab === "places"   && <PlacesTab   data={data} update={update} addPlaceToSchedule={addPlaceToSchedule} isPlaceInSchedule={isPlaceInSchedule} />}
        {tab === "packing"  && <PackingTab  data={data} update={update} />}
        {tab === "meals"    && <MealsTab    data={data} update={update} />}
        {tab === "budget"   && <BudgetTab   data={data} update={update} />}
      </main>

      <footer className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 mt-16 sm:mt-20 pt-6 border-t divider flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: hasUnsyncedChanges ? "#C56B3F" : "#0A0A0A" }}
          />
          <span className="cap">
            {hasUnsyncedChanges ? "Local · 미공유 변경사항" : "Synced · 최신"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={publish}
            className="ink-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m"
            title="내 변경사항을 팀 전체에 공유"
          >
            <ArrowRight size={11} className="-rotate-90" /> Publish
          </button>
          <button
            onClick={pull}
            className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m"
            title="팀의 최신 변경사항 가져오기"
          >
            <ArrowRight size={11} className="rotate-90" /> Pull
          </button>
          <button onClick={exportJSON} className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m" title="JSON 파일로 백업">
            Export
          </button>
          <button onClick={importJSON} className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m" title="JSON 파일로 복구">
            Import
          </button>
          <button
            onClick={async () => {
              if (!confirm("내 로컬 내용만 초기화합니다 (공유 저장소는 그대로). 계속할까요?")) return;
              setData(DEFAULT_DATA);
              try { await window.storage.set("retreat-plan-v4", JSON.stringify(DEFAULT_DATA), false); } catch (e) {}
            }}
            className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m"
          >
            <X size={11} /> Reset
          </button>
        </div>
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full f-body-m text-sm shadow-lg z-50"
          style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF" }}>
          {toast}
        </div>
      )}

      {/* Data Modal — Export/Import 공용 */}
      {dataModal && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 fade"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDataModal(null); }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-xl sm:rounded-xl"
            style={{ backgroundColor: "#FAFAFA", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b divider">
              <div className="flex items-baseline gap-3">
                <span className="f-mono text-xs" style={{ color: "#737373" }}>
                  {dataModal.mode === "export" ? "↑" : "↓"}
                </span>
                <span className="f-display text-lg sm:text-xl font-bold">
                  {dataModal.mode === "export" ? "Export" : "Import"}
                </span>
                <span className="italic-s text-xs hidden sm:inline" style={{ color: "#737373" }}>
                  — {dataModal.mode === "export" ? "현재 데이터 복사" : "JSON 붙여넣어 복구"}
                </span>
              </div>
              <button onClick={() => setDataModal(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-auto">
              {dataModal.mode === "export" ? (
                <>
                  <p className="f-body text-sm mb-3" style={{ color: "#404040" }}>
                    아래 JSON을 <strong className="f-body-m">전체 선택(Ctrl/Cmd + A)</strong>해서 복사하거나, 버튼을 눌러 클립보드에 복사하세요.
                  </p>
                  <textarea
                    readOnly
                    value={dataModal.text}
                    onClick={(e) => e.target.select()}
                    className="w-full p-3 f-mono text-xs rounded border divider"
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#404040",
                      minHeight: "260px",
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.5,
                    }}
                  />
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={copyExport}
                      className="ink-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m"
                    >
                      <Copy size={12} /> 클립보드에 복사
                    </button>
                    <button
                      onClick={() => setDataModal(null)}
                      className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m"
                    >
                      닫기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="f-body text-sm mb-3" style={{ color: "#404040" }}>
                    JSON 텍스트를 <strong className="f-body-m">붙여넣은 뒤</strong> 불러오기를 누르세요. 현재 내용은 전부 덮어써집니다.
                  </p>
                  <textarea
                    value={dataModal.text}
                    onChange={(e) => setDataModal({ ...dataModal, text: e.target.value })}
                    placeholder='{"tripTitle": "...", ...}'
                    autoFocus
                    className="w-full p-3 f-mono text-xs rounded border divider"
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#404040",
                      minHeight: "260px",
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.5,
                    }}
                  />
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={applyImport}
                      disabled={!dataModal.text.trim()}
                      className="ink-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m"
                      style={{
                        opacity: dataModal.text.trim() ? 1 : 0.35,
                        cursor: dataModal.text.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      <ArrowRight size={12} /> 불러오기
                    </button>
                    <button
                      onClick={() => setDataModal(null)}
                      className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m"
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ HOME ════════════════════ */
function HomeTab({ data, update }) {
  const filled = data.participants.filter(p => p.name?.trim()).length;
  const packTotal = data.packingGroup.length + data.packingPersonal.length;
  const packDone = data.packingGroup.filter(p => p.checked).length + data.packingPersonal.filter(p => p.checked).length;
  const placesTotal = data.places.food.length + data.places.cafe.length + data.places.play.length;

  const copyAddress = () => {
    navigator.clipboard?.writeText(ADDRESS);
    alert("주소가 복사되었습니다");
  };

  const stats = [
    { label: "Guests",  value: `${filled}`,      suffix: "명" },
    { label: "Nights",  value: "1",              suffix: "박 2일" },
    { label: "Places",  value: `${placesTotal}`, suffix: "곳 후보" },
    { label: "Packed",  value: `${packDone}`,    suffix: `/ ${packTotal}` },
  ];

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">

      {/* WHEN / WHERE */}
      <section className="grid md:grid-cols-2 gap-10 md:gap-10 lg:gap-16">
        {/* WHEN */}
        <div className="pb-10 md:pb-0 border-b md:border-b-0 divider">
          <div className="cap mb-5 sm:mb-6">When</div>
          <div className="grid grid-cols-2 gap-5 sm:gap-8">
            <div className="ufield">
              <div className="italic-s text-xs mb-2" style={{ color: "#737373" }}>Departure</div>
              <input
                type="date"
                value={data.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                className="f-serif text-base sm:text-xl lg:text-2xl w-full"
                style={{ fontWeight: 300 }}
              />
            </div>
            <div className="ufield">
              <div className="italic-s text-xs mb-2" style={{ color: "#737373" }}>Return</div>
              <input
                type="date"
                value={data.endDate}
                onChange={(e) => update({ endDate: e.target.value })}
                className="f-serif text-base sm:text-xl lg:text-2xl w-full"
                style={{ fontWeight: 300 }}
              />
            </div>
          </div>
        </div>

        {/* WHERE */}
        <div className="md:pl-10 lg:pl-16 md:border-l divider">
          <div className="cap mb-5 sm:mb-6">Where</div>
          <div className="f-display text-xl sm:text-2xl lg:text-[28px] leading-snug mb-3 kb">
            {ADDRESS}
          </div>
          <p className="italic-s text-sm mb-5 sm:mb-6" style={{ color: "#737373" }}>
            Toechon-myeon, Gwangju — a quiet pocket by the lake.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyAddress} className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m">
              <Copy size={12} /> 주소 복사
            </button>
            <button
              type="button"
              onClick={() => openExternal(`https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`)}
              className="ink-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m">
              KakaoMap <ChevronRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => openExternal(`https://map.naver.com/v5/search/${encodeURIComponent(ADDRESS)}`)}
              className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m">
              NaverMap <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-t border-b divider">
        <div className="stats-grid grid grid-cols-2 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="py-5 sm:py-6 px-3 sm:px-4 md:first:pl-0">
              <div className="cap mb-1.5 sm:mb-2">{s.label}</div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="f-display text-3xl sm:text-4xl" style={{ fontWeight: 700 }}>{s.value}</span>
                <span className="italic-s text-xs sm:text-sm" style={{ color: "#737373" }}>{s.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NARRATIVE */}
      <section className="grid md:grid-cols-12 gap-8 md:gap-10">
        <div className="md:col-span-4">
          <div className="cap mb-3">Our Plan</div>
          <textarea
            value={data.planHeadline}
            onChange={(e) => update({ planHeadline: e.target.value })}
            placeholder="한 줄 소개를 적어보세요 (Enter로 줄바꿈)"
            rows={2}
            className="f-display text-2xl sm:text-3xl leading-snug kb w-full resize-none"
            style={{ whiteSpace: "pre-wrap" }}
          />
        </div>
        <div className="md:col-span-8 space-y-4 sm:space-y-5">
          {data.planItems.map((item, idx) => (
            <div key={idx} className="flex gap-4 sm:gap-5 pb-3 sm:pb-4 border-b divider-soft group items-start">
              <span className="f-mono text-sm pt-0.5 flex-shrink-0" style={{ color: "#0A0A0A" }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <textarea
                value={item}
                onChange={(e) => {
                  const next = [...data.planItems];
                  next[idx] = e.target.value;
                  update({ planItems: next });
                }}
                placeholder="이 날의 한 순간을 적어보세요"
                rows={1}
                className="f-body text-sm sm:text-base leading-relaxed flex-1 kb min-w-0 resize-none overflow-hidden"
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
              />
              <button
                onClick={() => update({ planItems: data.planItems.filter((_, i) => i !== idx) })}
                className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 pt-1"
                aria-label="삭제"
              >
                <Trash2 size={12} style={{ color: "#737373" }} />
              </button>
            </div>
          ))}
          <button
            onClick={() => update({ planItems: [...data.planItems, ""] })}
            className="ghost-btn flex items-center gap-2 px-3 py-1.5 rounded-full text-xs f-body-m"
          >
            <Plus size={11} /> Add moment
          </button>
        </div>
      </section>
    </div>
  );
}

/* ════════════════════ PEOPLE ════════════════════ */
function PeopleTab({ data, update }) {
  const ROLES = ["호스트","총무","요리","사진","플레이리스트","운전","간식","참가자"];
  const add = () => {
    const id = Math.max(0, ...data.participants.map(p => p.id)) + 1;
    update({ participants: [...data.participants, { id, name: "", role: "참가자", phone: "", note: "" }] });
  };
  const edit = (id, patch) => update({ participants: data.participants.map(p => p.id === id ? { ...p, ...patch } : p) });
  const remove = (id) => update({ participants: data.participants.filter(p => p.id !== id) });

  return (
    <div className="space-y-6">
      <div className="hidden md:grid grid-cols-[40px_1fr_110px_1.1fr_1.3fr_36px] gap-4 py-3 border-b divider cap">
        <div>No.</div><div>이름</div><div>역할</div><div>연락처</div><div>메모</div><div></div>
      </div>

      {data.participants.map((p, idx) => (
        <div key={p.id}>
          {/* Mobile */}
          <div className="md:hidden pb-5 mb-5 border-b divider-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <span className="f-mono text-xs" style={{ color: "#737373" }}>{String(idx + 1).padStart(2, "0")}</span>
                <select value={p.role} onChange={(e) => edit(p.id, { role: e.target.value })}
                  className="italic-s text-sm" style={{ color: "#0A0A0A" }}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <button onClick={() => remove(p.id)} className="opacity-50 active:opacity-100">
                <Trash2 size={14} />
              </button>
            </div>
            <input value={p.name} onChange={(e) => edit(p.id, { name: e.target.value })}
              placeholder={`Guest ${idx + 1}`} className="f-serif text-xl w-full mb-3" style={{ fontWeight: 300 }} />
            <div className="ufield mb-2">
              <input value={p.phone} onChange={(e) => edit(p.id, { phone: e.target.value })}
                placeholder="010-0000-0000" className="f-mono text-sm w-full" />
            </div>
            <div className="ufield">
              <input value={p.note} onChange={(e) => edit(p.id, { note: e.target.value })}
                placeholder="알레르기, 차량 여부 등" className="f-body text-sm w-full" />
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden md:grid grid-cols-[40px_1fr_110px_1.1fr_1.3fr_36px] gap-4 py-3 items-center border-b divider-soft group">
            <span className="f-mono text-xs" style={{ color: "#737373" }}>{String(idx + 1).padStart(2, "0")}</span>
            <input value={p.name} onChange={(e) => edit(p.id, { name: e.target.value })}
              placeholder={`Guest ${idx + 1}`} className="f-serif text-lg" style={{ fontWeight: 300 }} />
            <select value={p.role} onChange={(e) => edit(p.id, { role: e.target.value })}
              className="italic-s text-sm" style={{ color: "#0A0A0A" }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <input value={p.phone} onChange={(e) => edit(p.id, { phone: e.target.value })}
              placeholder="010-0000-0000" className="f-mono text-sm" />
            <input value={p.note} onChange={(e) => edit(p.id, { note: e.target.value })}
              placeholder="알레르기, 차량 여부 등" className="f-body text-sm" />
            <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      <button onClick={add} className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m">
        <Plus size={13} /> Add guest
      </button>
    </div>
  );
}

/* ════════════════════ SCHEDULE ════════════════════ */
function ScheduleTab({ data, update, getPlaceById }) {
  const [day, setDay] = useState("day1");
  const items = data.schedule[day];

  const edit = (id, patch) => {
    const next = items.map(i => i.id === id ? { ...i, ...patch } : i);
    update({ schedule: { ...data.schedule, [day]: next } });
  };
  const add = () => {
    const id = Math.max(0, ...items.map(i => i.id)) + 1;
    update({ schedule: { ...data.schedule, [day]: [...items, { id, time: "", activity: "", leader: "", linkedPlaceId: null }] } });
  };
  const remove = (id) => update({ schedule: { ...data.schedule, [day]: items.filter(i => i.id !== id) } });

  const linkedPlace = (id) => id ? getPlaceById(id) : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex gap-6 sm:gap-8 border-b divider">
        {["day1","day2"].map(d => (
          <button key={d} onClick={() => setDay(d)}
            className="pb-3 flex items-baseline gap-2 transition-all"
            style={{
              borderBottom: day === d ? "1px solid #0A0A0A" : "1px solid transparent",
              marginBottom: "-1px",
              color: day === d ? "#0A0A0A" : "#737373",
            }}>
            <span className="f-mono text-xs">{d === "day1" ? "01" : "02"}</span>
            <span className="f-display text-lg sm:text-xl">{d === "day1" ? "Day One" : "Day Two"}</span>
          </button>
        ))}
      </div>

      <div>
        {items.map((item) => {
          const lp = linkedPlace(item.linkedPlaceId);
          return (
            <div key={item.id} className="group py-4 sm:py-5 border-b divider-soft">
              {/* Mobile */}
              <div className="sm:hidden space-y-2">
                <div className="flex items-center justify-between">
                  <input type="time" value={item.time} onChange={(e) => edit(item.id, { time: e.target.value })}
                    className="f-mono text-base" />
                  <button onClick={() => remove(item.id)} className="opacity-50 active:opacity-100">
                    <Trash2 size={13} style={{ color: "#737373" }} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {lp && <MapPin size={12} className="flex-shrink-0" style={{ color: "#0A0A0A" }} />}
                  <input value={item.activity} onChange={(e) => edit(item.id, { activity: e.target.value })}
                    placeholder="활동" className="f-serif text-xl flex-1 min-w-0" style={{ fontWeight: 300 }} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <input value={item.leader} onChange={(e) => edit(item.id, { leader: e.target.value })}
                    placeholder="담당" className="italic-s text-sm flex-1 min-w-0" style={{ color: "#737373" }} />
                  {lp?.link && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openExternal(lp.link); }}
                      className="ghost-btn flex items-center gap-1 px-2 py-1 rounded-full text-[10px] f-body-m flex-shrink-0"
                    >
                      <ExternalLink size={10} /> 지도
                    </button>
                  )}
                </div>
              </div>

              {/* Tablet+ */}
              <div className="hidden sm:grid grid-cols-[90px_1fr_140px_36px] gap-4 items-center">
                <input type="time" value={item.time} onChange={(e) => edit(item.id, { time: e.target.value })}
                  className="f-mono text-lg" />
                <div className="flex items-center gap-2 min-w-0">
                  {lp && <MapPin size={13} className="flex-shrink-0" style={{ color: "#0A0A0A" }} />}
                  <input value={item.activity} onChange={(e) => edit(item.id, { activity: e.target.value })}
                    placeholder="활동" className="f-serif text-xl w-full min-w-0" style={{ fontWeight: 300 }} />
                  {lp?.link && (
                    <button
                      type="button"
                      title="지도 열기"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openExternal(lp.link); }}
                      className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
                <input value={item.leader} onChange={(e) => edit(item.id, { leader: e.target.value })}
                  placeholder="담당" className="italic-s text-sm" style={{ color: "#737373" }} />
                <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} style={{ color: "#737373" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={add} className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m">
          <Plus size={13} /> Add entry
        </button>
      </div>

      <div className="p-4 sm:p-5 soft-bg rounded-sm mt-8">
        <div className="italic-s text-xs mb-1" style={{ color: "#0A0A0A" }}>Tip</div>
        <div className="f-body text-xs sm:text-sm leading-relaxed kb" style={{ color: "#404040" }}>
          <MapPin size={11} className="inline -mt-0.5 mr-1" /> 아이콘이 있는 항목은 장소 탭에서 가져온 거예요.
          장소 후보는 <strong className="f-body-m">04 — 장소</strong> 탭에서 추가하고, 가고 싶은 곳을 여기에 옮겨보세요.
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ PLACES ════════════════════ */
function PlacesTab({ data, update, addPlaceToSchedule, isPlaceInSchedule }) {
  const [cat, setCat] = useState("food");
  const items = data.places[cat] || [];

  const CATEGORIES = [
    { key: "food", label: "Restaurants", kr: "식당",   hint: "점심·저녁·브런치" },
    { key: "cafe", label: "Cafés",       kr: "카페",   hint: "호수뷰·디저트" },
    { key: "play", label: "Play",        kr: "놀거리", hint: "산책·액티비티" },
  ];

  const edit = (id, patch) => update({
    places: { ...data.places, [cat]: items.map(i => i.id === id ? { ...i, ...patch } : i) }
  });
  const add = () => update({
    places: { ...data.places, [cat]: [...items, { id: Date.now(), name: "", area: "", link: "", note: "", proposer: "", status: "후보" }] }
  });
  const remove = (id) => update({
    places: { ...data.places, [cat]: items.filter(i => i.id !== id) }
  });

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="grid grid-cols-3 border-t border-b divider">
        {CATEGORIES.map((c, i) => {
          const active = cat === c.key;
          const count = (data.places[c.key] || []).length;
          return (
            <button key={c.key} onClick={() => setCat(c.key)}
              className="py-4 sm:py-5 text-left px-3 sm:px-5 transition-all"
              style={{
                backgroundColor: active ? "#0A0A0A" : "transparent",
                color: active ? "#FFFFFF" : "#0A0A0A",
                borderRight: i < 2 ? "1px solid rgba(0,0,0,0.08)" : "none",
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="italic-s text-[11px] sm:text-xs" style={{ color: active ? "#A3A3A3" : "#737373" }}>{c.label}</div>
                  <div className="f-display text-lg sm:text-xl lg:text-2xl mt-0.5 sm:mt-1">{c.kr}</div>
                  <div className="f-body text-[10px] sm:text-xs mt-0.5 sm:mt-1 hidden sm:block" style={{ color: active ? "#A3A3A3" : "#737373" }}>{c.hint}</div>
                </div>
                <div className="f-mono text-xs flex-shrink-0" style={{ color: active ? "#A3A3A3" : "#737373" }}>
                  {String(count).padStart(2, "0")}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="py-12 sm:py-16 text-center">
          <div className="italic-s text-sm sm:text-base mb-4" style={{ color: "#737373" }}>
            아직 후보가 없어요. 첫 번째 장소를 제안해주세요.
          </div>
          <button onClick={add} className="ink-btn inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m">
            <Plus size={13} /> 후보 추가
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-6 sm:gap-y-8">
            {items.map((p, idx) => (
              <PlaceCard
                key={p.id} place={p} idx={idx} edit={edit} remove={remove}
                addPlaceToSchedule={addPlaceToSchedule}
                inSchedule={isPlaceInSchedule(p.id)}
              />
            ))}
          </div>
          <button onClick={add} className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m">
            <Plus size={13} /> 후보 추가
          </button>
        </>
      )}

      <div className="p-4 sm:p-5 soft-bg rounded-sm">
        <div className="italic-s text-xs mb-1" style={{ color: "#0A0A0A" }}>How it works</div>
        <div className="f-body text-xs sm:text-sm leading-relaxed kb" style={{ color: "#404040" }}>
          네이버/카카오 지도에서 가고 싶은 곳의 링크를 복사해서 자유롭게 추가하세요.
          마음에 드는 후보는 <strong className="f-body-m">→ 일정에 추가</strong> 버튼으로 바로 <strong className="f-body-m">03 — 일정</strong> 탭에 꽂을 수 있어요.
        </div>
      </div>
    </div>
  );
}

function PlaceCard({ place, idx, edit, remove, addPlaceToSchedule, inSchedule }) {
  const STATUSES = ["후보","확정","보류"];
  const [addMode, setAddMode] = useState(false);
  const [addDay, setAddDay] = useState("day1");
  const [addTime, setAddTime] = useState("");

  const statusColor = {
    "후보": { bg: "transparent",           color: "#737373", border: "rgba(0,0,0,0.2)" },
    "확정": { bg: "#0A0A0A",               color: "#FFFFFF", border: "#0A0A0A" },
    "보류": { bg: "rgba(0,0,0,0.05)",      color: "#A3A3A3", border: "transparent" },
  }[place.status || "후보"];

  const submitAdd = () => {
    if (!addTime) return;
    addPlaceToSchedule(addDay, addTime, place);
    setAddMode(false);
    setAddTime("");
  };

  return (
    <div className="group pb-5 sm:pb-6 border-b divider-soft">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="f-mono text-xs" style={{ color: "#737373" }}>{String(idx + 1).padStart(2, "0")}</span>
          {inSchedule && (
            <span className="f-mono text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#0A0A0A", letterSpacing: "0.1em" }}>
              <Check size={8} /> 일정포함
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={place.status || "후보"} onChange={(e) => edit(place.id, { status: e.target.value })}
            className="f-mono text-[10px] px-2 py-1 rounded-full"
            style={{
              backgroundColor: statusColor.bg,
              color: statusColor.color,
              border: `1px solid ${statusColor.border}`,
              letterSpacing: "0.15em",
            }}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => remove(place.id)} className="opacity-40 hover:opacity-100 transition-opacity">
            <Trash2 size={12} style={{ color: "#737373" }} />
          </button>
        </div>
      </div>

      <input value={place.name} onChange={(e) => edit(place.id, { name: e.target.value })}
        placeholder="장소 이름" className="f-display text-xl sm:text-2xl w-full mb-2" style={{ fontWeight: 700 }} />

      <div className="flex items-center gap-2 mb-3">
        <MapPin size={11} style={{ color: "#737373" }} className="flex-shrink-0" />
        <input value={place.area} onChange={(e) => edit(place.id, { area: e.target.value })}
          placeholder="위치 (예: 퇴촌, 팔당)" className="italic-s text-sm flex-1 min-w-0" style={{ color: "#737373" }} />
      </div>

      <textarea value={place.note} onChange={(e) => edit(place.id, { note: e.target.value })}
        placeholder="왜 가고 싶은지, 대표 메뉴나 특징…" rows={2}
        className="f-body text-sm w-full resize-none leading-relaxed mb-3" />

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-3">
        <div className="flex-1 min-w-0 ufield">
          <input value={place.link} onChange={(e) => edit(place.id, { link: e.target.value })}
            placeholder="네이버/카카오 지도 링크 붙여넣기" className="f-mono text-xs w-full" />
        </div>
        {place.link && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openExternal(place.link); }}
            className="ghost-btn flex items-center gap-1 px-2 py-1 rounded-full text-[10px] f-body-m flex-shrink-0"
          >
            <ExternalLink size={10} /> 열기
          </button>
        )}
        <input value={place.proposer} onChange={(e) => edit(place.id, { proposer: e.target.value })}
          placeholder="제안" className="italic-s text-xs w-14 sm:w-16 text-right flex-shrink-0" style={{ color: "#737373" }} />
      </div>

      {/* Add-to-itinerary area */}
      {!addMode ? (
        <button
          onClick={() => setAddMode(true)}
          className="w-full soft-bg hover:bg-black hover:text-white transition-colors flex items-center justify-between px-3 py-2 rounded-sm"
          style={{ color: "#0A0A0A" }}
        >
          <span className="f-body-m text-xs flex items-center gap-2">
            <ArrowRight size={12} /> 일정에 추가
          </span>
          <span className="italic-s text-[10px]" style={{ opacity: 0.6 }}>Add to itinerary</span>
        </button>
      ) : (
        <div className="p-3 rounded-sm" style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="cap" style={{ color: "#A3A3A3" }}>Add to itinerary</span>
            <button onClick={() => { setAddMode(false); setAddTime(""); }} className="opacity-60 hover:opacity-100">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <div className="italic-s text-[10px] mb-1" style={{ color: "#A3A3A3" }}>Day</div>
              <select
                value={addDay}
                onChange={(e) => setAddDay(e.target.value)}
                className="f-body-m text-sm w-full"
                style={{ color: "#FFFFFF" }}
              >
                <option value="day1" style={{ color: "#0A0A0A" }}>Day 1</option>
                <option value="day2" style={{ color: "#0A0A0A" }}>Day 2</option>
              </select>
            </div>
            <div>
              <div className="italic-s text-[10px] mb-1" style={{ color: "#A3A3A3" }}>Time</div>
              <input
                type="time"
                value={addTime}
                onChange={(e) => setAddTime(e.target.value)}
                className="f-mono text-sm w-full"
                style={{ color: "#FFFFFF", colorScheme: "dark" }}
              />
            </div>
            <button
              onClick={submitAdd}
              disabled={!addTime}
              className="px-3 py-2 rounded-sm f-body-m text-xs whitespace-nowrap"
              style={{
                backgroundColor: addTime ? "#FFFFFF" : "rgba(255,255,255,0.2)",
                color: addTime ? "#0A0A0A" : "#737373",
                cursor: addTime ? "pointer" : "not-allowed",
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ PACKING ════════════════════ */
function PackingTab({ data, update }) {
  const toggleG = (id) => update({ packingGroup: data.packingGroup.map(p => p.id === id ? { ...p, checked: !p.checked } : p) });
  const editG = (id, patch) => update({ packingGroup: data.packingGroup.map(p => p.id === id ? { ...p, ...patch } : p) });
  const addG = () => update({ packingGroup: [...data.packingGroup, { id: Date.now(), name: "", assignee: "", checked: false }] });
  const removeG = (id) => update({ packingGroup: data.packingGroup.filter(p => p.id !== id) });

  const toggleP = (id) => update({ packingPersonal: data.packingPersonal.map(p => p.id === id ? { ...p, checked: !p.checked } : p) });
  const editP = (id, patch) => update({ packingPersonal: data.packingPersonal.map(p => p.id === id ? { ...p, ...patch } : p) });
  const addP = () => update({ packingPersonal: [...data.packingPersonal, { id: Date.now(), name: "", checked: false }] });
  const removeP = (id) => update({ packingPersonal: data.packingPersonal.filter(p => p.id !== id) });

  return (
    <div className="grid md:grid-cols-2 gap-10 md:gap-12 lg:gap-16">
      <section>
        <div className="flex items-baseline justify-between mb-5 border-b divider pb-3">
          <div>
            <div className="cap">Shared</div>
            <div className="f-display text-xl sm:text-2xl mt-1">공동 준비물</div>
          </div>
          <div className="f-mono text-xs" style={{ color: "#737373" }}>
            {data.packingGroup.filter(p => p.checked).length} / {data.packingGroup.length}
          </div>
        </div>
        <div>
          {data.packingGroup.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b divider-soft group">
              <Dot checked={item.checked} onToggle={() => toggleG(item.id)} />
              <input value={item.name} onChange={(e) => editG(item.id, { name: e.target.value })}
                className="f-body text-sm sm:text-base flex-1 min-w-0"
                style={{
                  textDecoration: item.checked ? "line-through" : "none",
                  color: item.checked ? "#A3A3A3" : "#0A0A0A"
                }} />
              <input value={item.assignee} onChange={(e) => editG(item.id, { assignee: e.target.value })}
                placeholder="담당" className="italic-s text-xs w-16 sm:w-20 text-right flex-shrink-0" style={{ color: "#737373" }} />
              <button onClick={() => removeG(item.id)} className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Trash2 size={12} style={{ color: "#737373" }} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addG} className="ghost-btn flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs f-body-m">
          <Plus size={11} /> Add item
        </button>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-5 border-b divider pb-3">
          <div>
            <div className="cap">Personal</div>
            <div className="f-display text-xl sm:text-2xl mt-1">개인 준비물</div>
          </div>
          <div className="f-mono text-xs" style={{ color: "#737373" }}>
            {data.packingPersonal.filter(p => p.checked).length} / {data.packingPersonal.length}
          </div>
        </div>
        <div>
          {data.packingPersonal.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b divider-soft group">
              <Dot checked={item.checked} onToggle={() => toggleP(item.id)} />
              <input value={item.name} onChange={(e) => editP(item.id, { name: e.target.value })}
                className="f-body text-sm sm:text-base flex-1 min-w-0"
                style={{
                  textDecoration: item.checked ? "line-through" : "none",
                  color: item.checked ? "#A3A3A3" : "#0A0A0A"
                }} />
              <button onClick={() => removeP(item.id)} className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Trash2 size={12} style={{ color: "#737373" }} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addP} className="ghost-btn flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs f-body-m">
          <Plus size={11} /> Add item
        </button>
      </section>
    </div>
  );
}

function Dot({ checked, onToggle }) {
  return (
    <button onClick={onToggle}
      className="w-4 h-4 rounded-full flex items-center justify-center transition-all flex-shrink-0"
      style={{
        backgroundColor: checked ? "#0A0A0A" : "transparent",
        border: `1px solid ${checked ? "#0A0A0A" : "rgba(0,0,0,0.3)"}`,
      }}>
      {checked && <Check size={9} style={{ color: "#FFFFFF" }} />}
    </button>
  );
}

/* ════════════════════ MEALS ════════════════════ */
function MealsTab({ data, update }) {
  const edit = (id, patch) => update({ meals: data.meals.map(m => m.id === id ? { ...m, ...patch } : m) });
  const add = () => update({ meals: [...data.meals, { id: Date.now(), when: "", menu: "", chef: "", note: "" }] });
  const remove = (id) => update({ meals: data.meals.filter(m => m.id !== id) });

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="grid md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 sm:gap-y-10">
        {data.meals.map((meal, idx) => (
          <div key={meal.id} className="group">
            <div className="flex items-baseline justify-between mb-3 border-b divider pb-2">
              <div className="flex items-baseline gap-3 min-w-0 flex-1">
                <span className="f-mono text-xs flex-shrink-0" style={{ color: "#0A0A0A" }}>{String(idx + 1).padStart(2, "0")}</span>
                <input value={meal.when} onChange={(e) => edit(meal.id, { when: e.target.value })}
                  className="cap flex-1 min-w-0" style={{ textTransform: "uppercase" }} />
              </div>
              <button onClick={() => remove(meal.id)} className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Trash2 size={12} style={{ color: "#737373" }} />
              </button>
            </div>
            <input value={meal.menu} onChange={(e) => edit(meal.id, { menu: e.target.value })}
              placeholder="메뉴" className="f-display text-2xl sm:text-3xl w-full mb-4" style={{ fontWeight: 700 }} />
            <div className="space-y-3">
              <div className="ufield">
                <div className="italic-s text-xs mb-1" style={{ color: "#737373" }}>Chef</div>
                <input value={meal.chef} onChange={(e) => edit(meal.id, { chef: e.target.value })}
                  placeholder="담당자" className="f-body text-sm w-full" />
              </div>
              <div className="ufield">
                <div className="italic-s text-xs mb-1" style={{ color: "#737373" }}>Notes</div>
                <textarea value={meal.note} onChange={(e) => edit(meal.id, { note: e.target.value })}
                  placeholder="재료나 특이사항" rows={2} className="f-body text-sm w-full resize-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="ghost-btn flex items-center gap-2 px-4 py-2 rounded-full text-xs f-body-m">
        <Plus size={13} /> Add meal
      </button>
    </div>
  );
}

/* ════════════════════ BUDGET ════════════════════ */
function BudgetTab({ data, update }) {
  const total = data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const nPeople = data.participants.filter(p => p.name?.trim()).length || 1;
  const totalFee = (data.feePerPerson || 0) * nPeople;
  const balance = totalFee - total;

  const edit = (id, patch) => update({ expenses: data.expenses.map(e => e.id === id ? { ...e, ...patch } : e) });
  const add = () => update({ expenses: [...data.expenses, { id: Date.now(), item: "", amount: 0, payer: "" }] });
  const remove = (id) => update({ expenses: data.expenses.filter(e => e.id !== id) });

  const summary = [
    { label: "Per Person", content: (
      <div className="flex items-baseline gap-1">
        <input type="number" value={data.feePerPerson} onChange={(e) => update({ feePerPerson: Number(e.target.value) })}
          className="f-display text-2xl sm:text-3xl w-full min-w-0" style={{ fontWeight: 700 }} />
        <span className="italic-s text-xs sm:text-sm flex-shrink-0" style={{ color: "#737373" }}>원</span>
      </div>
    )},
    { label: "Pool",   content: <span className="f-display text-2xl sm:text-3xl" style={{ fontWeight: 700 }}>{totalFee.toLocaleString()}</span> },
    { label: "Spent",  content: <span className="f-display text-2xl sm:text-3xl" style={{ fontWeight: 700 }}>{total.toLocaleString()}</span> },
    { label: balance >= 0 ? "Remaining" : "Short",
      content: <span className="f-display text-2xl sm:text-3xl" style={{ fontWeight: 700 }}>{Math.abs(balance).toLocaleString()}</span>
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="border-t border-b divider">
        <div className="stats-grid grid grid-cols-2 md:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="py-5 sm:py-6 px-3 sm:px-4 md:first:pl-0">
              <div className="cap mb-1.5 sm:mb-2">{s.label}</div>
              {s.content}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="hidden md:grid grid-cols-[40px_1.5fr_1fr_1fr_36px] gap-4 py-3 border-b divider cap">
          <div>No.</div><div>Item</div><div>Amount</div><div>Payer</div><div></div>
        </div>

        {data.expenses.map((exp, idx) => (
          <div key={exp.id}>
            <div className="md:hidden py-4 border-b divider-soft">
              <div className="flex items-center justify-between mb-3">
                <span className="f-mono text-xs" style={{ color: "#737373" }}>{String(idx + 1).padStart(2, "0")}</span>
                <button onClick={() => remove(exp.id)} className="opacity-50 active:opacity-100">
                  <Trash2 size={13} style={{ color: "#737373" }} />
                </button>
              </div>
              <input value={exp.item} onChange={(e) => edit(exp.id, { item: e.target.value })}
                placeholder="항목" className="f-serif text-xl w-full mb-3" style={{ fontWeight: 300 }} />
              <div className="grid grid-cols-2 gap-4">
                <div className="ufield">
                  <div className="italic-s text-xs mb-1" style={{ color: "#737373" }}>Amount</div>
                  <div className="flex items-baseline gap-1">
                    <input type="number" value={exp.amount} onChange={(e) => edit(exp.id, { amount: Number(e.target.value) })}
                      className="f-mono text-base w-full min-w-0" />
                    <span className="italic-s text-xs" style={{ color: "#737373" }}>원</span>
                  </div>
                </div>
                <div className="ufield">
                  <div className="italic-s text-xs mb-1" style={{ color: "#737373" }}>Payer</div>
                  <input value={exp.payer} onChange={(e) => edit(exp.id, { payer: e.target.value })}
                    placeholder="누가 결제" className="f-body text-sm w-full" />
                </div>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-[40px_1.5fr_1fr_1fr_36px] gap-4 py-4 items-center border-b divider-soft group">
              <span className="f-mono text-xs" style={{ color: "#737373" }}>{String(idx + 1).padStart(2, "0")}</span>
              <input value={exp.item} onChange={(e) => edit(exp.id, { item: e.target.value })}
                placeholder="항목" className="f-serif text-lg" style={{ fontWeight: 300 }} />
              <div className="flex items-baseline gap-1">
                <input type="number" value={exp.amount} onChange={(e) => edit(exp.id, { amount: Number(e.target.value) })}
                  className="f-mono text-base w-full min-w-0" />
                <span className="italic-s text-xs flex-shrink-0" style={{ color: "#737373" }}>원</span>
              </div>
              <input value={exp.payer} onChange={(e) => edit(exp.id, { payer: e.target.value })}
                placeholder="누가 결제" className="italic-s text-sm" style={{ color: "#737373" }} />
              <button onClick={() => remove(exp.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={13} style={{ color: "#737373" }} />
              </button>
            </div>
          </div>
        ))}

        <button onClick={add} className="ghost-btn flex items-center gap-2 mt-5 px-4 py-2 rounded-full text-xs f-body-m">
          <Plus size={13} /> Add expense
        </button>
      </section>

      <div className="p-4 sm:p-5 soft-bg rounded-sm">
        <div className="italic-s text-xs mb-1" style={{ color: "#0A0A0A" }}>Tip</div>
        <div className="f-body text-xs sm:text-sm leading-relaxed kb" style={{ color: "#404040" }}>
          한 명이 카드로 대표 결제하고, 끝나고 회비에서 정산하면 깔끔해요. 카카오톡 정산하기 기능을 쓰면 더 빠릅니다.
        </div>
      </div>
    </div>
  );
}
