import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Wallet, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddFunds() {
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const { data } = await api.get('/crypto/methods');
        setMethods(data);
        if (data.length > 0) {
          setSelectedMethod(data[0]);
          setAmount(data[0].minAmount.toString());
        }
      } catch (error) {
        console.error('Failed to fetch payment methods:', error);
        toast.error('Failed to load payment methods');
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum < selectedMethod.minAmount) {
      setError(`Minimum amount is $${selectedMethod.minAmount}`);
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post('/crypto/create-session', {
        methodId: selectedMethod.id,
        amount: amountNum
      });
      
      navigate(`/dashboard/add-funds/pay/${data.sessionId}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto" data-testid="add-funds-page">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">Add Funds</h1>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Select Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[8px] text-sm">
                {error}
              </div>
            )}

            {/* Payment Methods */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {methods.map(method => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount(method.minAmount.toString());
                  }}
                  className={`p-4 rounded-[12px] border-2 transition-all text-left ${
                    selectedMethod?.id === method.id 
                      ? 'border-[#7c3aed] bg-[#f5f3ff]' 
                      : 'border-[#e5e7eb] hover:border-[#7c3aed]/50'
                  }`}
                  data-testid={`method-${method.coinName}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-[#7c3aed]" />
                      <span className="font-semibold text-[#111827]">{method.coinName}</span>
                    </div>
                    {selectedMethod?.id === method.id && (
                      <CheckCircle2 className="w-5 h-5 text-[#7c3aed]" />
                    )}
                  </div>
                  <p className="text-sm text-[#6b7280]">{method.network} Network</p>
                  <p className="text-xs text-[#6b7280] mt-1">Min: ${method.minAmount}</p>
                </button>
              ))}
            </div>

            {methods.length === 0 && (
              <div className="text-center py-8 text-[#6b7280]">
                <p>No payment methods available</p>
              </div>
            )}

            {/* Amount */}
            {selectedMethod && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder={`Min $${selectedMethod.minAmount}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={selectedMethod.minAmount}
                  step="0.01"
                  required
                  className="h-12 rounded-[8px] border-[#e5e7eb] text-lg font-semibold"
                  data-testid="amount-input"
                />
                <p className="text-sm text-[#6b7280]">
                  You will send {amount || '0'} {selectedMethod.coinName} on {selectedMethod.network}
                </p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting || !selectedMethod}
              className="w-full h-12 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
              data-testid="generate-address-btn"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Generate Payment Address'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
