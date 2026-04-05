import { Disclosure } from '@headlessui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';  // FIXED: Import for navigation
import { useSelector } from 'react-redux';  // FIXED: Import for state access
import LoginForm from './loginForm.tsx';
import UserGrid from './userManagement.tsx';
import { selectAuth } from '../../store/slices/auth.ts';  // FIXED: Import selector (adjust path if needed)

Disclosure;  // Unused? Remove if not needed

export default function LoginPage() {
  const [getLock, setLock] = useState<any>(null);
  const [autoLoginNonce, setAutoLoginNonce] = useState(0);
  const [deleteUser, setdeleteUser] = useState('');
  const navigate = useNavigate();  // FIXED: Hook for programmatic navigation
  const { isLoggedIn } = useSelector(selectAuth);  // FIXED: Get login state

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/stats');  // FIXED: Redirect to Overview on login state change
    }
  }, [isLoggedIn, navigate]);  // Dependencies: Rerun on state/nav change

  return (
    <>
      {/* App shell already offsets for Windows titlebar (pt-7); don't subtract again here. */}
      <main className="h-full overflow-hidden lg:flex lg:flex-row-reverse dark:bg-dark-level-two">
        {/* Account switcher */}
        <section aria-labelledby="summary-heading" className="hidden w-full max-w-xs flex-col lg:flex overflow-y-auto">
          <UserGrid
            clickOnProfile={(value: any) => {
              setLock(value);
              setAutoLoginNonce(Date.now());
            }}
            runDeleteUser={() => setdeleteUser('')}
            deleteUser={deleteUser}
          />
        </section>
        {/* Login */}
        <section
          aria-labelledby="payment-heading"
          className="flex-auto overflow-hidden px-4 py-6 sm:px-6 lg:px-8 bg-white dark:bg-dark-level-one"
        >
          <div className="max-w-lg mx-auto h-full overflow-y-auto">
            <LoginForm
              isLock={getLock || ''}
              autoLoginNonce={autoLoginNonce}
              replaceLock={() => setLock('')}
              runDeleteUser={(username) => setdeleteUser(username)}
            />
          </div>
        </section>
      </main>
    </>
  );
}