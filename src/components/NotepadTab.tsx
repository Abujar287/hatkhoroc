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
  RotateCcw,
  FolderOpen,
  X,
  Calendar,
  CheckSquare,
  Square,
  Tag
} from 'lucide-react';
import { NoteEntry } from '../types';

interface NotepadTabProps {
  notes: NoteEntry[];
  isSyncing: boolean;
  onSyncNotes: () => Promise<void> | void;
  onAddNote: (note: { notename: string; category: string; note: string }) => Promise<void>;
  onUpdateNote: (note: NoteEntry, original?: { notename: string; datetime: string }) => Promise<void>;
  onDeleteNote: (note: NoteEntry) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotepadTab: React.FC<NotepadTabProps> = ({
  notes,
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

  // Multi-select state (triggered by long press on note card)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState('Uncategorized');

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

  // Extract unique categories directly from Google Sheet notes (BD column)
  const categories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      const c = (n.category || '').trim();
      if (c) set.add(c);
    });
    if (set.size === 0) {
      set.add('Uncategorized');
      set.add('Important');
    }
    return Array.from(set);
  }, [notes]);

  const parseNoteDate = (dtStr: string): Date | null => {
    if (!dtStr) return null;
    const d = new Date(dtStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dtStr.split(',');
    if (parts.length > 0) {
      const d2 = new Date(parts[0].trim());
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
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

  const handleOpenNoteModal = (note: NoteEntry) => {
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
    setIsEditingInPopup(false);
  };

  const toggleSelectNote = (id: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
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

  const handleBulkApplyCategory = async () => {
    if (selectedNoteIds.length === 0) return;
    setIsSaving(true);
    try {
      for (const id of selectedNoteIds) {
        const target = notes.find(n => n.id === id);
        if (target) {
          const updated: NoteEntry = {
            ...target,
            category: bulkCategoryTarget,
            action: 'SYNC'
          };
          await onUpdateNote(updated, {
            notename: target.notename,
            datetime: target.datetime
          });
        }
      }
      showToast(`Assigned category to ${selectedNoteIds.length} notes`, 'success');
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
    if (!formName.trim() && !formBody.trim()) {
      showToast('Please enter a note title or content', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const updated: NoteEntry = {
        ...activeNote,
        notename: formName.trim() || 'Untitled',
        category: resolvedCategory,
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

  return (
    <div className="w-full max-w-6xl mx-auto pb-28 space-y-4 animate-fadeIn relative">
      {/* Top Header & Search & Filter Row */}
      <div className="bg-[#0B3C39] border border-teal-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        {/* Title & Count */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <NotebookPen className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-[#F0FDFA] tracking-tight">
              Notepad ({notes.length})
            </h2>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes by title, content, category, or date..."
            className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* Filter Row: Category, Sort, Date (1 row on mobile) */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {/* 1. Category */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="min-h-[36px] px-2 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-[11px] sm:text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate"
          >
            <option value="All">Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* 2. Sort */}
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'newest' | 'sheet' | 'az')}
            className="min-h-[36px] px-2 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-[11px] sm:text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate"
          >
            <option value="newest">Sort</option>
            <option value="newest">Newest First</option>
            <option value="sheet">Sheet Order</option>
            <option value="az">Title A–Z</option>
          </select>

          {/* 3. Date */}
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
            className="min-h-[36px] px-2 py-1 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-[11px] sm:text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer truncate"
          >
            <option value="all">Date</option>
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
      </div>

      {/* STICKY TOP MULTI-SELECT ACTION BAR (Stays pinned to top of the scroll container while scrolling) */}
      {isSelectMode && (
        <div className="sticky top-0 z-30 bg-[#062423]/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl px-3 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2 animate-fadeIn mb-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1.5 rounded-xl bg-teal-900/90 hover:bg-teal-800 text-teal-200 border border-teal-700 font-bold text-xs cursor-pointer active:scale-95 transition-all"
            >
              {selectedNoteIds.length === filteredNotes.length && filteredNotes.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </button>
            <span className="text-xs font-black text-emerald-300 tabular-nums">
              ({selectedNoteIds.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={selectedNoteIds.length === 0}
              onClick={() => setShowBulkCategoryModal(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md text-xs transition-all active:scale-95"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Assign Category</span>
            </button>

            <button
              type="button"
              disabled={selectedNoteIds.length === 0}
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md text-xs transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedNoteIds([]);
              }}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#042F2E] hover:bg-teal-950 text-teal-300 border border-teal-700/80 font-bold cursor-pointer text-xs transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ALL NOTES LIST */}
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
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-all ${isSelectMode ? 'pb-36' : 'pb-20'}`}>
          {filteredNotes.map(note => {
            const isSelected = selectedNoteIds.includes(note.id);
            return (
              <div
                key={note.id}
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelectNote(note.id);
                  } else {
                    handleOpenNoteModal(note);
                  }
                }}
                onMouseDown={e => handleTouchStart(e, note.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={e => handleTouchStart(e, note.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={`border rounded-2xl p-4 transition-colors cursor-pointer flex flex-col justify-between gap-3 group select-none ${
                  isSelected
                    ? 'bg-teal-900/60 border-emerald-400'
                    : 'bg-[#0B3C39] hover:bg-[#0E4844] border-teal-800/80 hover:border-teal-600/80'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelectMode && (
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            toggleSelectNote(note.id);
                          }}
                          className="text-emerald-400 shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-teal-400/70" />
                          )}
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-[#F0FDFA] truncate group-hover:text-emerald-300 transition-colors">
                        {note.notename || 'Untitled'}
                      </h3>
                    </div>

                    {/* Preview, Copy & Remove Buttons on Card (Always accessible) */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenNoteModal(note)}
                        className="w-7 h-7 rounded-lg bg-[#062423] text-teal-300 hover:text-white flex items-center justify-center border border-teal-800/60 cursor-pointer"
                        title="Preview note"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(note.note || note.notename, note.id)}
                        className="w-7 h-7 rounded-lg bg-[#062423] text-teal-300 hover:text-white flex items-center justify-center border border-teal-800/60 cursor-pointer"
                        title="Copy note"
                      >
                        {copiedId === note.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteNote(note)}
                        className="w-7 h-7 rounded-lg bg-rose-950/60 text-rose-300 hover:bg-rose-900 hover:text-white flex items-center justify-center border border-rose-800/60 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-teal-300/80 truncate">
                    <span className="font-semibold text-emerald-300">{note.category || 'Uncategorized'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums truncate">{note.datetime || 'Synced'}</span>
                  </div>

                  <p className="text-xs text-teal-100/85 line-clamp-3 whitespace-pre-line leading-relaxed pt-1">
                    {note.note || 'No content'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEWPORT-ANCHORED FLOATING BOTTOM ACTION BAR (Portal to document.body, totally immune to container scrolling) */}
      {typeof document !== 'undefined' &&
        isSelectMode &&
        createPortal(
          <div className="fixed bottom-[74px] sm:bottom-20 left-1/2 -translate-x-1/2 z-[99999] w-[95%] max-w-lg bg-[#062423]/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl px-2.5 sm:px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-1.5 sm:gap-2 animate-fadeIn pointer-events-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-2.5 py-1.5 rounded-xl bg-teal-900/90 hover:bg-teal-800 text-teal-200 border border-teal-700 font-bold text-[11px] sm:text-xs cursor-pointer active:scale-95 transition-all"
              >
                {selectedNoteIds.length === filteredNotes.length && filteredNotes.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              <span className="text-xs font-black text-emerald-300 tabular-nums">
                ({selectedNoteIds.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={selectedNoteIds.length === 0}
                onClick={() => setShowBulkCategoryModal(true)}
                className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md text-[11px] sm:text-xs transition-all active:scale-95"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="truncate">Assign Category</span>
              </button>

              <button
                type="button"
                disabled={selectedNoteIds.length === 0}
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md text-[11px] sm:text-xs transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedNoteIds([]);
                }}
                className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#042F2E] hover:bg-teal-950 text-teal-300 border border-teal-700/80 font-bold cursor-pointer text-[11px] sm:text-xs transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
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
      {/* BULK CATEGORY ASSIGN MODAL                              */}
      {/* ======================================================== */}
      {showBulkCategoryModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 animate-fadeIn"
          onClick={() => setShowBulkCategoryModal(false)}
        >
          <div
            className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl animate-modalSpring"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#F0FDFA]">
                Assign Category to {selectedNoteIds.length} Notes
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="w-6 h-6 rounded-full bg-[#062423] text-teal-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-teal-200">Select Category from Sheet</label>
              <select
                value={bulkCategoryTarget}
                onChange={e => setBulkCategoryTarget(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="min-h-[36px] px-3.5 py-1 rounded-xl bg-[#062423] text-teal-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkApplyCategory}
                disabled={isSaving}
                className="min-h-[36px] px-4 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                {isSaving ? 'Applying...' : 'Apply Category'}
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
      {/* NOTE DETAILS & EDIT POPUP MODAL                         */}
      {/* ======================================================== */}
      {activeNote && (
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
                  {isEditingInPopup ? 'Edit Note' : (activeNote.notename || 'Note Details')}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditingInPopup && (
                  <button
                    type="button"
                    onClick={() => setIsEditingInPopup(true)}
                    className="min-h-[34px] px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
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
              {isEditingInPopup ? (
                <form onSubmit={handleSavePopupEdit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-teal-200">Title</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
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
                        <option value="__custom__">+ Custom...</option>
                      </select>
                    </div>
                  </div>

                  {formCategory === '__custom__' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-teal-200">Custom Category</label>
                      <input
                        type="text"
                        value={formCustomCat}
                        onChange={e => setFormCustomCat(e.target.value)}
                        placeholder="Enter category name..."
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs font-medium focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-teal-200">Content (Click text to edit)</label>
                    <textarea
                      value={formBody}
                      onChange={e => setFormBody(e.target.value)}
                      rows={10}
                      className="w-full p-3 rounded-xl bg-white text-slate-900 border border-teal-700/60 text-xs leading-relaxed focus:outline-none focus:border-emerald-400 resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingInPopup(false)}
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
              ) : (
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

                  {/* Clicking directly on text switches to edit mode */}
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
              )}
            </div>

            {/* Modal Footer actions */}
            {!isEditingInPopup && (
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
            )}
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
