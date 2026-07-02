/**
 * Error Handler Utility
 * Centralized error management with user-friendly English messages
 */

interface ErrorInfo {
  code: string;
  userMessage: string;
  technicalMessage?: string;
  severity: 'error' | 'warning' | 'info';
}

export const errorHandler = {
  // Error Messages Mapping
  errorMessages: {
    // Authentication Errors
    'auth_invalid_credentials': 'Invalid username or password.',
    'auth_user_not_found': 'This user does not exist.',
    'auth_invalid_token': 'Session expired. Please log in again.',
    'auth_email_exists': 'This email is already in use.',
    'auth_weak_password': 'Password is too weak.',

    // Database Errors
    'db_duplicate_key': 'This entry already exists.',
    'db_unique_violation': 'This value is already in use.',
    'db_not_found': 'Requested data was not found.',
    'db_permission_denied': 'You do not have permission to perform this action.',

    // Network Errors
    'network_timeout': 'Connection timed out. Please try again.',
    'network_offline': 'No internet connection.',
    'network_error': 'Network error. Please try again.',

    // Validation Errors
    'validation_required': 'This field is required.',
    'validation_format': 'Invalid format.',
    'validation_range': 'Value out of range.',

    // Server Errors
    'server_internal': 'Internal server error. Please try again later.',
    'server_unavailable': 'Service is currently unavailable.',
    'server_maintenance': 'Service is down for maintenance.',

    // General Errors
    'unknown': 'Something went wrong. Please try again.',
    'operation_failed': 'Operation failed.',
  } as Record<string, string>,

  /**
   * Handle Supabase Errors
   */
  handleSupabaseError: (error: unknown): ErrorInfo => {
    const err = error as { code?: string | number; message?: string } | null | undefined;
    const technicalMessage = err?.message || (error ? String(error) : '');

    // Duplicate key error
    if (err?.code === '23505' || err?.message?.includes('duplicate')) {
      return {
        code: 'db_duplicate_key',
        userMessage: 'This entry already exists.',
        technicalMessage,
        severity: 'error'
      };
    }

    // Permission denied
    if (err?.code === '42501' || err?.message?.includes('permission')) {
      return {
        code: 'db_permission_denied',
        userMessage: 'You do not have permission to perform this action.',
        technicalMessage,
        severity: 'error'
      };
    }

    // Foreign key constraint
    if (err?.code === '23503' || err?.message?.includes('foreign')) {
      return {
        code: 'db_not_found',
        userMessage: 'Associated record was not found.',
        technicalMessage,
        severity: 'error'
      };
    }

    // Default Supabase error
    return {
      code: 'server_error',
      userMessage: err?.message || 'A database error occurred.',
      technicalMessage,
      severity: 'error'
    };
  },

  /**
   * Handle Network Errors
   */
  handleNetworkError: (error: unknown): ErrorInfo => {
    const err = error as { code?: string | number; message?: string } | null | undefined;
    const message = err?.message || '';

    if (message.includes('timeout') || err?.code === 'ECONNABORTED') {
      return {
        code: 'network_timeout',
        userMessage: 'Connection timed out. Please try again.',
        technicalMessage: message,
        severity: 'error'
      };
    }

    if (!navigator.onLine) {
      return {
        code: 'network_offline',
        userMessage: 'No internet connection.',
        technicalMessage: message,
        severity: 'error'
      };
    }

    return {
      code: 'network_error',
      userMessage: 'Network error. Please try again.',
      technicalMessage: message,
      severity: 'error'
    };
  },

  /**
   * General Error Handler
   */
  handleError: (error: unknown): ErrorInfo => {
    const err = error as { code?: string | number; message?: string } | null | undefined;
    
    // Supabase error
    if (err?.code && typeof err.code === 'string') {
      return errorHandler.handleSupabaseError(error);
    }

    // Network error
    if (err?.message?.includes('fetch') || !navigator.onLine) {
      return errorHandler.handleNetworkError(error);
    }

    // Known error message
    const message = err?.message || '';
    for (const [key, value] of Object.entries(errorHandler.errorMessages)) {
      if (message.toLowerCase().includes(key)) {
        return {
          code: key,
          userMessage: value,
          technicalMessage: message,
          severity: 'error'
        };
      }
    }

    // Default error
    return {
      code: 'unknown',
      userMessage: 'Something went wrong. Please try again.',
      technicalMessage: message || (error instanceof Error ? error.message : String(error)),
      severity: 'error'
    };
  },

  /**
   * Get User Friendly Message
   */
  getUserMessage: (code: string): string => {
    return errorHandler.errorMessages[code] || errorHandler.errorMessages['unknown'];
  },

  /**
   * Log context error in development
   */
  logError: (error: unknown, context?: string): void => {
    if (typeof window !== 'undefined' && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
      console.error(`[Error] ${context || 'Unknown context'}:`, error);
    }
  },

  /**
   * Success Message Helper
   */
  getSuccessMessage: (action: string): string => {
    const messages: Record<string, string> = {
      'create': 'Successfully created.',
      'update': 'Successfully updated.',
      'delete': 'Successfully deleted.',
      'approve': 'Successfully approved.',
      'reject': 'Successfully rejected.',
      'submit': 'Successfully submitted.',
      'sync': 'Successfully synced.',
      'export': 'Successfully exported.',
    };
    return messages[action] || 'Successfully completed.';
  }
};
