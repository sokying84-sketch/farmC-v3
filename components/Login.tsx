import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Leaf, Package, BarChart3, Users, ShieldCheck, Mail, Lock, User, Upload, LogOut } from 'lucide-react';
import { auth } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
            throw new Error("Passwords do not match");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
            displayName: displayName
            // Note: Real photo upload would require Firebase Storage, keeping it simple for now as requested.
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
        if (err.code === 'auth/invalid-credential') {
            setError("Password or email incorrect");
        } else if (err.code === 'auth/email-already-in-use') {
            setError("User already exist, sign in?");
        } else {
            setError(err.message);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleSignOut = () => {
      signOut(auth);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-earth-900 via-earth-800 to-earth-900 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-nature-800 blur-3xl"></div>
         <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] rounded-full bg-earth-600 blur-3xl"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border-2 border-earth-200 z-10 relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-nature-100 text-nature-700 mb-4 shadow-inner">
            <Leaf size={32} />
          </div>
          <h1 className="text-3xl font-bold text-earth-900">ShroomTrack ERP</h1>
          {!currentUser ? (
              <p className="text-earth-600 mt-2">{isRegistering ? 'Create Account' : 'Sign In to Access'}</p>
          ) : (
              <div className="mt-2">
                  <p className="text-earth-800 font-medium">Welcome, {currentUser.displayName || currentUser.email}</p>
                  <button onClick={handleSignOut} className="text-xs text-red-500 hover:underline flex items-center justify-center w-full mt-1">
                      <LogOut size={12} className="mr-1"/> Sign Out
                  </button>
              </div>
          )}
        </div>

        {/* AUTHENTICATION FORMS */}
        {!currentUser && (
            <form onSubmit={handleAuth} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center">
                        <span className="font-bold mr-2">!</span> {error}
                    </div>
                )}
                
                {isRegistering && (
                    <div className="space-y-4 animate-in slide-in-from-left">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-3 text-slate-400"/>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-nature-500 outline-none" 
                                    placeholder="John Doe"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profile Photo</label>
                            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                                <Upload size={20} className="text-slate-400 mr-2"/>
                                <span className="text-sm text-slate-500">{photo ? photo.name : "Upload Photo"}</span>
                                <input type="file" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                            </label>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <div className="relative">
                        <Mail size={18} className="absolute left-3 top-3 text-slate-400"/>
                        <input 
                            type="email" 
                            required 
                            className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-nature-500 outline-none" 
                            placeholder="name@company.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3 top-3 text-slate-400"/>
                        <input 
                            type="password" 
                            required 
                            className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-nature-500 outline-none" 
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {isRegistering && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repeat Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-3 text-slate-400"/>
                            <input 
                                type="password" 
                                required 
                                className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-nature-500 outline-none" 
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <button disabled={loading} className="w-full py-3 bg-nature-600 text-white font-bold rounded-xl shadow-lg hover:bg-nature-700 transition-colors disabled:opacity-50">
                    {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
                </button>

                <div className="text-center">
                    <button 
                        type="button"
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                        className="text-sm text-earth-600 hover:text-earth-800 underline font-medium"
                    >
                        {isRegistering ? "Already have an account? Sign In" : "New user? Create Account"}
                    </button>
                </div>
            </form>
        )}

        {/* ROLE SELECTION (Only visible if logged in) */}
        {currentUser && (
            <div className="space-y-3 mt-4 animate-in fade-in zoom-in-95">
            <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Select Access Level</p>
            <button
                onClick={() => onLogin(UserRole.ADMIN)}
                className="w-full flex items-center p-3 rounded-xl border border-earth-300 bg-earth-50 hover:border-earth-500 hover:bg-white transition-all group"
            >
                <div className="p-2 bg-earth-200 rounded-lg group-hover:bg-earth-800 group-hover:text-white text-earth-800 transition-colors">
                <ShieldCheck size={20} />
                </div>
                <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Operations Manager</h3>
                <p className="text-xs text-earth-500">Full Access Main Dashboard</p>
                </div>
            </button>

            <button
                onClick={() => onLogin(UserRole.PROCESSING_WORKER)}
                className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
                <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <Users size={20} />
                </div>
                <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Processing Worker</h3>
                <p className="text-xs text-earth-500">Log deliveries, wash & dry</p>
                </div>
            </button>

            <button
                onClick={() => onLogin(UserRole.PACKING_STAFF)}
                className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
                <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <Package size={20} />
                </div>
                <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Packing Staff</h3>
                <p className="text-xs text-earth-500">Label, QR scan, and store</p>
                </div>
            </button>

            <button
                onClick={() => onLogin(UserRole.FINANCE_CLERK)}
                className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
                <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <BarChart3 size={20} />
                </div>
                <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Finance Clerk</h3>
                <p className="text-xs text-earth-500">Inventory & Financial Dashboard</p>
                </div>
            </button>
            </div>
        )}
        
        <div className="mt-8 text-center text-xs text-earth-400">
          Integrated with Google Sheets & Apps Script
        </div>
      </div>
    </div>
  );
};

export default Login;