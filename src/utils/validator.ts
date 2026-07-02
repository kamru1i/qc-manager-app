/**
 * Input Validation Utilities
 * All validations return { isValid, errors } format
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Helper to safely parse numbers
const parseNum = (val: string | number | undefined, defaultVal: number = 0): number => {
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
};

export const validator = {
  // Leave Form Validation
  validateLeaveForm: (data: {
    date?: string;
    leaveType?: string;
    signInTime?: string;
    signOutTime?: string;
    leaveHour?: string;
    reserveHoliday?: string;
  }): ValidationResult => {
    const errors: string[] = [];

    if (!data.date) {
      errors.push('Please select a date.');
    } else {
      // Date format validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        errors.push('Please use the correct date format (YYYY-MM-DD).');
      }
      // Date should not be in future
      const selectedDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        errors.push('Future dates cannot be selected.');
      }
    }

    if (!data.leaveType) {
      errors.push('Please select a leave type.');
    } else {
      const validTypes = ['Full Leave', 'Short Leave', 'Overtime'];
      if (!validTypes.includes(data.leaveType)) {
        errors.push('Invalid leave type.');
      }
    }

    // Time validation only for Short Leave and Overtime
    if (
      data.leaveType === 'Short Leave' ||
      data.leaveType === 'Overtime'
    ) {
      if (!data.signInTime) {
        errors.push('Please select a sign-in time.');
      } else if (!/^\d{2}:\d{2}$/.test(data.signInTime)) {
        errors.push('Please specify sign-in time in the correct format (HH:MM).');
      }

      if (!data.signOutTime) {
        errors.push('Please select a sign-out time.');
      } else if (!/^\d{2}:\d{2}$/.test(data.signOutTime)) {
        errors.push('Please specify sign-out time in the correct format (HH:MM).');
      }

      // Check if sign out time is after sign in time
      if (data.signInTime && data.signOutTime) {
        const [inH, inM] = data.signInTime.split(':').map(Number);
        const [outH, outM] = data.signOutTime.split(':').map(Number);
        const inMins = inH * 60 + inM;
        const outMins = outH * 60 + outM;

        if (outMins <= inMins) {
          errors.push('Sign-out time must be after sign-in time.');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Profile Form Validation
  validateProfileForm: (data: {
    fullName?: string;
    jobRole?: string;
    workingHours?: string | number;
    breakTime?: string | number;
    signInTime?: string;
    signOutTime?: string;
  }): ValidationResult => {
    const errors: string[] = [];

    if (!data.fullName || data.fullName.trim() === '') {
      errors.push('Please enter a full name.');
    } else if (data.fullName.length < 2) {
      errors.push('Name must be at least 2 characters.');
    } else if (data.fullName.length > 100) {
      errors.push('Name cannot exceed 100 characters.');
    }

    if (!data.jobRole || data.jobRole.trim() === '') {
      errors.push('Please enter a job role.');
    }

    const workingHrs = parseNum(data.workingHours);
    if (isNaN(workingHrs) || workingHrs < 1 || workingHrs > 24) {
      errors.push('Working hours must be between 1 and 24 hours.');
    }

    const breakHrs = parseNum(data.breakTime);
    if (isNaN(breakHrs) || breakHrs < 0 || breakHrs > 480) {
      errors.push('Break time must be between 0 and 480 minutes.');
    }

    if (data.signInTime && !/^\d{2}:\d{2}$/.test(data.signInTime)) {
      errors.push('Please specify sign-in time in the correct format (HH:MM).');
    }

    if (data.signOutTime && !/^\d{2}:\d{2}$/.test(data.signOutTime)) {
      errors.push('Please specify sign-out time in the correct format (HH:MM).');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // User Creation Validation
  validateCreateUserForm: (data: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    username?: string;
    fullName?: string;
    role?: string;
  }): ValidationResult => {
    const errors: string[] = [];

    if (!data.email || data.email.trim() === '') {
      errors.push('Please enter an email.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Please enter a valid email address.');
    }

    if (!data.password || data.password.length === 0) {
      errors.push('Please enter a password.');
    } else if (data.password.length < 6 || data.password.length > 12) {
      errors.push('Password must be between 6 and 12 characters.');
    }

    if (data.password !== data.confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (!data.username || data.username.trim() === '') {
      errors.push('Please enter a username.');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
      errors.push('Username can only contain letters, numbers, hyphens, and underscores.');
    }

    if (!data.fullName || data.fullName.trim() === '') {
      errors.push('Please enter a full name.');
    }

    if (!data.role || !['admin', 'user', 'supervisor'].includes(data.role)) {
      errors.push('Please select a valid role.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Password Strength Validation
  validatePassword: (password: string): ValidationResult => {
    const errors: string[] = [];

    if (!password) {
      errors.push('Please enter a password.');
    } else if (password.length < 4) {
      errors.push('Password must be at least 4 characters.');
    } else if (password.length > 128) {
      errors.push('Password cannot exceed 128 characters.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Username Syntax Validation
  validateUsername: (username: string): ValidationResult => {
    const errors: string[] = [];

    if (!username || username.trim() === '') {
      errors.push('Please enter a username.');
    } else if (username.length < 2) {
      errors.push('Username must be at least 2 characters.');
    } else if (username.length > 50) {
      errors.push('Username cannot exceed 50 characters.');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, hyphens, and underscores.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Time String Format Validation
  validateTimeFormat: (timeStr: string): ValidationResult => {
    const errors: string[] = [];

    if (!timeStr) {
      errors.push('Please enter a time.');
    } else if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      errors.push('Please use the correct time format (HH:MM).');
    } else {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (hours < 0 || hours > 23) {
        errors.push('Hours must be between 0 and 23.');
      }
      if (minutes < 0 || minutes > 59) {
        errors.push('Minutes must be between 0 and 59.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Date String Format Validation
  validateDateFormat: (dateStr: string): ValidationResult => {
    const errors: string[] = [];

    if (!dateStr) {
      errors.push('Please enter a date.');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.push('Please use the correct date format (YYYY-MM-DD).');
    } else {
      try {
        new Date(dateStr);
      } catch {
        errors.push('Invalid date.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};
