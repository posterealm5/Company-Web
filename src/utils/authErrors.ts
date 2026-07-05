interface FriendlyError {
  title: string;
  message: string;
}

export function mapAuthError(err: any): FriendlyError {
  if (!err) {
    return {
      title: 'Something went wrong',
      message: 'Please try again.',
    };
  }

  // Extract properties
  const code = err.code || (err as any).error_description || '';
  const status = err.status || 0;
  const rawMessage = err.message || String(err);
  const message = rawMessage.toLowerCase();

  // Rate limiting checks
  if (
    status === 429 ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('email rate limit')
  ) {
    return {
      title: 'Too Many Attempts',
      message: "You've made several authentication requests in a short period. Please wait a few minutes before trying again.",
    };
  }

  // 1. Check specific Supabase error codes
  if (code === 'invalid_credentials') {
    // Check if the message indicates user not found
    if (message.includes('user not found') || message.includes('no user')) {
      return {
        title: 'No account found',
        message: 'No account exists with this email.',
      };
    }
    return {
      title: 'Incorrect password',
      message: 'Please enter the correct password.',
    };
  }

  if (code === 'email_exists' || code === 'user_already_exists') {
    return {
      title: 'Account already exists',
      message: 'An account with this email already exists.',
    };
  }

  if (code === 'weak_password') {
    return {
      title: 'Weak password',
      message: 'Password must contain at least 8 characters.',
    };
  }

  if (code === 'validation_failed') {
    if (message.includes('email')) {
      return {
        title: 'Invalid email',
        message: 'Please enter a valid email address.',
      };
    }
  }

  // 2. Check HTTP status code
  if (status === 400) {
    if (message.includes('invalid claim') || message.includes('invalid credentials') || message.includes('grant')) {
      return {
        title: 'Incorrect password',
        message: 'Please enter the correct password.',
      };
    }
    if (message.includes('already registered') || message.includes('already exists')) {
      return {
        title: 'Account already exists',
        message: 'An account with this email already exists.',
      };
    }
    if (message.includes('password should be') || message.includes('weak password')) {
      return {
        title: 'Weak password',
        message: 'Password must contain at least 8 characters.',
      };
    }
  }

  // 3. Fallback to message content checking
  if (message.includes('wrong password') || message.includes('incorrect password')) {
    return {
      title: 'Incorrect password',
      message: 'Please enter the correct password.',
    };
  }

  if (message.includes('user not found') || message.includes('no account exists') || message.includes('no user exists')) {
    return {
      title: 'No account found',
      message: 'No account exists with this email.',
    };
  }

  if (message.includes('already registered') || message.includes('already exists') || message.includes('email_already_exists')) {
    return {
      title: 'Account already exists',
      message: 'An account with this email already exists.',
    };
  }

  if (message.includes('weak password') || message.includes('password should be at least') || message.includes('password must contain')) {
    return {
      title: 'Weak password',
      message: 'Password must contain at least 8 characters.',
    };
  }

  if (message.includes('invalid email') || message.includes('invalid_email') || message.includes('email address is invalid')) {
    return {
      title: 'Invalid email',
      message: 'Please enter a valid email address.',
    };
  }

  if (
    message.includes('popup_closed_by_user') || 
    message.includes('popup closed') || 
    message.includes('cancelled') || 
    message.includes('sign in was cancelled') ||
    message.includes('user_cancelled')
  ) {
    return {
      title: 'Google Sign In Cancelled',
      message: 'Sign in was cancelled.',
    };
  }

  if (
    message.includes('failed to fetch') || 
    message.includes('network') || 
    message.includes('connection') || 
    message.includes('timeout')
  ) {
    return {
      title: 'Connection problem',
      message: 'Please try again.',
    };
  }

  return {
    title: 'Something went wrong',
    message: 'Please try again.',
  };
}
