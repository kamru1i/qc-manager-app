'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, TodoItem } from '@/types';
import { 
  Check, 
  Copy, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CalendarDays, 
  ListTodo, 
  Clock,
  CheckCircle2,
  ChevronDown,
  Edit
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { createPortal } from 'react-dom';
import { TodoSkeleton } from './skeleton/TodoSkeleton';

interface TodoPanelProps {
  profile: Profile | null;
}

// All-time tasks are dynamically managed by the user using the "All-Time" checkbox when adding a task.

export const TodoPanel: React.FC<TodoPanelProps> = ({ profile }) => {
  const [subTab, setSubTab] = useState<'daily' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todoTabPrefs');
      if (saved === 'daily' || saved === 'all') return saved;
    }
    return 'daily';
  });

  useEffect(() => {
    localStorage.setItem('todoTabPrefs', subTab);
  }, [subTab]);

  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  const sortedTodos = React.useMemo(() => {
    return [...todos].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [todos]);

  const [newTask, setNewTask] = useState('');
  const [isAllTime, setIsAllTime] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null);
  
  // Inline edit, bulk select and custom context menu state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [lastClickTime, setLastClickTime] = useState<{ id: string; time: number } | null>(null);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    todoId: string;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Daily State
  const [todayStr] = useState(() => new Date().toLocaleDateString('en-CA')); // Local YYYY-MM-DD
  const isCarryingOverRef = React.useRef(false);

  // Archive / All State
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [archiveTodos, setArchiveTodos] = useState<TodoItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const yearsList = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);

  const monthsList = [
    { val: '01', name: 'January' },
    { val: '02', name: 'February' },
    { val: '03', name: 'March' },
    { val: '04', name: 'April' },
    { val: '05', name: 'May' },
    { val: '06', name: 'June' },
    { val: '07', name: 'July' },
    { val: '08', name: 'August' },
    { val: '09', name: 'September' },
    { val: '10', name: 'October' },
    { val: '11', name: 'November' },
    { val: '12', name: 'December' }
  ];

  // Fetch Daily Todos and Handle Carry-Over / All-Time auto-population
  const fetchDailyTodos = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch today's existing todos
      const { data: todayData, error: todayErr } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', profile.id)
        .eq('todo_date', todayStr)
        .order('created_at', { ascending: false });

      if (todayErr) throw todayErr;

      let currentTodayTodos = todayData || [];

      // A. Check for existing duplicates in today's list and clean them up
      const uniqueTodayMap = new Map<string, TodoItem>();
      const duplicateIdsToDelete: string[] = [];

      currentTodayTodos.forEach((todo) => {
        const key = todo.task.trim().toLowerCase();
        const existing = uniqueTodayMap.get(key);
        if (existing) {
          // Merge status and is_all_time
          if (todo.status === 'Completed' && existing.status !== 'Completed') {
            existing.status = 'Completed';
          } else if (todo.status === 'Working' && existing.status === 'Idle') {
            existing.status = 'Working';
          }
          if (todo.is_all_time) {
            existing.is_all_time = true;
          }
          duplicateIdsToDelete.push(todo.id);
        } else {
          uniqueTodayMap.set(key, { ...todo });
        }
      });

      if (duplicateIdsToDelete.length > 0) {
        // Delete duplicates in database
        const { error: deleteErr } = await supabase
          .from('todos')
          .delete()
          .in('id', duplicateIdsToDelete);
        
        if (deleteErr) console.error('Failed to auto-clean duplicate todos:', deleteErr);
        currentTodayTodos = Array.from(uniqueTodayMap.values());
      }

      // 2. If today has zero todos, perform the carry-over & all-time auto-population
      if (currentTodayTodos.length === 0) {
        if (isCarryingOverRef.current) {
          setLoading(false);
          return;
        }
        isCarryingOverRef.current = true;

        try {
          // A. Find the most recent active day to carry over "Working" tasks
          const { data: lastDateData, error: lastDateErr } = await supabase
            .from('todos')
            .select('todo_date')
            .eq('user_id', profile.id)
            .lt('todo_date', todayStr)
            .order('todo_date', { ascending: false })
            .limit(1);

          if (lastDateErr) throw lastDateErr;

          if (lastDateData && lastDateData.length > 0) {
            const lastActiveDate = lastDateData[0].todo_date;
            
            const { data: lastTodos, error: lastErr } = await supabase
              .from('todos')
              .select('*')
              .eq('user_id', profile.id)
              .eq('todo_date', lastActiveDate)
              .order('created_at', { ascending: false });

            if (lastErr) throw lastErr;

            const lastActiveTodos = lastTodos || [];
            const taskMap = new Map<string, Partial<TodoItem>>();

            lastActiveTodos.forEach((task) => {
              // Carry over if it was not completed ('Working' or 'Idle') OR if it is an 'All-Time' task (recreated daily)
              const shouldCarryOver = task.status === 'Working' || task.status === 'Idle' || task.is_all_time;
              
              if (shouldCarryOver) {
                const taskKey = task.task.trim().toLowerCase();
                const existing = taskMap.get(taskKey);
                if (existing) {
                  // If the new one is permanent, ensure the combined one is also permanent
                  if (task.is_all_time) {
                    existing.is_all_time = true;
                  }
                } else {
                  taskMap.set(taskKey, {
                    user_id: profile.id,
                    codename: profile.username.toUpperCase(),
                    task: task.task.trim(),
                    status: 'Idle', // Every carried over task starts as 'Idle' today
                    comment: task.is_all_time ? '' : (task.comment || ''), // reset comment for all-time tasks
                    todo_date: todayStr,
                    is_all_time: task.is_all_time
                  });
                }
              }
            });

            const tempInserted = Array.from(taskMap.values());

            // Insert carried-over and all-time tasks into database
            if (tempInserted.length > 0) {
              const { data: insertedData, error: insertErr } = await supabase
                .from('todos')
                .insert(tempInserted)
                .select();

              if (insertErr) throw insertErr;
              if (insertedData) {
                currentTodayTodos = insertedData;
              }
            }
          }
        } finally {
          isCarryingOverRef.current = false;
        }
      }

      setTodos(currentTodayTodos);
    } catch (err: any) {
      console.error('Failed to fetch daily todos:', err?.message || err);
      toast.error('Failed to load today\'s Todo list.');
    } finally {
      setLoading(false);
    }
  }, [profile, todayStr]);

  // Fetch Archive (All) Todos based on selected Month/Year
  const fetchArchiveTodos = useCallback(async () => {
    if (!profile) return;
    setArchiveLoading(true);
    try {
      const yearNum = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10);
      const lastDay = new Date(yearNum, monthNum, 0).getDate();

      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', profile.id)
        .gte('todo_date', startDate)
        .lte('todo_date', endDate)
        .neq('status', 'Idle')
        .order('todo_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArchiveTodos(data || []);
    } catch (err: any) {
      console.error('Failed to fetch archive todos:', err?.message || err);
      toast.error('Failed to load historical Todo list.');
    } finally {
      setArchiveLoading(false);
    }
  }, [profile, selectedYear, selectedMonth]);

  // Handle Mounting state for Portals
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Handle Initial Load and Sub-tab toggle updates
  useEffect(() => {
    if (subTab === 'daily') {
      fetchDailyTodos();
    } else {
      fetchArchiveTodos();
    }
  }, [subTab, fetchDailyTodos, fetchArchiveTodos]);

  // Trigger archive fetch on Month or Year dropdown changes
  useEffect(() => {
    if (subTab === 'all') {
      fetchArchiveTodos();
    }
  }, [selectedYear, selectedMonth, subTab, fetchArchiveTodos]);

  // Add a new Daily Todo Item
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTask.trim()) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: profile.id,
          codename: profile.username.toUpperCase(),
          task: newTask.trim(),
          status: 'Idle',
          comment: '',
          todo_date: todayStr,
          is_all_time: isAllTime
        })
        .select();

      if (error) throw error;
      if (data) {
        setTodos((prev) => [...prev, ...data]);
        setNewTask('');
        setIsAllTime(false);
        toast.success('Task added successfully!');
      }
    } catch (err: any) {
      console.error('Failed to add todo:', err?.message || err);
      toast.error('Failed to add task.');
    }
  };

  // Toggle Todo Status (Idle -> Working -> Completed -> Idle)
  const handleToggleStatus = async (todo: TodoItem) => {
    let nextStatus: 'Idle' | 'Working' | 'Completed';
    if (todo.status === 'Idle') {
      nextStatus = 'Working';
    } else if (todo.status === 'Working') {
      nextStatus = 'Completed';
    } else {
      nextStatus = 'Idle';
    }

    try {
      const { error } = await supabase
        .from('todos')
        .update({ status: nextStatus })
        .eq('id', todo.id);

      if (error) throw error;
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, status: nextStatus } : t))
      );
      toast.success(`Task marked as ${nextStatus}!`);
    } catch (err: any) {
      console.error('Failed to toggle status:', err?.message || err);
      toast.error('Failed to update status.');
    }
  };

  // Toggle All-Time Status for a task
  const handleToggleAllTime = async (todo: TodoItem) => {
    const nextAllTime = !todo.is_all_time;
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_all_time: nextAllTime })
        .eq('id', todo.id);

      if (error) throw error;
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, is_all_time: nextAllTime } : t))
      );
      toast.success(nextAllTime ? 'Task marked as Permanent!' : 'Removed from Permanent routine.');
    } catch (err: any) {
      console.error('Failed to toggle all-time status:', err?.message || err);
      toast.error('Failed to update task type.');
    }
  };

  // Update Task Comment Inline
  const handleUpdateComment = async (id: string, commentVal: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ comment: commentVal })
        .eq('id', id);

      if (error) throw error;
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, comment: commentVal } : t))
      );
    } catch (err: any) {
      console.error('Failed to update comment:', err?.message || err);
    }
  };

  // Close context menu on click anywhere
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Context Menu trigger
  const handleContextMenu = (e: React.MouseEvent, todoId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      todoId
    });
  };

  // Double click / consecutive click edit handler
  const handleTaskClick = React.useCallback((todo: TodoItem) => {
    const now = Date.now();
    if (lastClickTime && lastClickTime.id === todo.id && now - lastClickTime.time < 2000) {
      setEditingTodoId(todo.id);
      setEditingTaskText(todo.task);
      setLastClickTime(null);
    } else {
      setLastClickTime({ id: todo.id, time: now });
    }
  }, [lastClickTime]);

  // Save inline edit
  const handleSaveEdit = async (todoId: string) => {
    if (!editingTaskText.trim()) {
      setEditingTodoId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('todos')
        .update({ task: editingTaskText.trim() })
        .eq('id', todoId);

      if (error) throw error;
      setTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, task: editingTaskText.trim() } : t))
      );
      toast.success('Task name updated!');
    } catch (err: any) {
      console.error('Failed to update task name:', err?.message || err);
      toast.error('Failed to update task name.');
    } finally {
      setEditingTodoId(null);
    }
  };

  // Toggle selection for bulk actions
  const handleToggleSelect = (todoId: string) => {
    setSelectedTodoIds((prev) =>
      prev.includes(todoId) ? prev.filter((id) => id !== todoId) : [...prev, todoId]
    );
  };

  // Bulk Delete implementation
  const handleBulkDelete = async () => {
    if (selectedTodoIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', selectedTodoIds);

      if (error) throw error;
      setTodos((prev) => prev.filter((t) => !selectedTodoIds.includes(t.id)));
      setSelectedTodoIds([]);
      toast.success('Selected tasks deleted successfully.');
    } catch (err: any) {
      console.error('Failed to bulk delete todos:', err?.message || err);
      toast.error('Failed to delete selected tasks.');
    }
  };

  // Delete a Todo Item
  const handleDeleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success('Task deleted successfully.');
    } catch (err: any) {
      console.error('Failed to delete todo:', err?.message || err);
      toast.error('Failed to delete task.');
    }
  };

  // Copy Todo Checklist formatted text to Clipboard
  const handleCopyTodos = () => {
    const activeTodos = todos.filter((t) => t.status !== 'Idle');
    
    if (activeTodos.length === 0) {
      toast.error('No working or completed tasks to copy.');
      return;
    }

    const [yyyy, mm, dd] = todayStr.split('-');
    const formattedDate = `${dd}/${mm}/${yyyy}`;
    const header = `✅ *Tasks Summery — ${formattedDate}*\n`;

    const body = activeTodos
      .map((t) => {
        if (t.status === 'Completed') {
          if (t.comment && t.comment.trim() !== '') {
            return `- ${t.task} — Completed — ${t.comment.trim()}`;
          }
          return `- ${t.task} — Completed`;
        }
        if (t.comment && t.comment.trim() !== '') {
          return `- ${t.task} — Working — ${t.comment.trim()}`;
        }
        return `- ${t.task} — Working`;
      })
      .join('\n');

    navigator.clipboard.writeText(header + body);
    toast.success('Todo list copied to clipboard!');
  };

  // Group historical todos by Date
  const groupedArchiveTodos = React.useMemo(() => {
    const groups: Record<string, TodoItem[]> = {};
    archiveTodos.forEach((item) => {
      const date = item.todo_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });
    return groups;
  }, [archiveTodos]);

  // Format YYYY-MM-DD into DD-MM-YYYY for display
  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-500" />
            Superadmin Tasks Registry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage daily assignments, carry-overs, and archive tracking.</p>
        </div>

        {/* Sub-tabs Selector */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setSubTab('daily')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'daily'
                ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400'
                : 'text-slate-450 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Daily List
          </button>
          <button
            onClick={() => setSubTab('all')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'all'
                ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400'
                : 'text-slate-450 hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            All Logs
          </button>
        </div>
      </div>

      {/* SUBTAB 1: DAILY VIEW */}
      {subTab === 'daily' && (
        <div className="space-y-6">
          {loading ? (
            <TodoSkeleton />
          ) : (
            <>
          {/* Add task form and copy options */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl">
            <form onSubmit={handleAddTodo} className="flex-1 w-full flex items-center gap-2.5">
              <input
                type="text"
                required
                placeholder="What task are you working on today? e.g. Fix NS720-pc Outlook issue"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                disabled={loading}
                className="flex-1 min-w-0 px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
              />
              <label className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/40 border border-slate-800/80 rounded-xl cursor-pointer select-none hover:bg-slate-900 transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={isAllTime}
                  onChange={(e) => setIsAllTime(e.target.checked)}
                  disabled={loading}
                  className="sr-only"
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                    isAllTime
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
                  }`}
                >
                  {isAllTime && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span className="text-[11px] text-slate-350 hover:text-white font-bold tracking-wide transition-colors">Permanent</span>
              </label>
              <button
                type="submit"
                disabled={loading || !newTask.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-center shadow-lg shadow-indigo-650/10"
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>
            </form>

            <div className="shrink-0 flex items-center gap-2 w-full md:w-auto justify-end">
              {/* Bulk Selection Actions - Inline placement matching RecordsTable with select animations */}
              <div 
                className={`flex items-center gap-2 transition-all duration-300 transform ${
                  selectedTodoIds.length > 0
                    ? 'scale-100 opacity-100 w-auto mr-1'
                    : 'scale-0 opacity-0 w-0 pointer-events-none mr-0'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTodoToDelete('bulk')}
                  className="p-2 text-rose-500 hover:text-rose-450 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer flex items-center justify-center shrink-0 transition-all"
                  title={`Delete ${selectedTodoIds.length} selected tasks`}
                >
                  <Trash2 className="h-4 w-4 text-rose-500 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortedTodos.every((t) => selectedTodoIds.includes(t.id))) {
                      setSelectedTodoIds([]);
                    } else {
                      setSelectedTodoIds(sortedTodos.map((t) => t.id));
                    }
                  }}
                  className={`rounded-full border border-slate-700 bg-slate-955 cursor-pointer h-4 w-4 flex items-center justify-center transition-all duration-300 shrink-0 ${
                    sortedTodos.length > 0 && sortedTodos.every((t) => selectedTodoIds.includes(t.id))
                      ? 'bg-indigo-500 border-indigo-500'
                      : ''
                  }`}
                  title="Select/Deselect All Tasks"
                >
                  {sortedTodos.length > 0 && sortedTodos.every((t) => selectedTodoIds.includes(t.id)) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                  )}
                </button>
                <div className="h-5 w-[1px] bg-slate-800 mx-1" />
              </div>

              <button
                type="button"
                onClick={handleCopyTodos}
                disabled={loading || todos.length === 0}
                className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md"
                title="Copy formatted checklist to clipboard"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Checklist
              </button>

              <button
                type="button"
                onClick={fetchDailyTodos}
                disabled={loading}
                className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                title="Refresh today's list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* List display */}
          {todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-950/15 border border-slate-850 rounded-2xl">
              <ListTodo className="w-12 h-12 text-slate-600 animate-pulse" />
              <div>
                <p className="text-slate-300 font-bold text-sm">No tasks listed for today</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Start your day by adding tasks above, or check back later to sync database lists.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {sortedTodos.map((todo) => {
                const isSelected = selectedTodoIds.includes(todo.id);
                return (
                  <div
                    key={todo.id}
                    onContextMenu={(e) => handleContextMenu(e, todo.id)}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ${
                      isSelected
                        ? 'bg-indigo-950/15 border-indigo-500/40 shadow-inner'
                        : todo.status === 'Completed'
                        ? 'bg-emerald-950/5 border-emerald-500/10 hover:border-emerald-500/20'
                        : todo.status === 'Working'
                        ? 'bg-slate-950/25 border-slate-800/70 hover:border-slate-800'
                        : 'bg-slate-950/5 border-slate-900/50 hover:border-slate-850 opacity-80'
                    }`}
                  >
                    {/* Task and Comment Layout */}
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        {editingTodoId === todo.id ? (
                          <input
                            type="text"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            onBlur={() => handleSaveEdit(todo.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(todo.id);
                              if (e.key === 'Escape') setEditingTodoId(null);
                            }}
                            autoFocus
                            className="w-full max-w-lg px-2.5 py-1 bg-slate-900 border border-indigo-500 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <p
                              onClick={() => handleTaskClick(todo)}
                              onDoubleClick={() => {
                                setEditingTodoId(todo.id);
                                setEditingTaskText(todo.task);
                              }}
                              className={`text-xs font-semibold leading-relaxed cursor-text select-none truncate ${
                                todo.status === 'Completed'
                                  ? 'text-slate-550 line-through'
                                  : todo.status === 'Idle'
                                  ? 'text-slate-500 italic font-medium'
                                  : 'text-slate-200'
                              }`}
                              title="Click twice or double-click to edit name"
                            >
                              {todo.task}
                            </p>
                            {todo.is_all_time && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAllTime(todo);
                                }}
                                className="px-1.5 py-0.5 rounded-full text-[7.5px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider shrink-0 select-none uppercase cursor-pointer hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 hover:scale-95 transition-all"
                                title="Click to remove from Permanent routine"
                              >
                                Permanent
                              </span>
                            )}
                          </div>
                        )}

                        {/* Comment Input Box */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium shrink-0">Notes:</span>
                          <input
                            type="text"
                            placeholder="Need time, will finish tomorrow..."
                            value={todo.comment || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTodos((prev) =>
                                prev.map((t) => (t.id === todo.id ? { ...t, comment: val } : t))
                              );
                            }}
                            onBlur={(e) => handleUpdateComment(todo.id, e.target.value)}
                            className="w-full max-w-md px-2.5 py-1 bg-slate-900/45 hover:bg-slate-900/80 focus:bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500/50 rounded-lg text-[11px] text-slate-350 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Meta Indicators and Actions */}
                    <div className="flex items-center gap-3 shrink-0 justify-end border-t sm:border-0 border-slate-900/50 pt-3 sm:pt-0">
                      <div className="flex items-center gap-2">
                        {/* Interactive checkmark toggle - moved to the RIGHT */}
                        <button
                          onClick={() => handleToggleStatus(todo)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            todo.status === 'Completed'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                              : todo.status === 'Working'
                              ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                              : 'border-slate-700 text-transparent hover:border-slate-500 hover:bg-slate-800/40 text-slate-500'
                          }`}
                          title={`Status: ${todo.status}. Click to cycle status.`}
                        >
                          {todo.status === 'Completed' ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : todo.status === 'Working' ? (
                            <Clock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                          ) : (
                            <Check className="w-3.5 h-3.5 opacity-0 hover:opacity-40 transition-opacity stroke-[3]" />
                          )}
                        </button>

                        {/* Checkbox for bulk selection - on the RIGHT with smooth transition animation */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(todo.id)}
                          className={`rounded-full border border-slate-700 bg-slate-955 cursor-pointer h-4 w-4 flex items-center justify-center transition-all duration-300 transform shrink-0 ${
                            isSelected ? 'bg-indigo-500 border-indigo-500' : ''
                          } ${
                            selectedTodoIds.length > 0
                              ? 'scale-100 opacity-100 w-4 ml-1'
                              : 'scale-0 opacity-0 w-0 pointer-events-none ml-0'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* SUBTAB 2: ARCHIVE VIEW */}
      {subTab === 'all' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl">
            {/* Year Selector */}
            <div className="flex flex-col gap-1.5 min-w-[120px]">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Select Year</span>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:outline-none appearance-none cursor-pointer pr-8"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Month Selector */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Select Month</span>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:outline-none appearance-none cursor-pointer pr-8"
                >
                  {monthsList.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="ml-auto mt-4 sm:mt-0 shrink-0">
              <button
                type="button"
                onClick={fetchArchiveTodos}
                disabled={archiveLoading}
                className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${archiveLoading ? 'animate-spin' : ''}`} />
                Reload Archives
              </button>
            </div>
          </div>

          {/* Grouped Logs Display */}
          {archiveLoading ? (
            <div className="space-y-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="w-24 h-4 bg-slate-800 rounded animate-pulse" />
                  <div className="p-4 bg-slate-950/20 border border-slate-800/60 rounded-xl animate-pulse h-16" />
                </div>
              ))}
            </div>
          ) : Object.keys(groupedArchiveTodos).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-950/15 border border-slate-850 rounded-2xl">
              <CalendarDays className="w-12 h-12 text-slate-600 animate-pulse" />
              <div>
                <p className="text-slate-300 font-bold text-sm">No historical logs found</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  There are no saved todos for the selected timeframe: {monthsList.find(m => m.val === selectedMonth)?.name} {selectedYear}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {Object.entries(groupedArchiveTodos).map(([date, list]) => (
                <div key={date} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-800/80 border border-slate-750 text-slate-300 font-mono text-[10px] font-bold rounded-lg tracking-wider">
                      {formatDateDisplay(date)}
                    </span>
                    <span className="text-[10px] text-slate-550 font-medium">({list.length} {list.length === 1 ? 'task' : 'tasks'})</span>
                  </div>

                  <div className="bg-slate-955 border border-slate-850/60 rounded-xl overflow-hidden shadow-inner">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-850/80 text-[10px] text-slate-550 uppercase tracking-wider font-bold">
                          <th className="px-3 py-2 w-[60%]">Task Name</th>
                          <th className="px-3 py-2 w-[15%] text-center">Status</th>
                          <th className="px-3 py-2 w-[25%]">Notes / Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/40 text-slate-350">
                        {list.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/35 transition-colors">
                            <td className="px-3 py-1.5 font-medium text-slate-200">
                              <div className="flex items-center gap-2">
                                {item.status === 'Completed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0 animate-pulse" />
                                )}
                                <span className="truncate max-w-[400px]" title={item.task}>
                                  {item.task}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border ${
                                  item.status === 'Completed'
                                    ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/10'
                                    : 'bg-purple-600/10 text-purple-400 border-purple-500/10'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-slate-450 italic truncate max-w-[200px]" title={item.comment || ''}>
                              {item.comment || <span className="text-slate-650 select-none">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={todoToDelete !== null}
        onClose={() => setTodoToDelete(null)}
        onConfirm={async () => {
          if (todoToDelete === 'bulk') {
            await handleBulkDelete();
          } else if (todoToDelete) {
            await handleDeleteTodo(todoToDelete);
          }
          setTodoToDelete(null);
        }}
        title={todoToDelete === 'bulk' ? 'Delete Selected Tasks' : 'Delete Task'}
        message={
          todoToDelete === 'bulk'
            ? `Are you sure you want to delete these ${selectedTodoIds.length} selected tasks? This action cannot be undone.`
            : 'Are you sure you want to delete this task? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />

      {/* Premium Glassmorphic Context Menu */}
      {contextMenu &&
        isMounted &&
        createPortal(
          <div
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            className="fixed z-50 backdrop-blur-lg bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl p-1 w-36 select-none animate-fadeIn"
          >
            {selectedTodoIds.includes(contextMenu.todoId) ? (
              <button
                onClick={() => {
                  handleToggleSelect(contextMenu.todoId);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                Deselect
              </button>
            ) : (
              <button
                onClick={() => {
                  handleToggleSelect(contextMenu.todoId);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Select
              </button>
            )}
            <button
              onClick={() => {
                const todo = todos.find((x) => x.id === contextMenu.todoId);
                if (todo) handleToggleAllTime(todo);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              {todos.find((x) => x.id === contextMenu.todoId)?.is_all_time ? 'Make Regular' : 'Make Permanent'}
            </button>
            <button
              onClick={() => {
                setEditingTodoId(contextMenu.todoId);
                const t = todos.find((x) => x.id === contextMenu.todoId);
                setEditingTaskText(t ? t.task : '');
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Edit className="h-3.5 w-3.5 text-slate-500" />
              Edit
            </button>
            <button
              onClick={() => {
                setTodoToDelete(contextMenu.todoId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-955/20 rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500 stroke-[2]" />
              Delete
            </button>
          </div>,
          document.body
        )}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
          transition: background 0.2s ease;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.35);
        }
      `}} />
    </div>
  );
};
