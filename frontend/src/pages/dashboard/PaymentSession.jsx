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

  // Fetch session data
  const fetchSession = useCallback(async () => {
    try {
      const { data } = await api.get(`/crypto/session/${sessionId}`);
      setSession(data);
      setStatus(data.status);
      
      // Calculate time left
      if (data.expiresAt) {
        const expires = new Date(data.expiresAt).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(diff);
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
    if (timeLeft === null || timeLeft <= 0 || status === 'credited') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, status]);

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
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-[12px] border border-gray-200">
            <Clock className="w-6 h-6 text-gray-500 animate-pulse" />
            <div>
              <p className="font-medium text-gray-700">Waiting for payment...</p>
              <p className="text-sm text-gray-500">Send the exact amount to the address above</p>
            </div>
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

  return (
    <div className="max-w-[500px] mx-auto" data-testid="payment-session-page">
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-[#111827]">
              Pay with {session.coinName} ({session.network})
            </h2>
          </div>

          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-[#6b7280] mb-1">Send exactly:</p>
            <p className="text-3xl font-bold text-[#111827]" data-testid="payment-amount">
              {session.expectedAmount} {session.coinName}
            </p>
          </div>

          {/* Address */}
          {status !== 'credited' && status !== 'expired' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-[#6b7280] text-center">To this address:</p>
                <div className="flex items-center gap-2 p-3 bg-[#f9fafb] rounded-[8px] border border-[#e5e7eb]">
                  <code className="flex-1 text-sm font-mono text-[#111827] break-all" data-testid="deposit-address">
                    {session.depositAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2 hover:bg-white rounded-[6px] transition-colors"
                    data-testid="copy-address-btn"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#6b7280]" />
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-[12px] border border-[#e5e7eb]">
                  <QRCodeSVG
                    value={session.depositAddress}
                    size={200}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-[8px] border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Send only {session.coinName} on {session.network} network. Sending other coins may result in permanent loss.
                </p>
              </div>

              {/* Timer */}
              {timeLeft !== null && (
                <div className="text-center">
                  <p className="text-sm text-[#6b7280] mb-1">Session expires in:</p>
                  <p className={`text-2xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-[#111827]'}`} data-testid="countdown-timer">
                    {formatTime(timeLeft)}
                  </p>
                </div>
              )}
            </>
          )}

          {/* TX Hash */}
          {session.txHash && (
            <div className="p-3 bg-[#f9fafb] rounded-[8px] border border-[#e5e7eb]">
              <p className="text-xs text-[#6b7280] mb-1">Transaction Hash:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-[#111827] truncate">
                  {session.txHash}
                </code>
                <a
                  href={`https://bscscan.com/tx/${session.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-white rounded"
                >
                  <ExternalLink className="w-4 h-4 text-[#7c3aed]" />
                </a>
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-sm text-[#6b7280] mb-3 text-center">Payment Status:</p>
            {getStatusContent()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
