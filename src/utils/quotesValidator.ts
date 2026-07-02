interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validator = {
  // Validate record form submission
  validateRecordForm: (data: {
    file_name?: string;
    branch_name?: string;
    codename?: string;
    file_type?: string;
  }): ValidationResult => {
    const errors: string[] = [];

    if (!data.file_name || data.file_name.trim() === '') {
      errors.push('Please enter the file name.');
    }
    if (!data.branch_name || data.branch_name.trim() === '') {
      errors.push('Please enter the branch name.');
    }
    if (!data.codename || data.codename.trim() === '') {
      errors.push('Please enter the codename.');
    }
    if (!data.file_type) {
      errors.push('Please select a file category/type.');
    } else {
      const validTypes = [
        'Quote',
        'Requote',
        'Requote Van',
        'Requote Bike',
        'Review',
        'Review Van',
        'Review Bike',
        'Individual Review',
        'Other Site',
        'Van',
        'Bike',
        'Sale'
      ];
      if (!validTypes.includes(data.file_type)) {
        errors.push('Invalid file type selected.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Validate admin user creation
  validateCreateUserForm: (data: {
    username?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
    role?: string;
  }): ValidationResult => {
    const errors: string[] = [];

    if (!data.username || data.username.trim() === '') {
      errors.push('Please enter the codename.');
    } else if (data.username.trim().length < 3) {
      errors.push('Codename must be at least 3 characters long.');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
      errors.push('Codename can only contain English letters, numbers, hyphens, and underscores.');
    }

    if (!data.password || data.password.length === 0) {
      errors.push('Please enter the password.');
    } else if (data.password.length < 4) {
      errors.push('Password must be at least 4 characters long.');
    }

    if (data.password !== data.confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (!data.role || !['admin', 'user'].includes(data.role)) {
      errors.push('Please select a valid role.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Validate password strength (change password screen)
  validatePassword: (password: string): ValidationResult => {
    const errors: string[] = [];

    if (!password) {
      errors.push('Please enter the new password.');
    } else if (password.length < 4) {
      errors.push('Password must be at least 4 characters long.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Validate password strength for user onboarding first-time setup (6 to 12 characters)
  validateOnboardingPassword: (password: string): ValidationResult => {
    const errors: string[] = [];

    if (!password) {
      errors.push('Please enter the new password.');
    } else if (password.length < 6 || password.length > 12) {
      errors.push('Password must be between 6 and 12 characters.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};
