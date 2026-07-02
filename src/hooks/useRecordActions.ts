'use client';

import { useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile, RecordItem, FileType } from '@/types';
import {
  saveOfflineRecord,
  saveOfflineUpdate,
  saveOfflineDelete,
  getOfflineRecords,
  deleteOfflineRecord,
  setCacheData,
  getCacheData,
  mergeCacheData,
  updateOfflineRecordAction,
} from '@/utils/quotesOfflineSync';

interface UseRecordActionsOptions {
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
  showToast: (type: 'success' | 'error', text: string) => void;
  logActivity: (actionType: string, targetId: string | null, details: string) => Promise<void>;
  fetchRecords: (forceServer?: boolean) => Promise<void>;
  fetchAvailableDates: () => Promise<void>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  updateLastActivity: () => void;
}

export const useRecordActions = ({
  sessionUser,
  profile,
  showToast,
  logActivity,
  fetchRecords,
  fetchAvailableDates,
  setSubmitting,
  updateLastActivity,
}: UseRecordActionsOptions) => {

  // Add a new Quote or Sales Entry
  const addRecord = useCallback(async (
    fileName: string,
    branchName: string,
    codename: string,
    fileType: FileType,
    customUserId?: string,
    customSubmittedAt?: string
  ) => {
    if (!sessionUser) return false;
    setSubmitting(true);
    updateLastActivity();

    try {
      const targetUserId = customUserId || sessionUser.id;
      const targetSubmittedAt = customSubmittedAt || new Date().toISOString();

      if (!navigator.onLine) {
        // Save to offline outbox queue
        const newOfflineRecord = {
          user_id: targetUserId,
          file_name: fileName,
          branch_name: branchName.toUpperCase().trim(),
          codename: codename.toUpperCase().trim(),
          file_type: fileType,
          submitted_at: targetSubmittedAt
        };

        const localId = await saveOfflineRecord(newOfflineRecord);

        // Optimistically add to local cache records_cache
        const cachedRecordItem: RecordItem = {
          id: localId,
          ...newOfflineRecord,
          created_at: new Date().toISOString(),
          profiles: {
            username: codename.toUpperCase().trim(),
            full_name: profile?.full_name || null
          }
        };
        await mergeCacheData('records_cache', [cachedRecordItem]);

        await fetchRecords(true);
        await fetchAvailableDates();
        showToast('success', 'Saved offline! Data will sync when online.');
        setSubmitting(false);
        return true;
      }

      const { error } = await supabase
        .from('records')
        .insert({
          user_id: targetUserId,
          file_name: fileName,
          branch_name: branchName.toUpperCase().trim(),
          codename: codename.toUpperCase().trim(),
          file_type: fileType,
          submitted_at: targetSubmittedAt
        });

      if (error) throw error;

      await fetchRecords(true);
      await fetchAvailableDates();
      showToast('success', 'Data entry saved successfully!');
      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Error adding record:', err);
      showToast('error', 'Failed to save data: ' + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
      return false;
    }
  }, [sessionUser, profile, showToast, fetchRecords, fetchAvailableDates, setSubmitting, updateLastActivity]);

  // Delete a Record
  const deleteRecord = useCallback(async (id: string) => {
    if (!sessionUser) return false;
    updateLastActivity();

    let recordDetails = `ID ${id}`;
    try {
      const cached = await getCacheData<RecordItem>('records_cache');
      const targetRecord = cached.find(r => r.id === id);
      if (targetRecord) {
        recordDetails = `'${targetRecord.file_name}' (${targetRecord.file_type} for ${targetRecord.branch_name}) by ${targetRecord.codename}`;
      }
    } catch (cacheErr) {
      console.error('Failed to read cache for audit log info:', cacheErr);
    }
    try {
      if (!navigator.onLine) {
        // Check if the record is a pending offline insert
        const pending = await getOfflineRecords();
        const pendingInsert = pending.find(r => r.localId === id || r.id === id);

        if (pendingInsert && pendingInsert.action === 'insert') {
          if (pendingInsert.localId) {
            await deleteOfflineRecord(pendingInsert.localId);
          }
        } else {
          // Server record, queue a deletion action
          await saveOfflineDelete(id, sessionUser.id);
        }

        // Remove from local cache optimistically
        const cached = await getCacheData<RecordItem>('records_cache');
        const updatedCache = cached.filter(r => r.id !== id);
        await setCacheData('records_cache', updatedCache);

        await fetchRecords(true);
        await fetchAvailableDates();
        showToast('success', 'Deleted offline! Data will sync when online.');
        return true;
      }

      const { error } = await supabase
        .from('records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Audit Log
      await logActivity(
        'DELETE_RECORD',
        id,
        `Deleted record: ${recordDetails}`
      );

      // Optimistically remove from local cache immediately
      const cached = await getCacheData<RecordItem>('records_cache');
      const updatedCache = cached.filter(r => r.id !== id);
      await setCacheData('records_cache', updatedCache);

      await fetchRecords(true);
      await fetchAvailableDates();
      showToast('success', 'Record deleted successfully!');
      return true;
    } catch (err) {
      console.error('Error deleting record:', err);
      showToast('error', 'Failed to delete record: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }, [sessionUser, showToast, logActivity, fetchRecords, fetchAvailableDates, updateLastActivity]);

  // Delete multiple records (Bulk Delete)
  const deleteRecords = useCallback(async (ids: string[]) => {
    if (!sessionUser) return false;
    updateLastActivity();

    // Cache info resolution for audit logging
    let deletedDetails = `${ids.length} records`;
    try {
      const cached = await getCacheData<RecordItem>('records_cache');
      const targetRecords = cached.filter(r => ids.includes(r.id));
      if (targetRecords.length > 0) {
        deletedDetails = targetRecords
          .map(r => `'${r.file_name}' (${r.file_type} for ${r.branch_name})`)
          .join(', ');
      }
    } catch (cacheErr) {
      console.error('Failed to read cache for audit log info:', cacheErr);
    }

    try {
      if (!navigator.onLine) {
        showToast('error', 'This action requires an active internet connection.');
        return false;
      }

      const { error } = await supabase
        .from('records')
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Audit Log
      await logActivity(
        'DELETE_RECORD',
        null,
        `Deleted ${ids.length} records in bulk: ${deletedDetails}`
      );

      // Optimistically remove from local cache immediately
      const cached = await getCacheData<RecordItem>('records_cache');
      const updatedCache = cached.filter(r => !ids.includes(r.id));
      await setCacheData('records_cache', updatedCache);

      await fetchRecords(true);
      await fetchAvailableDates();
      showToast('success', `${ids.length} records deleted successfully!`);
      return true;
    } catch (err) {
      console.error('Error deleting records in bulk:', err);
      showToast('error', 'Failed to delete records: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }, [sessionUser, showToast, logActivity, fetchRecords, fetchAvailableDates, updateLastActivity]);

  // Update/Edit a Record
  const updateRecord = useCallback(async (
    id: string,
    fileName: string,
    branchName: string,
    codename: string,
    fileType: FileType,
    submittedAt?: string
  ) => {
    if (!sessionUser) return false;
    setSubmitting(true);
    updateLastActivity();

    let oldDetails = `ID ${id}`;
    try {
      const cached = await getCacheData<RecordItem>('records_cache');
      const targetRecord = cached.find(r => r.id === id);
      if (targetRecord) {
        oldDetails = `'${targetRecord.file_name}' (${targetRecord.file_type} for ${targetRecord.branch_name})`;
      }
    } catch (cacheErr) {
      console.error('Failed to read cache for audit log info:', cacheErr);
    }
    try {
      const updates: {
        file_name: string;
        branch_name: string;
        codename: string;
        file_type: FileType;
        submitted_at?: string;
      } = {
        file_name: fileName,
        branch_name: branchName.toUpperCase().trim(),
        codename: codename.toUpperCase().trim(),
        file_type: fileType
      };

      if (submittedAt) {
        updates.submitted_at = submittedAt;
      }

      if (!navigator.onLine) {
        const pending = await getOfflineRecords();
        const pendingInsert = pending.find(r => r.localId === id || r.id === id);

        if (pendingInsert && pendingInsert.action === 'insert') {
          // Edit the pending insert record in-place in outbox
          if (pendingInsert.localId) {
            await updateOfflineRecordAction(pendingInsert.localId, {
              file_name: fileName,
              branch_name: branchName.toUpperCase().trim(),
              codename: codename.toUpperCase().trim(),
              file_type: fileType,
              submitted_at: submittedAt || pendingInsert.submitted_at
            });
          }
        } else {
          // Server record, queue an update action
          await saveOfflineUpdate(id, sessionUser.id, updates);
        }

        // Update local cache optimistically
        const cached = await getCacheData<RecordItem>('records_cache');
        const updatedCache = cached.map(r => {
          if (r.id === id) {
            return {
              ...r,
              ...updates,
              profiles: {
                username: codename.toUpperCase().trim(),
                full_name: r.profiles?.full_name || null
              }
            };
          }
          return r;
        });
        await setCacheData('records_cache', updatedCache);

        await fetchRecords(true);
        await fetchAvailableDates();
        showToast('success', 'Updated offline! Data will sync when online.');
        setSubmitting(false);
        return true;
      }

      const { error } = await supabase
        .from('records')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Audit Log
      await logActivity(
        'UPDATE_RECORD',
        id,
        `Updated record ${oldDetails} -> '${fileName}' (${fileType} for ${branchName.toUpperCase().trim()})`
      );

      await fetchRecords(true);
      await fetchAvailableDates();
      showToast('success', 'Record updated successfully!');
      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Error updating record:', err);
      showToast('error', 'Failed to update record: ' + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
      return false;
    }
  }, [sessionUser, showToast, logActivity, fetchRecords, fetchAvailableDates, setSubmitting, updateLastActivity]);

  const bulkUpdateRecords = useCallback(async (
    updatesMap: Record<string, Partial<RecordItem>>
  ) => {
    if (!sessionUser) return false;
    const recordIds = Object.keys(updatesMap);
    if (recordIds.length === 0) return true;

    setSubmitting(true);
    updateLastActivity();

    try {
      if (!navigator.onLine) {
        const pending = await getOfflineRecords();
        
        for (const id of recordIds) {
          const updates = updatesMap[id];
          const dbUpdates: any = {};
          if (updates.file_name !== undefined) dbUpdates.file_name = updates.file_name;
          if (updates.branch_name !== undefined) dbUpdates.branch_name = updates.branch_name.toUpperCase().trim();
          if (updates.codename !== undefined) dbUpdates.codename = updates.codename.toUpperCase().trim();
          if (updates.file_type !== undefined) dbUpdates.file_type = updates.file_type;
          if (updates.submitted_at !== undefined) dbUpdates.submitted_at = updates.submitted_at;

          const pendingInsert = pending.find(r => r.localId === id || r.id === id);
          if (pendingInsert && pendingInsert.action === 'insert') {
            if (pendingInsert.localId) {
              await updateOfflineRecordAction(pendingInsert.localId, dbUpdates);
            }
          } else {
            await saveOfflineUpdate(id, sessionUser.id, dbUpdates);
          }
        }

        // Update local cache optimistically
        const cached = await getCacheData<RecordItem>('records_cache');
        const updatedCache = cached.map(r => {
          if (updatesMap[r.id]) {
            const rowUpdates = updatesMap[r.id];
            const dbUpdates: any = {};
            if (rowUpdates.file_name !== undefined) dbUpdates.file_name = rowUpdates.file_name;
            if (rowUpdates.branch_name !== undefined) dbUpdates.branch_name = rowUpdates.branch_name.toUpperCase().trim();
            if (rowUpdates.codename !== undefined) dbUpdates.codename = rowUpdates.codename.toUpperCase().trim();
            if (rowUpdates.file_type !== undefined) dbUpdates.file_type = rowUpdates.file_type;
            if (rowUpdates.submitted_at !== undefined) dbUpdates.submitted_at = rowUpdates.submitted_at;

            return {
              ...r,
              ...dbUpdates,
              profiles: {
                username: dbUpdates.codename || (r.profiles?.username || r.codename),
                full_name: r.profiles?.full_name || null
              }
            };
          }
          return r;
        });
        await setCacheData('records_cache', updatedCache);

        await fetchRecords(true);
        await fetchAvailableDates();
        showToast('success', `Updated ${recordIds.length} records offline!`);
        setSubmitting(false);
        return true;
      }

      // Online: Run all updates in parallel
      const updatePromises = recordIds.map(async (id) => {
        const rowUpdates = updatesMap[id];
        const dbUpdates: any = {};
        if (rowUpdates.file_name !== undefined) dbUpdates.file_name = rowUpdates.file_name;
        if (rowUpdates.branch_name !== undefined) dbUpdates.branch_name = rowUpdates.branch_name.toUpperCase().trim();
        if (rowUpdates.codename !== undefined) dbUpdates.codename = rowUpdates.codename.toUpperCase().trim();
        if (rowUpdates.file_type !== undefined) dbUpdates.file_type = rowUpdates.file_type;
        if (rowUpdates.submitted_at !== undefined) dbUpdates.submitted_at = rowUpdates.submitted_at;

        const { error } = await supabase
          .from('records')
          .update(dbUpdates)
          .eq('id', id);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      // Bulk Audit Log
      await logActivity(
        'UPDATE_RECORD',
        recordIds[0],
        `Bulk updated ${recordIds.length} records in grid edit`
      );

      await fetchRecords(true);
      await fetchAvailableDates();
      showToast('success', `Successfully saved ${recordIds.length} changes!`);
      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Error bulk updating records:', err);
      showToast('error', 'Failed to save changes: ' + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
      return false;
    }
  }, [sessionUser, showToast, logActivity, fetchRecords, fetchAvailableDates, setSubmitting, updateLastActivity]);

  return {
    addRecord,
    deleteRecord,
    deleteRecords,
    updateRecord,
    bulkUpdateRecords,
  };
};
