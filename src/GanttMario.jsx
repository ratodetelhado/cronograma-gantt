import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Plus, 
  Filter, 
  Calendar, 
  Flag, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  X, 
  Coins, 
  Layers, 
  ChevronRight
} from 'lucide-react';

export default function App({ data, updateItem, deleteItem, insertItem, moveItem, followLink }) {
  // 1. ESTADOS E REFS
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterWeek, setFilterWeek] = useState('All');
  const [viewMode, setViewMode] = useState('week'); // 'week' (separado por semanas) ou 'phase' (consolidado)
  const [zoom, setZoom] = useState(44); // Pixels por dia na escala horizontal
  const [showSidebar, setShowSidebar] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [modalState, setModalState] = useState({ open: false, mode: 'create', task: null });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, task: null });

  const leftPaneRef = useRef(null);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);
  const svgRef = useRef(null);

  const ROW_HEIGHT = 70; // Altura confortável para evitar cortes de texto

  // Paleta de cores inspirada no Super Mario com contraste WCAG garantido
  const MARIO_COLORS = [
    { bg: '#E52521', border: '#9B111E', text: '#FFFFFF', label: 'Cogumelo Vermelho' },
    { bg: '#0288D1', border: '#01579B', text: '#FFFFFF', label: 'Super Azul' },
    { bg: '#FFA000', border: '#C67100', text: '#212121', label: 'Moeda Dourada' },
    { bg: '#2E7D32', border: '#1B5E20', text: '#FFFFFF', label: 'Super Luigi' },
    { bg: '#795548', border: '#4E342E', text: '#FFFFFF', label: 'Bloco Tijolo' },
    { bg: '#C62828', border: '#8E0000', text: '#FFFFFF', label: 'Flor de Fogo' },
    { bg: '#1565C0', border: '#0D47A1', text: '#FFFFFF', label: 'Bloco POW' },
    { bg: '#FFB300', border: '#E65100', text: '#212121', label: 'Super Estrela' },
  ];

  // Sanitizador de texto (caso haja problemas de codificação UTF-8)
  const sanitizeText = (raw) => {
    if (raw === null || raw === undefined) return '';
    let str = String(raw).trim();
    try {
      if (/[\u00C2-\u00C3]/.test(str)) {
        str = decodeURIComponent(escape(str));
      }
    } catch (_) {}
    return str
      .replace(/Ã¡/g, 'á').replace(/Ã /g, 'à').replace(/Ã¢/g, 'â').replace(/Ã£/g, 'ã')
      .replace(/Ã©/g, 'é').replace(/Ãª/g, 'ê').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó')
      .replace(/Ã´/g, 'ô').replace(/Ãµ/g, 'õ').replace(/Ãº/g, 'ú').replace(/Ã§/g, 'ç')
      .replace(/Ã/g, 'Á').replace(/Ã€/g, 'À').replace(/Ã‚/g, 'Â').replace(/Ãƒ/g, 'Ã')
      .replace(/Ã‰/g, 'É').replace(/ÃŠ/g, 'Ê').replace(/Ã/g, 'Í').replace(/Ã“/g, 'Ó')
      .replace(/Ã”/g, 'Ô').replace(/Ã•/g, 'Õ').replace(/Ãš/g, 'Ú').replace(/Ã‡/g, 'Ç')
      .replace(/Â/g, '');
  };

  // Parser seguro de datas
  const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    const str = String(val).trim();
    const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
      return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    }
    const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }
    return null;
  };

  const formatISODate = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDisplayDate = (d) => {
    if (!d || isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${day}/${m}/${y}`;
  };

  // 2. LEITURA DOS DADOS
  const sheetEnvelope = data && data[0] ? data[0] : { index_: 0, data: [] };
  const rawRows = sheetEnvelope.data || [];

  let headerRowIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i].row || [];
    if (row.some(cell => {
      const s = String(cell).toLowerCase();
      return s.includes('início') || s.includes('inicio') || s.includes('fase');
    })) {
      headerRowIndex = i;
      break;
    }
  }

  // Definição das 17 semanas do projeto acadêmico (S1 a S17)
  const projectWeeks = useMemo(() => {
    const base = new Date(2026, 7, 10); // 10 de Agosto de 2026 (Segunda-feira)
    const weeks = [];
    for (let w = 1; w <= 17; w++) {
      const wStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (w - 1) * 7);
      const wEnd = w === 17
        ? new Date(2026, 11, 5) // Encerramento em 05/12/2026
        : new Date(base.getFullYear(), base.getMonth(), base.getDate() + (w - 1) * 7 + 6);

      weeks.push({
        num: w,
        id: `S${w}`,
        label: `Semana ${w}`,
        shortLabel: `S${w}`,
        startDate: wStart,
        endDate: wEnd,
      });
    }
    return weeks;
  }, []);

  const tasksData = useMemo(() => {
    const items = [];
    const startFrom = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

    for (let i = startFrom; i < rawRows.length; i++) {
      const itemEnvelope = rawRows[i];
      const r = itemEnvelope.row || [];
      if (!r || r.length === 0 || !r[0]) continue;

      const phase = sanitizeText(r[0] || `Fase ${i}`);
      const title = sanitizeText(r[1] || 'Sem Título');
      const milestone = sanitizeText(r[2] || '');
      const startDate = parseSafeDate(r[3]);
      const endDate = parseSafeDate(r[4]);
      const durationWeeks = r[5] !== undefined && r[5] !== null && r[5] !== '' ? Number(r[5]) : null;
      const status = sanitizeText(r[6] || 'Pendente');

      const colorScheme = MARIO_COLORS[(i - startFrom) % MARIO_COLORS.length];

      const matchingWeeks = projectWeeks.filter(w => {
        if (!startDate || !endDate) return false;
        return startDate <= w.endDate && endDate >= w.startDate;
      });
      const weekIds = matchingWeeks.map(w => w.id);
      const weekLabel = weekIds.length > 0
        ? (weekIds.length === 1 ? weekIds[0] : `${weekIds[0]} - ${weekIds[weekIds.length - 1]}`)
        : '';

      items.push({
        id: `task-${itemEnvelope.index_}`,
        rowIndex_: itemEnvelope.index_,
        orderIndex: i - startFrom,
        phase,
        title,
        milestone,
        startDate,
        endDate,
        durationWeeks,
        status,
        weekIds,
        weekLabel,
        color: colorScheme.bg,
        borderColor: colorScheme.border,
        textColor: colorScheme.text,
        colorLabel: colorScheme.label,
        isUnscheduled: !startDate || !endDate,
      });
    }
    return items;
  }, [rawRows, headerRowIndex, projectWeeks]);

  const scheduledTasks = useMemo(() => tasksData.filter(t => !t.isUnscheduled), [tasksData]);
  const unscheduledTasks = useMemo(() => tasksData.filter(t => t.isUnscheduled), [tasksData]);

  // Desdobramento de tarefas multi-semanas para exibição linha por linha por semana
  const weeklyItems = useMemo(() => {
    const items = [];
    scheduledTasks.forEach(task => {
      const weeksForTask = projectWeeks.filter(w => {
        return task.startDate <= w.endDate && task.endDate >= w.startDate;
      });

      if (weeksForTask.length === 0) {
        items.push({
          ...task,
          weekNum: 1,
          weekId: 'S1',
          weekLabel: 'Semana 1',
          weekPartText: task.title,
          parentTask: task,
        });
      } else {
        weeksForTask.forEach((w, wIdx) => {
          items.push({
            id: `${task.id}-${w.id}`,
            taskId: task.id,
            rowIndex_: task.rowIndex_,
            phase: task.phase,
            title: task.title,
            weekNum: w.num,
            weekId: w.id,
            weekLabel: `Semana ${w.num} (${w.id})`,
            weekPartText: weeksForTask.length > 1 ? `${task.title} (Semana ${wIdx + 1}/${weeksForTask.length})` : task.title,
            milestone: wIdx === weeksForTask.length - 1 ? task.milestone : `Etapa semanal ${w.id}`,
            startDate: w.startDate,
            endDate: w.endDate,
            durationWeeks: 1,
            status: task.status,
            color: task.color,
            borderColor: task.borderColor,
            textColor: task.textColor,
            colorLabel: task.colorLabel,
            isUnscheduled: false,
            parentTask: task,
          });
        });
      }
    });

    return items.sort((a, b) => a.weekNum - b.weekNum || a.rowIndex_ - b.rowIndex_);
  }, [scheduledTasks, projectWeeks]);

  const displayedItems = useMemo(() => {
    const sourceItems = viewMode === 'week' ? weeklyItems : scheduledTasks;

    return sourceItems.filter(t => {
      if (filterStatus !== 'All') {
        const s = t.status.toLowerCase();
        const f = filterStatus.toLowerCase();
        let statusMatch = false;
        if (f === 'done' || f === 'concluído') statusMatch = s.includes('concl') || s.includes('done');
        else if (f === 'in progress' || f === 'em andamento') statusMatch = s.includes('andamento') || s.includes('progress');
        else if (f === 'blocked' || f === 'bloqueado') statusMatch = s.includes('bloq') || s.includes('block');
        else if (f === 'pendente') statusMatch = s.includes('pend');
        else statusMatch = s === f;
        if (!statusMatch) return false;
      }

      if (filterWeek !== 'All') {
        if (viewMode === 'week') {
          if (t.weekId !== filterWeek) return false;
        } else {
          if (!t.weekIds || !t.weekIds.includes(filterWeek)) return false;
        }
      }

      return true;
    });
  }, [viewMode, weeklyItems, scheduledTasks, filterStatus, filterWeek]);

  // 3. COORDENADAS E LIMITES TEMPORAIS
  const { minDate, maxDate, calendarDays, totalDays } = useMemo(() => {
    if (scheduledTasks.length === 0) {
      const now = new Date();
      const minD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      const maxD = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate() + 3);
      const days = [];
      const curr = new Date(minD);
      while (curr <= maxD) {
        days.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return { minDate: minD, maxDate: maxD, calendarDays: days, totalDays: days.length };
    }

    let earliest = scheduledTasks[0].startDate;
    let latest = scheduledTasks[0].endDate;

    for (const t of scheduledTasks) {
      if (t.startDate && t.startDate < earliest) earliest = t.startDate;
      if (t.endDate && t.endDate > latest) latest = t.endDate;
    }

    const minD = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate() - 2);
    const maxD = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate() + 3);

    const days = [];
    const curr = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
    const endBoundary = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate());

    while (curr <= endBoundary) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    return { minDate: minD, maxDate: maxD, calendarDays: days, totalDays: days.length };
  }, [scheduledTasks]);

  const svgWidth = useMemo(() => totalDays * zoom, [totalDays, zoom]);
  const svgHeight = useMemo(() => Math.max(displayedItems.length * ROW_HEIGHT, 360), [displayedItems, ROW_HEIGHT]);

  const getDayColumnX = (targetDate) => {
    if (!targetDate) return 0;
    const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const m = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    const diffDays = Math.round((d.getTime() - m.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays * zoom;
  };

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const isTodayVisible = today >= minDate && today <= maxDate;

  const jumpToToday = () => {
    if (!bodyRef.current || !isTodayVisible) return;
    const x = getDayColumnX(today) + zoom / 2;
    const centerOffset = bodyRef.current.clientWidth / 2;
    bodyRef.current.scrollLeft = Math.max(0, x - centerOffset);
  };

  const jumpToProjectStart = () => {
    if (!bodyRef.current || scheduledTasks.length === 0) return;
    const x = getDayColumnX(scheduledTasks[0].startDate);
    bodyRef.current.scrollLeft = Math.max(0, x - 40);
  };

  const jumpToWeek = (weekObj) => {
    if (!bodyRef.current || !weekObj) return;
    const x = getDayColumnX(weekObj.startDate);
    const centerOffset = bodyRef.current.clientWidth / 3;
    bodyRef.current.scrollLeft = Math.max(0, x - centerOffset);
  };

  // 4. SINCRONIZAÇÃO DE SCROLL
  const handleScroll = (e) => {
    if (leftPaneRef.current) {
      leftPaneRef.current.scrollTop = e.target.scrollTop;
    }
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // 5. CABEÇALHOS (APENAS MESES E SEMANAS S1-S17)
  const { monthHeaders, weekHeaders, dayHeaders } = useMemo(() => {
    const months = [];
    const weeks = [];
    const days = [];

    const monthNamesPt = [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ];

    let currentMonth = -1;
    let currentYear = -1;
    let monthStartIndex = 0;
    let monthLabel = '';

    calendarDays.forEach((dayTime, index) => {
      const m = dayTime.getMonth();
      const y = dayTime.getFullYear();
      const xStart = index * zoom;

      if (m !== currentMonth || y !== currentYear) {
        if (currentMonth !== -1) {
          months.push({
            name: monthLabel,
            x: monthStartIndex * zoom,
            width: (index - monthStartIndex) * zoom,
          });
        }
        currentMonth = m;
        currentYear = y;
        monthStartIndex = index;
        monthLabel = `${monthNamesPt[m]} ${y}`;
      }

      const dayOfWeek = dayTime.getDay();
      days.push({
        date: dayTime,
        dayNumber: String(dayTime.getDate()),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        x: xStart,
        width: zoom,
      });
    });

    if (currentMonth !== -1) {
      months.push({
        name: monthLabel,
        x: monthStartIndex * zoom,
        width: (calendarDays.length - monthStartIndex) * zoom,
      });
    }

    projectWeeks.forEach((w) => {
      const xStart = getDayColumnX(w.startDate);
      const xEnd = getDayColumnX(w.endDate) + zoom;
      const startStr = `${String(w.startDate.getDate()).padStart(2, '0')}/${String(w.startDate.getMonth() + 1).padStart(2, '0')}`;
      const endStr = `${String(w.endDate.getDate()).padStart(2, '0')}/${String(w.endDate.getMonth() + 1).padStart(2, '0')}`;

      weeks.push({
        num: w.num,
        id: w.id,
        label: w.label,
        shortLabel: w.shortLabel,
        dateRangeStr: `${startStr} - ${endStr}`,
        x: xStart,
        width: Math.max(xEnd - xStart, zoom * 6),
        weekObj: w,
      });
    });

    return { monthHeaders: months, weekHeaders: weeks, dayHeaders: days };
  }, [calendarDays, projectWeeks, zoom, minDate]);

  // 6. CURVAS BEZIER DE CONEXÃO
  const dependencyPaths = useMemo(() => {
    const paths = [];
    for (let i = 0; i < displayedItems.length - 1; i++) {
      const current = displayedItems[i];
      const next = displayedItems[i + 1];

      if (current.endDate && next.startDate) {
        const x1 = getDayColumnX(current.endDate) + zoom;
        const y1 = i * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = getDayColumnX(next.startDate);
        const y2 = (i + 1) * ROW_HEIGHT + ROW_HEIGHT / 2;

        const dx = Math.max(20, (x2 - x1) * 0.4);
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        paths.push({
          id: `dep-${current.id}-${next.id}`,
          d,
          color: current.color,
        });
      }
    }
    return paths;
  }, [displayedItems, ROW_HEIGHT, zoom]);

  // 7. CRUD HANDLERS
  const openCreateModal = () => {
    const nextPhaseNum = tasksData.length + 1;
    setModalState({
      open: true,
      mode: 'create',
      task: {
        phase: `Fase ${nextPhaseNum}`,
        title: '',
        milestone: '',
        startDate: formatISODate(new Date()),
        endDate: formatISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
        durationWeeks: 2,
        status: 'Pendente',
      },
    });
  };

  const openEditModal = (task) => {
    setModalState({
      open: true,
      mode: 'edit',
      task: {
        rowIndex_: task.rowIndex_,
        phase: task.phase,
        title: task.title,
        milestone: task.milestone,
        startDate: formatISODate(task.startDate),
        endDate: formatISODate(task.endDate),
        durationWeeks: task.durationWeeks || 2,
        status: task.status,
      },
    });
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const t = modalState.task;
    if (!t) return;

    const rowData = [
      t.phase || `Fase ${tasksData.length + 1}`,
      t.title || 'Nova Etapa',
      t.milestone || '',
      t.startDate || '',
      t.endDate || '',
      t.durationWeeks ? Number(t.durationWeeks) : undefined,
      t.status || 'Pendente',
    ];

    if (modalState.mode === 'create') {
      if (insertItem) insertItem(sheetEnvelope.index_, undefined, rowData);
    } else {
      if (updateItem) updateItem(sheetEnvelope.index_, t.rowIndex_, rowData);
    }
    setModalState({ open: false, mode: 'create', task: null });
  };

  const handleDeleteTask = (task) => {
    setDeleteModalState({ open: true, task });
  };

  const confirmDelete = () => {
    if (deleteModalState.task && deleteItem) {
      deleteItem(sheetEnvelope.index_, deleteModalState.task.rowIndex_);
    }
    setDeleteModalState({ open: false, task: null });
  };

  const quickToggleStatus = (task, e) => {
    e.stopPropagation();
    const cycle = ['Pendente', 'Em Andamento', 'Concluído', 'Bloqueado'];
    const idx = cycle.indexOf(task.status);
    const nextStatus = cycle[(idx + 1) % cycle.length];

    if (updateItem) {
      updateItem(sheetEnvelope.index_, task.rowIndex_, [
        undefined, undefined, undefined, undefined, undefined, undefined, nextStatus
      ]);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status).toLowerCase();
    if (s.includes('concl') || s.includes('done')) {
      return { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-600', text: 'Concluído' };
    }
    if (s.includes('andamento') || s.includes('progress')) {
      return { bg: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-600', text: 'Em Andamento' };
    }
    if (s.includes('bloq') || s.includes('block')) {
      return { bg: 'bg-rose-100 text-rose-900 border-rose-300', dot: 'bg-rose-600', text: 'Bloqueado' };
    }
    return { bg: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-500', text: 'Pendente' };
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-white font-sans text-slate-800 antialiased selection:bg-red-500 selection:text-white">

      {/* TOP TOOLBAR */}
      <div className="flex-none h-16 border-b flex items-center px-4 gap-2.5 z-30 bg-gradient-to-r from-red-600 via-red-500 to-red-600 shadow-sm text-white select-none">
        
        {/* Mario Banner */}
        <div className="flex items-center gap-2.5 mr-1.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] text-black font-black text-base">
            ?
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                WORLD 1-1
              </span>
              <span className="px-1.5 py-0.2 text-[9px] bg-black/40 rounded text-yellow-200 font-mono font-bold">
                17 SEMANAS
              </span>
            </div>
            <h1 className="text-sm md:text-base font-black tracking-tight leading-tight text-white drop-shadow-[1px_1px_2px_rgba(0,0,0,0.7)] truncate">
              Cronograma Gantt &bull; Softwareanos
            </h1>
          </div>
        </div>

        {/* MODO DE VISUALIZAÇÃO: Por Semana vs Por Fase */}
        <div className="flex items-center bg-black/35 p-1 rounded-lg border border-black/40 shadow-inner">
          <button
            onClick={() => setViewMode('week')}
            className={`px-2.5 py-1 text-xs font-black rounded transition-all flex items-center gap-1 ${
              viewMode === 'week'
                ? 'bg-yellow-400 text-black shadow-[1.5px_1.5px_0px_#000]'
                : 'text-yellow-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Por Semana (17 Sem)</span>
          </button>
          <button
            onClick={() => setViewMode('phase')}
            className={`px-2.5 py-1 text-xs font-black rounded transition-all flex items-center gap-1 ${
              viewMode === 'phase'
                ? 'bg-yellow-400 text-black shadow-[1.5px_1.5px_0px_#000]'
                : 'text-yellow-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Por Fase</span>
          </button>
        </div>

        {/* FILTRO DE SEMANAS */}
        <div className="flex items-center gap-1 border-l border-r border-red-400/50 px-2.5">
          <span className="text-xs font-semibold text-yellow-200 uppercase tracking-wider flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-300" />
            Semana:
          </span>
          <select
            value={filterWeek}
            onChange={(e) => {
              const val = e.target.value;
              setFilterWeek(val);
              if (val !== 'All') {
                const targetW = projectWeeks.find(w => w.id === val);
                if (targetW) jumpToWeek(targetW);
              }
            }}
            className="border-2 border-black rounded px-2 py-1 text-xs bg-white text-slate-900 font-bold shadow-[1.5px_1.5px_0px_#000] outline-none cursor-pointer"
          >
            <option value="All">Todas as Semanas (S1–S17)</option>
            {projectWeeks.map(w => (
              <option key={w.id} value={w.id}>
                {w.id} &bull; {w.startDate.getDate().toString().padStart(2, '0')}/{(w.startDate.getMonth() + 1).toString().padStart(2, '0')} a {w.endDate.getDate().toString().padStart(2, '0')}/{(w.endDate.getMonth() + 1).toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>

        {/* FILTRO DE STATUS */}
        <div className="flex items-center gap-1.5 border-r border-red-400/50 pr-2.5">
          <span className="text-xs font-semibold text-yellow-200 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Status:
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border-2 border-black rounded px-2 py-1 text-xs bg-white text-slate-900 font-bold shadow-[1.5px_1.5px_0px_#000] outline-none cursor-pointer"
          >
            <option value="All">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="In Progress">Em Andamento</option>
            <option value="Done">Concluído</option>
            <option value="Blocked">Bloqueado</option>
          </select>
        </div>

        {/* CONTROLES DE ZOOM */}
        <div className="flex items-center gap-1 border-r border-red-400/50 pr-2.5">
          <button 
            onClick={() => setZoom(z => Math.max(14, z - 8))} 
            className="w-7 h-7 rounded border-2 border-black bg-white text-slate-950 font-black text-sm hover:bg-yellow-300 shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center transition-all"
          >
            -
          </button>
          <span className="text-xs font-mono font-bold text-yellow-300 w-8 text-center drop-shadow">
            {zoom}px
          </span>
          <button 
            onClick={() => setZoom(z => Math.min(120, z + 8))} 
            className="w-7 h-7 rounded border-2 border-black bg-white text-slate-950 font-black text-sm hover:bg-yellow-300 shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center transition-all"
          >
            +
          </button>
        </div>

        {/* BOTÃO NOVA FASE */}
        <button 
          onClick={openCreateModal} 
          className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs rounded border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>+ Nova Fase</span>
        </button>

        {/* BOTÃO NÃO AGENDADAS */}
        <button 
          onClick={() => setShowSidebar(!showSidebar)} 
          className={`px-3 py-1.5 font-bold text-xs rounded border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5 ${
            unscheduledTasks.length > 0 ? 'bg-amber-400 text-black animate-pulse' : 'bg-white/95 text-slate-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Não Agendadas</span>
          <span className="ml-0.5 px-1.5 py-0.2 bg-black text-yellow-300 rounded text-[10px] font-mono">
            {unscheduledTasks.length}
          </span>
        </button>

        {/* BOTÃO HOJE / INÍCIO */}
        <div className="ml-auto flex items-center gap-2">
          {isTodayVisible ? (
            <button 
              onClick={jumpToToday} 
              className="px-3 py-1 text-xs border-2 border-black bg-red-700 hover:bg-red-800 text-white rounded-full font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              <span>Hoje</span>
            </button>
          ) : (
            <button 
              onClick={jumpToProjectStart} 
              className="px-3 py-1 text-xs border-2 border-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black shadow-[2px_2px_0px_#000] flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Início</span>
            </button>
          )}
        </div>
      </div>

      {/* ÁREA PRINCIPAL SPLIT */}
      <div className="flex-1 flex overflow-hidden relative min-w-0 bg-slate-50">

        {/* PAINEL ESQUERDO: LISTA DE ETAPAS */}
        <div className="w-[440px] sm:w-[480px] md:w-[520px] flex-none flex flex-col border-r border-slate-300 bg-white z-20 shadow-sm">
          
          <div className="h-20 flex-none border-b border-slate-300 px-4 flex flex-col justify-center bg-gradient-to-b from-slate-100 to-slate-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500 border border-black inline-block shadow-[1px_1px_0px_#000]" />
                {viewMode === 'week' ? 'Cronograma por Semana (S1–S17)' : 'Fases do Projeto &bull; Etapas e Marcos'}
              </span>
              <span className="text-[11px] font-mono font-bold bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-700 shadow-sm">
                {displayedItems.length} {displayedItems.length === 1 ? 'Item' : 'Itens'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 font-medium flex items-center gap-1.5 truncate">
              <span>Robô Softwareanos</span>
              <span>&bull;</span>
              <span className="font-bold text-slate-700">
                {viewMode === 'week' ? 'Visualização detalhada semana a semana' : 'Visualização consolidada por fases'}
              </span>
            </p>
          </div>

          <div
            ref={leftPaneRef}
            className="flex-1 overflow-hidden relative select-none"
            style={{ height: 'calc(100% - 80px)' }}
          >
            <div style={{ height: `${svgHeight}px` }} className="relative">
              {displayedItems.map((item) => {
                const statusInfo = getStatusBadge(item.status);
                const targetTask = item.parentTask || item;

                return (
                  <div
                    key={item.id}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className="flex flex-col justify-center px-3.5 border-b border-slate-200 bg-white hover:bg-amber-50/70 transition-colors group relative"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black bg-yellow-400 text-slate-950 shadow-[1px_1px_0px_#000] flex items-center gap-1 flex-none">
                        <Coins className="w-2.5 h-2.5" />
                        <span>{item.weekId || item.weekLabel || 'S1'}</span>
                      </span>

                      <span 
                        className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] flex-none"
                        style={{ backgroundColor: item.color, color: item.textColor }}
                      >
                        {String(item.phase)}
                      </span>

                      <span className="text-xs font-bold text-slate-900 leading-snug break-words truncate" title={String(item.title)}>
                        {viewMode === 'week' ? String(item.weekPartText || item.title) : String(item.title)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px] gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 text-slate-600">
                        <Flag className="w-3 h-3 text-slate-400 flex-none" />
                        <span className="truncate font-medium text-slate-600" title={String(item.milestone)}>
                          {String(item.milestone || 'Marco pendente')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-none">
                        <button
                          onClick={(e) => quickToggleStatus(targetTask, e)}
                          title="Clique para alterar status"
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 transition-transform active:scale-95 shadow-sm ${statusInfo.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          <span>{statusInfo.text}</span>
                        </button>

                        <button
                          onClick={() => openEditModal(targetTask)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar Etapa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(targetTask)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir Etapa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PAINEL DIREITO: LINHA DO TEMPO (APENAS MESES E SEMANAS) */}
        <div className="flex-1 flex flex-col relative z-10 min-w-0 bg-white">

          <div
            ref={headerRef}
            className="h-20 flex-none overflow-hidden relative bg-slate-100 border-b border-slate-300 select-none"
          >
            <div style={{ width: `${svgWidth}px` }} className="h-full flex flex-col">
              
              {/* TOPO: MESES */}
              <div className="h-8 border-b border-slate-300 flex relative bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 text-white">
                {monthHeaders.map((m, idx) => (
                  <div
                    key={`month-${idx}`}
                    style={{ left: `${m.x}px`, width: `${m.width}px` }}
                    className="absolute top-0 bottom-0 border-r-2 border-black/40 px-3 flex items-center font-black text-[11px] uppercase tracking-wider drop-shadow-sm text-yellow-200"
                  >
                    <Coins className="w-3 h-3 mr-1.5 text-yellow-300" />
                    <span>{String(m.name)}</span>
                  </div>
                ))}
              </div>

              {/* BASE: APENAS AS SEMANAS (S1 A S17) */}
              <div className="h-12 flex relative bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100">
                {weekHeaders.map((w, idx) => (
                  <button
                    key={`week-hdr-${idx}`}
                    onClick={() => jumpToWeek(w.weekObj)}
                    style={{ left: `${w.x}px`, width: `${w.width}px` }}
                    title={`Clique para focar na ${w.label} (${w.dateRangeStr})`}
                    className={`absolute top-0 bottom-0 border-r-2 border-slate-400 px-2.5 flex flex-col justify-center transition-colors hover:bg-yellow-200/80 cursor-pointer ${
                      filterWeek === w.id ? 'bg-yellow-300 font-black shadow-inner' : (idx % 2 === 0 ? 'bg-amber-50/80' : 'bg-yellow-100/70')
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-yellow-400 border border-black flex items-center justify-center font-black text-[9px] text-black shadow-[1px_1px_0px_#000] flex-none">
                          ?
                        </span>
                        <span className="font-black text-xs text-slate-900 tracking-tight">
                          {String(w.label)}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-black/10 text-[9px] font-mono font-black text-slate-700">
                        {String(w.shortLabel)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-slate-600 mt-0.5 truncate">
                      {String(w.dateRangeStr)}
                    </span>
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* CORPO DO SVG */}
          <div
            ref={bodyRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto relative custom-scrollbar bg-slate-50"
          >
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              className="block relative"
            >
              <defs>
                <filter id="marioShadow" x="-5%" y="-10%" width="115%" height="135%">
                  <feDropShadow dx="2" dy="2.5" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.45" />
                </filter>
                <marker
                  id="marioArrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#D97706" stroke="#000" strokeWidth="0.8" />
                </marker>
              </defs>

              {/* Fundo alternado por linha */}
              {displayedItems.map((_, idx) => (
                <rect
                  key={`row-bg-${idx}`}
                  x={0}
                  y={idx * ROW_HEIGHT}
                  width={svgWidth}
                  height={ROW_HEIGHT}
                  fill={idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                  stroke="#E2E8F0"
                  strokeWidth="0.5"
                />
              ))}

              {/* Shading alternado por semana */}
              {weekHeaders.map((w, idx) => (
                idx % 2 === 1 ? (
                  <rect
                    key={`week-band-${w.id}`}
                    x={w.x}
                    y={0}
                    width={w.width}
                    height={svgHeight}
                    fill="#F1F5F9"
                    opacity="0.6"
                  />
                ) : null
              ))}

              {/* Divisores verticais de semanas */}
              {weekHeaders.map((w) => (
                <g key={`week-divider-${w.id}`}>
                  <line
                    x1={w.x}
                    y1={0}
                    x2={w.x}
                    y2={svgHeight}
                    stroke="#0284C7"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.5"
                  />
                </g>
              ))}

              {/* Conexões Bezier */}
              {dependencyPaths.map((dep) => (
                <path
                  key={dep.id}
                  d={dep.d}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  markerEnd="url(#marioArrow)"
                  className="opacity-80 hover:opacity-100 transition-opacity"
                />
              ))}

              {/* Barras do Gantt */}
              {displayedItems.map((task, idx) => {
                if (!task.startDate || !task.endDate) return null;
                const targetTask = task.parentTask || task;

                const xStart = getDayColumnX(task.startDate);
                const xEnd = getDayColumnX(task.endDate) + zoom;
                const barWidth = Math.max(xEnd - xStart, 16);
                const yPos = idx * ROW_HEIGHT + 14;
                const barHeight = ROW_HEIGHT - 28;

                return (
                  <g
                    key={task.id}
                    className="task-group cursor-pointer group"
                    data-task-id={task.id}
                    onClick={() => openEditModal(targetTask)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: Math.min(window.innerWidth - 260, rect.left + barWidth / 2),
                        y: Math.max(10, rect.top - 12),
                        content: (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: targetTask.color }} />
                                <span className="font-black text-yellow-300 uppercase tracking-wide">{String(targetTask.phase)}</span>
                              </div>
                              <span className="px-1.5 py-0.2 rounded bg-yellow-400 text-black font-black text-[10px]">
                                {task.weekId || task.weekLabel || 'S1'}
                              </span>
                            </div>
                            <p className="font-bold text-white text-xs">
                              {viewMode === 'week' ? String(task.weekPartText || targetTask.title) : String(targetTask.title)}
                            </p>
                            <p className="text-[11px] text-slate-300">
                              <span className="text-yellow-400 font-semibold">Marco:</span> {String(targetTask.milestone || 'N/A')}
                            </p>
                            <div className="text-[10px] text-slate-300 flex items-center justify-between gap-3 pt-1">
                              <span>📅 {formatDisplayDate(targetTask.startDate)} &rarr; {formatDisplayDate(targetTask.endDate)}</span>
                              <span className="font-mono bg-black/60 px-1.5 py-0.5 rounded text-yellow-400 font-bold">
                                {targetTask.durationWeeks ? `${targetTask.durationWeeks} sem` : '-'}
                              </span>
                            </div>
                          </div>
                        ),
                      });
                    }}
                    onMouseMove={(e) => {
                      setTooltip((prev) => prev ? {
                        ...prev,
                        x: Math.min(window.innerWidth - 260, e.clientX + 14),
                        y: Math.max(10, e.clientY - 90),
                      } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <rect
                      x={xStart}
                      y={yPos}
                      width={barWidth}
                      height={barHeight}
                      rx={6}
                      ry={6}
                      fill={task.color}
                      stroke="#000000"
                      strokeWidth="2"
                      filter="url(#marioShadow)"
                      className="transition-all hover:brightness-110"
                    />

                    <line
                      x1={xStart + 3}
                      y1={yPos + 3}
                      x2={xStart + barWidth - 3}
                      y2={yPos + 3}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeOpacity="0.4"
                      strokeLinecap="round"
                      pointerEvents="none"
                    />

                    <g transform={`translate(${xStart + barWidth - 14}, ${yPos + barHeight / 2 - 5})`} pointerEvents="none">
                      <circle cx="5" cy="5" r="5" fill="#FBD000" stroke="#000" strokeWidth="1" />
                      <circle cx="3.8" cy="4" r="0.8" fill="#000" />
                      <circle cx="6.2" cy="4" r="0.8" fill="#000" />
                    </g>
                  </g>
                );
              })}

              {/* Linha vermelha Hoje */}
              {isTodayVisible && (
                <g>
                  <line
                    x1={getDayColumnX(today) + zoom / 2}
                    y1={0}
                    x2={getDayColumnX(today) + zoom / 2}
                    y2={svgHeight}
                    stroke="red"
                    strokeWidth="2.5"
                  />
                  <g transform={`translate(${getDayColumnX(today) + zoom / 2 - 22}, 4)`}>
                    <rect x="0" y="0" width="44" height="18" rx="3" fill="red" stroke="#000" strokeWidth="1.5" />
                    <text x="22" y="13" textAnchor="middle" fill="#FFF" fontSize="9" fontWeight="900" letterSpacing="0.5">
                      HOJE
                    </text>
                  </g>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* SIDEBAR TAREFAS NÃO AGENDADAS */}
        {showSidebar && (
          <div className="absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white border-l-2 border-slate-400 z-40 shadow-2xl p-4 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-400 border border-black flex items-center justify-center font-bold text-black text-sm">!</div>
                <div>
                  <h3 className="font-black text-sm text-slate-800 uppercase">Fases Não Agendadas</h3>
                  <p className="text-[11px] text-slate-500">Itens sem data definida</p>
                </div>
              </div>
              <button onClick={() => setShowSidebar(false)} className="p-1 rounded text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-3 space-y-2.5">
              {unscheduledTasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border-2 border-slate-300 bg-slate-50 hover:bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200 text-slate-700">{String(task.phase)}</span>
                    <button onClick={() => openEditModal(task)} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                      Agendar <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 mt-1">{String(task.title)}</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">{String(task.milestone || 'Sem marco')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* TOOLTIP */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-950/95 text-white text-xs p-3 rounded-xl shadow-2xl pointer-events-none border border-slate-700 max-w-xs backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000] w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4 text-white flex items-center justify-between border-b-4 border-black">
              <h3 className="font-black text-base uppercase text-white">
                {modalState.mode === 'create' ? 'Nova Etapa do Robô' : 'Editar Etapa do Cronograma'}
              </h3>
              <button onClick={() => setModalState({ open: false, mode: 'create', task: null })} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-3 bg-slate-50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">ID / Fase</label>
                  <input
                    type="text"
                    required
                    value={modalState.task.phase}
                    onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, phase: e.target.value } })}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border-2 border-black rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">Status</label>
                  <select
                    value={modalState.task.status}
                    onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, status: e.target.value } })}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border-2 border-black rounded"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">Nome da Tarefa</label>
                <input
                  type="text"
                  required
                  value={modalState.task.title}
                  onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, title: e.target.value } })}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-white border-2 border-black rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">Marco de Validação</label>
                <input
                  type="text"
                  value={modalState.task.milestone}
                  onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, milestone: e.target.value } })}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-white border-2 border-black rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={modalState.task.startDate}
                    onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, startDate: e.target.value } })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border-2 border-black rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={modalState.task.endDate}
                    onChange={(e) => setModalState({ ...modalState, task: { ...modalState.task, endDate: e.target.value } })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border-2 border-black rounded"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalState({ open: false, mode: 'create', task: null })}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border-2 border-black rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-slate-950 bg-yellow-400 border-2 border-black rounded"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUSÃO */}
      {deleteModalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000] w-full max-w-sm p-5 space-y-4">
            <h3 className="font-black text-sm text-slate-900 uppercase">Excluir Etapa?</h3>
            <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border font-medium">
              Deseja apagar <strong>{String(deleteModalState.task?.phase)}</strong>: "{String(deleteModalState.task?.title)}"?
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setDeleteModalState({ open: false, task: null })} className="px-3 py-1.5 text-xs font-bold border-2 border-black rounded">
                Cancelar
              </button>
              <button onClick={confirmDelete} className="px-4 py-1.5 text-xs font-black text-white bg-red-600 border-2 border-black rounded">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}