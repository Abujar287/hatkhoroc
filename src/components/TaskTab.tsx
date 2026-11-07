import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Bell,
  BellRing,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Tag,
  Trash2,
  Edit3,
  Search,
  Filter,
  DollarSign,
  ArrowRight,
  Sparkles,
  CalendarDays,
  AlertTriangle,
  Layers,
  Check,
  X
} from 'lucide-react';
import { CostTask, Transaction, TransactionType } from '../types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../constants';

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
}

export const TaskTab: React.FC<TaskTabProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onConvertTaskToExpense,
  t,
  showToast,
  currentUser,
  categories = DEFAULT_EXPENSE_CATEGORIES
}) => {
  const [filterStatus, setFilterStatus] = useState<'pending' | 'due' | 'upcoming' | 'completed' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [editingTask, setEditingTask] = useState<CostTask | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dueTime, setDueTime] = useState('09:00');
  const [category, setCategory] = useState(categories[0] || 'Uncategorized');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(1);
  const [autoNotify, setAutoNotify] = useState(true);
  const [notes, setNotes] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Request Notification permission
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast(t('Notifications enabled for task reminders!', 'টাস্ক রিমাইন্ডারের জন্য নোটিফিকেশন চালু হয়েছে!'), 'success');
      } else {
        showToast(t('Notification permission denied', 'নোটিফিকেশন অনুমতি পাওয়া যায়নি'), 'error');
      }
    }
  };

  // Reset or set modal form when editing
  const openFormModal = (taskToEdit?: CostTask) => {
    if (taskToEdit) {
      setEditingTask(taskToEdit);
      setTitle(taskToEdit.title);
      setAmount(taskToEdit.amount.toString());
      setDueDate(taskToEdit.dueDate);
      setDueTime(taskToEdit.dueTime || '09:00');
      setCategory(taskToEdit.category);
      setPriority(taskToEdit.priority);
      setReminderDaysBefore(taskToEdit.reminderDaysBefore);
      setAutoNotify(taskToEdit.autoNotify);
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
        autoNotify,
        notes: notes.trim(),
        status: 'pending',
        createdBy: currentUser?.username || 'user'
      });
      showToast(t('New task reminder added!', 'নতুন টাস্ক রিমাইন্ডার সেভ হয়েছে!'), 'success');
    }

    setShowAddModal(false);
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        task.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || task.category === selectedCategory;

      // Status filter
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
      // Pending tasks first, sorted by due date
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [tasks, searchQuery, selectedCategory, filterStatus, todayStr]);

  // Statistics calculation
  const stats = useMemo(() => {
    let dueTodayOrOverdueCount = 0;
    let dueTodayOrOverdueAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;
    let completedAmount = 0;

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
        completedAmount += task.amount;
      }
    });

    return {
      dueTodayOrOverdueCount,
      dueTodayOrOverdueAmount,
      upcomingCount,
      upcomingAmount,
      completedAmount,
      totalPendingAmount: dueTodayOrOverdueAmount + upcomingAmount
    };
  }, [tasks, todayStr]);

  return (
    <div className="w-full h-full flex flex-col bg-[#042F2E] overflow-y-auto pb-24 p-3 md:p-6 space-y-4">
      
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-teal-900/90 via-[#0B3C39] to-teal-950 p-4 md:p-5 rounded-2xl border border-teal-700/60 shadow-lg text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <BellRing className="w-6 h-6 text-teal-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#F0FDFA] flex items-center gap-2">
                হাত খরচ Task & Reminders
              </h1>
              <p className="text-xs text-teal-200 mt-0.5">
                {t('Schedule upcoming costs and receive automatic date reminders', 'ভবিষ্যতের খরচের তারিখ ও বাজেট সেট করুন এবং রিমাইন্ডার পান')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              type="button"
              onClick={() => setShowScriptModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-800/80 hover:bg-teal-700 text-teal-100 border border-teal-600/60 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <CodeIcon className="w-3.5 h-3.5 text-teal-300" />
              <span>{t('Apps Script Code', 'অ্যাপস স্ক্রিপ্ট কোড')}</span>
            </button>

            {notificationPermission !== 'granted' && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{t('Enable Notifications', 'নোটিফিকেশন चालू করুন')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openFormModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('Add New Task', 'নতুন টাস্ক যোগ করুন')}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-teal-800/80">
          {/* Overdue / Due Today Card */}
          <div className={`p-3 rounded-xl border ${stats.dueTodayOrOverdueCount > 0 ? 'bg-red-950/40 border-red-500/50 text-red-200' : 'bg-teal-950/50 border-teal-800/70 text-teal-100'}`}>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1">
                <AlertTriangle className={`w-3.5 h-3.5 ${stats.dueTodayOrOverdueCount > 0 ? 'text-red-400' : 'text-teal-400'}`} />
                {t('Due / Overdue', 'আজকের বা পার হওয়া')}
              </span>
              {stats.dueTodayOrOverdueCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white font-bold rounded-full animate-bounce">
                  {stats.dueTodayOrOverdueCount}
                </span>
              )}
            </div>
            <div className="text-lg md:text-xl font-bold mt-1">
              ৳{stats.dueTodayOrOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>

          {/* Upcoming Costs Card */}
          <div className="p-3 rounded-xl bg-teal-950/50 border border-teal-800/70 text-teal-100">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1 text-teal-300">
                <CalendarDays className="w-3.5 h-3.5 text-teal-400" />
                {t('Upcoming Costs', 'সামনের খরচ')}
              </span>
              <span className="text-[10px] text-teal-300 font-bold">{stats.upcomingCount} {t('tasks', 'টি')}</span>
            </div>
            <div className="text-lg md:text-xl font-bold mt-1 text-teal-200">
              ৳{stats.upcomingAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>

          {/* Total Pending Card */}
          <div className="p-3 rounded-xl bg-teal-950/50 border border-teal-800/70 text-teal-100">
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              {t('Total Planned Cost', 'মোট টাস্ক বাজেট')}
            </div>
            <div className="text-lg md:text-xl font-bold mt-1 text-amber-300">
              ৳{stats.totalPendingAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>

          {/* Paid / Completed Card */}
          <div className="p-3 rounded-xl bg-teal-950/50 border border-teal-800/70 text-teal-100">
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              {t('Completed & Paid', 'পরিশোধিত খরচ')}
            </div>
            <div className="text-lg md:text-xl font-bold mt-1 text-teal-300">
              ৳{stats.completedAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="bg-[#0B3C39] p-3 rounded-xl border border-teal-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-teal-950/70 p-1 rounded-xl border border-teal-800/60 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filterStatus === 'pending'
                ? 'bg-teal-500 text-teal-950 shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            <span>{t('Pending Tasks', 'বকেয়া টাস্ক')}</span>
            <span className="px-1.5 py-0.2 bg-teal-950 text-teal-200 text-[10px] rounded-full font-extrabold">
              {stats.dueTodayOrOverdueCount + stats.upcomingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('due')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filterStatus === 'due'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-red-300 hover:text-red-200'
            }`}
          >
            <span>{t('Due Today', 'আজকের টাস্ক')}</span>
            {stats.dueTodayOrOverdueCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-950 text-red-200 text-[10px] rounded-full font-extrabold">
                {stats.dueTodayOrOverdueCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'upcoming'
                ? 'bg-teal-500 text-teal-950 shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            {t('Upcoming', 'সামনের')} ({stats.upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'completed'
                ? 'bg-teal-500 text-teal-950 shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            {t('Paid / Done', 'পরিশোধিত')}
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-teal-500 text-teal-950 shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            {t('All', 'সকল')} ({tasks.length})
          </button>
        </div>

        {/* Search & Category Select */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 md:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Search task...', 'টাস্ক খুঁজুন...')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-400"
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

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="all">{t('All Categories', 'সকল ক্যাটাগরি')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Task List Grid / Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 p-8 text-center flex flex-col items-center justify-center my-4">
          <div className="w-14 h-14 rounded-full bg-teal-950 border border-teal-800 flex items-center justify-center mb-3 text-teal-400">
            <CalendarDays className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#F0FDFA]">
            {t('No task reminders found', 'কোনো টাস্ক রিমাইন্ডার পাওয়া যায়নি')}
          </h3>
          <p className="text-xs text-teal-200/80 max-w-sm mt-1 mb-4">
            {searchQuery || selectedCategory !== 'all' || filterStatus !== 'all'
              ? t('Try clearing your search or filter settings.', 'ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।')
              : t('Set up upcoming bill payments, monthly rent, or shopping costing dates to get auto reminders!', 'আপনার ভবিষ্যতের বিদ্যুৎ বিল, বাসা ভাড়া বা কেনাকাটার তারিখ সেট করুন।')}
          </p>
          <button
            type="button"
            onClick={() => openFormModal()}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            + {t('Add First Task Reminder', 'প্রথম টাস্ক যোগ করুন')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTasks.map(task => {
            const isDone = task.status === 'completed' || task.status === 'paid';
            const isOverdue = !isDone && task.dueDate < todayStr;
            const isToday = !isDone && task.dueDate === todayStr;

            return (
              <div
                key={task.id}
                className={`group relative rounded-2xl p-4 transition-all duration-200 border shadow-md flex flex-col justify-between ${
                  isDone
                    ? 'bg-slate-900/60 border-slate-800 opacity-75'
                    : isOverdue
                    ? 'bg-gradient-to-b from-red-950/60 to-red-900/40 border-red-500/70 ring-1 ring-red-500/30'
                    : isToday
                    ? 'bg-gradient-to-b from-amber-950/60 to-amber-900/40 border-amber-500/80 ring-1 ring-amber-500/40'
                    : 'bg-[#0B3C39] hover:bg-[#0E4744] border-teal-800/80'
                }`}
              >
                {/* Header Row */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {/* Status Badge */}
                        {isDone ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {t('Paid & Saved', 'পরিশোধিত')}
                          </span>
                        ) : isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            {t('Overdue', 'বকেয়া অতিক্রান্ত')}
                          </span>
                        ) : isToday ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-amber-950 flex items-center gap-1 font-extrabold">
                            <Clock className="w-3 h-3" />
                            {t('Due Today', 'আজকের টাস্ক')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-900/80 text-teal-200 border border-teal-700/60">
                            {t('Upcoming', 'আসন্ন')}
                          </span>
                        )}

                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          task.priority === 'high'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                            : task.priority === 'medium'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                            : 'bg-teal-950 text-teal-300 border border-teal-700/60'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>

                        {/* Category */}
                        <span className="text-[10px] text-teal-200/80 bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-800/60">
                          {task.category}
                        </span>
                      </div>

                      <h3 className={`text-base font-bold truncate ${isDone ? 'line-through text-slate-400' : 'text-[#F0FDFA]'}`}>
                        {task.title}
                      </h3>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <span className="text-xs text-teal-300 block font-semibold">{t('Est. Cost', 'খরচ')}</span>
                      <span className={`text-lg font-bold ${isDone ? 'text-slate-400' : 'text-amber-300'}`}>
                        ৳{task.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Notes if available */}
                  {task.notes && (
                    <p className="text-xs text-teal-200/90 bg-teal-950/40 p-2 rounded-lg border border-teal-800/40 my-2 italic line-clamp-2">
                      "{task.notes}"
                    </p>
                  )}

                  {/* Date & Time info */}
                  <div className="flex items-center gap-3 text-xs text-teal-200/80 mt-2">
                    <div className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-teal-400" />
                      <span>{task.dueDate}</span>
                    </div>
                    {task.dueTime && (
                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span>{task.dueTime}</span>
                      </div>
                    )}
                    {task.reminderDaysBefore > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-teal-300/80">
                        <Bell className="w-3 h-3 text-amber-400" />
                        <span>{task.reminderDaysBefore}d before</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="mt-4 pt-3 border-t border-teal-800/60 flex items-center justify-between gap-2">
                  {!isDone ? (
                    <button
                      type="button"
                      onClick={() => onConvertTaskToExpense(task)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>{t('Pay Now & Add Expense', 'পে করুন ও খরচে যোগ করুন')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUpdateTask({ ...task, status: 'pending' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{t('Mark Unpaid', 'পেন্ডিং করুন')}</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openFormModal(task)}
                      className="p-2 rounded-lg bg-teal-900/60 hover:bg-teal-800 text-teal-200 hover:text-white border border-teal-700/60 transition-all cursor-pointer"
                      title={t('Edit Task', 'এডিট')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('Are you sure you want to delete this task reminder?', 'আপনি কি এই টাস্ক রিমাইন্ডারটি মুছতে চান?'))) {
                          onDeleteTask(task.id);
                          showToast(t('Task deleted', 'টাস্ক মোছা হয়েছে'), 'info');
                        }
                      }}
                      className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-red-100 border border-red-800/60 transition-all cursor-pointer"
                      title={t('Delete Task', 'মুছুন')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-modalSpring">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-teal-900/90 border-b border-teal-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CalendarClockIcon className="w-5 h-5 text-teal-300" />
                <h2 className="text-base font-bold text-[#F0FDFA]">
                  {editingTask ? t('Edit Task Reminder', 'টাস্ক রিমাইন্ডার এডিট করুন') : t('Add Upcoming Cost Task', 'ভবিষ্যতের খরচের টাস্ক যোগ করুন')}
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
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-bold text-teal-200 mb-1">
                  {t('Task Name / Purpose', 'টাস্কের নাম / খরচের বিবরণ')} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Electricity Bill, House Rent, Laptop EMI"
                  className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-400 font-medium"
                />
              </div>

              {/* Amount & Category Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Expected Cost (৳)', 'আনমানিক খরচ (৳)')} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Category', 'ক্যাটাগরি')}
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date & Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Costing Target Date', 'খরচের মূল তারিখ')} *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Reminder Time', 'রিমাইন্ডার সময়')}
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                  />
                </div>
              </div>

              {/* Priority & Reminder Notification setting */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Priority Level', 'গুরুত্ব (Priority)')}
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                  >
                    <option value="high">🔴 High (জরুরী)</option>
                    <option value="medium">🟡 Medium (সাধারণ)</option>
                    <option value="low">🔵 Low (কম)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-200 mb-1">
                    {t('Remind Me Before', 'কয়দিন আগে জানাবে')}
                  </label>
                  <select
                    value={reminderDaysBefore}
                    onChange={e => setReminderDaysBefore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                  >
                    <option value={0}>On the same day (একই দিনে)</option>
                    <option value={1}>1 Day Before (১ দিন আগে)</option>
                    <option value={2}>2 Days Before (২ দিন আগে)</option>
                    <option value={3}>3 Days Before (৩ দিন আগে)</option>
                    <option value={7}>1 Week Before (১ সপ্তাহ আগে)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-teal-200 mb-1">
                  {t('Notes / Details', 'অতিরিক্ত নোট (ঐচ্ছিক)')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Account number, bkash details, special instructions..."
                  className="w-full px-3 py-2 text-xs bg-white text-slate-900 rounded-xl border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-teal-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-teal-950 hover:bg-teal-900 text-teal-200 text-xs font-semibold border border-teal-800 transition-all"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  {editingTask ? t('Update Task', 'আপডেট করুন') : t('Save Task Reminder', 'সেভ করুন')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* GOOGLE APPS SCRIPT CODE MODAL */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0B3C39] border border-teal-700/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-modalSpring text-white">
            <div className="px-5 py-4 bg-teal-900/90 border-b border-teal-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CodeIcon className="w-5 h-5 text-teal-300" />
                <h2 className="text-sm font-bold text-[#F0FDFA]">
                  Google Apps Script Code (Google Sheet Sync)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1 rounded-lg hover:bg-teal-800 text-teal-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              <p className="text-xs text-teal-200 leading-relaxed">
                আপনার Google Sheet এ Extensions &gt; Apps Script এ নিচের কোডটি পেস্ট করে Deploy (Web App) করুন। এটি আপনার মূল <b>Transactions</b> এবং <b>Tasks</b> দুটোই সিঙ্ক করবে।
              </p>

              <div className="relative bg-slate-950 p-3 rounded-xl border border-teal-800 font-mono text-[11px] text-teal-300 overflow-x-auto max-h-64">
                <pre>{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetTab = data.sheetTab || "abujar287";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Task Actions
    if (action === "insertTask" || action === "addTask") {
      var taskSheet = getOrCreateSheet(ss, sheetTab + "_Tasks", ["ID", "Title", "Amount", "DueDate", "DueTime", "Category", "Priority", "Status", "ReminderDays", "Notes", "CreatedAt"]);
      taskSheet.appendRow([data.id || new Date().getTime().toString(), data.title || "", data.amount || 0, data.dueDate || "", data.dueTime || "", data.category || "", data.priority || "medium", "pending", data.reminderDaysBefore || 1, data.notes || "", new Date().toISOString()]);
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "updateTask") {
      var taskSheet = ss.getSheetByName(sheetTab + "_Tasks");
      if (taskSheet) {
        var rows = taskSheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(data.id)) {
            if (data.title) taskSheet.getRange(i + 1, 2).setValue(data.title);
            if (data.amount) taskSheet.getRange(i + 1, 3).setValue(data.amount);
            if (data.dueDate) taskSheet.getRange(i + 1, 4).setValue(data.dueDate);
            if (data.dueTime) taskSheet.getRange(i + 1, 5).setValue(data.dueTime);
            if (data.category) taskSheet.getRange(i + 1, 6).setValue(data.category);
            if (data.priority) taskSheet.getRange(i + 1, 7).setValue(data.priority);
            if (data.status) taskSheet.getRange(i + 1, 8).setValue(data.status === "paid" ? "complete" : data.status);
            if (data.notes !== undefined) taskSheet.getRange(i + 1, 10).setValue(data.notes);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteTask") {
      var taskSheet = ss.getSheetByName(sheetTab + "_Tasks");
      if (taskSheet) {
        var rows = taskSheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(data.id)) {
            taskSheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Transaction Actions
    var txSheet = getOrCreateSheet(ss, sheetTab, ["ID", "Datetime", "Type", "Category", "Date", "Value", "Note"]);
    if (action === "insert") {
      txSheet.appendRow([data.id || new Date().getTime().toString(), data.datetime || "", data.type || "Expense", data.category || "", data.date || "", data.value || 0, data.note || ""]);
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "update") {
      var rows = txSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          txSheet.getRange(i + 1, 2).setValue(data.datetime);
          txSheet.getRange(i + 1, 3).setValue(data.type);
          txSheet.getRange(i + 1, 4).setValue(data.category);
          txSheet.getRange(i + 1, 5).setValue(data.date);
          txSheet.getRange(i + 1, 6).setValue(data.value);
          txSheet.getRange(i + 1, 7).setValue(data.note);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "delete") {
      var rows = txSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          txSheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheetTab = (e.parameter && e.parameter.sheetTab) || "abujar287";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var txSheet = getOrCreateSheet(ss, sheetTab, ["ID", "Datetime", "Type", "Category", "Date", "Value", "Note"]);
    var txRows = txSheet.getDataRange().getValues();
    var transactions = [];
    for (var i = 1; i < txRows.length; i++) {
      if (txRows[i][0]) {
        transactions.push({ id: txRows[i][0], datetime: txRows[i][1], type: txRows[i][2], category: txRows[i][3], date: txRows[i][4], value: txRows[i][5], note: txRows[i][6], rowNumber: i + 1 });
      }
    }
    var taskSheet = getOrCreateSheet(ss, sheetTab + "_Tasks", ["ID", "Title", "Amount", "DueDate", "DueTime", "Category", "Priority", "Status", "ReminderDays", "Notes", "CreatedAt"]);
    var taskRows = taskSheet.getDataRange().getValues();
    var tasks = [];
    for (var j = 1; j < taskRows.length; j++) {
      if (taskRows[j][0]) {
        tasks.push({ id: taskRows[j][0], title: taskRows[j][1], amount: taskRows[j][2], dueDate: taskRows[j][3], dueTime: taskRows[j][4], category: taskRows[j][5], priority: taskRows[j][6], status: taskRows[j][7], reminderDaysBefore: taskRows[j][8], notes: taskRows[j][9], createdAt: taskRows[j][10] });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ result: "success", sheetTab: sheetTab, transactions: transactions, tasks: tasks })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) sheet.appendRow(headers);
  }
  return sheet;
}`}</pre>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const scriptText = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    var action = data.action;\n    var sheetTab = data.sheetTab || "abujar287";\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n\n    if (action === "insertTask" || action === "addTask") {\n      var taskSheet = getOrCreateSheet(ss, sheetTab + "_Tasks", ["ID", "Title", "Amount", "DueDate", "DueTime", "Category", "Priority", "Status", "ReminderDays", "Notes", "CreatedAt"]);\n      taskSheet.appendRow([data.id || new Date().getTime().toString(), data.title || "", data.amount || 0, data.dueDate || "", data.dueTime || "", data.category || "", data.priority || "medium", "pending", data.reminderDaysBefore || 1, data.notes || "", new Date().toISOString()]);\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n    if (action === "updateTask") {\n      var taskSheet = ss.getSheetByName(sheetTab + "_Tasks");\n      if (taskSheet) {\n        var rows = taskSheet.getDataRange().getValues();\n        for (var i = 1; i < rows.length; i++) {\n          if (String(rows[i][0]) === String(data.id)) {\n            if (data.title) taskSheet.getRange(i + 1, 2).setValue(data.title);\n            if (data.amount) taskSheet.getRange(i + 1, 3).setValue(data.amount);\n            if (data.dueDate) taskSheet.getRange(i + 1, 4).setValue(data.dueDate);\n            if (data.dueTime) taskSheet.getRange(i + 1, 5).setValue(data.dueTime);\n            if (data.category) taskSheet.getRange(i + 1, 6).setValue(data.category);\n            if (data.priority) taskSheet.getRange(i + 1, 7).setValue(data.priority);\n            if (data.status) taskSheet.getRange(i + 1, 8).setValue(data.status === "paid" ? "complete" : data.status);\n            if (data.notes !== undefined) taskSheet.getRange(i + 1, 10).setValue(data.notes);\n            break;\n          }\n        }\n      }\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n    if (action === "deleteTask") {\n      var taskSheet = ss.getSheetByName(sheetTab + "_Tasks");\n      if (taskSheet) {\n        var rows = taskSheet.getDataRange().getValues();\n        for (var i = 1; i < rows.length; i++) {\n          if (String(rows[i][0]) === String(data.id)) {\n            taskSheet.deleteRow(i + 1);\n            break;\n          }\n        }\n      }\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n\n    var txSheet = getOrCreateSheet(ss, sheetTab, ["ID", "Datetime", "Type", "Category", "Date", "Value", "Note"]);\n    if (action === "insert") {\n      txSheet.appendRow([data.id || new Date().getTime().toString(), data.datetime || "", data.type || "Expense", data.category || "", data.date || "", data.value || 0, data.note || ""]);\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n    if (action === "update") {\n      var rows = txSheet.getDataRange().getValues();\n      for (var i = 1; i < rows.length; i++) {\n        if (String(rows[i][0]) === String(data.id)) {\n          txSheet.getRange(i + 1, 2).setValue(data.datetime);\n          txSheet.getRange(i + 1, 3).setValue(data.type);\n          txSheet.getRange(i + 1, 4).setValue(data.category);\n          txSheet.getRange(i + 1, 5).setValue(data.date);\n          txSheet.getRange(i + 1, 6).setValue(data.value);\n          txSheet.getRange(i + 1, 7).setValue(data.note);\n          break;\n        }\n      }\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n    if (action === "delete") {\n      var rows = txSheet.getDataRange().getValues();\n      for (var i = 1; i < rows.length; i++) {\n        if (String(rows[i][0]) === String(data.id)) {\n          txSheet.deleteRow(i + 1);\n          break;\n        }\n      }\n      return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n    }\n    return ContentService.createTextOutput(JSON.stringify({ result: "success" })).setMimeType(ContentService.MimeType.JSON);\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\nfunction doGet(e) {\n  try {\n    var sheetTab = (e.parameter && e.parameter.sheetTab) || "abujar287";\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n    var txSheet = getOrCreateSheet(ss, sheetTab, ["ID", "Datetime", "Type", "Category", "Date", "Value", "Note"]);\n    var txRows = txSheet.getDataRange().getValues();\n    var transactions = [];\n    for (var i = 1; i < txRows.length; i++) {\n      if (txRows[i][0]) {\n        transactions.push({ id: txRows[i][0], datetime: txRows[i][1], type: txRows[i][2], category: txRows[i][3], date: txRows[i][4], value: txRows[i][5], note: txRows[i][6], rowNumber: i + 1 });\n      }\n    }\n    var taskSheet = getOrCreateSheet(ss, sheetTab + "_Tasks", ["ID", "Title", "Amount", "DueDate", "DueTime", "Category", "Priority", "Status", "ReminderDays", "Notes", "CreatedAt"]);\n    var taskRows = taskSheet.getDataRange().getValues();\n    var tasks = [];\n    for (var j = 1; j < taskRows.length; j++) {\n      if (taskRows[j][0]) {\n        tasks.push({ id: taskRows[j][0], title: taskRows[j][1], amount: taskRows[j][2], dueDate: taskRows[j][3], dueTime: taskRows[j][4], category: taskRows[j][5], priority: taskRows[j][6], status: taskRows[j][7], reminderDaysBefore: taskRows[j][8], notes: taskRows[j][9], createdAt: taskRows[j][10] });\n      }\n    }\n    return ContentService.createTextOutput(JSON.stringify({ result: "success", sheetTab: sheetTab, transactions: transactions, tasks: tasks })).setMimeType(ContentService.MimeType.JSON);\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\nfunction getOrCreateSheet(ss, sheetName, headers) {\n  var sheet = ss.getSheetByName(sheetName);\n  if (!sheet) {\n    sheet = ss.insertSheet(sheetName);\n    if (headers && headers.length > 0) sheet.appendRow(headers);\n  }\n  return sheet;\n}`;
                    navigator.clipboard.writeText(scriptText);
                    setCopiedScript(true);
                    showToast(t('Script code copied to clipboard!', 'কোড কপি হয়েছে!'), 'success');
                    setTimeout(() => setCopiedScript(false), 3000);
                  }}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-md"
                >
                  {copiedScript ? t('Copied!', 'কপি হয়েছে!') : t('Copy Script Code', 'কোড কপি করুন')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function CalendarClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <circle cx="16" cy="16" r="6" />
      <path d="M16 14v2l1 1" />
    </svg>
  );
}

function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
