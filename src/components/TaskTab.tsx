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
  Trash2,
  Edit3,
  Search,
  Check,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { CostTask } from '../types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../constants';
import { ModalPortal } from './Modals';
import {
  playTaskAlarmSound,
  stopTaskAlarmSound,
  sendSystemNotification,
  vibrateDevice,
  initAudioUnlock
} from '../utils/taskAlarmManager';
import { normalizeTime, formatTime12h } from '../utils/dateUtils';

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
  activeRingingTask?: CostTask | null;
  onStopRingingAlarm?: () => void;
  onTestTaskAlarm?: (task?: CostTask) => void;
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
  categories = DEFAULT_EXPENSE_CATEGORIES,
  activeRingingTask,
  onStopRingingAlarm
}) => {
  const [filterStatus, setFilterStatus] = useState<'pending' | 'due' | 'upcoming' | 'completed' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CostTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<CostTask | null>(null);
  const [isTestingSound, setIsTestingSound] = useState(false);

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

  // Request Notification permission & auto-set alarm
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  useEffect(() => {
    initAudioUnlock();
  }, []);

  const requestNotificationPermission = async () => {
    initAudioUnlock();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          showToast(t('Notification & Alarm Sound Auto-Enabled!', 'নোটিফিকেশন ও অ্যালার্ম সাউন্ড অটো-সেট হয়েছে!'), 'success');
          
          tasks.forEach(taskObj => {
            if (!taskObj.autoNotify) {
              onUpdateTask({ ...taskObj, autoNotify: true });
            }
          });

          sendSystemNotification('হাত খরচ Task Reminder', {
            body: t('Notifications & sound alarms are active!', 'নোটিফিকেশন এবং সাউন্ড অ্যালার্ম সক্রিয় হয়েছে!')
          });
        } else {
          showToast(t('Notification permission denied', 'নোটিফিকেশন অনুমতি পাওয়া যায়নি'), 'error');
        }
      } catch (e) {
        console.warn('Error requesting notification permission:', e);
      }
    }
  };

  const handleTestAlarmSound = (taskObj?: CostTask) => {
    initAudioUnlock();
    if (isTestingSound) {
      stopTaskAlarmSound();
      setIsTestingSound(false);
      showToast(t('Alarm test stopped', 'অ্যালার্ম পরীক্ষা বন্ধ করা হয়েছে'), 'info');
      return;
    }

    setIsTestingSound(true);
    playTaskAlarmSound();
    vibrateDevice([200, 100, 200, 100, 300]);

    sendSystemNotification('🔔 Alarm Sound Test', {
      body: taskObj ? `Task: ${taskObj.title} (৳${taskObj.amount})` : 'Testing task reminder alarm sound & alert notification.'
    });

    showToast(t('Playing alarm sound... Tap button to stop', 'অ্যালার্ম সাউন্ড বাজছে... বন্ধ করতে আবার চাপুন'), 'success');

    setTimeout(() => {
      stopTaskAlarmSound();
      setIsTestingSound(false);
    }, 8000);
  };

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

  // Filter tasks
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
      
      {/* RINGING ALARM BANNER */}
      {activeRingingTask && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-3 rounded-xl border-2 border-amber-300 shadow-xl text-white flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-bounce">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-amber-200 animate-spin shrink-0" />
            <div className="text-xs">
              <span className="font-extrabold uppercase bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                {t('Alarm Ringing!', 'অ্যালার্ম বাজছে!')}
              </span>
              <span className="font-bold">{activeRingingTask.title}</span> — <span className="font-extrabold">{activeRingingTask.amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onStopRingingAlarm && (
              <button
                type="button"
                onClick={onStopRingingAlarm}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('Stop', 'থামান')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onStopRingingAlarm) onStopRingingAlarm();
                onConvertTaskToExpense(activeRingingTask);
              }}
              className="px-3 py-1 rounded-lg bg-amber-300 hover:bg-amber-200 text-amber-950 font-black text-xs flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{t('Pay Now', 'পরিশোধ করুন')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Header Bar */}
      <div className="bg-[#0B3C39] p-3 rounded-xl border border-teal-800/80 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Title & Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#F0FDFA] flex items-center gap-2 leading-tight">
              {t('Cost Tasks & Reminders', 'টাস্ক ও খরচ রিমাইন্ডার')}
            </h1>
            <div className="flex items-center gap-2 text-xs text-teal-200 mt-0.5">
              <span>Planned: <strong className="text-amber-300">{stats.totalPendingAmount.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Due Today: <strong className={stats.dueTodayOrOverdueCount > 0 ? 'text-red-400' : 'text-teal-300'}>{stats.dueTodayOrOverdueCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
          <button
            type="button"
            onClick={() => handleTestAlarmSound()}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
              isTestingSound
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-teal-950 hover:bg-teal-900 text-amber-300 border-teal-700/80'
            }`}
          >
            {isTestingSound ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isTestingSound ? 'Stop Sound' : 'Test Sound 🔔'}</span>
          </button>

          {notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notification</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openFormModal()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{t('Add Task', 'নতুন টাস্ক')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0B3C39] p-2 rounded-xl border border-teal-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-sm">
        
        {/* Status Filter Chips */}
        <div className="flex items-center bg-teal-950/80 p-1 rounded-lg border border-teal-800/60 overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-teal-500 text-teal-950'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'pending'
                ? 'bg-teal-500 text-teal-950'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            Pending ({stats.dueTodayOrOverdueCount + stats.upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('due')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'due'
                ? 'bg-red-500 text-white'
                : 'text-red-300 hover:text-red-200'
            }`}
          >
            Due Today ({stats.dueTodayOrOverdueCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('upcoming')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'upcoming'
                ? 'bg-teal-500 text-teal-950'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            Upcoming ({stats.upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'completed'
                ? 'bg-teal-500 text-teal-950'
                : 'text-teal-200 hover:text-white'
            }`}
          >
            Paid ({stats.completedCount})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 sm:w-40">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-2 py-1 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 focus:outline-none placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2 py-1 text-xs bg-white text-slate-900 rounded-lg border border-teal-700/60 font-medium focus:outline-none"
          >
            <option value="all">All Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

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
            <div className="col-span-2">Date & Time</div>
            <div className="col-span-2">In How Many Days</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-1 text-center">Alarm</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* List Rows */}
          {filteredTasks.map(task => {
            const isDone = task.status === 'completed' || task.status === 'paid';
            const isOverdue = !isDone && task.dueDate < todayStr;
            const isToday = !isDone && task.dueDate === todayStr;
            const daysText = getDaysDifferenceText(task.dueDate);

            return (
              <div
                key={task.id}
                className={`p-3 transition-all hover:bg-teal-900/40 shadow-xs ${
                  isDone
                    ? 'bg-[#062423]/60 border-l-4 border-l-slate-600 opacity-85'
                    : isOverdue
                    ? 'bg-red-950/30 border-l-4 border-l-red-500'
                    : isToday
                    ? 'bg-amber-950/30 border-l-4 border-l-amber-400'
                    : 'bg-[#0B3C39] border-l-4 border-l-teal-500'
                }`}
              >
                {/* DESKTOP ROW (md:grid) */}
                <div className="hidden md:grid grid-cols-12 items-center gap-2">
                  {/* 1. Name + Priority + Category */}
                  <div className="col-span-3 min-w-0 flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        task.priority === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : task.priority === 'medium'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}>
                        {task.priority ? task.priority.substring(0, 3).toUpperCase() : 'MED'}
                      </span>
                      <span className="text-[10px] text-teal-200 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800 truncate">
                        {task.category}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm font-bold truncate block ${isDone ? 'line-through text-slate-400' : 'text-[#F0FDFA]'}`}>
                        {task.title}
                      </span>
                    </div>
                  </div>

                  {/* 2. Date & Time */}
                  <div className="col-span-2 text-xs text-teal-200 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-teal-400 shrink-0" />
                    <span className="font-semibold">{task.dueDate}</span>
                    {task.dueTime && (
                      <span className="text-[11px] text-amber-300 font-medium">({formatTime12h(task.dueTime)})</span>
                    )}
                  </div>

                  {/* 3. Days Countdown */}
                  <div className="col-span-2">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-700">
                        <Check className="w-3 h-3 stroke-[3]" /> Paid
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> {daysText}
                      </span>
                    ) : isToday ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3 stroke-[2.5]" /> Due Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-200 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800">
                        {daysText}
                      </span>
                    )}
                  </div>

                  {/* 4. Amount */}
                  <div className="col-span-2 text-left">
                    <span className={`text-base font-extrabold ${isDone ? 'text-slate-400' : 'text-amber-300'}`}>
                      {task.amount.toLocaleString()}
                    </span>
                  </div>

                  {/* 5. Alarm */}
                  <div className="col-span-1 text-center flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleTestAlarmSound(task)}
                      className={`p-1 rounded-md transition-all cursor-pointer ${
                        task.autoNotify && !isDone
                          ? 'text-amber-300 hover:bg-amber-950/60'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Test Alarm Sound"
                    >
                      {task.autoNotify && !isDone ? <Bell className="w-3.5 h-3.5 fill-amber-400/20" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 6. Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 shrink-0">
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => onConvertTaskToExpense(task)}
                        className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-teal-950 text-xs font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
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
                      className="p-1.5 rounded-lg bg-teal-950 hover:bg-teal-900 text-teal-200 border border-teal-800 transition-all cursor-pointer"
                      title="Edit Task"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 transition-all cursor-pointer"
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
                        task.priority === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : task.priority === 'medium'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}>
                        {task.priority ? task.priority.substring(0, 3).toUpperCase() : 'MED'}
                      </span>
                      <h3 className={`text-sm font-bold truncate ${isDone ? 'line-through text-slate-400' : 'text-[#F0FDFA]'}`}>
                        {task.title}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-700">
                          <Check className="w-3 h-3 stroke-[3]" /> Paid
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> {daysText}
                        </span>
                      ) : isToday ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 stroke-[2.5]" /> Due Today
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-200 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800">
                          {daysText}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Middle Row: Category + Date & Time + Amount */}
                  <div className="flex items-center justify-between gap-2 text-xs text-teal-200/90 pt-1 border-t border-teal-800/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-teal-300 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800">
                        {task.category}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-medium">
                        <Calendar className="w-3 h-3 text-teal-400 shrink-0" />
                        <span>{task.dueDate}</span>
                        {task.dueTime && (
                          <span className="text-amber-300">({formatTime12h(task.dueTime)})</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-base font-extrabold ${isDone ? 'text-slate-400' : 'text-amber-300'}`}>
                        {task.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Bottom Action Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-teal-800/40">
                    <button
                      type="button"
                      onClick={() => handleTestAlarmSound(task)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border ${
                        task.autoNotify && !isDone
                          ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                          : 'bg-teal-950 text-slate-400 border-teal-800'
                      }`}
                    >
                      {task.autoNotify && !isDone ? <Bell className="w-3 h-3 text-amber-400" /> : <VolumeX className="w-3 h-3" />}
                      <span>Alarm</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {!isDone ? (
                        <button
                          type="button"
                          onClick={() => onConvertTaskToExpense(task)}
                          className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-teal-950 text-xs font-black shadow-xs cursor-pointer flex items-center gap-1"
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
                        className="p-1.5 rounded-lg bg-teal-950 text-teal-200 border border-teal-800 cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setTaskToDelete(task)}
                        className="p-1.5 rounded-lg bg-red-950/80 text-red-300 border border-red-800 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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

              <div className="flex items-center justify-between p-2.5 bg-teal-950/60 rounded-xl border border-teal-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold text-teal-100">
                    Enable Sound Alarm
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoNotify}
                  onChange={e => setAutoNotify(e.target.checked)}
                  className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
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
