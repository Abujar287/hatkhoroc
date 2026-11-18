import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Plus,
  BellRing,
  Trash2,
  Edit3,
  Search,
  Check,
  X,
  RotateCcw,
  Zap
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
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<CostTask | null>(null);

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
    let pendingCount = 0;
    let dueTodayOrOverdueCount = 0;
    let dueTodayOrOverdueAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;
    let completedAmount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      const isDone = task.status === 'completed' || task.status === 'paid';
      if (!isDone) {
        pendingCount++;
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
      pendingCount,
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

      {/* Summary Statistics Card: Total Due, Due Today, Due Count in 1 Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0B3C39] p-2.5 sm:p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/80 uppercase tracking-tight truncate">
            Total Due
          </span>
          <span className="text-xs sm:text-sm font-black text-amber-300 tabular-nums truncate">
            {formatNumberLocale(stats.totalPendingAmount, lang)}
          </span>
        </div>
        <div className="bg-[#0B3C39] p-2.5 sm:p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/80 uppercase tracking-tight truncate">
            Due Today
          </span>
          <span className="text-xs sm:text-sm font-black text-[#FF7A59] tabular-nums truncate">
            {formatNumberLocale(stats.dueTodayOrOverdueAmount, lang)}
          </span>
        </div>
        <div className="bg-[#0B3C39] p-2.5 sm:p-3 rounded-2xl border border-teal-800/80 shadow-sm flex flex-col justify-center">
          <span className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/80 uppercase tracking-tight truncate">
            Due Count
          </span>
          <span className="text-xs sm:text-sm font-black text-emerald-400 tabular-nums truncate">
            {formatNumberLocale(stats.pendingCount, lang)}
          </span>
        </div>
      </div>

      {/* Single Row: Search Task | All Category | Add Task */}
      <div className="bg-[#0B3C39] p-2 rounded-xl border border-teal-800/80 flex items-center gap-1.5 sm:gap-2 shadow-xs">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search task..."
            className="w-full min-h-[36px] pl-8 pr-6 py-1 text-[11px] sm:text-xs bg-white text-slate-900 rounded-xl border border-teal-700/60 focus:outline-none placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="w-[100px] sm:w-[140px] min-h-[36px] px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs bg-white text-slate-900 rounded-xl border border-teal-700/60 font-semibold focus:outline-none shrink-0 cursor-pointer truncate"
        >
          <option value="all">All Category</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => openFormModal()}
          className="min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 font-black text-[11px] sm:text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Add Task</span>
        </button>
      </div>

      {/* MOBILE-FIT TASK TABLE (Task name | Category | Target Date time | Amount) */}
      {filteredTasks.length === 0 ? (
        <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 p-6 text-center flex flex-col items-center justify-center my-2">
          <Clock className="w-6 h-6 text-teal-400 mb-2" />
          <p className="text-xs font-bold text-teal-100">No task reminders found</p>
          <button
            type="button"
            onClick={() => openFormModal()}
            className="mt-3 px-3 py-1.5 bg-teal-500 text-teal-950 font-bold text-xs rounded-lg shadow-sm cursor-pointer"
          >
            + Add Task
          </button>
        </div>
      ) : (
        <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 overflow-hidden shadow-md">
          <table className="w-full table-fixed text-left border-collapse">
            <thead>
              <tr className="bg-[#062423] text-teal-300/90 border-b border-teal-800/80">
                <th scope="col" className="w-[32%] py-2 px-1.5 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider border-r border-teal-800/60">
                  Task name
                </th>
                <th scope="col" className="w-[22%] py-2 px-1.5 sm:px-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="w-[26%] py-2 px-1.5 sm:px-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  Target Date time
                </th>
                <th scope="col" className="w-[20%] py-2 px-1.5 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs text-[#F0FDFA]">
              {filteredTasks.map(task => {
                const isDone = task.status === 'completed' || task.status === 'paid';
                const isOverdue = !isDone && task.dueDate < todayStr;
                const isToday = !isDone && task.dueDate === todayStr;
                const isDueNow = (isToday || isOverdue) && !isDone;

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskForAction(task)}
                    className={`cursor-pointer transition-colors ${
                      isDone
                        ? 'bg-[#062423]/70 opacity-75 hover:bg-teal-950/60'
                        : isDueNow
                        ? 'bg-[#361A17] hover:bg-[#44211D]'
                        : 'hover:bg-teal-900/30'
                    }`}
                  >
                    {/* 1. Task name */}
                    <td className="py-2 px-1.5 sm:px-3 border-r border-teal-800/60">
                      <span className={`font-bold text-[10px] sm:text-xs leading-tight break-words block ${
                        isDone ? 'line-through text-slate-400' : 'text-[#F0FDFA]'
                      }`}>
                        {task.title}
                      </span>
                    </td>

                    {/* 2. Category */}
                    <td className="py-2 px-1.5 sm:px-2.5">
                      <span className={`text-[9.5px] sm:text-[11px] font-medium leading-tight break-words block ${
                        isDueNow ? 'text-orange-200' : 'text-teal-200'
                      }`}>
                        {task.category}
                      </span>
                    </td>

                    {/* 3. Target Date time */}
                    <td className="py-2 px-1.5 sm:px-2.5 tabular-nums">
                      <div className="leading-tight">
                        <span className={`block text-[9.5px] sm:text-[11px] font-semibold ${
                          isDueNow ? 'text-orange-100' : 'text-teal-100'
                        }`}>
                          {task.dueDate}
                        </span>
                        {task.dueTime && (
                          <span className="block text-[9px] sm:text-[10px] font-medium text-amber-300">
                            {formatTime12h(task.dueTime)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Amount */}
                    <td className="py-2 px-1.5 sm:px-3 text-right">
                      <span className={`text-[10px] sm:text-xs font-extrabold tabular-nums ${
                        isDone
                          ? 'text-slate-400'
                          : isDueNow
                          ? 'text-[#FF7A59]'
                          : 'text-amber-300'
                      }`}>
                        {task.amount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TASK CLICK ACTION POPUP (Edit / Delete / Pay Now) */}
      {selectedTaskForAction && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
            onClick={() => setSelectedTaskForAction(null)}
          >
            <div
              className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-xs sm:max-w-sm rounded-2xl shadow-2xl border border-teal-700/80 overflow-hidden animate-modalSpring"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BellRing className="w-4 h-4 text-teal-300 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-[#F0FDFA] truncate">
                    {selectedTaskForAction.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskForAction(null)}
                  className="w-7 h-7 rounded-full bg-[#0B3C39] text-teal-300 hover:text-white flex items-center justify-center cursor-pointer border border-teal-700/60 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="bg-[#062423] rounded-xl p-3 border border-teal-800/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-teal-300/80">Category</span>
                    <span className="font-bold text-teal-100">{selectedTaskForAction.category}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-teal-300/80">Target Date & Time</span>
                    <span className="font-semibold text-amber-300 tabular-nums">
                      {selectedTaskForAction.dueDate}
                      {selectedTaskForAction.dueTime ? ` (${formatTime12h(selectedTaskForAction.dueTime)})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-teal-300/80">Amount</span>
                    <span className="font-black text-sm text-[#FF7A59] tabular-nums">
                      {selectedTaskForAction.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-teal-300/80">Status</span>
                    <span className="font-bold text-emerald-300">
                      {selectedTaskForAction.status === 'completed' || selectedTaskForAction.status === 'paid'
                        ? 'Paid'
                        : getDaysDifferenceText(selectedTaskForAction.dueDate)}
                    </span>
                  </div>
                  {selectedTaskForAction.notes && (
                    <div className="pt-1.5 border-t border-teal-800/60 text-teal-200/90 text-[11px]">
                      {selectedTaskForAction.notes}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {selectedTaskForAction.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tObj = selectedTaskForAction;
                        setSelectedTaskForAction(null);
                        onConvertTaskToExpense(tObj);
                      }}
                      className="py-2 px-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Pay Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const tObj = selectedTaskForAction;
                        setSelectedTaskForAction(null);
                        onUpdateTask({ ...tObj, status: 'pending' });
                      }}
                      className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Unpaid</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const tObj = selectedTaskForAction;
                      setSelectedTaskForAction(null);
                      openFormModal(tObj);
                    }}
                    className="py-2 px-2 rounded-xl bg-[#062423] hover:bg-teal-900 text-teal-100 border border-teal-700/80 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const tObj = selectedTaskForAction;
                      setSelectedTaskForAction(null);
                      setTaskToDelete(tObj);
                    }}
                    className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
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
