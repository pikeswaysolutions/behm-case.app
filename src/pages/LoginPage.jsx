import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/signup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Signup failed');
        }
        toast.success('Account created! Signing you in...');
        await login(email, password);
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img
              src="/behm-logo-topmenu.png"
              alt="Behm Family Funeral Homes"
              className="h-16 w-auto mx-auto mb-6 object-contain"
            />
            <h1 className="text-3xl font-playfair font-semibold text-slate-900">
              Behm Funeral Home
            </h1>
            <p className="text-slate-500 mt-2">Management System</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">
                {isSignUp ? 'Create account' : 'Sign in'}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? 'Enter your details to create a new account'
                  : 'Enter your credentials to access your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@behmfuneral.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    data-testid="login-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 btn-primary"
                  disabled={loading}
                  data-testid="login-submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isSignUp ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    isSignUp ? 'Create account' : 'Sign in'
                  )}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-slate-600 hidden">
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="text-slate-900 font-medium hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-slate-900 font-medium hover:underline"
                    >
                      Create one
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className="hidden lg:flex lg:flex-1 relative bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom right, rgba(27, 42, 65, 0.85), rgba(15, 23, 42, 0.95)), url('https://images.unsplash.com/photo-1673219498641-e54db77132a8?crop=entropy&cs=srgb&fm=jpg&q=85')`
        }}
      >
        <div className="flex flex-col justify-center items-center text-center p-12 w-full">
          <div className="max-w-md">
            <blockquote className="text-2xl font-playfair text-white italic leading-relaxed">
              "Since 1906, we have served Northeast Ohio with a deep sense of commitment, compassion, and dignity."
            </blockquote>
            <p className="mt-6 text-gold font-medium">- Behm Family</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
