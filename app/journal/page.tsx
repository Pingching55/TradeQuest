"use client";

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import '../account/account.css';
import './journal.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, BookOpen, LogOut, Moon, Sun, Edit, Trash2, User, BarChart3, Newspaper, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Trade {
  id: string;
  date: string;
  pair: string;
  position: 'Long' | 'Short';
  entry_price: number;
  exit_price: number | null;
  pnl_amount: number | null;
  notes: string;
  trading_account_id: string;
}

interface TradingAccount {
  id: string;
  name: string;
  current_balance: number;
}

interface UserProfile {
  username: string;
}

export default function JournalPage() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, isLoaded } = useTheme();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAddingTrade, setIsAddingTrade] = useState(false);
  const [isEditingTrade, setIsEditingTrade] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [newTrade, setNewTrade] = useState({
    date: new Date().toISOString().split('T')[0],
    pair: '',
    position: 'Long' as 'Long' | 'Short',
    entry_price: '',
    exit_price: '',
    pnl_amount: '',
    notes: '',
    trading_account_id: ''
  });

  const [editTrade, setEditTrade] = useState({
    date: '',
    pair: '',
    position: 'Long' as 'Long' | 'Short',
    entry_price: '',
    exit_price: '',
    pnl_amount: '',
    notes: '',
    trading_account_id: ''
  });

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
    const savedAccount = localStorage.getItem('selectedTradingAccount');
    if (savedAccount && accounts.length > 0) {
      const accountExists = accounts.find(acc => acc.id === savedAccount);
      if (accountExists) {
        setSelectedAccount(savedAccount);
        setNewTrade(prev => ({ ...prev, trading_account_id: savedAccount }));
        loadTrades(savedAccount);
      } else {
        if (accounts.length > 0) {
          const firstAccountId = accounts[0].id;
          setSelectedAccount(firstAccountId);
          setNewTrade(prev => ({ ...prev, trading_account_id: firstAccountId }));
          localStorage.setItem('selectedTradingAccount', firstAccountId);
          loadTrades(firstAccountId);
        }
      }
    } else if (accounts.length > 0 && !selectedAccount) {
      const firstAccountId = accounts[0].id;
      setSelectedAccount(firstAccountId);
      setNewTrade(prev => ({ ...prev, trading_account_id: firstAccountId }));
      localStorage.setItem('selectedTradingAccount', firstAccountId);
      loadTrades(firstAccountId);
    }
  }, [accounts]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError('Error loading profile');
        setLoading(false);
        return;
      }

      setUserProfile(profile);

      const { data: accountsData, error: accountsError } = await supabase
        .from('trading_accounts')
        .select('id, name, current_balance')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (accountsError) {
        console.error('Error loading trading accounts:', accountsError);
      } else {
        setAccounts(accountsData || []);
        if (accountsData && accountsData.length > 0) {
          setSelectedAccount(accountsData[0].id);
          setNewTrade(prev => ({ ...prev, trading_account_id: accountsData[0].id }));
          loadTrades(accountsData[0].id);
        }
      }

      setLoading(false);
    } catch (err) {
      setError('An error occurred');
      setLoading(false);
    }
  };

  const loadTrades = async (accountId: string) => {
    try {
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('trading_account_id', accountId)
        .order('date', { ascending: false });

      if (tradesError) {
        console.error('Error loading trades:', tradesError);
      } else {
        setTrades(tradesData || []);
      }
    } catch (err) {
      console.error('Error loading trades:', err);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
    loadTrades(accountId);
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    console.log('=== STARTING TRADE CREATION ===');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found, redirecting to login');
        router.push('/auth/login');
        return;
      }
      
      console.log('User authenticated:', user.id);

      if (!selectedAccount) {
        console.error('No account selected');
        setError('Please select a trading account');
        return;
      }

      if (!newTrade.pair || !newTrade.entry_price) {
        console.error('Missing required fields:', { pair: newTrade.pair, entry_price: newTrade.entry_price });
        setError('Please fill in all required fields');
        return;
      }
      
      console.log('Basic validation passed');

      let pnlAmount = newTrade.pnl_amount ? parseFloat(newTrade.pnl_amount) : null;
      const entryPrice = parseFloat(newTrade.entry_price);
      const exitPrice = newTrade.exit_price ? parseFloat(newTrade.exit_price) : null;
      
      // Validate P&L logic if both exit price and P&L are provided
      if (exitPrice && pnlAmount !== null) {
        const priceMovement = exitPrice - entryPrice;
        const expectedProfit = newTrade.position === 'Long' ? priceMovement > 0 : priceMovement < 0;
        
        // If user entered positive P&L but trade should be a loss, make it negative
        if (pnlAmount > 0 && !expectedProfit) {
          pnlAmount = -Math.abs(pnlAmount);
          console.log(`Corrected P&L from +${newTrade.pnl_amount} to ${pnlAmount} based on ${newTrade.position} position`);
        }
        // If user entered negative P&L but trade should be a profit, make it positive
        else if (pnlAmount < 0 && expectedProfit) {
          pnlAmount = Math.abs(pnlAmount);
          console.log(`Corrected P&L from ${newTrade.pnl_amount} to +${pnlAmount} based on ${newTrade.position} position`);
        }
      }
      
      console.log('Parsed values:', { pnlAmount, entryPrice, exitPrice });

      if (isNaN(entryPrice)) {
        console.error('Invalid entry price:', newTrade.entry_price);
        setError('Please enter a valid entry price');
        return;
      }

      if (newTrade.exit_price && isNaN(exitPrice!)) {
        console.error('Invalid exit price:', newTrade.exit_price);
        setError('Please enter a valid exit price');
        return;
      }

      if (newTrade.pnl_amount && isNaN(pnlAmount!)) {
        console.error('Invalid P&L amount:', newTrade.pnl_amount);
        setError('Please enter a valid P&L amount');
        return;
      }
      
      console.log('Number validation passed');
      
      console.log('Checking trading account:', selectedAccount);
      const { data: accountCheck, error: accountError } = await supabase
        .from('trading_accounts')
        .select('id, name, user_id')
        .eq('id', selectedAccount)
        .eq('user_id', user.id)
        .single();
        
      if (accountError) {
        console.error('Account check error:', accountError);
        setError(`Account validation failed: ${accountError.message}`);
        return;
      }
      
      if (!accountCheck) {
        console.error('Account not found or does not belong to user');
        setError('Selected trading account is invalid');
        return;
      }
      
      console.log('Account validation passed:', accountCheck);
      
      const tradeData = {
        user_id: user.id,
        trading_account_id: selectedAccount,
        date: newTrade.date,
        pair: newTrade.pair.toUpperCase().trim(),
        position: newTrade.position,
        entry_price: entryPrice,
        exit_price: exitPrice,
        pnl_amount: pnlAmount,
        notes: newTrade.notes.trim(),
      };
      
      console.log('Creating trade with data:', tradeData);

      const { data, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select();
      
      console.log('Supabase insert result:', { data, error });

      if (error) {
        console.error('=== DATABASE ERROR ===');
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Error code:', error.code);
        
        const errorMessage = error.message || error.details || error.hint || 'Unknown database error';
        setError(`Database error: ${errorMessage}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No data returned from insert operation');
        setError('Trade was created but no data was returned. Please refresh the page.');
        loadTrades(selectedAccount);
        setIsAddingTrade(false);
        return;
      }

      const createdTrade = data[0];
      console.log('Trade created successfully:', createdTrade);
      
      // Update account balance if P&L amount is provided
      if (pnlAmount !== null && pnlAmount !== 0) {
        console.log('Updating account balance with P&L:', pnlAmount);
        
        // Get the fresh current balance from the account
        const { data: freshAccount, error: freshAccountError } = await supabase
          .from('trading_accounts')
          .select('current_balance')
          .eq('id', selectedAccount)
          .eq('user_id', user.id)
          .single();
          
        if (freshAccountError) {
          console.error('Error getting fresh account balance:', freshAccountError);
          setError('Trade created but failed to get current balance');
          return;
        }
        
        // Safely parse the current balance
        let currentBalance = 0;
        if (freshAccount?.current_balance !== null && freshAccount?.current_balance !== undefined) {
          currentBalance = Number(freshAccount.current_balance);
        }
        
        if (isNaN(currentBalance)) {
          console.warn('Invalid current balance, using 0:', freshAccount?.current_balance);
          currentBalance = 0;
        }
        
        const newBalance = currentBalance + pnlAmount;
        
        console.log(`Balance update: ${currentBalance} + ${pnlAmount} = ${newBalance}`);
        
        const { error: balanceError } = await supabase
          .from('trading_accounts')
          .update({ current_balance: newBalance })
          .eq('id', selectedAccount)
          .eq('user_id', user.id);
          
        if (balanceError) {
          console.error('Balance update error:', balanceError);
          setError('Trade created but failed to update account balance');
          return;
        }
        
        // Update local accounts state immediately
        setAccounts(accounts.map(acc => 
          acc.id === selectedAccount 
            ? { ...acc, current_balance: newBalance }
            : acc
        ));
        
        console.log('Account balance updated successfully');
      } else {
        console.log('No P&L amount provided, balance unchanged');
      }
      
      setTrades([createdTrade, ...trades]);
      
      setNewTrade({
        date: new Date().toISOString().split('T')[0],
        pair: '',
        position: 'Long',
        entry_price: '',
        exit_price: '',
        pnl_amount: '',
        notes: '',
        trading_account_id: selectedAccount
      });
      setIsAddingTrade(false);
      
      console.log('=== TRADE CREATION COMPLETED SUCCESSFULLY ===');
      
    } catch (err) {
      console.error('=== GENERAL ERROR ===');
      console.error('Error object:', err);
      
      let errorMessage = 'Unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error('Error stack:', err.stack);
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        try {
          errorMessage = JSON.stringify(err);
        } catch (jsonErr) {
          errorMessage = 'Error object could not be serialized';
        }
      }
      
      setError(`Error creating trade: ${errorMessage}`);
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setEditTrade({
      date: trade.date,
      pair: trade.pair,
      position: trade.position,
      entry_price: trade.entry_price.toString(),
      exit_price: trade.exit_price ? trade.exit_price.toString() : '',
      pnl_amount: trade.pnl_amount ? trade.pnl_amount.toString() : '',
      notes: trade.notes,
      trading_account_id: trade.trading_account_id
    });
    setIsEditingTrade(true);
  };

  const handleUpdateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!editingTradeId) {
      setError('No trade selected for editing');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (!editTrade.pair || !editTrade.entry_price) {
        setError('Please fill in all required fields');
        return;
      }

      let pnlAmount = editTrade.pnl_amount ? parseFloat(editTrade.pnl_amount) : null;
      const entryPrice = parseFloat(editTrade.entry_price);
      const exitPrice = editTrade.exit_price ? parseFloat(editTrade.exit_price) : null;

      if (isNaN(entryPrice)) {
        setError('Please enter a valid entry price');
        return;
      }

      if (editTrade.exit_price && isNaN(exitPrice!)) {
        setError('Please enter a valid exit price');
        return;
      }

      if (editTrade.pnl_amount && isNaN(pnlAmount!)) {
        setError('Please enter a valid P&L amount');
        return;
      }

      // Validate P&L logic if both exit price and P&L are provided
      if (exitPrice && pnlAmount !== null) {
        const priceMovement = exitPrice - entryPrice;
        const expectedProfit = editTrade.position === 'Long' ? priceMovement > 0 : priceMovement < 0;
        
        // If user entered positive P&L but trade should be a loss, make it negative
        if (pnlAmount > 0 && !expectedProfit) {
          pnlAmount = -Math.abs(pnlAmount);
          console.log(`Corrected P&L from +${editTrade.pnl_amount} to ${pnlAmount} based on ${editTrade.position} position`);
        }
        // If user entered negative P&L but trade should be a profit, make it positive
        else if (pnlAmount < 0 && expectedProfit) {
          pnlAmount = Math.abs(pnlAmount);
          console.log(`Corrected P&L from ${editTrade.pnl_amount} to +${pnlAmount} based on ${editTrade.position} position`);
        }
      }
      // Get the original trade to calculate balance difference
      const originalTrade = trades.find(t => t.id === editingTradeId);
      if (!originalTrade) {
        setError('Original trade not found');
        return;
      }
      
      // Get current account balance
      const { data: accountCheck, error: accountError } = await supabase
        .from('trading_accounts')
        .select('current_balance')
        .eq('id', editTrade.trading_account_id)
        .eq('user_id', user.id)
        .single();
        
      if (accountError) {
        setError(`Account validation failed: ${accountError.message}`);
        return;
      }

      const updateData = {
        date: editTrade.date,
        pair: editTrade.pair.toUpperCase().trim(),
        position: editTrade.position,
        entry_price: entryPrice,
        exit_price: exitPrice,
        pnl_amount: pnlAmount,
        notes: editTrade.notes.trim(),
      };

      const { data, error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', editingTradeId)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Update error:', error);
        setError(`Error updating trade: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        setError('Trade update failed - no data returned');
        return;
      }

      const updatedTrade = data[0];
      
      // Update account balance based on P&L difference
      const originalPnL = originalTrade.pnl_amount || 0;
      const newPnL = pnlAmount || 0;
      const pnlDifference = newPnL - originalPnL;
      
      if (pnlDifference !== 0) {
        console.log(`P&L changed: ${originalPnL} -> ${newPnL} (difference: ${pnlDifference})`);
        
        // Get fresh account balance
        const { data: freshAccount, error: freshAccountError } = await supabase
          .from('trading_accounts')
          .select('current_balance')
          .eq('id', editTrade.trading_account_id)
          .eq('user_id', user.id)
          .single();
          
        if (freshAccountError) {
          console.error('Error getting fresh account balance:', freshAccountError);
          setError('Trade updated but failed to get current balance');
          return;
        }
        
        let currentBalance = 0;
        if (freshAccount?.current_balance !== null && freshAccount?.current_balance !== undefined) {
          currentBalance = Number(freshAccount.current_balance);
        }
        
        if (isNaN(currentBalance)) {
          console.warn('Invalid current balance, defaulting to 0:', freshAccount?.current_balance);
          currentBalance = 0;
        }
        
        const newBalance = currentBalance + pnlDifference;
        
        const { error: balanceError } = await supabase
          .from('trading_accounts')
          .update({ current_balance: newBalance })
          .eq('id', editTrade.trading_account_id)
          .eq('user_id', user.id);
          
        if (balanceError) {
          console.error('Balance update error:', balanceError);
          setError('Trade updated but failed to update account balance');
          return;
        }
        
        // Update local accounts state
        setAccounts(accounts.map(acc => 
          acc.id === editTrade.trading_account_id 
            ? { ...acc, current_balance: newBalance }
            : acc
        ));
        
        console.log('Account balance updated successfully');
      }
      
      setTrades(trades.map(trade => 
        trade.id === editingTradeId ? updatedTrade : trade
      ));

      setEditTrade({
        date: '',
        pair: '',
        position: 'Long',
        entry_price: '',
        exit_price: '',
        pnl_amount: '',
        notes: '',
        trading_account_id: ''
      });
      setEditingTradeId(null);
      setIsEditingTrade(false);

    } catch (err) {
      console.error('Error updating trade:', err);
      setError(`Error updating trade: ${err}`);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      // Get the trade being deleted to reverse its P&L impact
      const tradeToDelete = trades.find(t => t.id === tradeId);
      if (!tradeToDelete) {
        setError('Trade not found');
        return;
      }
      
      // Get current account balance
      const { data: accountCheck, error: accountError } = await supabase
        .from('trading_accounts')
        .select('current_balance')
        .eq('id', tradeToDelete.trading_account_id)
        .eq('user_id', user.id)
        .single();
        
      if (accountError) {
        setError(`Account validation failed: ${accountError.message}`);
        return;
      }
      
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId);

      if (error) {
        setError('Error deleting trade');
        return;
      }

      // Reverse the P&L impact on account balance
      const tradePnL = tradeToDelete.pnl_amount || 0;
      if (tradePnL !== 0) {
        console.log(`Reversing P&L impact: ${tradePnL}`);
        
        // Get fresh account balance
        const { data: freshAccount, error: freshAccountError } = await supabase
          .from('trading_accounts')
          .select('current_balance')
          .eq('id', tradeToDelete.trading_account_id)
          .eq('user_id', user.id)
          .single();
          
        if (freshAccountError) {
          console.error('Error getting fresh account balance:', freshAccountError);
          setError('Trade deleted but failed to get current balance');
          return;
        }
        
        let currentBalance = 0;
        if (freshAccount?.current_balance !== null && freshAccount?.current_balance !== undefined) {
          currentBalance = Number(freshAccount.current_balance);
        }
        
        if (isNaN(currentBalance)) {
          console.warn('Invalid current balance, using 0:', freshAccount?.current_balance);
          currentBalance = 0;
        }
        
        const newBalance = currentBalance - tradePnL; // Subtract to reverse the impact
        
        const { error: balanceError } = await supabase
          .from('trading_accounts')
          .update({ current_balance: newBalance })
          .eq('id', tradeToDelete.trading_account_id)
          .eq('user_id', user.id);
          
        if (balanceError) {
          console.error('Balance update error:', balanceError);
          setError('Trade deleted but failed to update account balance');
          return;
        }
        
        // Update local accounts state
        setAccounts(accounts.map(acc => 
          acc.id === tradeToDelete.trading_account_id 
            ? { ...acc, current_balance: newBalance }
            : acc
        ));
        
        console.log('Account balance updated after trade deletion');
      }
      
      setTrades(trades.filter(trade => trade.id !== tradeId));
    } catch (err) {
      setError('An error occurred while deleting the trade');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getPnLClass = (trade: Trade) => {
    if (trade.pnl_amount === null) return '';
    
    // If user manually entered P&L, trust their input
    if (trade.pnl_amount !== null && trade.exit_price !== null && trade.entry_price) {
      // Calculate what the P&L should be based on position and price movement
      const priceMovement = trade.exit_price - trade.entry_price;
      const expectedProfit = trade.position === 'Long' ? priceMovement > 0 : priceMovement < 0;
      
      // If the manually entered P&L contradicts the price movement, show warning color
      // But still respect the sign of the manually entered P&L for color
      return trade.pnl_amount >= 0 ? 'profit' : 'loss';
    }
    
    // Default: use the sign of the P&L amount
    return trade.pnl_amount >= 0 ? 'profit' : 'loss';
  };

  const getSelectedAccountBalance = () => {
    const account = accounts.find(acc => acc.id === selectedAccount);
    return account ? account.current_balance : 0;
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
              <button className="nav-tab active">
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
              <button 
                onClick={() => router.push('/account')}
                className="nav-tab"
              >
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

        {/* Journal Header */}
        <div className="journal-header">
          <div>
            <h1 className="journal-title">Trade Journal</h1>
            {selectedAccount && (
              <p className="account-balance">
                Account Balance: USD{getSelectedAccountBalance().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          
          <div className="journal-actions">
            <Dialog open={isAddingTrade} onOpenChange={setIsAddingTrade}>
              <DialogTrigger asChild>
                <button className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Add Trade
                </button>
              </DialogTrigger>
              <DialogContent className="trade-dialog">
                <DialogHeader>
                  <DialogTitle>Add New Trade</DialogTitle>
                  <DialogDescription>
                    Record your trading activity
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddTrade} className="trade-form">
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="date" className="form-label">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newTrade.date}
                        onChange={(e) => setNewTrade({...newTrade, date: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <Label htmlFor="pair" className="form-label">Trading Pair</Label>
                      <Input
                        id="pair"
                        type="text"
                        placeholder="XAUUSD"
                        value={newTrade.pair}
                        onChange={(e) => setNewTrade({...newTrade, pair: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="position" className="form-label">Position</Label>
                      <Select value={newTrade.position} onValueChange={(value: 'Long' | 'Short') => setNewTrade({...newTrade, position: value})}>
                        <SelectTrigger className="form-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Long">Long</SelectItem>
                          <SelectItem value="Short">Short</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="form-group">
                      <Label htmlFor="entryPrice" className="form-label">Entry Price</Label>
                      <Input
                        id="entryPrice"
                        type="number"
                        step="0.00001"
                        placeholder="Enter entry price"
                        value={newTrade.entry_price}
                        onChange={(e) => setNewTrade({...newTrade, entry_price: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="exitPrice" className="form-label">Exit Price</Label>
                      <Input
                        id="exitPrice"
                        type="number"
                        step="0.00001"
                        placeholder="Enter exit price"
                        value={newTrade.exit_price}
                        onChange={(e) => setNewTrade({...newTrade, exit_price: e.target.value})}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <Label htmlFor="pnlAmount" className="form-label">P&L Amount (USD)</Label>
                      <Input
                        id="pnlAmount"
                        type="number"
                        step="0.01"
                        placeholder="Enter P&L amount (e.g., 150.50 or -75.25)"
                        value={newTrade.pnl_amount}
                        onChange={(e) => setNewTrade({...newTrade, pnl_amount: e.target.value})}
                        className="form-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <Label htmlFor="notes" className="form-label">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any trade notes here"
                      value={newTrade.notes}
                      onChange={(e) => setNewTrade({...newTrade, notes: e.target.value})}
                      className="form-textarea"
                      rows={3}
                    />
                  </div>
                  
                  <div className="form-actions">
                    <Button type="submit" className="btn-primary-form">
                      Save Trade
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsAddingTrade(false)}
                      className="btn-outline-form"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Trade Dialog */}
        <Dialog open={isEditingTrade} onOpenChange={setIsEditingTrade}>
          <DialogContent className="trade-dialog">
            <DialogHeader>
              <DialogTitle>Edit Trade</DialogTitle>
              <DialogDescription>
                Update your trade information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateTrade} className="trade-form">
              <div className="form-row">
                <div className="form-group">
                  <Label htmlFor="editDate" className="form-label">Date</Label>
                  <Input
                    id="editDate"
                    type="date"
                    value={editTrade.date}
                    onChange={(e) => setEditTrade({...editTrade, date: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="editPair" className="form-label">Trading Pair</Label>
                  <Input
                    id="editPair"
                    type="text"
                    placeholder="XAUUSD"
                    value={editTrade.pair}
                    onChange={(e) => setEditTrade({...editTrade, pair: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <Label htmlFor="editPosition" className="form-label">Position</Label>
                  <Select value={editTrade.position} onValueChange={(value: 'Long' | 'Short') => setEditTrade({...editTrade, position: value})}>
                    <SelectTrigger className="form-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Long">Long</SelectItem>
                      <SelectItem value="Short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label htmlFor="editEntryPrice" className="form-label">Entry Price</Label>
                  <Input
                    id="editEntryPrice"
                    type="number"
                    step="0.00001"
                    placeholder="Enter entry price"
                    value={editTrade.entry_price}
                    onChange={(e) => setEditTrade({...editTrade, entry_price: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <Label htmlFor="editExitPrice" className="form-label">Exit Price</Label>
                  <Input
                    id="editExitPrice"
                    type="number"
                    step="0.00001"
                    placeholder="Enter exit price"
                    value={editTrade.exit_price}
                    onChange={(e) => setEditTrade({...editTrade, exit_price: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="editPnlAmount" className="form-label">P&L Amount (USD)</Label>
                  <Input
                    id="editPnlAmount"
                    type="number"
                    step="0.01"
                    placeholder="Enter P&L amount (e.g., 150.50 or -75.25)"
                    value={editTrade.pnl_amount}
                    onChange={(e) => setEditTrade({...editTrade, pnl_amount: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <Label htmlFor="editNotes" className="form-label">Notes</Label>
                <Textarea
                  id="editNotes"
                  placeholder="Add any trade notes here"
                  value={editTrade.notes}
                  onChange={(e) => setEditTrade({...editTrade, notes: e.target.value})}
                  className="form-textarea"
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <Button type="submit" className="btn-primary-form">
                  Update Trade
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsEditingTrade(false)}
                  className="btn-outline-form"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Trades Table */}
        <div className="trades-section">
          {accounts.length === 0 ? (
            <div className="empty-state">
              <BookOpen className="empty-icon" />
              <p>No trading accounts found</p>
              <p className="empty-subtitle">Create a trading account first to start journaling</p>
              <Button onClick={() => router.push('/account')} className="btn-primary">
                Go to Account
              </Button>
            </div>
          ) : trades.length === 0 ? (
            <div className="empty-state">
              <BookOpen className="empty-icon" />
              <p>No trades recorded yet</p>
              <p className="empty-subtitle">Start by adding your first trade</p>
              <button onClick={() => setIsAddingTrade(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add Your First Trade
              </button>
            </div>
          ) : (
            <div className="trades-table-container">
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>PAIR</th>
                    <th>POSITION</th>
                    <th>ENTRY</th>
                    <th>EXIT</th>
                    <th>P&L</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{new Date(trade.date).toLocaleDateString()}</td>
                      <td className="pair-cell">{trade.pair}</td>
                      <td>
                        <span className={`position-badge ${trade.position.toLowerCase()}`}>
                          {trade.position}
                        </span>
                      </td>
                      <td>{trade.entry_price.toFixed(5)}</td>
                      <td>{trade.exit_price ? trade.exit_price.toFixed(5) : '-'}</td>
                      <td>
                        {trade.pnl_amount !== null ? (
                          <span className={`pnl-amount ${getPnLClass(trade)}`}>
                            {trade.pnl_amount >= 0 ? '+' : ''}{trade.pnl_amount.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-edit"
                            onClick={() => handleEditTrade(trade)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            className="btn-delete"
                            onClick={() => handleDeleteTrade(trade.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}