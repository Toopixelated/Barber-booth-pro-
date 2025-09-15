/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { auth, googleProvider, facebookProvider } from '../lib/firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup,
    AuthProvider
} from 'firebase/auth';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const GoogleIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className="mr-3 h-5 w-5 fill-current">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

const FacebookIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className="mr-3 h-5 w-5 fill-current">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1 0-1.5.5-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"/>
    </svg>
);

const LoginScreen: React.FC = () => {
    const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (action: 'signIn' | 'signUp') => {
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }
        setIsLoading(true);
        setLoadingProvider('email');
        setError(null);
        try {
            if (action === 'signIn') {
                await signInWithEmailAndPassword(auth, email, password);
                toast.success("Welcome back!");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                toast.success("Account created successfully!");
            }
        } catch (err: any) {
            handleAuthError(err);
        } finally {
            setIsLoading(false);
            setLoadingProvider(null);
        }
    };
    
    const handleSocialSignIn = async (provider: AuthProvider, providerName: string) => {
        setIsLoading(true);
        setLoadingProvider(providerName.toLowerCase());
        setError(null);
        try {
            await signInWithPopup(auth, provider);
            toast.success(`Signed in with ${providerName}!`);
        } catch (err: any) {
            handleAuthError(err, providerName);
        } finally {
            setIsLoading(false);
            setLoadingProvider(null);
        }
    };
    
    const handleAuthError = (err: any, providerName?: string) => {
        console.error("Auth Error:", err);
        if (err && err.code) {
            switch (err.code) {
                case 'auth/invalid-api-key':
                    setError('Firebase API key is not valid. Please configure it in lib/firebase.ts');
                    break;
                case 'auth/invalid-email':
                    setError('Please enter a valid email address.');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('Invalid credentials. Please try again.');
                    break;
                case 'auth/email-already-in-use':
                    setError('An account with this email already exists.');
                    break;
                case 'auth/weak-password':
                    setError('Password should be at least 6 characters long.');
                    break;
                case 'auth/account-exists-with-different-credential':
                    setError("An account already exists with this email. Please sign in with the original method.");
                    break;
                default:
                    setError(providerName ? `Could not sign in with ${providerName}. Please try again.` : 'An unexpected error occurred. Please try again.');
                    break;
            }
        } else {
            setError('An unknown error occurred.');
        }
    };
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        handleAuth(mode);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-slate-100 flex flex-col items-center justify-center p-4">
             <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-sm"
             >
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/80 to-purple-600/80 shadow-lg overflow-hidden" role="img" aria-label="Barber Booth Pro Logo">
                        <span className="absolute text-5xl transform -rotate-[20deg] -translate-x-2 translate-y-1" aria-hidden="true">✂️</span>
                        <span className="absolute text-5xl transform rotate-[20deg] translate-x-1.5" aria-hidden="true">💈</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Barber <span className="text-pink-400">Booth</span> Pro</h1>
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
                            {mode === 'signIn' ? 'Welcome Back!' : 'Create an Account'}
                        </CardTitle>
                        <CardDescription>{mode === 'signIn' ? 'Sign in to continue' : 'Get started in seconds'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full h-12 pl-10 pr-4 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all" />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                                <input type={isPasswordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full h-12 pl-10 pr-12 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all" />
                                <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1" aria-label={isPasswordVisible ? "Hide password" : "Show password"}>
                                    {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            
                            {mode === 'signIn' && (
                                <div className="text-right -mt-2">
                                    <button type="button" onClick={() => toast("Password reset feature coming soon!")} className="text-xs text-pink-400 hover:underline font-medium">Forgot Password?</button>
                                </div>
                            )}

                            {error && (<p className="text-sm text-center text-red-400 pt-1">{error}</p>)}
                            
                            <Button type="submit" className="w-full" disabled={isLoading && loadingProvider === 'email'}>
                                {isLoading && loadingProvider === 'email' ? <LoadingSpinner /> : (mode === 'signIn' ? 'Sign In' : 'Create Account')}
                            </Button>
                        </form>
                        
                        <div className="relative flex py-5 items-center">
                            <div className="flex-grow border-t border-neutral-700"></div>
                            <span className="flex-shrink mx-4 text-neutral-500 text-xs uppercase">Or</span>
                            <div className="flex-grow border-t border-neutral-700"></div>
                        </div>

                        <div className="space-y-3">
                            <Button variant="secondary" className="w-full" onClick={() => handleSocialSignIn(googleProvider, 'Google')} disabled={isLoading}>
                                {isLoading && loadingProvider === 'google' ? <LoadingSpinner /> : <><GoogleIcon /> Continue with Google</>}
                            </Button>
                            <Button variant="secondary" className="w-full" onClick={() => handleSocialSignIn(facebookProvider, 'Facebook')} disabled={isLoading}>
                                {isLoading && loadingProvider === 'facebook' ? <LoadingSpinner /> : <><FacebookIcon /> Continue with Facebook</>}
                            </Button>
                        </div>
                        
                        <p className="mt-6 text-center text-sm text-neutral-400">
                            {mode === 'signIn' ? "Don't have an account?" : "Already have an account?"}{' '}
                            <button onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); }} className="font-semibold text-pink-400 hover:underline">
                                {mode === 'signIn' ? 'Sign up' : 'Sign in'}
                            </button>
                        </p>
                    </CardContent>
                </Card>
                <p className="text-center text-xs text-neutral-600 mt-8">
                    By continuing, you agree to our <a href="#" className="underline hover:text-neutral-400">Terms of Service</a> and <a href="#" className="underline hover:text-neutral-400">Privacy Policy</a>.
                </p>
             </motion.div>
        </div>
    );
};

export default LoginScreen;