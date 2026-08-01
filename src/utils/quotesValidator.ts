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
