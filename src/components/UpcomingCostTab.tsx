import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  BellRing,
  Trash2,
  Edit3,
  Search,
  Check,
  X,
  RotateCcw,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { CostTask } from '../types';
import { ModalPortal } from './Modals';
import { initAudioUnlock } from '../utils/taskAlarmManager';
import { normalizeTime, formatTime12h, formatNumberLocale } from '../utils/dateUtils';

interface TaskTabProps {
  tasks: CostTask[];
  onAddTask: (task: Omit<CostTask, 'id' | 'createdAt'>) => void;
  onUpdateTask: (task: CostTask) => void;
  onDeleteTask: (taskId: string) => void;
  onConvertTaskToExpense: (task: CostTask) => void;
  t: (en: string, bn: string) => string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentUser: { username: string; displayName?: string } | null;
  categories?: string[];
  lang: 'en' | 'bn';
}

export const UpcomingCostTab: React.FC<TaskTabProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onConvertTaskToExpense,
  t,
  showToast,
  currentUser,
  categories = [],
  lang
}) => {
  const [filterStatus] = useState<'pending' | 'due' | 'upcoming' | 'completed' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CostTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<CostTask | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');
  const [category, setCategory] = useState(categories[0] || 'Uncategorized');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(1);
  const [autoNotify, setAutoNotify] = useState(true);
  const [notes, setNotes] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    initAudioUnlock();
  }, []);

  const openFormModal = (taskToEdit?: CostTask) => {
    initAudioUnlock();
    if (taskToEdit) {
      setEditingTask(taskToEdit);
      setTitle(taskToEdit.title);
      setAmount(taskToEdit.amount.toString());
      setDueDate(taskToEdit.dueDate);
      setDueTime(taskToEdit.dueTime || '09:00');
      setCategory(taskToEdit.category);
      setPriority(taskToEdit.priority);
      setReminderDaysBefore(taskToEdit.reminderDaysBefore ?? 1);
      setAutoNotify(taskToEdit.autoNotify ?? true);
      setNotes(taskToEdit.notes || '');
    } else {
      setEditingTask(null);
      setTitle('');
      setAmount('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setDueTime('09:00');
      setCategory(categories[0] || 'Uncategorized');
      setPriority('medium');
      setReminderDaysBefore(1);
      setAutoNotify(true);
      setNotes('');
    }
    setShowAddModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast(t('Please enter task name', 'টাস্কের নাম লিখুন'), 'error');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast(t('Please enter valid amount', 'সঠিক খরচের পরিমাণ লিখুন'), 'error');
      return;
    }

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: title.trim(),
        amount: parsedAmount,
        dueDate,
        dueTime,
        category,
        priority,
        reminderDaysBefore,
        autoNotify,
        notes: notes.trim()
      });
      showToast(t('Task updated successfully', 'টাস্ক আপডেট হয়েছে'), 'success');
    } else {
      onAddTask({
        title: title.trim(),
        amount: parsedAmount,
        dueDate,
        dueTime,
        category,
        priority,
        reminderDaysBefore,
        autoNotify: true,
        notes: notes.trim(),
        status: 'pending',
        createdBy: currentUser?.username || 'user'
      });
      showToast(t('New task reminder saved!', 'নতুন টাস্ক রিমাইন্ডার সেভ হয়েছে!'), 'success');
    }

    setShowAddModal(false);
  };

  // Filter & Sort tasks: Closest due date & time shown at the top!
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        task.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || task.category === selectedCategory;

      let matchesStatus = true;
      if (filterStatus === 'pending') {
        matchesStatus = task.status === 'pending';
      } else if (filterStatus === 'due') {
        matchesStatus = task.status === 'pending' && task.dueDate <= todayStr;
      } else if (filterStatus === 'upcoming') {
        matchesStatus = task.status === 'pending' && task.dueDate > todayStr;
      } else if (filterStatus === 'completed') {
        matchesStatus = task.status === 'completed' || task.status === 'paid';
      }

      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      const isDoneA = a.status === 'completed' || a.status === 'paid';
      const isDoneB = b.status === 'completed' || b.status === 'paid';

      // Pending tasks come first, completed tasks go to the bottom
      if (!isDoneA && isDoneB) return -1;
      if (isDoneA && !isDoneB) return 1;

      // Combine date and time for precise chronological ordering (closest upcoming first)
      const timeA = a.dueTime ? normalizeTime(a.dueTime) : '00:00';
      const timeB = b.dueTime ? normalizeTime(b.dueTime) : '00:00';
      const dateTimeA = `${a.dueDate} ${timeA}`;
      const dateTimeB = `${b.dueDate} ${timeB}`;

      if (!isDoneA && !isDoneB) {
        // Pending: Closest upcoming date/time at the top (ascending order)
        return dateTimeA.localeCompare(dateTimeB);
      }

      // Paid/Completed: Most recent at top of completed list
      return dateTimeB.localeCompare(dateTimeA);
    });
  }, [tasks, searchQuery, selectedCategory, filterStatus, todayStr]);

  // Statistics calculation
  const stats = useMemo(() => {
    let dueTodayOrOverdueCount = 0;
    let dueTodayOrOverdueAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;
    let completedAmount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      if (task.status === 'pending') {
        if (task.dueDate <= todayStr) {
          dueTodayOrOverdueCount++;
          dueTodayOrOverdueAmount += task.amount;
        } else {
          upcomingCount++;
          upcomingAmount += task.amount;
        }
      } else {
        completedCount++;
        completedAmount += task.amount;
      }
    });

    return {
      dueTodayOrOverdueCount,
      dueTodayOrOverdueAmount,
      upcomingCount,
      upcomingAmount,
      completedCount,
      completedAmount,
      totalPendingAmount: dueTodayOrOverdueAmount + upcomingAmount
    };
  }, [tasks, todayStr]);

  // Helper date distance text
  const getDaysDifferenceText = (targetDateStr: string) => {
    const target = new Date(targetDateStr);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('Due Today', 'আজকের দিন');
    if (diffDays === 1) return t('Tomorrow', 'আগামীকাল');
    if (diffDays > 1) return t(`In ${diffDays} days`, `${diffDays} দিন বাকি`);
    if (diffDays === -1) return t('1 day overdue', '১ দিন পার');
    return t(`${Math.abs(diffDays)} days overdue`, `${Math.abs(diffDays)} দিন পার`);
  };

  return (
    <div className="w-full flex flex-col space-y-3 pb-28 p-2 md:p-4">

      {/* Summary Statistics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
        <div className="bg-[#0B3C39] p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-tight">Total Due</span>
          <span className="text-sm font-black text-amber-300 tabular-nums">
            {formatNumberLocale(stats.totalPendingAmount, lang)}
          </span>
        </div>
        <div className="bg-[#0B3C39] p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-tight">Due Today</span>
          <span className="text-sm font-black text-[#FF7A59] tabular-nums">
            {formatNumberLocale(stats.dueTodayOrOverdueAmount, lang)}
          </span>
        </div>
        <div className="bg-[#0B3C39] p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-tight">Upcoming</span>
          <span className="text-sm font-black text-teal-300 tabular-nums">
            {formatNumberLocale(stats.upcomingAmount, lang)}
          </span>
        </div>
        <div className="bg-[#0B3C39] p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-tight">Completed</span>
          <span className="text-sm font-black text-emerald-400 tabular-nums">
            {formatNumberLocale(stats.completedAmount, lang)}
          </span>
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={() => openFormModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Search & Category Filter Row */}
      <div className="bg-[#0B3C39] p-2 rounded-xl border border-teal-800/80 flex items-center justify-between gap-2 shadow-xs">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search task..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 focus:outline-none placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Select */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-2.5 py-1 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 font-medium focus:outline-none shrink-0"
        >
          <option value="all">All Category</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* ULTRA-COMPACT TASK LIST VIEW */}
      {filteredTasks.length === 0 ? (
        <div className="bg-[#0B3C39] rounded-xl border border-teal-800/80 p-6 text-center flex flex-col items-center justify-center my-2">
          <Clock className="w-6 h-6 text-teal-400 mb-2" />
          <p className="text-xs font-bold text-teal-100">No task reminders found</p>
          <button
            type="button"
            onClick={() => openFormModal()}
            className="mt-3 px-3 py-1.5 bg-teal-500 text-teal-950 font-bold text-xs rounded-lg shadow-sm"
          >
            + Add Task
          </button>
        </div>
      ) : (
        <div className="bg-[#0B3C39] rounded-xl border border-teal-800/80 overflow-hidden shadow-md divide-y divide-teal-800/60">
          
          {/* Table Header Row (Desktop/Tablet) */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-teal-950/80 text-[11px] font-extrabold uppercase tracking-wider text-teal-300">
            <div className="col-span-3">Task Name</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Datetime</div>
            <div className="col-span-1">Due Days</div>
            <div className="col-span-1">Amount</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* List Rows - Closest due date & time displayed first */}
          {filteredTasks.map(task => {
            const isDone = task.status === 'completed' || task.status === 'paid';
            const isOverdue = !isDone && task.dueDate < todayStr;
            const isToday = !isDone && task.dueDate === todayStr;
            const isDueNow = (isToday || isOverdue) && !isDone;
            const daysText = getDaysDifferenceText(task.dueDate);

            return (
              <div
                key={task.id}
                className={`p-3 transition-all duration-200 shadow-xs rounded-xl ${
                  isDone
                    ? 'bg-[#062423]/60 border-l-4 border-l-slate-600 opacity-85 hover:bg-teal-900/30'
                    : isDueNow
                    ? 'bg-gradient-to-r from-[#FF7A59] to-[#E05338] border-2 border-white/60 text-white shadow-xl shadow-[#FF7A59]/30 ring-2 ring-[#FF7A59]/50 animate-glowPulse'
                    : 'bg-[#0B3C39] border-l-4 border-l-teal-500 hover:bg-teal-900/40'
                }`}
              >
                {/* DESKTOP ROW (md:grid) */}
                <div className="hidden md:grid grid-cols-12 items-center gap-2">
                  {/* 1. Task Name */}
                  <div className="col-span-3 min-w-0">
                    <span className={`text-sm font-bold truncate block ${
                      isDone
                        ? 'line-through text-slate-400'
                        : isDueNow
                        ? 'text-white font-extrabold drop-shadow-xs'
                        : 'text-[#F0FDFA]'
                    }`}>
                      {task.title}
                    </span>
                  </div>

                  {/* 2. Category */}
                  <div className="col-span-2 truncate">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                      isDueNow
                        ? 'text-white bg-white/20 border-white/40 font-bold'
                        : 'text-teal-200 bg-teal-950/80 border-teal-800'
                    }`}>
                      {task.category}
                    </span>
                  </div>

                  {/* 3. Datetime (2026-11-10 (10:00AM)) */}
                  <div className={`col-span-2 text-xs flex items-center gap-1 ${isDueNow ? 'text-white font-bold' : 'text-teal-200'}`}>
                    <span className="font-semibold">{task.dueDate}</span>
                    {task.dueTime && (
                      <span className={`text-[11px] font-medium ${isDueNow ? 'text-amber-200 font-bold' : 'text-amber-300'}`}>
                        ({formatTime12h(task.dueTime)})
                      </span>
                    )}
                  </div>

                  {/* 4. Due Days */}
                  <div className="col-span-1">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-700">
                        Paid
                      </span>
                    ) : isDueNow ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-white px-2 py-0.5 rounded-full shadow-md animate-pulse">
                        {isToday ? 'Due Today' : daysText}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-200 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800">
                        {daysText}
                      </span>
                    )}
                  </div>

                  {/* 5. Amount */}
                  <div className="col-span-1 text-left">
                    <span className={`text-sm font-extrabold ${
                      isDone
                        ? 'text-slate-400'
                        : isDueNow
                        ? 'text-white font-black drop-shadow-sm'
                        : 'text-amber-300'
                    }`}>
                      {task.amount.toLocaleString()}
                    </span>
                  </div>

                  {/* 6. Priority */}
                  <div className="col-span-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      isDueNow
                        ? 'bg-white/20 text-white border border-white/40'
                        : task.priority === 'high'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : task.priority === 'medium'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-teal-950 text-teal-300 border border-teal-800'
                    }`}>
                      {task.priority ? task.priority.toUpperCase() : 'MED'}
                    </span>
                  </div>

                  {/* 7. Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 shrink-0">
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => onConvertTaskToExpense(task)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                          isDueNow
                            ? 'bg-amber-300 hover:bg-amber-200 text-amber-950 shadow-md ring-1 ring-amber-400'
                            : 'bg-teal-500 hover:bg-teal-400 text-teal-950'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>Pay Now</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateTask({ ...task, status: 'pending' })}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-teal-300 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Unpaid</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openFormModal(task)}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                        isDueNow
                          ? 'bg-red-800 hover:bg-red-900 text-white border-red-400'
                          : 'bg-teal-950 hover:bg-teal-900 text-teal-200 border-teal-800'
                      }`}
                      title="Edit Task"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                        isDueNow
                          ? 'bg-red-950 hover:bg-black text-white border-red-400'
                          : 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-800/80'
                      }`}
                      title="Delete Task"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* MOBILE COMPACT CARD (md:hidden) */}
                <div className="flex md:hidden flex-col space-y-2">
                  {/* Mobile Top Row: Priority + Title + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        isDueNow
                          ? 'bg-white/20 text-white border border-white/40'
                          : task.priority === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : task.priority === 'medium'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}>
                        {task.priority ? task.priority.substring(0, 3).toUpperCase() : 'MED'}
                      </span>
                      <h3 className={`text-sm font-bold truncate ${
                        isDone
                          ? 'line-through text-slate-400'
                          : isDueNow
                          ? 'text-white font-black'
                          : 'text-[#F0FDFA]'
                      }`}>
                        {task.title}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-700">
                          <Check className="w-3 h-3 stroke-[3]" /> Paid
                        </span>
                      ) : isDueNow ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-white px-2 py-0.5 rounded-full shadow-md animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-red-600" /> {isToday ? 'Due Today' : daysText}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-200 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800">
                          {daysText}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Middle Row: Category + Date & Time + Amount */}
                  <div className={`flex items-center justify-between gap-2 text-xs pt-1 border-t ${
                    isDueNow ? 'border-red-400/40 text-white' : 'border-teal-800/40 text-teal-200/90'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        isDueNow ? 'text-white bg-white/20 border-white/40 font-bold' : 'text-teal-300 bg-teal-950/80 border-teal-800'
                      }`}>
                        {task.category}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-medium">
                        <Calendar className={`w-3 h-3 shrink-0 ${isDueNow ? 'text-white' : 'text-teal-400'}`} />
                        <span className="font-semibold">{task.dueDate}</span>
                        {task.dueTime && (
                          <span className={isDueNow ? 'text-amber-200 font-bold' : 'text-amber-300'}>
                            ({formatTime12h(task.dueTime)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-base font-extrabold ${
                        isDone
                          ? 'text-slate-400'
                          : isDueNow
                          ? 'text-white font-black'
                          : 'text-amber-300'
                      }`}>
                        {task.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Bottom Action Row */}
                  <div className={`flex items-center justify-end gap-1.5 pt-1 border-t ${
                    isDueNow ? 'border-red-400/40' : 'border-teal-800/40'
                  }`}>
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => onConvertTaskToExpense(task)}
                        className={`px-3 py-1 rounded-lg text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 ${
                          isDueNow
                            ? 'bg-amber-300 hover:bg-amber-200 text-amber-950 shadow-md ring-1 ring-amber-400'
                            : 'bg-teal-500 hover:bg-teal-400 text-teal-950'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>Pay Now</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateTask({ ...task, status: 'pending' })}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-teal-300 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Unpaid</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openFormModal(task)}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isDueNow ? 'bg-red-800 text-white border-red-400' : 'bg-teal-950 text-teal-200 border border-teal-800'
                      }`}
                      title="Edit"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isDueNow ? 'bg-red-950 text-white border-red-400' : 'bg-red-950/80 text-red-300 border border-red-800'
                      }`}
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT TASK MODAL */}
      {showAddModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-modalSpring">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-teal-900/90 border-b border-teal-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-300" />
                <h2 className="text-base font-bold text-[#F0FDFA]">
                  {editingTask ? t('Edit Task Reminder', 'টাস্ক এডিট করুন') : t('Add Cost Task', 'নতুন খরচের টাস্ক')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-teal-800 text-teal-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-teal-200 mb-1">
                  Task Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Electricity Bill, Rent"
                  className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Target Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Alarm Time
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🔵 Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    Remind Before
                  </label>
                  <select
                    value={reminderDaysBefore}
                    onChange={e => setReminderDaysBefore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                  >
                    <option value={0}>Same day</option>
                    <option value={1}>1 Day Before</option>
                    <option value={2}>2 Days Before</option>
                    <option value={3}>3 Days Before</option>
                    <option value={7}>1 Week Before</option>
                  </select>
                </div>
              </div>



              <div>
                <label className="block text-xs font-bold text-teal-200 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-teal-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-teal-950 text-teal-200 text-xs font-semibold border border-teal-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 text-teal-950 text-xs font-bold shadow-md"
                >
                  {editingTask ? 'Update Task' : 'Save Task'}
                </button>
              </div>

            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {taskToDelete && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
            onClick={() => setTaskToDelete(null)}
          >
            <div
              className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-teal-800 animate-modalSpring text-center space-y-3 my-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center justify-center mx-auto shadow-md">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#F0FDFA]">
                  Delete Task Reminder?
                </h3>
                <p className="text-xs text-amber-300 mt-1 font-semibold truncate">
                  "{taskToDelete.title}" · {taskToDelete.amount.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="py-2 bg-[#062423] text-teal-200 border border-teal-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTask(taskToDelete.id);
                    setTaskToDelete(null);
                    showToast('Task deleted', 'info');
                  }}
                  className="py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
};
