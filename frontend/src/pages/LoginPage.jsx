import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = '/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Seed data on first load
    const seedData = async () => {
      try {
        setSeeding(true);
        await axios.post(`${API}/seed`);
      } catch (error) {
        // Ignore if already seeded
      } finally {
        setSeeding(false);
      }
    };
    seedData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-playfair font-semibold text-slate-900">
              Behm Funeral Home
            </h1>
            <p className="text-slate-500 mt-2">Management System</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">Sign in</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      placeholder="••••••••"
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
                  disabled={loading || seeding}
                  data-testid="login-submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center mb-3">Demo Credentials</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="font-medium text-slate-700">Admin</p>
                    <p className="text-slate-500">admin@behmfuneral.com</p>
                    <p className="text-slate-500">admin123</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="font-medium text-slate-700">Director</p>
                    <p className="text-slate-500">eric@behmfuneral.com</p>
                    <p className="text-slate-500">director123</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Image */}
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
            <p className="mt-6 text-gold font-medium">— Behm Family</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
