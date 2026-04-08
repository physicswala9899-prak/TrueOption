import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('is_admin, email')
          .eq('id', user.id)
          .single();

        console.log('Admin check for user:', user.id, 'Data:', data, 'Error:', error);

        // Fallback: Check email directly if database check fails or returns false
        const isAdminEmail = user.email === 'physicswala9899@gmail.com' || (data && (data as any).email === 'physicswala9899@gmail.com');

        if (error) {
          console.error('Admin check error:', error);
          if (isAdminEmail) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } else if ((data && (data as any).is_admin === true) || isAdminEmail) {
          console.log('Admin access granted');
          setIsAdmin(true);
        } else {
          console.warn('User is not an admin in the database');
          setIsAdmin(false);
        }
      } catch (err: any) {
        console.error('Unexpected error in AdminGuard:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/trade" state={{ from: location, message: 'Admin access required' }} replace />;
  }

  return <>{children}</>;
};
