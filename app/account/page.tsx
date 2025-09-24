"use client";

import { useState, useEffect, createContext, useContext } from 'react';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import './account.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, User, DollarSign, LogOut, Trash2, Moon, Sun, BookOpen, BarChart3, Newspaper, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface TradingAccount {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  created_at: string;
}

interface UserProfile {
  full_name: string;
  username: string;
  phone_number: string;
  email?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, isLoaded } = useTheme();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAccount, setNewAccount] = useState({
    name: '',
    initialBalance: ''
  });
  const [editProfile, setEditProfile] = useState({
    full_name: '',
    phone_number: ''
  });
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return (
      <div className="loading-container theme-dark">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    // Load selected account from localStorage after accounts are loaded
    if (accounts.length > 0) {
      const savedAccount = localStorage.getItem('selectedTradingAccount');
      if (savedAccount) {
        // Check if the saved account still exists in the accounts list
        const accountExists = accounts.find(acc => acc.id === savedAccount);
        if (accountExists) {
          setSelectedAccount(savedAccount);
        } else {
          // If saved account doesn't exist, select first account and update localStorage
          const firstAccountId = accounts[0].id;
          setSelectedAccount(firstAccountId);
          localStorage.setItem('selectedTradingAccount', firstAccountId);
        }
      } else {
        // If no saved account, select first account
        const firstAccountId = accounts[0].id;
        setSelectedAccount(firstAccountId);
        localStorage.setItem('selectedTradingAccount', firstAccountId);
      }
    }
  }, [accounts]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError('Error loading profile');
        setLoading(false);
        return;
      }

      setUserProfile({
        ...profile,
        email: user.email
      });

      setEditProfile({
        full_name: profile.full_name,
        phone_number: profile.phone_number
      });

      // Get trading accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (accountsError) {
        setError('Error loading trading accounts');
      } else {
        setAccounts(accountsData || []);
        // Don't set selectedAccount here - let the useEffect handle it after accounts are loaded
      }

      setLoading(false);
    } catch (err) {
      setError('An error occurred');
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const initialBalance = parseFloat(newAccount.initialBalance);
      
      const { data, error } = await supabase
        .from('trading_accounts')
        .insert({
          user_id: user.id,
          name: newAccount.name,
          initial_balance: initialBalance,
          current_balance: initialBalance,
        })
        .select()
        .single();

      if (error) {
        setError('Error creating trading account');
        return;
      }

      setAccounts([data, ...accounts]);
      setNewAccount({ name: '', initialBalance: '' });
      setIsAddingAccount(false);
    } catch (err) {
      setError('An error occurred while creating the account');
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editProfile.full_name,
          phone_number: editProfile.phone_number,
        })
        .eq('id', user.id);

      if (error) {
        setError('Error updating profile');
        return;
      }

      setUserProfile(prev => prev ? {
        ...prev,
        full_name: editProfile.full_name,
        phone_number: editProfile.phone_number
      } : null);

      setIsEditingProfile(false);
    } catch (err) {
      setError('An error occurred while updating profile');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', accountId);

      if (error) {
        setError('Error deleting account');
        return;
      }

      setAccounts(accounts.filter(acc => acc.id !== accountId));
    } catch (err) {
      setError('An error occurred while deleting the account');
    }
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccount(accountId);
    // Store selected account in localStorage for journal page
    localStorage.setItem('selectedTradingAccount', accountId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className={`loading-container ${isDarkMode ? 'theme-dark' : 'theme-light'}`}>
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className={`loading-container ${isDarkMode ? 'theme-dark' : 'theme-light'}`}>
        <div className="text-center">
          <p className="error-text">Error loading profile</p>
          <Button onClick={() => router.push('/auth/login')} className="btn-primary mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`account-page ${isDarkMode ? 'theme-dark' : 'theme-light'}`}>
      {/* Top Navigation */}
      <nav className="nav-bar">
        <div className="nav-container">
          <div className="nav-content">
            {/* Logo */}
            <div className="nav-logo">
              <h1>TradeQuest</h1>
            </div>

            {/* Navigation Tabs */}
            <div className="nav-tabs">
              <button 
                onClick={() => router.push('/dashboard')}
                className="nav-tab"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
              <button 
                onClick={() => router.push('/journal')}
                className="nav-tab"
              >
                <BookOpen className="w-4 h-4" />
                Journal
              </button>
              <button 
                onClick={() => router.push('/news')}
                className="nav-tab"
              >
                <Newspaper className="w-4 h-4" />
                News
              </button>
              <button 
                onClick={() => router.push('/community')}
                className="nav-tab"
              >
                <Users className="w-4 h-4" />
                Community
              </button>
              <button 
                onClick={() => router.push('/teams')}
                className="nav-tab"
              >
                <Users className="w-4 h-4" />
                Teams
              </button>
              <button className="nav-tab active">
                <User className="w-4 h-4" />
                Account
              </button>
            </div>

            {/* Right side */}
            <div className="nav-actions">
              <ThemeToggle />
              <span className="nav-username">{userProfile.username}</span>
              <button onClick={handleLogout} className="btn-logout">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Profile Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2 className="section-title">Profile Information</h2>
            <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
              <DialogTrigger asChild>
                <button className="btn-primary">
                  Edit Profile
                </button>
              </DialogTrigger>
              <DialogContent className="dialog-content edit-profile-dialog">
                <DialogHeader>
                  <DialogTitle className="dialog-title">Edit Profile</DialogTitle>
                  <DialogDescription className="dialog-description">
                    Update your profile information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditProfile}>
                  <div className="form-group">
                    <Label htmlFor="editName" className="form-label">Name</Label>
                    <Input
                      id="editName"
                      type="text"
                      placeholder="Enter your full name"
                      value={editProfile.full_name}
                      onChange={(e) => setEditProfile({...editProfile, full_name: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="editPhone" className="form-label">Phone Number</Label>
                    <Input
                      id="editPhone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={editProfile.phone_number}
                      onChange={(e) => setEditProfile({...editProfile, phone_number: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Save Changes
                    </button>
                    <button 
                      type="button" 
                      className="btn-outline"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="profile-info">
            <div className="info-item">
              <Label className="info-label">Email</Label>
              <p className="info-value">{userProfile.email}</p>
            </div>
            <div className="info-item">
              <Label className="info-label">Name</Label>
              <p className="info-value">{userProfile.full_name}</p>
            </div>
            <div className="info-item">
              <Label className="info-label">Phone Number</Label>
              <p className="info-value">{userProfile.phone_number}</p>
            </div>
          </div>
        </div>

        {/* Trading Accounts Section */}
        <div className="accounts-section">
          <div className="section-header">
            <h2 className="section-title">Trading Accounts</h2>
            <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
              <DialogTrigger asChild>
                <button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </button>
              </DialogTrigger>
              <DialogContent className="dialog-content add-account-dialog">
                <DialogHeader>
                  <DialogTitle className="dialog-title">Add New Trading Account</DialogTitle>
                  <DialogDescription className="dialog-description">
                    Create a new trading account to track your trades
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddAccount}>
                  <div className="form-group">
                    <Label htmlFor="accountName" className="form-label">Account Name</Label>
                    <Input
                      id="accountName"
                      type="text"
                      placeholder="e.g., E8 Funded"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="initialBalance" className="form-label">Initial Balance (USD)</Label>
                    <Input
                      id="initialBalance"
                      type="number"
                      step="0.01"
                      placeholder="25000.00"
                      value={newAccount.initialBalance}
                      onChange={(e) => setNewAccount({...newAccount, initialBalance: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Create Account
                    </button>
                    <button 
                      type="button" 
                      className="btn-outline"
                      onClick={() => setIsAddingAccount(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-accounts">
              <DollarSign className="h-12 w-12" />
              <p>No trading accounts yet</p>
              <button onClick={() => setIsAddingAccount(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add Your First Account
              </button>
            </div>
          ) : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div key={account.id} className="account-card">
                  <div 
                    className={`account-content ${selectedAccount === account.id ? 'selected' : ''}`}
                    onClick={() => handleAccountSelect(account.id)}
                  >
                    <div className="account-info">
                      <h3>{account.name}</h3>
                      <p className="account-balance">
                        Balance: USD{Number(account.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="account-actions">
                      <span className={`status-badge ${selectedAccount === account.id ? 'active' : 'inactive'}`}>
                        {selectedAccount === account.id ? 'Selected' : 'Available'}
                      </span>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="btn-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}