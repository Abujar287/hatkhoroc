import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  NotebookPen,
  Plus,
  Search,
  Copy,
  Check,
  Edit3,
  Trash2,
  Save,
  FolderOpen,
  X,
  Calendar,
  Eye,
  Tag,
  ArrowLeft,
  SlidersHorizontal
} from 'lucide-react';
import { NoteEntry } from '../types';

interface NotepadTabProps {
  notes: NoteEntry[];
  sheetCategories?: string[];
  isSyncing: boolean;
  onSyncNotes: () => Promise<void> | void;
  onAddNote: (note: { notename: string; category: string; note: string }) => Promise<void>;
  onUpdateNote: (note: NoteEntry, original?: { notename: string; datetime: string }) => Promise<void>;
  onDeleteNote: (note: NoteEntry) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotepadTab: React.FC<NotepadTabProps> = ({
  notes,
  sheetCategories = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'sheet' | 'az'>('newest');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Multi-select state (triggered by long press on note card)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState('');

  // Popup modal for viewing & editing note
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [isEditingInPopup, setIsEditingInPopup] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Uncategorized');
  const [formCustomCat, setFormCustomCat] = useState('');
  const [formBody, setFormBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Create note modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<NoteEntry | null>(null);

  // Long press timer ref and touch movement tracking to prevent selection while scrolling
  const pressTimerRef = useRef<any>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isScrollingRef = useRef<boolean>(false);

  // Extract unique categories directly from Google Sheet BD column (sheetCategories + synced notes)
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    const pushCat = (raw?: string) => {
      const c = String(raw || '').trim();
      if (!c) return;
      const key = c.toLowerCase();
      if (key === 'category' || key === 'notepad') return;
      if (!map.has(key)) {
        map.set(key, c);
      }
    };
    sheetCategories.forEach(pushCat);
    notes.forEach(n => pushCat(n.category));
    if (map.size === 0) {
      map.set('uncategorized', 'Uncategorized');
    }
    return Array.from(map.values());
  }, [sheetCategories, notes]);

  React.useEffect(() => {
    if (
      selectedCategory !== 'All' &&
      !categories.some(c => c.toLowerCase() === selectedCategory.toLowerCase())
    ) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  React.useEffect(() => {
    if (categories.length > 0 && (!bulkCategoryTarget || !categories.includes(bulkCategoryTarget))) {
      setBulkCategoryTarget(categories[0]);
    }
  }, [categories, bulkCategoryTarget]);

  const parseNoteDate = (dtStr: string): Date | null => {
    if (!dtStr) return null;
    const trimmed = String(dtStr).trim();
    if (!trimmed) return null;

    // 1. Try native Date parsing first (ISO, "Nov 15, 2026 8:27 AM", "M/d/yyyy, h:mm:ss a", etc.)
    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime())) return nativeDate;

    // 2. Parse DD/MM/YYYY or MM/DD/YYYY with optional time ("15/11/2026, 08:27:00 AM" or "15-11-2026 8:27 PM")
    const slashMatch = trimmed.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
    );
    if (slashMatch) {
      const a = Number(slashMatch[1]);
      const b = Number(slashMatch[2]);
      let yr = Number(slashMatch[3]);
      if (yr < 100) yr += 2000;

      // If first token > 12, it's definitely DD/MM; otherwise assume M/D if <= 12 unless second > 12
      let month = a - 1;
      let day = b;
      if (a > 12) {
        day = a;
        month = b - 1;
      } else if (b > 12) {
        month = a - 1;
        day = b;
      }

      let hr = slashMatch[4] ? Number(slashMatch[4]) : 0;
      const min = slashMatch[5] ? Number(slashMatch[5]) : 0;
      const sec = slashMatch[6] ? Number(slashMatch[6]) : 0;
      const ampm = slashMatch[7] ? slashMatch[7].toUpperCase() : '';
      if (ampm === 'PM' && hr < 12) hr += 12;
      if (ampm === 'AM' && hr === 12) hr = 0;

      const parsed = new Date(yr, month, day, hr, min, sec);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // 3. Parse "15-Nov-26 08:27AM" or "15-Nov-2026"
    const monMatch = trimmed.match(
      /^(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i
    );
    if (monMatch) {
      const monthsMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const mIdx = monthsMap[monMatch[2].toLowerCase()];
      if (mIdx !== undefined) {
        const day = Number(monMatch[1]);
        let yr = Number(monMatch[3]);
        if (yr < 100) yr += 2000;
        let hr = monMatch[4] ? Number(monMatch[4]) : 0;
        const min = monMatch[5] ? Number(monMatch[5]) : 0;
        const ampm = monMatch[6] ? monMatch[6].toUpperCase() : '';
        if (ampm === 'PM' && hr < 12) hr += 12;
        if (ampm === 'AM' && hr === 12) hr = 0;
        const parsed = new Date(yr, mIdx, day, hr, min);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }

    return null;
  };

  const formatCompactNoteDateTime = (dtStr: string): string => {
    const d = parseNoteDate(dtStr);
    if (!d) return dtStr ? dtStr.split(',')[0].trim().slice(0, 18) : 'Synced';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${mon}-${yr}  ${String(hours).padStart(2, '0')}:${mins}${ampm}`;
  };

  const formatCleanPreview = (body: string): string => {
    const clean = String(body || '').replace(/\s+/g, ' ').trim();
    return clean || 'No content';
  };

  const getCategoryDotClass = (cat: string): string => {
    const lower = (cat || '').trim().toLowerCase();
    const palette = [
      'bg-amber-400',
      'bg-emerald-400',
      'bg-cyan-400',
      'bg-teal-300',
      'bg-violet-400',
      'bg-rose-400'
    ];
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
      hash = (hash * 31 + lower.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const list = notes.filter(n => {
      // Category filter
      if (selectedCategory !== 'All') {
        if ((n.category || 'Uncategorized').trim().toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'all') {
        const noteDate = parseNoteDate(n.datetime);
        if (!noteDate) return false;
        const noteDateStr = noteDate.toDateString();

        if (dateFilter === 'today') {
          if (noteDateStr !== todayStr) return false;
        } else if (dateFilter === 'previous_day') {
          if (noteDateStr !== yesterdayStr) return false;
        } else if (dateFilter === 'last_7_days') {
          const diffDays = (now.getTime() - noteDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays < 0 || diffDays > 7) return false;
        } else if (dateFilter === 'this_month') {
          if (noteDate.getFullYear() !== now.getFullYear() || noteDate.getMonth() !== now.getMonth()) return false;
        } else if (dateFilter === 'previous_month') {
          const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (noteDate.getFullYear() !== prevMonthDate.getFullYear() || noteDate.getMonth() !== prevMonthDate.getMonth()) return false;
        } else if (dateFilter === 'this_year') {
          if (noteDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'last_year') {
          if (noteDate.getFullYear() !== now.getFullYear() - 1) return false;
        } else if (dateFilter === 'custom' && customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (noteDate < start || noteDate > end) return false;
        }
      }

      // Search query
      if (q) {
        const matchName = (n.notename || '').toLowerCase().includes(q);
        const matchBody = (n.note || '').toLowerCase().includes(q);
        const matchCat = (n.category || '').toLowerCase().includes(q);
        const matchDt = (n.datetime || '').toLowerCase().includes(q);
        if (!matchName && !matchBody && !matchCat && !matchDt) return false;
      }

      return true;
    });

    if (sortOrder === 'newest') {
      return [...list].reverse();
    }
    if (sortOrder === 'az') {
      return [...list].sort((a, b) => (a.notename || '').localeCompare(b.notename || ''));
    }
    return list;
  }, [notes, searchQuery, selectedCategory, dateFilter, customStart, customEnd, sortOrder]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast('Note copied to clipboard', 'success');
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const handleOpenNoteModal = (note: NoteEntry, startInEdit = false) => {
    setActiveNote(note);
    setFormName(note.notename || '');
    const cat = (note.category || 'Uncategorized').trim();
    if (categories.includes(cat)) {
      setFormCategory(cat);
      setFormCustomCat('');
    } else {
      setFormCategory('__custom__');
      setFormCustomCat(cat);
    }
    setFormBody(note.note || '');
    setIsEditingInPopup(startInEdit);
  };

  const toggleSelectNote = (id: string) => {
    setSelectedNoteIds(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      if (!isSelectMode && next.length > 0) {
        setIsSelectMode(true);
      } else if (isSelectMode && next.length === 0) {
        setIsSelectMode(false);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedNoteIds.length === filteredNotes.length && filteredNotes.length > 0) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(filteredNotes.map(n => n.id));
    }
  };

  // Long press handlers to enter select mode - scroll-proof!
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, noteId: string) => {
    if (isSelectMode) return; // In select mode, tap toggles immediately

    if ('touches' in e && e.touches.length > 0) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ('clientX' in e) {
      touchStartPos.current = { x: e.clientX, y: e.clientY };
    }
    isScrollingRef.current = false;

    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }

    pressTimerRef.current = setTimeout(() => {
      if (!isScrollingRef.current) {
        setIsSelectMode(true);
        setSelectedNoteIds(prev => (prev.includes(noteId) ? prev : [...prev, noteId]));
        showToast('Selection mode activated', 'info');
      }
      touchStartPos.current = null;
    }, 700);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !pressTimerRef.current) return;
    if (e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      // If user moved more than 6px in any direction, they are scrolling! Cancel long press!
      if (dx > 6 || dy > 6) {
        isScrollingRef.current = true;
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        touchStartPos.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    touchStartPos.current = null;
  };

  const handleBulkApplyCategory = async (overrideCat?: string) => {
    const targetCategory = (overrideCat ?? bulkCategoryTarget).trim();
    if (selectedNoteIds.length === 0 || !targetCategory) return;
    setIsSaving(true);
    try {
      for (const id of selectedNoteIds) {
        const target = notes.find(n => n.id === id);
        if (target) {
          const updated: NoteEntry = {
            ...target,
            category: targetCategory,
            action: 'SYNC'
          };
          await onUpdateNote(updated, {
            notename: target.notename,
            datetime: target.datetime
          });
        }
      }
      showToast(`Assigned "${targetCategory}" to ${selectedNoteIds.length} notes`, 'success');
      setSelectedNoteIds([]);
      setIsSelectMode(false);
      setShowBulkCategoryModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.length === 0) return;
    setIsSaving(true);
    try {
      for (const id of selectedNoteIds) {
        const target = notes.find(n => n.id === id);
        if (target) {
          await onDeleteNote(target);
        }
      }
      showToast(`Deleted ${selectedNoteIds.length} notes`, 'info');
      setSelectedNoteIds([]);
      setIsSelectMode(false);
      setShowBulkDeleteConfirm(false);
    } finally {
      setIsSaving(false);
    }
  };

  const resolvedCategory =
    formCategory === '__custom__'
      ? formCustomCat.trim() || 'Uncategorized'
      : formCategory.trim() || 'Uncategorized';

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() && !formBody.trim()) {
      showToast('Please enter a note title or content', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await onAddNote({
        notename: formName.trim() || formBody.trim().split('\n')[0].slice(0, 50) || 'Untitled',
        category: resolvedCategory,
        note: formBody
      });
      setShowCreateModal(false);
      setFormName('');
      setFormBody('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePopupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote) return;
    if (!formBody.trim() && !activeNote.notename?.trim()) {
      showToast('Please enter note content', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const updated: NoteEntry = {
        ...activeNote,
        notename: activeNote.notename?.trim() || 'Untitled',
        category: activeNote.category?.trim() || 'Uncategorized',
        note: formBody,
        action: 'SYNC'
      };
      await onUpdateNote(updated, {
        notename: activeNote.notename,
        datetime: activeNote.datetime
      });
      setActiveNote(updated);
      setIsEditingInPopup(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteNote) return;
    await onDeleteNote(confirmDeleteNote);
    setConfirmDeleteNote(null);
    if (activeNote && activeNote.id === confirmDeleteNote.id) {
      setActiveNote(null);
    }
  };

  const hasExtraFilterActive = sortOrder !== 'newest' || dateFilter !== 'all';

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 space-y-2 animate-fadeIn relative">
      {/* Minimal Single-Line Top Bar (Search + Sheet BD Category + Sort/Date Toggle) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-teal-400/75 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full h-8 pl-8 pr-2.5 rounded-xl bg-[#0B3C39] text-[#F0FDFA] border border-teal-800/70 text-xs font-medium placeholder:text-teal-400/55 focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Category Filter (Auto from Sheet BD) */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-[100px] sm:w-[132px] h-8 px-2 rounded-xl bg-[#0B3C39] text-teal-100 border border-teal-800/70 text-[11px] font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate shrink-0"
            aria-label="Category filter"
          >
            <option value="All">All Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Toggle Sort & Date Drawer */}
          <button
            type="button"
            onClick={() => setShowMoreFilters(prev => !prev)}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-95 ${
              showMoreFilters || hasExtraFilterActive
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-[#0B3C39] hover:bg-[#0E4844] text-teal-200 border-teal-800/70'
            }`}
            title="Sort & Date Filters"
            aria-label="Sort & Date Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Collapsible Sort & Date Row */}
        {showMoreFilters && (
          <div className="grid grid-cols-2 gap-1.5 animate-fadeIn">
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'sheet' | 'az')}
              className="h-9 px-2.5 rounded-xl bg-[#0B3C39] text-teal-100 border border-teal-800/80 text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate"
            >
              <option value="newest">Sort: Newest</option>
              <option value="sheet">Sort: Sheet Order</option>
              <option value="az">Sort: Title A–Z</option>
            </select>

            <select
              value={dateFilter}
              onChange={e => {
                const val = e.target.value;
                if (val === 'custom') {
                  setShowCustomDateModal(true);
                } else {
                  setDateFilter(val);
                }
              }}
              className="h-9 px-2.5 rounded-xl bg-[#0B3C39] text-teal-100 border border-teal-800/80 text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate"
            >
              <option value="all">Date: All</option>
              <option value="today">Today</option>
              <option value="previous_day">Previous Day</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="previous_month">Previous Month</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>
        )}
      </div>

      {/* SINGLE SIMPLE STICKY SELECTION ACTION BAR */}
      {isSelectMode && (
        <div className="sticky top-0 z-30 bg-[#062423]/95 backdrop-blur-md border border-emerald-500/80 rounded-xl px-2.5 py-1.5 shadow-xl flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-teal-900/90 hover:bg-teal-800 text-teal-100 border border-teal-700 font-bold text-[11px] cursor-pointer active:scale-95 transition-all whitespace-nowrap"
            >
              {selectedNoteIds.length === filteredNotes.length && filteredNotes.length > 0
                ? 'None'
                : 'All'}
            </button>
            <span className="text-[11px] font-bold text-emerald-300 tabular-nums whitespace-nowrap">
              {selectedNoteIds.length} selected
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedNoteIds.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  const target = notes.find(n => n.id === selectedNoteIds[0]);
                  if (target) handleOpenNoteModal(target);
                }}
                className="h-8 px-2.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-teal-100 border border-teal-600/80 font-bold flex items-center gap-1 cursor-pointer text-[11px] transition-all active:scale-95 whitespace-nowrap"
                title="Preview selected note"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-300" />
                <span>Preview</span>
              </button>
            )}

            <button
              type="button"
              disabled={selectedNoteIds.length === 0}
              onClick={() => {
                if (!bulkCategoryTarget && categories.length > 0) {
                  setBulkCategoryTarget(categories[0]);
                }
                setShowBulkCategoryModal(true);
              }}
              className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-1 cursor-pointer text-[11px] transition-all active:scale-95 whitespace-nowrap"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Category</span>
            </button>

            <button
              type="button"
              disabled={selectedNoteIds.length === 0}
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="h-8 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold flex items-center justify-center cursor-pointer text-[11px] transition-all active:scale-95"
              title="Delete selected"
              aria-label="Delete selected"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedNoteIds([]);
              }}
              className="w-8 h-8 rounded-lg bg-[#042F2E] hover:bg-teal-950 text-teal-300 border border-teal-700/80 font-bold cursor-pointer flex items-center justify-center transition-all active:scale-95"
              title="Cancel selection"
              aria-label="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ALL NOTES LIST (Demo Card Design in App Teal Palette) */}
      {filteredNotes.length === 0 ? (
        <div className="bg-[#0B3C39] border border-teal-800/80 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#062423] border border-teal-800/70 flex items-center justify-center mx-auto text-teal-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#F0FDFA]">
              {notes.length === 0 ? 'No notes synced yet' : 'No matching notes found'}
            </h3>
            <p className="text-xs text-teal-300/75 max-w-sm mx-auto">
              {notes.length === 0
                ? 'Tap the floating + button below to add a new note.'
                : 'Try adjusting your search query, category, or date filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-16">
          {filteredNotes.map(note => {
            const isSelected = selectedNoteIds.includes(note.id);
            const compactDt = formatCompactNoteDateTime(note.datetime);
            const catLabel = (note.category || 'Uncategorized').trim();
            const previewText = formatCleanPreview(note.note);
            return (
              <div
                key={note.id}
                onClick={() => handleOpenNoteModal(note)}
                onMouseDown={e => handleTouchStart(e, note.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={e => handleTouchStart(e, note.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={`border rounded-2xl px-3.5 py-2 transition-colors cursor-pointer flex flex-col gap-1 group select-none min-w-0 ${
                  isSelected
                    ? 'bg-teal-900/65 border-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-[#0B3C39] hover:bg-[#0E4844] border-teal-800/75 hover:border-teal-600/80'
                }`}
              >
                {/* Row 1: Checkbox + Category Dot + Uppercase Category + DateTime + Airy Action Icons */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelectNote(note.id);
                      }}
                      className={`w-[15px] h-[15px] rounded-[3px] border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-[#042F2E]'
                          : 'bg-white border-white/90 hover:border-emerald-300'
                      }`}
                      title={isSelected ? 'Deselect note' : 'Select note'}
                      aria-label={isSelected ? 'Deselect note' : 'Select note'}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <span className={`w-2 h-2 rounded-full shrink-0 ${getCategoryDotClass(catLabel)}`} />

                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-teal-200/80 truncate max-w-[56px]">
                      {catLabel}
                    </span>

                    <span className="text-[10.5px] font-normal tabular-nums text-teal-300/65 shrink-0 whitespace-nowrap">
                      {compactDt}
                    </span>
                  </div>

                  {/* Top-Right Action Icons (Clean, airy spacing like demo: larger Copy, Edit, small Delete) */}
                  <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleCopy(note.note || note.notename, note.id)}
                      className="text-teal-200/80 hover:text-emerald-300 flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
                      title="Copy note"
                      aria-label="Copy note"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-[18px] h-[18px] text-emerald-400" strokeWidth={2.4} />
                      ) : (
                        <Copy className="w-[18px] h-[18px]" strokeWidth={1.7} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenNoteModal(note, true)}
                      className="text-teal-300/75 hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
                      title="Edit note"
                      aria-label="Edit note"
                    >
                      <Edit3 className="w-[15px] h-[15px]" strokeWidth={1.6} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteNote(note)}
                      className="text-teal-300/65 hover:text-rose-300 flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-[13.5px] h-[13.5px]" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>

                {/* Row 2: Clean Bold Title */}
                <h3 className="text-[14.5px] font-bold text-[#F0FDFA] truncate group-hover:text-emerald-300 transition-colors leading-snug">
                  {note.notename || 'Untitled'}
                </h3>

                {/* Row 3: Clean 1-Line Body Preview */}
                <p className="text-[12px] text-teal-200/70 truncate leading-snug">
                  {previewText}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING ACTION BUTTON (FAB) FOR NEW NOTE AT BOTTOM RIGHT */}
      {typeof document !== 'undefined' &&
        !isSelectMode &&
        createPortal(
          <button
            type="button"
            onClick={() => {
              setFormName('');
              setFormCategory(categories[0] || 'Uncategorized');
              setFormCustomCat('');
              setFormBody('');
              setShowCreateModal(true);
            }}
            className="fixed bottom-[74px] sm:bottom-20 right-5 z-[9999] w-14 h-14 rounded-full bg-[#0D9488] hover:bg-[#0F766E] text-white flex items-center justify-center shadow-2xl shadow-emerald-950/80 cursor-pointer transition-transform active:scale-95 border-2 border-white/20 pointer-events-auto"
            title="Add New Note"
          >
            <Plus className="w-7 h-7 stroke-[3]" />
          </button>,
          document.body
        )}

      {/* ======================================================== */}
      {/* SIMPLE BULK CATEGORY ASSIGN MODAL                       */}
      {/* ======================================================== */}
      {showBulkCategoryModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => setShowBulkCategoryModal(false)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-xs p-4 space-y-3 shadow-2xl animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#F0FDFA]">
                Category ({selectedNoteIds.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="w-6 h-6 rounded-full bg-[#062423] text-teal-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleBulkApplyCategory(cat)}
                  className="px-3 py-1.5 rounded-xl bg-[#062423] hover:bg-emerald-600 text-teal-100 hover:text-white border border-teal-700/70 text-xs font-semibold cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-teal-800/70">
              <input
                type="text"
                value={bulkCategoryTarget}
                onChange={e => setBulkCategoryTarget(e.target.value)}
                placeholder="Or type new category..."
                className="flex-1 min-h-[34px] px-2.5 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-medium focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleBulkApplyCategory()}
                disabled={isSaving || !bulkCategoryTarget.trim()}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                {isSaving ? '...' : 'Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BULK DELETE CONFIRM MODAL                               */}
      {/* ======================================================== */}
      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#F0FDFA]">
                Delete {selectedNoteIds.length} Selected Notes
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="w-6 h-6 rounded-full bg-[#062423] text-teal-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-teal-200/90 leading-relaxed">
              Are you sure you want to delete {selectedNoteIds.length} notes? This will permanently remove them from Google Sheet (BB:BF).
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="min-h-[36px] px-3.5 py-1 rounded-xl bg-[#062423] text-teal-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isSaving}
                className="min-h-[36px] px-4 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {isSaving ? 'Deleting...' : 'Delete Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* NOTE FULL-SCREEN CONTENT EDITOR (WHEN EDITING)           */}
      {/* ======================================================== */}
      {activeNote && isEditingInPopup && createPortal(
        <div className="fixed inset-0 z-[999999] bg-[#042F2E] text-[#F0FDFA] flex flex-col w-full h-full overflow-hidden animate-fadeIn">
          {/* Full-screen Top Bar */}
          <div className="px-3 sm:px-5 py-3 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsEditingInPopup(false)}
                className="w-8 h-8 rounded-xl bg-[#0B3C39] hover:bg-teal-900 text-teal-200 hover:text-white flex items-center justify-center cursor-pointer border border-teal-700/60 shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-xs sm:text-sm font-bold text-[#F0FDFA] truncate">
                Edit Content
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditingInPopup(false)}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3C39] text-teal-200 border border-teal-700/60 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSavePopupEdit}
                className="min-h-[34px] px-3.5 py-1 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
              </button>
            </div>
          </div>

          {/* Full-screen Content Editor Only */}
          <form onSubmit={handleSavePopupEdit} className="flex-1 flex flex-col p-3 sm:p-5 min-h-0">
            <textarea
              value={formBody}
              onChange={e => setFormBody(e.target.value)}
              placeholder="Write note content..."
              autoFocus
              className="flex-1 w-full h-full min-h-0 p-3.5 sm:p-4 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-emerald-400 resize-none"
            />
          </form>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* NOTE DETAILS POPUP MODAL (WHEN VIEWING)                  */}
      {/* ======================================================== */}
      {activeNote && !isEditingInPopup && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => {
            setActiveNote(null);
            setIsEditingInPopup(false);
          }}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <NotebookPen className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-[#F0FDFA] truncate">
                  {activeNote.notename || 'Note Details'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditingInPopup(true)}
                  className="min-h-[34px] px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNote(null);
                    setIsEditingInPopup(false);
                  }}
                  className="w-7 h-7 rounded-full bg-[#0B3C39] text-teal-300 hover:text-white flex items-center justify-center cursor-pointer border border-teal-700/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#F0FDFA] leading-snug break-words">
                    {activeNote.notename}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-teal-300/80 mt-1 flex-wrap">
                    <span className="font-semibold text-emerald-300">{activeNote.category || 'Uncategorized'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activeNote.datetime || 'Synced'}</span>
                  </div>
                </div>

                {/* Clicking directly on text switches to full-screen edit mode */}
                <div
                  onClick={() => setIsEditingInPopup(true)}
                  className="bg-[#062423] border border-teal-800/70 hover:border-emerald-500/60 rounded-xl p-4 text-xs sm:text-sm text-[#F0FDFA] leading-relaxed whitespace-pre-wrap break-words min-h-[180px] cursor-pointer transition-colors group relative"
                  title="Click anywhere to edit"
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    Click to edit
                  </div>
                  {activeNote.note || <span className="text-teal-400/60 italic">No content (click to add)</span>}
                </div>
              </div>
            </div>

            {/* Modal Footer actions */}
            <div className="px-4 py-3 bg-[#062423] border-t border-teal-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteNote(activeNote)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(activeNote.note || activeNote.notename, activeNote.id)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0B3C39] hover:bg-teal-900 text-teal-100 border border-teal-700/70 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === activeNote.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-teal-300" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveNote(null);
                    setIsEditingInPopup(false);
                  }}
                  className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE NOTE MODAL                                       */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-3">
              <h3 className="text-xs sm:text-sm font-bold text-[#F0FDFA]">New Note</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-[#0B3C39] text-teal-300 hover:text-white flex items-center justify-center cursor-pointer border border-teal-700/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNew} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-teal-200">Note Title</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Enter note name..."
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-medium focus:outline-none focus:border-emerald-400"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-teal-200">Category</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__custom__">+ Custom Category...</option>
                </select>
              </div>

              {formCategory === '__custom__' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-teal-200">Custom Category Name</label>
                  <input
                    type="text"
                    value={formCustomCat}
                    onChange={e => setFormCustomCat(e.target.value)}
                    placeholder="e.g. Work, Ideas"
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-medium focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-teal-200">Note Content</label>
                <textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  rows={8}
                  placeholder="Write your note here..."
                  className="w-full p-3 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs leading-relaxed focus:outline-none resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#062423] text-teal-200 border border-teal-700/60 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM DATE RANGE MODAL                                 */}
      {/* ======================================================== */}
      {showCustomDateModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => setShowCustomDateModal(false)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#F0FDFA] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Custom Date Range</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomDateModal(false)}
                className="w-6 h-6 rounded-full bg-[#062423] text-teal-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold text-teal-200 uppercase">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full min-h-[36px] px-2.5 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-teal-200 uppercase">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full min-h-[36px] px-2.5 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDateFilter('all');
                  setCustomStart('');
                  setCustomEnd('');
                  setShowCustomDateModal(false);
                }}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[#062423] text-teal-200 text-xs font-semibold cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (customStart && customEnd) {
                    setDateFilter('custom');
                  }
                  setShowCustomDateModal(false);
                }}
                className="min-h-[36px] px-4 py-1 rounded-xl bg-[#0D9488] text-white text-xs font-bold cursor-pointer"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                               */}
      {/* ======================================================== */}
      {confirmDeleteNote && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
          onClick={() => setConfirmDeleteNote(null)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl p-4 max-w-sm w-full space-y-3 shadow-2xl animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#F0FDFA]">Delete Note</h3>
              <button
                type="button"
                onClick={() => setConfirmDeleteNote(null)}
                className="w-6 h-6 rounded-full bg-[#062423] text-teal-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-teal-200/90 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">"{confirmDeleteNote.notename}"</span>? This will permanently remove it from Google Sheet (BB:BF).
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteNote(null)}
                className="min-h-[36px] px-3.5 py-1 rounded-xl bg-[#062423] text-teal-200 text-xs font-semibold border border-teal-700/60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[36px] px-4 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
