import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supabase, UserProfile } from '../lib/supabase';
import { generateNumericId } from '../lib/utils';
import { Camera, AlertCircle, CheckCircle2, Lock, Edit2, X, User } from 'lucide-react';

const CustomInput = ({ label, value, onChange, type = "text", placeholder = "Empty", disabled = false, rightElement = null }: any) => (
  <div className="relative mt-3">
    <fieldset className={`border ${disabled ? 'border-gray-700/50' : 'border-gray-600 focus-within:border-blue-500'} rounded-md px-3 pb-2 pt-0 transition-colors`}>
      <legend className="text-xs text-gray-500 px-1">{label}</legend>
      <div className="flex items-center">
        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className="bg-transparent text-gray-200 w-full outline-none text-sm placeholder-gray-700 [color-scheme:dark]"
        />
        {rightElement}
      </div>
    </fieldset>
  </div>
);

const CustomSelect = ({ label, value, onChange, options }: any) => (
  <div className="relative mt-3">
    <fieldset className="border border-gray-600 focus-within:border-blue-500 rounded-md px-3 pb-2 pt-0 transition-colors">
      <legend className="text-xs text-gray-500 px-1">{label}</legend>
      <select
        value={value}
        onChange={onChange}
        className="bg-transparent text-gray-200 w-full outline-none text-sm appearance-none cursor-pointer"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value} className="bg-[#1e222d] text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 pointer-events-none text-gray-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </fieldset>
  </div>
);

const Toggle = ({ checked, onChange, label }: any) => (
  <div className="flex items-center gap-3 mt-4">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-600'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
    <span className="text-sm text-gray-200 font-medium">{label}</span>
  </div>
);

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Form state
  const [nickname, setNickname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [country, setCountry] = useState('India');
  const [address, setAddress] = useState('');
  
  // Security state
  const [twoFactorLogin, setTwoFactorLogin] = useState(true);
  const [twoFactorWithdraw, setTwoFactorWithdraw] = useState(true);
  
  // Settings state
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('UTC+05:30');

  const isVerified = !!(firstName && lastName && dateOfBirth && aadhaar && address);
  const isEmailVerified = !!authUser?.email_confirmed_at;

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setAuthUser(authUser);
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (data) {
        setUser(data as UserProfile);
      }
      
      // Load metadata
      const meta = authUser.user_metadata || {};
      setNickname(meta.nickname || `#${authUser.id.substring(0, 8)}`);
      setFirstName(meta.first_name || '');
      setLastName(meta.last_name || '');
      setDateOfBirth(meta.date_of_birth || '');
      setAadhaar(meta.aadhaar || '');
      setCountry(meta.country || 'India');
      setAddress(meta.address || '');
      setTwoFactorLogin(meta.two_factor_login ?? true);
      setTwoFactorWithdraw(meta.two_factor_withdraw ?? true);
      setLanguage(meta.language || 'English');
      setTimezone(meta.timezone || 'UTC+05:30');
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!authUser?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authUser.email,
        options: {
          emailRedirectTo: window.location.origin + '/settings'
        }
      });
      if (error) throw error;
      alert('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setResending(false);
    }
  };

  const handleChangePassword = async () => {
    if (!authUser?.email) return;
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: window.location.origin + '/settings'
      });
      if (error) throw error;
      alert('Password reset link has been sent to your email.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!authUser) return;
    setSaving(true);
    
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          nickname,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          aadhaar,
          country,
          address,
          two_factor_login: twoFactorLogin,
          two_factor_withdraw: twoFactorWithdraw,
          language,
          timezone
        }
      });

      if (authError) throw authError;

      // Update public.users table as well
      const { error: dbError } = await (supabase as any)
        .from('users')
        .update({
          username: nickname,
          full_name: `${firstName} ${lastName}`.trim()
        })
        .eq('id', authUser.id);

      if (dbError) throw dbError;

      await fetchUser(); // Refresh data after save
      alert('Profile updated successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('Account deletion requires admin approval. Please contact support.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const shortId = authUser?.id ? generateNumericId(authUser.id) : '';

  return (
    <Layout>
      <div className="min-h-screen bg-[#1e222d] text-gray-300 font-sans">
        {/* Top Navigation Bar (Mocked to match image) */}
        <div className="flex flex-wrap items-center justify-between bg-[#232833] px-4 py-0 border-b border-gray-700/50">
          <div className="flex items-center overflow-x-auto scrollbar-hide">
            <Link to="/wallet" className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap">
              Withdrawal
            </Link>
            <Link to="/transactions" className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap">
              Transactions
            </Link>
            <button className="px-4 py-4 text-sm font-medium text-white bg-white/10 rounded-md whitespace-nowrap">
              My Account
            </button>
          </div>
          
          <div className="flex items-center gap-6 py-2 hidden md:flex">
            <div className="text-right">
              <div className="text-xs text-gray-500">My current currency</div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-bold text-white">₹ INR</span>
                <button onClick={() => alert('Currency change requires admin approval.')} className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">CHANGE</button>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Available for withdrawal</div>
              <div className="text-sm font-bold text-white">{user?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} ₹</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">In the account</div>
              <div className="text-sm font-bold text-white">{user?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} ₹</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="p-6 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left Column: Personal Data */}
            <div className="md:col-span-3 space-y-4">
              <h2 className="text-white font-bold text-lg mb-4">Personal data:</h2>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <button onClick={() => alert('Avatar upload coming soon!')} className="absolute bottom-0 right-0 bg-gray-700 p-1 rounded-full border border-gray-600 hover:bg-gray-600 transition-colors">
                    <Camera className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div>
                  <div className="text-sm text-white font-medium">{authUser?.email}</div>
                  <div className="text-xs text-gray-400 mt-0.5">ID: {shortId}</div>
                  {isVerified ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded mt-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded mt-1">
                      <X className="w-3 h-3" /> Not verified
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <CustomInput label="Nickname" value={nickname} onChange={(e: any) => setNickname(e.target.value)} />
                <CustomInput label="First Name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} />
                <CustomInput label="Last Name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} />
                <CustomInput label="Date of birth" type="date" value={dateOfBirth} onChange={(e: any) => setDateOfBirth(e.target.value)} />
                <CustomInput label="Aadhaar" value={aadhaar} onChange={(e: any) => setAadhaar(e.target.value)} />
                
                <CustomInput 
                  label="Email" 
                  value={authUser?.email || ''} 
                  disabled 
                  rightElement={
                    <div className="flex items-center gap-2">
                      {isEmailVerified ? (
                        <span className="text-[10px] text-emerald-500">Verified</span>
                      ) : (
                        <>
                          <span className="text-[10px] text-red-500">Unverified</span>
                          <button 
                            onClick={handleResendVerification} 
                            disabled={resending}
                            className="bg-blue-600/20 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                          >
                            {resending ? '...' : 'RESEND'}
                          </button>
                        </>
                      )}
                    </div>
                  }
                />
                
                <CustomSelect 
                  label="Country" 
                  value={country} 
                  onChange={(e: any) => setCountry(e.target.value)}
                  options={[
                    { value: 'India', label: 'India' },
                    { value: 'United States', label: 'United States' },
                    { value: 'United Kingdom', label: 'United Kingdom' },
                  ]}
                />
                
                <CustomInput label="Address" value={address} onChange={(e: any) => setAddress(e.target.value)} />
              </div>

              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-[#007aff] hover:bg-blue-600 text-white font-bold py-3 rounded-md mt-6 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Middle Column: Documents & Security */}
            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:border-l md:border-gray-700/50 md:pl-8">
              
              {/* Documents verification */}
              <div>
                <h2 className="text-white font-bold text-lg mb-4">Documents verification:</h2>
                {isVerified ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-4 flex items-start gap-3">
                    <div className="bg-emerald-500 rounded-full p-1 mt-0.5 shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Your identity information has been submitted and verified.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 flex items-start gap-3">
                    <div className="bg-red-500 rounded-full p-1 mt-0.5 shrink-0">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      You need fill identity information before verification your account.
                    </p>
                  </div>
                )}
              </div>

              {/* Security */}
              <div className="md:border-l md:border-gray-700/50 md:pl-8">
                <h2 className="text-white font-bold text-lg mb-4">Security:</h2>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-emerald-500 rounded-full p-0.5">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white font-bold text-sm">Two-step verification</span>
                  </div>
                  <div className="flex items-center gap-2 ml-7">
                    <span className="text-xs text-gray-400">Receiving codes via Email</span>
                    <Edit2 onClick={() => alert('Change email for 2FA coming soon!')} className="w-3 h-3 text-blue-500 cursor-pointer" />
                  </div>
                </div>

                <div className="space-y-2 ml-7 mb-8">
                  <Toggle checked={twoFactorLogin} onChange={setTwoFactorLogin} label="To enter the platform" />
                  <Toggle checked={twoFactorWithdraw} onChange={setTwoFactorWithdraw} label="To withdraw funds" />
                </div>

                <div className="border-t border-gray-700/50 pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span className="text-white font-bold text-sm">Password</span>
                  </div>
                  <div className="ml-7 space-y-1">
                    <p className="text-xs text-gray-400">Change your account password</p>
                    <button 
                      onClick={handleChangePassword} 
                      disabled={resetting}
                      className="text-sm text-blue-500 hover:text-blue-400 font-medium disabled:opacity-50"
                    >
                      {resetting ? 'Sending link...' : 'Change'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Settings */}
            <div className="md:col-span-3 md:border-l md:border-gray-700/50 md:pl-8">
              <div className="space-y-1">
                <CustomSelect 
                  label="Language" 
                  value={language} 
                  onChange={(e: any) => setLanguage(e.target.value)}
                  options={[
                    { value: 'English', label: 'English' },
                    { value: 'Hindi', label: 'Hindi' },
                    { value: 'Spanish', label: 'Spanish' },
                  ]}
                  rightElement={<span className="text-gray-400 mr-2">🌐</span>}
                />
                
                <CustomSelect 
                  label="Timezone" 
                  value={timezone} 
                  onChange={(e: any) => setTimezone(e.target.value)}
                  options={[
                    { value: 'UTC+05:30', label: '(UTC+05:30)' },
                    { value: 'UTC+00:00', label: '(UTC+00:00)' },
                    { value: 'UTC-05:00', label: '(UTC-05:00)' },
                  ]}
                />
              </div>

              <button onClick={handleDeleteAccount} className="flex items-center gap-2 text-red-500 hover:text-red-400 text-sm font-medium mt-8 transition-colors">
                <X className="w-4 h-4" />
                Delete My account
              </button>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
