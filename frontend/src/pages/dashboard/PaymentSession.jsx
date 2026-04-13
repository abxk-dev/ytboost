import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Copy, Check, Clock, Search, CheckCircle, PartyPopper, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function PaymentSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { updateBalance } = useAuth();
  const { joinPaymentSession, leavePaymentSession, onPaymentDetected, onPaymentCredited } = useSocket();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState('pending');
  const [expiresAtMs, setExpiresAtMs] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Fetch session data
  const fetchSession = useCallback(async () => {
    try {
      const { data } = await api.get(`/crypto/session/${sessionId}`);
      setSession(data);
      setStatus(data.status);
      
      // Calculate time left
      if (data.expiresAt) {
        const expires = new Date(data.expiresAt).getTime();
        if (Number.isFinite(expires)) {
          setExpiresAtMs(expires);
          const now = Date.now();
          const diff = Math.max(0, Math.floor((expires - now) / 1000));
          setTimeLeft(diff);
        } else {
          setExpiresAtMs(null);
          setTimeLeft(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      toast.error('Failed to load payment session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    joinPaymentSession(sessionId);

    return () => {
      leavePaymentSession(sessionId);
    };
  }, [sessionId, fetchSession, joinPaymentSession, leavePaymentSession]);

  // Socket event handlers
  useEffect(() => {
    const unsubDetected = onPaymentDetected((data) => {
      if (data.sessionId === sessionId || !data.sessionId) {
        setStatus('detected');
        setSession(prev => prev ? { ...prev, txHash: data.txHash, receivedAmount: data.amount, confirmations: data.confirmations } : prev);
        toast.success('Payment detected on blockchain!');
      }
    });

    const unsubCredited = onPaymentCredited((data) => {
      if (data.sessionId === sessionId || !data.sessionId) {
        setStatus('credited');
        setSession(prev => prev ? { ...prev, ...data } : prev);
        updateBalance(data.newBalance);
        
        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        toast.success(`$${data.amount} credited to your balance!`);
      }
    });

    return () => {
      unsubDetected();
      unsubCredited();
    };
  }, [sessionId, onPaymentDetected, onPaymentCredited, updateBalance]);

  // Countdown timer
  useEffect(() => {
    if (expiresAtMs == null || status === 'credited') return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
      setTimeLeft(diff);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAtMs, status]);

  // Poll for updates as fallback
  useEffect(() => {
    if (status === 'credited' || status === 'expired') return;

    const pollInterval = setInterval(() => {
      fetchSession();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [status, fetchSession]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    if (session?.depositAddress) {
      await navigator.clipboard.writeText(session.depositAddress);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerifyHash = async (e) => {
    e.preventDefault();
    if (!txHash.trim()) return;
    if (txHash.length < 64) {
      toast.error('Invalid transaction hash');
      return;
    }

    setVerifying(true);
    try {
      const { data } = await api.post('/crypto/verify-hash', {
        sessionId,
        txHash: txHash.trim()
      });
      
      toast.success(data.message || 'Payment verified!');
      fetchSession();
      if (data.status === 'credited') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error(error.response?.data?.detail || 'Verification failed. Please check the hash and try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6b7280]">Payment session not found</p>
      </div>
    );
  }

  const getStatusContent = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="space-y-6">
            <div className="p-6 bg-[#0f172a] rounded-[16px] border border-[#334155] shadow-xl">
              <p className="text-[10px] font-bold text-[#64748b] text-center tracking-widest uppercase mb-4">
                Our BEP20 Receiving Address
              </p>
              
              <div className="relative group">
                <div className="flex items-center gap-2 p-4 bg-[#020617] rounded-[12px] border border-[#334155] transition-all group-hover:border-[#7c3aed]/50">
                  <code className="flex-1 text-sm font-mono text-[#e879f9] break-all text-center">
                    {session.depositAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2 hover:bg-[#1e293b] rounded-[8px] transition-colors text-[#94a3b8]"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="p-3 bg-white rounded-[16px]">
                  <QRCodeSVG
                    value={session.depositAddress}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Token</label>
                <div className="p-3 bg-[#0f172a] border border-[#334155] rounded-[10px] text-sm text-[#f1f5f9] font-medium">
                  {session.coinName} ({session.network})
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Amount (USD)</label>
                <div className="p-3 bg-[#0f172a] border border-[#334155] rounded-[10px] text-sm text-[#f1f5f9] font-medium">
                  Min ${session.expectedAmount}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Transaction Hash (TXID)</label>
              <input
                type="text"
                placeholder="0x..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                disabled={verifying}
                className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-[10px] text-[#f1f5f9] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50 placeholder:text-[#334155]"
              />
            </div>

            <Button
              onClick={handleVerifyHash}
              disabled={verifying || !txHash.trim()}
              className="w-full h-14 bg-gradient-to-r from-[#c026d3] to-[#7c3aed] hover:from-[#d946ef] hover:to-[#8b5cf6] text-white font-bold rounded-[12px] shadow-lg shadow-[#7c3aed]/20 transition-all active:scale-[0.98]"
            >
              {verifying ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'Verify & Add Funds'
              )}
            </Button>

            {timeLeft !== null && (
              <div className="flex items-center justify-center gap-2 text-[#64748b]">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Session expires in: {formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        );
      case 'detecting':
      case 'detected':
        return (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-[12px] border border-blue-200 animate-pulse">
            <Search className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-medium text-blue-700">Payment detected on chain!</p>
              <p className="text-sm text-blue-600">Waiting for confirmations...</p>
            </div>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-[12px] border border-yellow-200">
            <CheckCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700">Confirming transaction...</p>
              <p className="text-sm text-yellow-600">{session.confirmations || 0} / {session.requiredConfirms || 1} confirmations</p>
            </div>
          </div>
        );
      case 'credited':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-[12px] border border-green-200">
              <PartyPopper className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Payment confirmed!</p>
                <p className="text-sm text-green-600">${session.receivedAmount?.toFixed(2) || session.expectedAmount} credited to your balance</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full h-12 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
              data-testid="go-to-dashboard-btn"
            >
              Go to Dashboard
            </Button>
          </div>
        );
      case 'expired':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-[12px] border border-red-200">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Session expired</p>
                <p className="text-sm text-red-600">Please create a new payment session</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/dashboard/add-funds')}
              className="w-full h-12 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
            >
              Create New Session
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const showTimeEnded = timeLeft === 0 && status !== 'credited' && status !== 'expired';

  return (
    <div className="max-w-[500px] mx-auto py-8 px-4" data-testid="payment-session-page">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black text-[#111827] tracking-tight mb-2 uppercase italic">
          Pay with {session.coinName} ({session.network})
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#f5f3ff] rounded-full border border-[#7c3aed]/10">
          <span className="text-sm font-bold text-[#7c3aed]">Send exactly:</span>
          <span className="text-lg font-black text-[#7c3aed]">{session.expectedAmount} {session.coinName}</span>
        </div>
      </div>

      <div className="bg-[#111827] rounded-[24px] p-1 shadow-2xl shadow-[#7c3aed]/10">
        <div className="bg-[#020617] rounded-[22px] overflow-hidden border border-[#334155]">
          <div className="p-6 sm:p-8">
            {getStatusContent()}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-start gap-3 p-4 bg-[#fff7ed] rounded-[16px] border border-[#ffedd5]">
        <AlertTriangle className="w-5 h-5 text-[#f97316] flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-[#9a3412] leading-relaxed">
          Send USDT (BEP20) to the address above, then paste your Transaction Hash (TxID) below. 
          Funds are credited automatically after verification.
        </p>
      </div>
    </div>
  );
}
