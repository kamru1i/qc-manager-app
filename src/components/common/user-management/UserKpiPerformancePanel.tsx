'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { 
  FileText, 
  Check, 
  Loader2, 
  AlertTriangle, 
  Printer, 
  Save, 
  Database, 
  Calendar,
  Edit2,
  Trash2,
  Info,
  FileSpreadsheet,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserKpiPerformancePanelProps {
  viewingStaff: Profile;
  onBack?: () => void;
}

const CORE_FILE_TYPES = [
  { key: 'Quote', label: 'Quotations' },
  { key: 'Review', label: 'Review Quotations' },
  { key: 'Individual Review', label: 'Review Quotations(Review)' },
  { key: 'Requote', label: 'Re-Quotations' },
  { key: 'Bike', label: 'Bike' },
  { key: 'Van', label: 'Van' },
  { key: 'Sale', label: 'Online Sales' }
];

export const UserKpiPerformancePanel: React.FC<UserKpiPerformancePanelProps> = ({ viewingStaff, onBack }) => {
  // Session User Info
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // External Evaluator Mode state
  const [evaluatorModeProfile, setEvaluatorModeProfile] = useState<Profile | null>(null);
  const targetStaff = evaluatorModeProfile || viewingStaff;

  const [showViewKpiModal, setShowViewKpiModal] = useState(false);
  const [appraiseeSearchText, setAppraiseeSearchText] = useState('');
  const [assignedAppraisees, setAssignedAppraisees] = useState<any[]>([]);
  const [searchingAppraisee, setSearchingAppraisee] = useState(false);
  const [hasAssignedAppraisees, setHasAssignedAppraisees] = useState(false);
  
  // Date Selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Header inputs
  const [empId, setEmpId] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [department, setDepartment] = useState('Data Entry');
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [appraiserName, setAppraiserName] = useState('');
  const [reviewerName, setReviewerName] = useState('');

  // Table row data maps
  const [weightages, setWeightages] = useState<Record<string, number>>({});
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [supervisorScores, setSupervisorScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  // Signatures
  const [appraiseeSigned, setAppraiseeSigned] = useState(false);
  const [appraiseeSignDate, setAppraiseeSignDate] = useState('');
  const [appraiserSigned, setAppraiserSigned] = useState(false);
  const [appraiserSignDate, setAppraiserSignDate] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbState, setDbState] = useState<'synced' | 'local' | 'checking'>('checking');
  
  // Production stats count
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  // Month list
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = [2024, 2025, 2026, 2027];

  // Check current session
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (data) setCurrentUser(data);
      }
    };
    fetchSession();
  }, []);

  // Is current viewer allowed to edit supervisor/appraiser fields?
  const isSupervisorOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (evaluatorModeProfile) return true;
    return currentUser.role === 'admin' || currentUser.role === 'supervisor';
  }, [currentUser, evaluatorModeProfile]);

  // Is current viewer the appraisee (the user themselves)?
  const isAppraisee = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.id === targetStaff.id;
  }, [currentUser, targetStaff]);

  // Can the viewer modify appraisee details?
  const canEditAppraiseeFields = useMemo(() => {
    return isAppraisee || isSupervisorOrAdmin;
  }, [isAppraisee, isSupervisorOrAdmin]);

  // Format dates for display
  const evaluationPeriod = useMemo(() => {
    const startStr = `01-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endStr = `${String(lastDay).padStart(2, '0')}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
    return { from: startStr, to: endStr };
  }, [selectedMonth, selectedYear]);

  const globalSettingsStr = JSON.stringify(targetStaff.global_settings || {});
  const performsDataEntry = targetStaff.global_settings?.performs_data_entry !== false;
  const performsOtherDeptTasks = !!targetStaff.global_settings?.performs_other_dept_tasks;
  const otherDepartment = targetStaff.global_settings?.other_department || 'IT';
  const kpiDeptIndicators = useMemo(() => {
    return targetStaff.global_settings?.kpi_dept_indicators || [];
  }, [globalSettingsStr]);
  const kpiOtherDeptIndicators = useMemo(() => {
    return targetStaff.global_settings?.kpi_other_dept_indicators || [];
  }, [globalSettingsStr]);

  const allowedTypesStr = JSON.stringify(targetStaff.allowed_types || []);
  const supervisorIdsStr = JSON.stringify(targetStaff.supervisor_ids || []);
  const staffGlobalEmpId = targetStaff.global_settings?.emp_id || '';
  const staffGlobalDoj = targetStaff.global_settings?.date_of_joining || '';

  // Filter allowed file types for this user
  const activeFileTypes = useMemo(() => {
    if (!targetStaff.has_quotes_access) return [];
    try {
      const parsed = JSON.parse(allowedTypesStr);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      return CORE_FILE_TYPES.filter(t => parsed.includes(t.key));
    } catch {
      return [];
    }
  }, [allowedTypesStr, targetStaff.has_quotes_access]);

  // Month key for lookup (e.g. "2026-07")
  const monthYearKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  }, [selectedMonth, selectedYear]);

  // Fetch production counts & supervisor names
  useEffect(() => {
    let active = true;
    const fetchProductionData = async () => {
      // 1. Fetch default supervisor name if empty
      if (targetStaff.supervisor_ids && targetStaff.supervisor_ids.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .in('id', targetStaff.supervisor_ids)
          .limit(1);
        if (data && data.length > 0 && active && !appraiserName) {
          setAppraiserName(data[0].full_name || '');
        }
      }

      // 2. Fetch record counts for the selected month
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const { data: recordData } = await supabase
        .from('records')
        .select('file_type')
        .eq('user_id', targetStaff.id)
        .gte('submitted_at', startDate.toISOString())
        .lte('submitted_at', endDate.toISOString());

      if (recordData && active) {
        const counts: Record<string, number> = {};
        let total = 0;
        recordData.forEach((r: any) => {
          counts[r.file_type] = (counts[r.file_type] || 0) + 1;
          total++;
        });
        setTypeCounts(counts);
        setTotalSubmissions(total);
      }
    };

    fetchProductionData();
    return () => { active = false; };
  }, [targetStaff.id, supervisorIdsStr, selectedMonth, selectedYear]);

  // Default Weightages
  const defaultWeightages = useMemo(() => {
    const finalWeightages: Record<string, number> = {};
    const otherDeptKpisCount = performsOtherDeptTasks ? kpiOtherDeptIndicators.length : 0;

    if (performsDataEntry) {
      const defaults: Record<string, number> = {
        'Quote': 20,
        'Review': 10,
        'Individual Review': 10,
        'Requote': 20,
        'Bike': 5,
        'Van': 5,
        'Sale': 20,
        'mistakes': 0,
        'monthly_reports': 5,
        'self_development': 5
      };

      const deptKpisCount = kpiDeptIndicators.length;
      const deptWeightageTotal = deptKpisCount > 0 ? 10 : 0; // Allocate 10% total for custom dept KPIs if present
      const otherDeptWeightageTotal = otherDeptKpisCount > 0 ? 10 : 0; // Allocate 10% total for secondary dept KPIs if present

      const otherSum = 5 + 5 + deptWeightageTotal + otherDeptWeightageTotal; // monthly_reports (5) + self_development (5) + dept KPIs (10) + other dept KPIs (10)
      const coreTargetSum = 100 - otherSum;

      const activeKeys = activeFileTypes.map(t => t.key);
      const activeCoreWeightageSum = activeKeys.reduce((acc, k) => acc + (defaults[k] || 0), 0);

      if (activeCoreWeightageSum > 0) {
        activeFileTypes.forEach(t => {
          finalWeightages[t.key] = Math.round(((defaults[t.key] || 0) / activeCoreWeightageSum) * coreTargetSum);
        });
      } else if (activeFileTypes.length > 0) {
        const share = Math.floor(coreTargetSum / activeFileTypes.length);
        activeFileTypes.forEach(t => {
          finalWeightages[t.key] = share;
        });
      }

      finalWeightages['mistakes'] = 0;
      finalWeightages['monthly_reports'] = 5;
      finalWeightages['self_development'] = 5;

      if (deptKpisCount > 0) {
        const deptShare = Math.floor(deptWeightageTotal / deptKpisCount);
        kpiDeptIndicators.forEach((indicator: string, idx: number) => {
          if (idx === deptKpisCount - 1) {
            finalWeightages[`dept_${indicator}`] = deptWeightageTotal - (deptShare * (deptKpisCount - 1));
          } else {
            finalWeightages[`dept_${indicator}`] = deptShare;
          }
        });
      }

      if (otherDeptKpisCount > 0) {
        const otherDeptShare = Math.floor(otherDeptWeightageTotal / otherDeptKpisCount);
        kpiOtherDeptIndicators.forEach((indicator: string, idx: number) => {
          if (idx === otherDeptKpisCount - 1) {
            finalWeightages[`other_dept_${indicator}`] = otherDeptWeightageTotal - (otherDeptShare * (otherDeptKpisCount - 1));
          } else {
            finalWeightages[`other_dept_${indicator}`] = otherDeptShare;
          }
        });
      }
    } else {
      // If performsDataEntry is false, we only evaluate custom indicators and self development (10% self_development)
      finalWeightages['self_development'] = 10;
      const deptKpisCount = kpiDeptIndicators.length;
      const totalCustomCount = deptKpisCount + otherDeptKpisCount;

      if (totalCustomCount > 0) {
        const share = Math.floor(90 / totalCustomCount);
        // Distribute to main indicators
        kpiDeptIndicators.forEach((indicator: string) => {
          finalWeightages[`dept_${indicator}`] = share;
        });
        // Distribute to secondary indicators
        kpiOtherDeptIndicators.forEach((indicator: string) => {
          finalWeightages[`other_dept_${indicator}`] = share;
        });
        // Adjust last indicator to make total exactly 90
        const totalAllocated = share * totalCustomCount;
        const remainder = 90 - totalAllocated;
        if (remainder > 0) {
          if (otherDeptKpisCount > 0) {
            finalWeightages[`other_dept_${kpiOtherDeptIndicators[otherDeptKpisCount - 1]}`] += remainder;
          } else {
            finalWeightages[`dept_${kpiDeptIndicators[deptKpisCount - 1]}`] += remainder;
          }
        }
      } else {
        finalWeightages['self_development'] = 100;
      }
    }

    return finalWeightages;
  }, [activeFileTypes, allowedTypesStr, performsDataEntry, globalSettingsStr, performsOtherDeptTasks, kpiDeptIndicators, kpiOtherDeptIndicators]);

  // Core Section Max for Self-Scores scaling
  const coreSelfMax = useMemo(() => {
    const reportSelf = selfScores['monthly_reports'] ?? 0;
    const devSelf = selfScores['self_development'] ?? 0;
    const deptSelfSum = kpiDeptIndicators.reduce((acc: number, ind: string) => acc + (selfScores[`dept_${ind}`] || 0), 0);
    const otherDeptSelfSum = performsOtherDeptTasks ? kpiOtherDeptIndicators.reduce((acc: number, ind: string) => acc + (selfScores[`other_dept_${ind}`] || 0), 0) : 0;
    return 100 - reportSelf - devSelf - deptSelfSum - otherDeptSelfSum;
  }, [selfScores, kpiDeptIndicators, kpiOtherDeptIndicators, performsOtherDeptTasks]);

  // Compute Auto Self-Scores for Serial 1 File Types
  const computedSelfScores = useMemo(() => {
    const scores: Record<string, number> = {};
    
    if (totalSubmissions === 0) {
      activeFileTypes.forEach(t => { scores[t.key] = 0; });
      return scores;
    }

    activeFileTypes.forEach(t => {
      const count = typeCounts[t.key] || 0;
      scores[t.key] = Math.round((count / totalSubmissions) * coreSelfMax);
    });

    return scores;
  }, [activeFileTypes, typeCounts, totalSubmissions, coreSelfMax]);

  // Total sums
  const totals = useMemo(() => {
    let weightSum = 0;
    let selfSum = 0;
    let supervisorSum = 0;

    if (performsDataEntry) {
      // Serial 1 File Types
      activeFileTypes.forEach(t => {
        weightSum += weightages[t.key] ?? defaultWeightages[t.key] ?? 0;
        selfSum += computedSelfScores[t.key] || 0;
        supervisorSum += supervisorScores[t.key] || 0;
      });

      // Mistakes row
      weightSum += weightages['mistakes'] ?? 0;
      selfSum += selfScores['mistakes'] ?? 0;
      supervisorSum += supervisorScores['mistakes'] ?? 0;

      // Monthly reports
      weightSum += weightages['monthly_reports'] ?? defaultWeightages['monthly_reports'] ?? 0;
      selfSum += selfScores['monthly_reports'] ?? 0;
      supervisorSum += supervisorScores['monthly_reports'] ?? 0;
    }

    // Department Specific tasks
    kpiDeptIndicators.forEach((ind: string) => {
      const key = `dept_${ind}`;
      weightSum += weightages[key] ?? defaultWeightages[key] ?? 0;
      selfSum += selfScores[key] ?? 0;
      supervisorSum += supervisorScores[key] ?? 0;
    });

    // Other Department Specific tasks
    if (performsOtherDeptTasks) {
      kpiOtherDeptIndicators.forEach((ind: string) => {
        const key = `other_dept_${ind}`;
        weightSum += weightages[key] ?? defaultWeightages[key] ?? 0;
        selfSum += selfScores[key] ?? 0;
        supervisorSum += supervisorScores[key] ?? 0;
      });
    }

    // Self Development
    weightSum += weightages['self_development'] ?? defaultWeightages['self_development'] ?? 0;
    selfSum += selfScores['self_development'] ?? 0;
    supervisorSum += supervisorScores['self_development'] ?? 0;

    return {
      weightage: weightSum,
      self: selfSum,
      supervisor: supervisorSum
    };
  }, [performsDataEntry, activeFileTypes, kpiDeptIndicators, kpiOtherDeptIndicators, performsOtherDeptTasks, weightages, defaultWeightages, computedSelfScores, selfScores, supervisorScores]);

  // Fetch from Database
  const lastLoadedRef = React.useRef({ id: '', monthYear: '' });

  useEffect(() => {
    let active = true;
    const fetchAssessment = async () => {
      const isNewFetch = lastLoadedRef.current.id !== targetStaff.id || lastLoadedRef.current.monthYear !== monthYearKey;
      if (isNewFetch) {
        setLoading(true);
        lastLoadedRef.current = { id: targetStaff.id, monthYear: monthYearKey };
      }
      try {
        const { data, error } = await supabase
          .from('kpi_assessments')
          .select('*')
          .eq('user_id', targetStaff.id)
          .eq('month_year', monthYearKey)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (active) {
            setEmpId(data.emp_id || '');
            setDateOfJoining(data.date_of_joining || '');
            setDepartment(data.department || 'Data Entry');
            setAppraiserName(data.appraiser_name || '');
            setReviewerName(data.reviewer_name || '');
            
            // Unpack KPI values maps
            const savedKpi = data.kpis || {};
            setWeightages(savedKpi.weightages || {});
            setSelfScores(savedKpi.selfScores || {});
            setSupervisorScores(savedKpi.supervisorScores || {});
            setComments(savedKpi.comments || {});

            setAppraiseeSigned(!!data.appraisee_signed);
            setAppraiseeSignDate(data.appraisee_sign_date || '');
            setAppraiserSigned(!!data.appraiser_signed);
            setAppraiserSignDate(data.appraiser_sign_date || '');
            setDbState('synced');
          }
        } else {
          // Initialize default state
          if (active) {
            setEmpId(targetStaff.global_settings?.emp_id || '');
            setDateOfJoining(targetStaff.global_settings?.date_of_joining || '');
            setDepartment(targetStaff.global_settings?.department || 'Data Entry');
            setReviewerName('');
            setWeightages(defaultWeightages);
            setSelfScores({ mistakes: 0, monthly_reports: 0, self_development: 0 });
            setSupervisorScores({});
            setComments({});
            setAppraiseeSigned(false);
            setAppraiseeSignDate('');
            setAppraiserSigned(false);
            setAppraiserSignDate('');
            setDbState('synced');
          }
        }
      } catch (err: any) {
        console.warn('Supabase KPI table fetch error, falling back to localStorage:', err);
        // Fallback to localStorage sandbox mock
        if (active) {
          setDbState('local');
          const localKey = `kpi_${targetStaff.id}_${monthYearKey}`;
          const localDataStr = localStorage.getItem(localKey);
          if (localDataStr) {
            try {
              const localData = JSON.parse(localDataStr);
              setEmpId(localData.emp_id || '');
              setDateOfJoining(localData.date_of_joining || '');
              setDepartment(localData.department || 'Data Entry');
              setAppraiserName(localData.appraiser_name || '');
              setReviewerName(localData.reviewer_name || '');
              setWeightages(localData.kpis?.weightages || {});
              setSelfScores(localData.kpis?.selfScores || {});
              setSupervisorScores(localData.kpis?.supervisorScores || {});
              setComments(localData.kpis?.comments || {});
              setAppraiseeSigned(!!localData.appraisee_signed);
              setAppraiseeSignDate(localData.appraisee_sign_date || '');
              setAppraiserSigned(!!localData.appraiser_signed);
              setAppraiserSignDate(localData.appraiser_sign_date || '');
            } catch {
              // ignore JSON error
            }
          } else {
            setEmpId('');
            setDateOfJoining('');
            setDepartment(targetStaff.global_settings?.department || 'Data Entry');
            setReviewerName('');
            setWeightages(defaultWeightages);
            setSelfScores({ mistakes: 0, monthly_reports: 0, self_development: 0 });
            setSupervisorScores({});
            setComments({});
            setAppraiseeSigned(false);
            setAppraiseeSignDate('');
            setAppraiserSigned(false);
            setAppraiserSignDate('');
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAssessment();
    return () => { active = false; };
  }, [targetStaff.id, monthYearKey, defaultWeightages, staffGlobalEmpId, staffGlobalDoj]);

  const fetchAssignedAppraisees = async () => {
    if (!currentUser) return;
    setSearchingAppraisee(true);
    try {
      const { data: assessments, error } = await supabase
        .from('kpi_assessments')
        .select('user_id')
        .eq('month_year', monthYearKey)
        .or(`appraiser_name.ilike.%${currentUser.full_name || 'NOTHING_HERE'}%,appraiser_name.ilike.%${currentUser.username || 'NOTHING_HERE'}%`);
        
      if (error) throw error;
      
      if (assessments && assessments.length > 0) {
        const userIds = Array.from(new Set(assessments.map((a: any) => a.user_id)));
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, role, allowed_types, global_settings')
          .in('id', userIds);
          
        if (profilesData) {
          setAssignedAppraisees(profilesData);
          setHasAssignedAppraisees(profilesData.length > 0);
          return;
        }
      }
      setAssignedAppraisees([]);
      setHasAssignedAppraisees(false);
    } catch (err) {
      console.error('Failed to load appraisees:', err);
    } finally {
      setSearchingAppraisee(false);
    }
  };

  // Check if current user has any assigned appraisees to show "View KPI" button
  useEffect(() => {
    let active = true;
    const checkAppraisees = async () => {
      if (!currentUser) return;
      try {
        const { data: assessments, error } = await supabase
          .from('kpi_assessments')
          .select('user_id')
          .eq('month_year', monthYearKey)
          .or(`appraiser_name.ilike.%${currentUser.full_name || 'NOTHING_HERE'}%,appraiser_name.ilike.%${currentUser.username || 'NOTHING_HERE'}%`);
          
        if (error) throw error;
        
        if (active) {
          setHasAssignedAppraisees(assessments && assessments.length > 0);
        }
      } catch (err) {
        console.error('Failed checking appraisees:', err);
      }
    };
    checkAppraisees();
    return () => { active = false; };
  }, [currentUser, monthYearKey]);

  const handleLoadAppraiseeByCodename = async (codename: string) => {
    const clean = codename.trim().toUpperCase();
    if (!clean) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', clean)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setEvaluatorModeProfile(data);
        setShowViewKpiModal(false);
        toast.success(`Loaded KPI sheet for ${data.full_name || data.username} in Evaluator Mode.`);
      } else {
        toast.error(`No user found with codename "${clean}"`);
      }
    } catch (err) {
      toast.error('Failed to look up codename: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Save to Database / LocalStorage fallback
  const handleSave = async () => {
    if (totals.weightage !== 100) {
      toast.error(`Weightage mismatch! Total weightage must sum up to exactly 100%. Current sum: ${totals.weightage}%`);
      return;
    }

    setSaving(true);
    const kpisPayload = {
      weightages,
      selfScores,
      supervisorScores,
      comments
    };

    const updateObj = {
      user_id: targetStaff.id,
      month_year: monthYearKey,
      emp_id: empId,
      date_of_joining: dateOfJoining,
      department: department,
      appraiser_name: appraiserName,
      reviewer_name: reviewerName,
      kpis: kpisPayload,
      appraisee_signed: appraiseeSigned,
      appraisee_sign_date: appraiseeSignDate,
      appraiser_signed: appraiserSigned,
      appraiser_sign_date: appraiserSignDate,
      updated_at: new Date().toISOString()
    };

    if (dbState === 'synced') {
      try {
        const { error } = await supabase
          .from('kpi_assessments')
          .upsert(updateObj, { onConflict: 'user_id,month_year' });

        if (error) throw error;
        
        // Also save emp_id and dateOfJoining to user's global settings in profile for future default use
        const existingGlobal = targetStaff.global_settings || {};
        if (existingGlobal.emp_id !== empId || existingGlobal.date_of_joining !== dateOfJoining) {
          await supabase
            .from('profiles')
            .update({
              global_settings: {
                ...existingGlobal,
                emp_id: empId,
                date_of_joining: dateOfJoining
              }
            })
            .eq('id', targetStaff.id);
        }

        toast.success('Performance Assessment saved successfully!');
      } catch (err: any) {
        console.error('Save to Database failed, saving to local storage:', err);
        toast.error('Cloud Sync failed. Saved locally inside localStorage.');
        setDbState('local');
        saveLocally();
      } finally {
        setSaving(false);
      }
    } else {
      saveLocally();
      setSaving(false);
    }
  };

  const saveLocally = () => {
    const localKey = `kpi_${targetStaff.id}_${monthYearKey}`;
    const payload = {
      emp_id: empId,
      date_of_joining: dateOfJoining,
      department: department,
      appraiser_name: appraiserName,
      reviewer_name: reviewerName,
      kpis: {
        weightages,
        selfScores,
        supervisorScores,
        comments
      },
      appraisee_signed: appraiseeSigned,
      appraisee_sign_date: appraiseeSignDate,
      appraiser_signed: appraiserSigned,
      appraiser_sign_date: appraiserSignDate
    };
    localStorage.setItem(localKey, JSON.stringify(payload));
    toast.success('Performance Assessment saved locally!');
  };

  // Sign Checkbox Trigger Appraisee
  const handleAppraiseeSignChange = (checked: boolean) => {
    if (!canEditAppraiseeFields) return;
    setAppraiseeSigned(checked);
    if (checked) {
      const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      setAppraiseeSignDate(todayStr);
    } else {
      setAppraiseeSignDate('');
    }
  };

  // Sign Checkbox Trigger Appraiser
  const handleAppraiserSignChange = (checked: boolean) => {
    if (!isSupervisorOrAdmin) return;
    setAppraiserSigned(checked);
    if (checked) {
      const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      setAppraiserSignDate(todayStr);
    } else {
      setAppraiserSignDate('');
    }
  };

  // Printer view trigger
  const handlePrint = () => {
    window.print();
  };

  // Excel export trigger
  const handleExportExcel = () => {
    const headers = [
      "Serial No",
      "Key Result Area",
      "Key Performance Indicator",
      "Measurable Criteria",
      "Target",
      "Weightage",
      "Self Score",
      "Supervisor Score",
      "Comments"
    ];

    const rows: string[][] = [
      [
        `Performance Assessment: ${selectedMonth + 1}-${selectedYear}`,
        `Employee Name: ${targetStaff.full_name || targetStaff.username}`,
        `Employee ID: ${empId}`,
        `Department: ${performsOtherDeptTasks ? `${department} & ${otherDepartment}` : department}`,
        `Appraiser: ${appraiserName}`,
        `Reviewer: ${reviewerName}`,
        `Date of Joining: ${dateOfJoining}`
      ],
      [], // blank line
      headers
    ];

    let currentSrl = 1;
    
    // Serial 1: Data Entry
    if (performsDataEntry) {
      const dataSrl = currentSrl++;
      activeFileTypes.forEach((type) => {
        rows.push([
          String(dataSrl),
          "Data Entry",
          type.label,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[type.key] ?? defaultWeightages[type.key] ?? 0}%`,
          `${computedSelfScores[type.key] || 0}%`,
          `${supervisorScores[type.key] !== undefined ? supervisorScores[type.key] : 0}%`,
          comments[type.key] || ""
        ]);
      });

      // Mistakes row
      rows.push([
        String(dataSrl),
        "Data Entry",
        "Number of Mistakes",
        "Quality, Quantity & Timeliness",
        "0%",
        `${weightages['mistakes'] ?? 0}%`,
        `${selfScores['mistakes'] ?? 0}%`,
        `${supervisorScores['mistakes'] !== undefined ? supervisorScores['mistakes'] : 0}%`,
        comments['mistakes'] || ""
      ]);
    }

    // Serial 2: Custom Department indicators
    if (kpiDeptIndicators.length > 0) {
      const deptSrl = currentSrl++;
      kpiDeptIndicators.forEach((indicator: string) => {
        const key = `dept_${indicator}`;
        rows.push([
          String(deptSrl),
          department,
          indicator,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[key] ?? defaultWeightages[key] ?? 0}%`,
          `${selfScores[key] ?? 0}%`,
          `${supervisorScores[key] !== undefined ? supervisorScores[key] : 0}%`,
          comments[key] || ""
        ]);
      });
    }

    // Secondary Department indicators
    if (performsOtherDeptTasks && kpiOtherDeptIndicators.length > 0) {
      const otherDeptSrl = currentSrl++;
      kpiOtherDeptIndicators.forEach((indicator: string) => {
        const key = `other_dept_${indicator}`;
        rows.push([
          String(otherDeptSrl),
          otherDepartment,
          indicator,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[key] ?? defaultWeightages[key] ?? 0}%`,
          `${selfScores[key] ?? 0}%`,
          `${supervisorScores[key] !== undefined ? supervisorScores[key] : 0}%`,
          comments[key] || ""
        ]);
      });
    }

    // Serial 3: Monthly Reports
    if (performsDataEntry) {
      const reportSrl = currentSrl++;
      rows.push([
        String(reportSrl),
        "Monthly Data Entry Report",
        "Monthly Reports",
        "Quality, Quantity & Timeliness",
        "100%",
        `${weightages['monthly_reports'] ?? defaultWeightages['monthly_reports'] ?? 5}%`,
        `${selfScores['monthly_reports'] ?? 0}%`,
        `${supervisorScores['monthly_reports'] !== undefined ? supervisorScores['monthly_reports'] : 0}%`,
        comments['monthly_reports'] || ""
      ]);
    }

    // Serial 4: Self Development
    const selfDevSrl = currentSrl++;
    rows.push([
      String(selfDevSrl),
      "Self Development Initiative",
      kpiSkillsJoined,
      "Quality, Quantity & Timeliness",
      "100%",
      `${weightages['self_development'] ?? defaultWeightages['self_development'] ?? 5}%`,
      `${selfScores['self_development'] ?? 0}%`,
      `${supervisorScores['self_development'] !== undefined ? supervisorScores['self_development'] : 0}%`,
      comments['self_development'] || ""
    ]);

    // Total Row
    rows.push([]);
    rows.push([
      "Total",
      "",
      "",
      "",
      "",
      `${totals.weightage.toFixed(1)}%`,
      `${totals.self.toFixed(1)}%`,
      `${totals.supervisor.toFixed(1)}%`,
      ""
    ]);

    // Signatures
    rows.push([]);
    rows.push([
      `Appraisee Signed: ${appraiseeSigned ? 'YES' : 'NO'}`,
      `Appraisee Sign Date: ${appraiseeSignDate || 'N/A'}`,
      "",
      `Appraiser Signed: ${appraiserSigned ? 'YES' : 'NO'}`,
      `Appraiser Sign Date: ${appraiserSignDate || 'N/A'}`
    ]);

    // Convert to Excel HTML table format
    const htmlRows = rows.map(r => 
      `<tr>${r.map(val => `<td style="border: 1px solid #ddd; padding: 6px;">${val}</td>`).join("")}</tr>`
    ).join("\n");
    
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>KPI Assessment</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body style="font-family: sans-serif;">
        <table style="border-collapse: collapse;">${htmlRows}</table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `KPI_Assessment_${targetStaff.username || 'user'}_${monthYearKey}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("KPI sheet exported to Excel format!");
  };

  // Weightage adjustment triggers
  const handleWeightageChange = (key: string, value: number) => {
    setWeightages(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Self scores change (only for Serials 2 & 3 & mistakes)
  const handleSelfScoreChange = (key: string, value: number) => {
    setSelfScores(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Supervisor scores change
  const handleSupervisorScoreChange = (key: string, value: number) => {
    setSupervisorScores(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Comments change
  const handleCommentChange = (key: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Joined KPI Skills string
  const skills = targetStaff.global_settings?.kpi_skills || [];
  const kpiSkillsJoined = skills.length > 0 ? skills.join(', ') : 'Spoken English, Communication skill';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-slate-850/60 rounded-2xl p-8">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading Performance Assessment Sheet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full font-sans print:bg-white print:text-black print:p-0 print:border-0 print:space-y-4">
      {/* 1. Header controls (Not printed) */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/35 border border-slate-850 p-4 rounded-2xl shadow-lg print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-slate-350 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">KPI Goal Sheet & Monthly Performance Assessment</h4>
            <p className="text-[11px] text-slate-400">Evaluate, submit self-scores, and save/lock monthly assessments.</p>
          </div>
        </div>

        {/* Date Month Selector */}
        <div className="flex items-center gap-2.5">
          {hasAssignedAppraisees && (
            <button
              type="button"
              onClick={() => {
                setShowViewKpiModal(true);
                fetchAssignedAppraisees();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (evaluatorModeProfile) {
                  setEvaluatorModeProfile(null);
                  toast.success("Reset view to your own KPI sheet.");
                }
              }}
              className="px-3 py-2 bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-450 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors group"
              title="Evaluate assigned employee sheets (Right click to reset)"
            >
              <Target className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
              <span>View KPI</span>
            </button>
          )}

          <div className="flex bg-slate-950/80 border border-slate-800 rounded-xl p-1 shrink-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-300 px-2 py-1.5 focus:outline-hidden cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={m} value={i} className="bg-slate-950 text-slate-355">{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-300 px-2 py-1.5 focus:outline-hidden cursor-pointer border-l border-slate-800/80"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-slate-955">{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Print assessment sheet"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="p-2 bg-emerald-950/20 hover:bg-emerald-900/20 border border-emerald-900/40 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors print:hidden"
            title="Export assessment sheet to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-950/20 border border-blue-700/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Sheet
          </button>
        </div>
      </div>

      {evaluatorModeProfile && (
        <div className="bg-blue-950/30 border border-blue-900/60 p-4 rounded-2xl text-xs text-blue-300 font-semibold flex justify-between items-center font-sans print:hidden animate-fade-in">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            <span>Currently evaluating Appraisee: <strong className="text-white font-black">{evaluatorModeProfile.full_name} ({evaluatorModeProfile.username})</strong></span>
          </span>
          <button
            type="button"
            onClick={() => setEvaluatorModeProfile(null)}
            className="px-3 py-1 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Exit Evaluator Mode
          </button>
        </div>
      )}

      {/* Database state notification warning (Not printed) */}
      {dbState === 'local' && (
        <div className="bg-amber-950/15 border border-amber-900/40 p-4 rounded-2xl text-xs text-amber-300 font-sans print:hidden space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">Supabase Cloud Sync Offline (SQL Table Missing)</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                The spreadsheet has successfully fallen back to localStorage. To enable central cloud syncing across all accounts, please ask your Supabase Administrator to run the following SQL script inside the Supabase SQL editor:
              </p>
            </div>
          </div>
          <pre className="bg-slate-950/90 border border-slate-850 rounded-xl p-3 text-[10px] text-slate-400 font-mono overflow-x-auto select-all max-h-48 whitespace-pre">
{`CREATE TABLE IF NOT EXISTS public.kpi_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  emp_id TEXT,
  date_of_joining TEXT,
  department TEXT DEFAULT 'Data Entry',
  appraiser_name TEXT,
  reviewer_name TEXT,
  kpis JSONB NOT NULL DEFAULT '[]'::jsonb,
  appraisee_signed BOOLEAN DEFAULT false,
  appraisee_sign_date TEXT,
  appraiser_signed BOOLEAN DEFAULT false,
  appraiser_sign_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, month_year)
);

ALTER TABLE public.kpi_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for all authenticated users" 
ON public.kpi_assessments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert/update/delete for admin, supervisor, or self" 
ON public.kpi_assessments FOR ALL TO authenticated 
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor')
));`}
          </pre>
        </div>
      )}

      {/* Weightage Warning (Not printed) */}
      {totals.weightage !== 100 && (
        <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2.5 font-sans print:hidden animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>Total Weightage must equal exactly 100%. Currently it is set to <strong className="underline text-white font-bold">{totals.weightage}%</strong>. Please adjust weightages below.</span>
        </div>
      )}

      {/* 2. MAIN SHEET CONTAINER */}
      <div className="bg-slate-950 border border-slate-850 p-6.5 rounded-2xl shadow-xl space-y-6 font-sans print:bg-white print:border-0 print:shadow-none print:p-0 print:text-black">
        
        {/* Banner Title */}
        <div className="text-center border-b border-slate-800 pb-4 print:border-black">
          <h2 className="text-lg font-bold text-white tracking-wide uppercase print:text-black print:text-base">Performance Assessment : {selectedYear}</h2>
        </div>

        {/* 3. Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs text-slate-350 print:text-black print:grid-cols-2">
          {/* Appraisee Name */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Appraisee Name</span>
            <span className="font-medium text-white print:text-black">{targetStaff.full_name || targetStaff.username}</span>
          </div>

          {/* Department */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200 group">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Department</span>
            {isEditingDept && isSupervisorOrAdmin ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  onBlur={() => setIsEditingDept(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingDept(false)}
                  autoFocus
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-white print:text-black">
                  {performsOtherDeptTasks ? `${department} & ${otherDepartment}` : department}
                </span>
                {isSupervisorOrAdmin && (
                  <button
                    onClick={() => setIsEditingDept(true)}
                    className="p-1 text-slate-500 hover:text-white transition-colors cursor-pointer print:hidden"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Emp ID */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Emp ID</span>
            {canEditAppraiseeFields ? (
              <input
                type="text"
                placeholder="2008"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-blue-500 w-36 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-white print:text-black">{empId || '—'}</span>
            )}
          </div>

          {/* Appraiser's Name */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Appraiser's Name</span>
            {isSupervisorOrAdmin ? (
              <input
                type="text"
                placeholder="Md Jahangir Hossan"
                value={appraiserName}
                onChange={(e) => setAppraiserName(e.target.value)}
                className="bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-750 focus:outline-hidden focus:border-blue-500 w-52 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-white print:text-black">{appraiserName || '—'}</span>
            )}
          </div>

          {/* Designation */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Designation</span>
            <span className="font-medium text-white print:text-black">{targetStaff.job_role || 'Executive'}</span>
          </div>

          {/* Reviewer's Name */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Reviewer's Name</span>
            {isSupervisorOrAdmin || isAppraisee ? (
              <input
                type="text"
                placeholder="Manager"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-750 focus:outline-hidden focus:border-blue-500 w-52 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-white print:text-black">{reviewerName || '—'}</span>
            )}
          </div>

          {/* Date of Joining */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Date of Joining</span>
            {canEditAppraiseeFields ? (
              <input
                type="text"
                placeholder="13-Jul-20"
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className="bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-blue-500 w-36 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-white print:text-black">{dateOfJoining || '—'}</span>
            )}
          </div>

          {/* Evaluation Period */}
          <div className="flex items-center border-b border-slate-900 pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-slate-400 shrink-0 print:text-black">Evaluation Period</span>
            <span className="font-medium text-white print:text-black">From: {evaluationPeriod.from} To: {evaluationPeriod.to}</span>
          </div>
        </div>

        {/* GOAL SHEET BANNER */}
        <div className="bg-slate-900/60 text-center py-2 rounded-xl border border-slate-850 print:bg-neutral-100 print:text-black print:border-black print:border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-350 print:text-black">GOAL SHEET</span>
        </div>

        {/* 4. PERFORMANCE TABLE */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-lg print:border-black print:border print:rounded-none">
          <table className="w-full text-left text-xs border-collapse min-w-[900px] print:text-black print:bg-white">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 print:bg-neutral-100 print:text-black print:border-black">
                <th className="py-3 px-3 text-center border-r border-slate-800 w-16 print:border-black">Srl No.</th>
                <th className="py-3 px-4 border-r border-slate-800 w-36 print:border-black">Key Result Area</th>
                <th className="py-3 px-4 border-r border-slate-800 w-48 print:border-black">Key Performance Indicator</th>
                <th className="py-3 px-4 border-r border-slate-800 w-48 print:border-black">Measurable Criteria</th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-20 print:border-black">Target</th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-24 print:border-black">Weightage</th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-20 print:border-black">Self</th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-24 print:border-black">Supervisor</th>
                <th className="py-3 px-4 print:text-black">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 print:divide-black">
              {(() => {
                let currentSrl = 1;
                const dataEntrySrl = performsDataEntry ? currentSrl++ : null;
                const deptKpiSrl = kpiDeptIndicators.length > 0 ? currentSrl++ : null;
                const otherDeptKpiSrl = (performsOtherDeptTasks && kpiOtherDeptIndicators.length > 0) ? currentSrl++ : null;
                const reportSrl = performsDataEntry ? currentSrl++ : null;
                const selfDevSrl = currentSrl++;

                return (
                  <>
                    {/* SERIAL 1: Core Submissions Section (Data Entry) */}
                    {performsDataEntry && (
                      <>
                        {activeFileTypes.map((type, idx) => {
                          const isFirst = idx === 0;
                          const totalRows = activeFileTypes.length + 1; // including Mistakes row

                          return (
                            <tr key={type.key} className="hover:bg-slate-950/20 transition-colors">
                              {/* Rowspans */}
                              {isFirst && (
                                <>
                                  <td 
                                    rowSpan={totalRows} 
                                    className="py-4 px-3 text-center align-middle font-bold text-slate-350 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {dataEntrySrl}
                                  </td>
                                  <td 
                                    rowSpan={totalRows} 
                                    className="py-4 px-4 align-middle font-bold text-slate-350 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    Data Entry
                                  </td>
                                </>
                              )}

                              {/* KPI Columns */}
                              <td className="py-2.5 px-4 border-r border-slate-850 font-medium text-slate-200 print:border-black print:text-black">
                                {type.label}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-850 text-slate-400 print:border-black print:text-black">
                                Quality, Quantity & Timeliness
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-slate-850 font-semibold text-slate-400 print:border-black print:text-black">
                                100%
                              </td>

                              {/* Weightage */}
                              <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={weightages[type.key] ?? defaultWeightages[type.key] ?? 0}
                                      onChange={(e) => handleWeightageChange(type.key, Number(e.target.value))}
                                      className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-slate-555 font-semibold">%</span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-350 print:text-black">
                                    {weightages[type.key] ?? defaultWeightages[type.key] ?? 0}%
                                  </span>
                                )}
                              </td>

                              {/* Self Score */}
                              <td className="py-2.5 px-3 text-center border-r border-slate-850 font-bold text-blue-400 bg-blue-955/5 print:border-black print:bg-transparent print:text-black">
                                {computedSelfScores[type.key] || 0}%
                              </td>

                              {/* Supervisor score */}
                              <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={supervisorScores[type.key] ?? 0}
                                      onChange={(e) => handleSupervisorScoreChange(type.key, Number(e.target.value))}
                                      className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                                    />
                                    <span className="text-[10px] text-slate-555 font-semibold">%</span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-350 print:text-black">
                                    {supervisorScores[type.key] !== undefined ? `${supervisorScores[type.key]}%` : '—'}
                                  </span>
                                )}
                              </td>

                              {/* Comments */}
                              <td className="py-2 px-3">
                                {isSupervisorOrAdmin ? (
                                  <input
                                    type="text"
                                    placeholder="Add feedback"
                                    value={comments[type.key] || ''}
                                    onChange={(e) => handleCommentChange(type.key, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-700"
                                  />
                                ) : (
                                  <span className="text-slate-400 italic text-[11px] print:text-black">
                                    {comments[type.key] || '—'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Number of Mistakes Row (Final Row of Serial 1 block) */}
                        <tr className="hover:bg-slate-950/20 transition-colors">
                          {activeFileTypes.length === 0 && (
                            <>
                              <td className="py-4 px-3 text-center align-middle font-bold text-slate-350 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black">
                                {dataEntrySrl}
                              </td>
                              <td className="py-4 px-4 align-middle font-bold text-slate-350 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black">
                                {department}
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-4 border-r border-slate-850 font-bold text-red-400 print:border-black">
                            Number of Mistakes
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-850 text-slate-450 print:border-black">
                            Quality, Quantity & Timeliness
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-850 font-semibold text-slate-450 print:border-black">
                            0%
                          </td>
                          
                          {/* Weightage */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={weightages['mistakes'] ?? 0}
                                  onChange={(e) => handleWeightageChange('mistakes', Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-350 print:text-black">
                                {weightages['mistakes'] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Self */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isAppraisee || isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selfScores['mistakes'] ?? 0}
                                  onChange={(e) => handleSelfScoreChange('mistakes', Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-350 print:text-black">
                                {selfScores['mistakes'] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Supervisor */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={supervisorScores['mistakes'] ?? 0}
                                  onChange={(e) => handleSupervisorScoreChange('mistakes', Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-350 print:text-black">
                                {supervisorScores['mistakes'] !== undefined ? `${supervisorScores['mistakes']}%` : '—'}
                              </span>
                            )}
                          </td>

                          {/* Comments */}
                          <td className="py-2 px-3">
                            {isSupervisorOrAdmin ? (
                              <input
                                type="text"
                                placeholder="Add feedback"
                                value={comments['mistakes'] || ''}
                                onChange={(e) => handleCommentChange('mistakes', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-700"
                              />
                            ) : (
                              <span className="text-slate-400 italic text-[11px] print:text-black">
                                {comments['mistakes'] || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* SERIAL 2: Custom Department Specific Indicators */}
                    {deptKpiSrl !== null && kpiDeptIndicators.map((indicator: string, idx: number) => {
                      const isFirst = idx === 0;
                      const key = `dept_${indicator}`;
                      const totalRows = kpiDeptIndicators.length;

                      return (
                        <tr key={key} className="hover:bg-slate-950/20 transition-colors">
                          {isFirst && (
                            <>
                              <td 
                                rowSpan={totalRows} 
                                className="py-4 px-3 text-center align-middle font-bold text-slate-355 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                              >
                                {deptKpiSrl}
                              </td>
                              <td 
                                rowSpan={totalRows} 
                                className="py-4 px-4 align-middle font-bold text-slate-355 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                              >
                                {department}
                              </td>
                            </>
                          )}

                          {/* KPI Columns */}
                          <td className="py-2.5 px-4 border-r border-slate-850 font-medium text-slate-200 print:border-black print:text-black">
                            {indicator}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-850 text-slate-400 print:border-black print:text-black">
                            Quality, Quantity & Timeliness
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-850 font-semibold text-slate-400 print:border-black print:text-black">
                            100%
                          </td>

                          {/* Weightage */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={weightages[key] ?? defaultWeightages[key] ?? 0}
                                  onChange={(e) => handleWeightageChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-355 print:text-black">
                                {weightages[key] ?? defaultWeightages[key] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Self */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isAppraisee || isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selfScores[key] ?? 0}
                                  onChange={(e) => handleSelfScoreChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold print:text-black">
                                {selfScores[key] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Supervisor */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={supervisorScores[key] ?? 0}
                                  onChange={(e) => handleSupervisorScoreChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold print:text-black">
                                {supervisorScores[key] !== undefined ? `${supervisorScores[key]}%` : '—'}
                              </span>
                            )}
                          </td>

                          {/* Comments */}
                          <td className="py-2 px-3">
                            {isSupervisorOrAdmin ? (
                              <input
                                type="text"
                                placeholder="Add feedback"
                                value={comments[key] || ''}
                                onChange={(e) => handleCommentChange(key, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-855 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-750"
                              />
                            ) : (
                              <span className="text-slate-400 italic text-[11px] print:text-black">
                                {comments[key] || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* SERIAL 3: Custom Other Department Specific Indicators */}
                    {otherDeptKpiSrl !== null && kpiOtherDeptIndicators.map((indicator: string, idx: number) => {
                      const isFirst = idx === 0;
                      const key = `other_dept_${indicator}`;
                      const totalRows = kpiOtherDeptIndicators.length;

                      return (
                        <tr key={key} className="hover:bg-slate-950/20 transition-colors">
                          {isFirst && (
                            <>
                              <td 
                                rowSpan={totalRows} 
                                className="py-4 px-3 text-center align-middle font-bold text-slate-355 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                              >
                                {otherDeptKpiSrl}
                              </td>
                              <td 
                                rowSpan={totalRows} 
                                className="py-4 px-4 align-middle font-bold text-slate-355 border-r border-slate-800 bg-slate-955/50 print:border-black print:bg-transparent print:text-black"
                              >
                                {otherDepartment}
                              </td>
                            </>
                          )}

                          {/* KPI Columns */}
                          <td className="py-2.5 px-4 border-r border-slate-850 font-medium text-slate-200 print:border-black print:text-black">
                            {indicator}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-850 text-slate-400 print:border-black print:text-black">
                            Quality, Quantity & Timeliness
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-850 font-semibold text-slate-400 print:border-black print:text-black">
                            100%
                          </td>

                          {/* Weightage */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={weightages[key] ?? defaultWeightages[key] ?? 0}
                                  onChange={(e) => handleWeightageChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-355 print:text-black">
                                {weightages[key] ?? defaultWeightages[key] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Self */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isAppraisee || isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selfScores[key] ?? 0}
                                  onChange={(e) => handleSelfScoreChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold print:text-black">
                                {selfScores[key] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Supervisor */}
                          <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={supervisorScores[key] ?? 0}
                                  onChange={(e) => handleSupervisorScoreChange(key, Number(e.target.value))}
                                  className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-slate-555 font-semibold">%</span>
                              </div>
                            ) : (
                              <span className="font-bold print:text-black">
                                {supervisorScores[key] !== undefined ? `${supervisorScores[key]}%` : '—'}
                              </span>
                            )}
                          </td>

                          {/* Comments */}
                          <td className="py-2 px-3">
                            {isSupervisorOrAdmin ? (
                              <input
                                type="text"
                                placeholder="Add feedback"
                                value={comments[key] || ''}
                                onChange={(e) => handleCommentChange(key, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-855 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-750"
                              />
                            ) : (
                              <span className="text-slate-400 italic text-[11px] print:text-black">
                                {comments[key] || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* SERIAL 3/2: Monthly Data Entry Report */}
                    {reportSrl !== null && (
                      <tr className="bg-emerald-950/15 border-t border-b border-slate-800 text-emerald-400 hover:bg-emerald-950/20 transition-colors print:bg-neutral-50 print:text-black print:border-black">
                        <td className="py-3 px-3 text-center align-middle font-bold border-r border-slate-800 print:border-black">{reportSrl}</td>
                        <td className="py-3 px-4 font-bold border-r border-slate-800 print:border-black">Monthly Data Entry Report</td>
                        <td className="py-3 px-4 font-medium border-r border-slate-850 print:border-black">Monthly Reports</td>
                        <td className="py-3 px-4 text-slate-400 border-r border-slate-850 print:border-black print:text-black">Quality, Quantity & Timeliness</td>
                        <td className="py-3 px-3 text-center font-semibold border-r border-slate-855 print:border-black">100%</td>
                        
                        {/* Weightage */}
                        <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                          {isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={weightages['monthly_reports'] ?? defaultWeightages['monthly_reports'] ?? 5}
                                onChange={(e) => handleWeightageChange('monthly_reports', Number(e.target.value))}
                                className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                              />
                              <span className="text-[10px] text-slate-555 font-semibold">%</span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {weightages['monthly_reports'] ?? defaultWeightages['monthly_reports'] ?? 5}%
                            </span>
                          )}
                        </td>

                        {/* Self */}
                        <td className="py-2 px-3 text-center border-r border-slate-855 print:border-black">
                          {isAppraisee || isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={selfScores['monthly_reports'] ?? 0}
                                onChange={(e) => handleSelfScoreChange('monthly_reports', Number(e.target.value))}
                                className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                              />
                              <span className="text-[10px] text-slate-555 font-semibold">%</span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {selfScores['monthly_reports'] ?? 0}%
                            </span>
                          )}
                        </td>

                        {/* Supervisor */}
                        <td className="py-2 px-3 text-center border-r border-slate-855 print:border-black">
                          {isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={supervisorScores['monthly_reports'] ?? 0}
                                onChange={(e) => handleSupervisorScoreChange('monthly_reports', Number(e.target.value))}
                                className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                              />
                              <span className="text-[10px] text-slate-555 font-semibold">%</span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {supervisorScores['monthly_reports'] !== undefined ? `${supervisorScores['monthly_reports']}%` : '—'}
                            </span>
                          )}
                        </td>

                        {/* Comments */}
                        <td className="py-2 px-3">
                          {isSupervisorOrAdmin ? (
                            <input
                              type="text"
                              placeholder="Add feedback"
                              value={comments['monthly_reports'] || ''}
                              onChange={(e) => handleCommentChange('monthly_reports', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-700"
                            />
                          ) : (
                            <span className="text-slate-400 italic text-[11px] print:text-black">
                              {comments['monthly_reports'] || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* SERIAL 4/3/2/1: Self Development Initiative */}
                    <tr className="bg-emerald-950/15 text-emerald-400 hover:bg-emerald-950/20 transition-colors print:bg-neutral-50 print:text-black">
                      <td className="py-3 px-3 text-center align-middle font-bold border-r border-slate-800 print:border-black">{selfDevSrl}</td>
                      <td className="py-3 px-4 font-bold border-r border-slate-800 print:border-black">Self Development Initiative</td>
                      <td className="py-3 px-4 font-medium border-r border-slate-850 print:border-black truncate max-w-xs" title={kpiSkillsJoined}>
                        {kpiSkillsJoined}
                      </td>
                      <td className="py-3 px-4 text-slate-400 border-r border-slate-850 print:border-black print:text-black">Quality, Quantity & Timeliness</td>
                      <td className="py-3 px-3 text-center font-semibold border-r border-slate-850 print:border-black">100%</td>
                      
                      {/* Weightage */}
                      <td className="py-2 px-3 text-center border-r border-slate-850 print:border-black">
                        {isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={weightages['self_development'] ?? defaultWeightages['self_development'] ?? 5}
                              onChange={(e) => handleWeightageChange('self_development', Number(e.target.value))}
                              className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                            />
                            <span className="text-[10px] text-slate-555 font-semibold">%</span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {weightages['self_development'] ?? defaultWeightages['self_development'] ?? 5}%
                          </span>
                        )}
                      </td>

                      {/* Self */}
                      <td className="py-2 px-3 text-center border-r border-slate-855 print:border-black">
                        {isAppraisee || isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={selfScores['self_development'] ?? 0}
                              onChange={(e) => handleSelfScoreChange('self_development', Number(e.target.value))}
                              className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-blue-500"
                            />
                            <span className="text-[10px] text-slate-555 font-semibold">%</span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {selfScores['self_development'] ?? 0}%
                          </span>
                        )}
                      </td>

                      {/* Supervisor */}
                      <td className="py-2 px-3 text-center border-r border-slate-855 print:border-black">
                        {isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={supervisorScores['self_development'] ?? 0}
                              onChange={(e) => handleSupervisorScoreChange('self_development', Number(e.target.value))}
                              className="w-14 bg-slate-900 border border-slate-800 rounded-lg py-1 text-center font-bold text-white focus:outline-hidden focus:border-emerald-500"
                            />
                            <span className="text-[10px] text-slate-555 font-semibold">%</span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {supervisorScores['self_development'] !== undefined ? `${supervisorScores['self_development']}%` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Comments */}
                      <td className="py-2 px-3">
                        {isSupervisorOrAdmin ? (
                          <input
                            type="text"
                            placeholder="Add feedback"
                            value={comments['self_development'] || ''}
                            onChange={(e) => handleCommentChange('self_development', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-700 focus:outline-hidden focus:border-slate-700"
                          />
                        ) : (
                          <span className="text-slate-400 italic text-[11px] print:text-black">
                            {comments['self_development'] || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })()}
              <tr className="bg-slate-900/90 font-bold border-t-2 border-slate-800 text-white print:bg-neutral-100 print:text-black print:border-black print:border-t">
                <td colSpan={5} className="py-3 px-4 text-right border-r border-slate-800 uppercase tracking-wider print:border-black">
                  Total Weightage (Max 100%)
                </td>
                <td className="py-3 px-3 text-center border-r border-slate-850 font-black text-blue-400 print:border-black print:text-black">
                  {totals.weightage.toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-center border-r border-slate-850 font-black text-blue-400 print:border-black print:text-black">
                  {totals.self.toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-center border-r border-slate-850 font-black text-emerald-400 print:border-black print:text-black">
                  {totals.supervisor.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-slate-400 font-normal italic text-[11px] print:text-black">
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote notes */}
        <div className="space-y-1.5 pt-4 text-[11px] text-slate-450 leading-relaxed border-t border-slate-900 print:border-black print:text-black">
          <p className="font-semibold text-slate-350 print:text-black">My Manager has discussed with me the objective set for my performance evaluation & I agree on the same.</p>
          <p className="italic">Note: Measurable Criteria: Time, Cost, Value, Quality, Quantity</p>
        </div>

        {/* 5. SIGNATURES ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-900 print:grid-cols-2 print:border-black">
          {/* Appraisee Signature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 print:hidden">
              <input
                type="checkbox"
                id="appraisee-sign-chk"
                checked={appraiseeSigned}
                disabled={!canEditAppraiseeFields}
                onChange={(e) => handleAppraiseeSignChange(e.target.checked)}
                className="h-4.5 w-4.5 rounded-lg border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="appraisee-sign-chk" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                Sign Assessment (Appraisee)
              </label>
            </div>
            
            <div className="border-t border-slate-800/80 pt-2 space-y-1 w-72 print:border-black print:border-t">
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wide print:text-black min-h-[16px]">
                {appraiseeSigned ? (targetStaff.full_name || targetStaff.username) : ''}
              </div>
              <div className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider print:text-black">
                Appraisee Signature {appraiseeSigned && appraiseeSignDate && `| Date: ${appraiseeSignDate}`}
              </div>
            </div>
          </div>

          {/* Appraiser Signature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 print:hidden">
              <input
                type="checkbox"
                id="appraiser-sign-chk"
                checked={appraiserSigned}
                disabled={!isSupervisorOrAdmin}
                onChange={(e) => handleAppraiserSignChange(e.target.checked)}
                className="h-4.5 w-4.5 rounded-lg border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="appraiser-sign-chk" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                Sign Assessment (Appraiser)
              </label>
            </div>

            <div className="border-t border-slate-800/80 pt-2 space-y-1 w-72 print:border-black print:border-t">
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wide print:text-black min-h-[16px]">
                {appraiserSigned ? appraiserName : ''}
              </div>
              <div className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider print:text-black">
                Appraiser Signature {appraiserSigned && appraiserSignDate && `| Date: ${appraiserSignDate}`}
              </div>
          </div>
        </div>
      </div>
    </div>

      {/* External Appraiser Portal Modal */}
      {showViewKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in print:hidden">
          <div className="bg-slate-950 border border-slate-850 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-white">Evaluate Appraisee KPI</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Select a user who has designated you as Appraiser, or search by Codename.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowViewKpiModal(false)}
                className="text-slate-500 hover:text-slate-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Codename Search */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Search Appraisee by Codename
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. KI1024"
                  value={appraiseeSearchText}
                  onChange={(e) => setAppraiseeSearchText(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 uppercase focus:outline-hidden focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLoadAppraiseeByCodename(appraiseeSearchText);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleLoadAppraiseeByCodename(appraiseeSearchText)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Load Sheet
                </button>
              </div>
            </div>

            {/* Assigned list */}
            <div className="border-t border-slate-900 pt-3 space-y-2">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assigned Appraisees ({monthYearKey})</h5>
              {searchingAppraisee ? (
                <div className="flex items-center justify-center py-4 text-slate-500 gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-xs">Searching database...</span>
                </div>
              ) : assignedAppraisees.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No users have designated you as Appraiser in this month's KPI sheets yet.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-slate-900/60 pr-1">
                  {assignedAppraisees.map((appraisee) => (
                    <button
                      key={appraisee.id}
                      type="button"
                      onClick={() => {
                        setEvaluatorModeProfile(appraisee);
                        setShowViewKpiModal(false);
                        toast.success(`Loaded KPI sheet for ${appraisee.full_name || appraisee.username} in Evaluator Mode.`);
                      }}
                      className="w-full text-left py-2 px-2.5 rounded-lg hover:bg-slate-900/60 hover:text-white text-slate-350 transition-colors flex justify-between items-center text-xs font-medium cursor-pointer"
                    >
                      <span>{appraisee.full_name || appraisee.username}</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{appraisee.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => {
                  setEvaluatorModeProfile(null);
                  setShowViewKpiModal(false);
                  toast.success("Reset view to your own KPI sheet.");
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset to Self
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
