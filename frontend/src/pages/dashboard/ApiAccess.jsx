import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Copy, Check, RefreshCw, Key, Code, Send, BarChart3, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function ApiAccess() {
  const { user, refreshUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleCopy = async () => {
    if (user?.apiKey) {
      await navigator.clipboard.writeText(user.apiKey);
      setCopied(true);
      toast.success('API key copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure you want to regenerate your API key? This will invalidate your current key.')) {
      return;
    }

    setRegenerating(true);
    try {
      await api.post('/auth/regenerate-api-key');
      await refreshUser();
      toast.success('API key regenerated');
    } catch (error) {
      toast.error('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
  };

  const apiEndpoints = [
    { method: 'POST', endpoint: '/api/v2', action: 'services', description: 'Get all available services' },
    { method: 'POST', endpoint: '/api/v2', action: 'add', description: 'Create a new order', params: 'key, service, link, quantity' },
    { method: 'POST', endpoint: '/api/v2', action: 'status', description: 'Check order status', params: 'key, order' },
    { method: 'POST', endpoint: '/api/v2', action: 'balance', description: 'Get account balance', params: 'key' },
  ];

  return (
    <div className="max-w-[800px] mx-auto space-y-6" data-testid="api-access-page">
      <h1 className="text-2xl font-bold text-[#111827]">API Access</h1>

      {/* API Key */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#7c3aed]" />
            <CardTitle className="text-lg font-semibold text-[#111827]">Your API Key</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={user?.apiKey || ''}
                readOnly
                className="font-mono text-sm h-11 rounded-[8px] border-[#e5e7eb] bg-[#f9fafb]"
                data-testid="api-key"
              />
              <Button
                variant="outline"
                onClick={handleCopy}
                className="h-11 px-4 rounded-[8px] border-[#e5e7eb]"
                data-testid="copy-api-key"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="h-11 px-4 rounded-[8px] border-[#e5e7eb]"
                data-testid="regenerate-api-key"
              >
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-[#6b7280]">
              Keep your API key secure. Do not share it publicly.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-[#7c3aed]" />
            <CardTitle className="text-lg font-semibold text-[#111827]">API Documentation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-[#111827] mb-2">Base URL</h3>
              <code className="px-3 py-2 bg-[#f9fafb] rounded-[6px] text-sm font-mono text-[#7c3aed] block">
                {window.location.origin}/api/v2
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-[#111827] mb-3">Endpoints</h3>
              <div className="space-y-3">
                {apiEndpoints.map((ep, idx) => (
                  <div key={idx} className="p-4 bg-[#f9fafb] rounded-[8px] border border-[#e5e7eb]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[#7c3aed] text-white text-xs font-semibold rounded">
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono text-[#111827]">{ep.endpoint}</code>
                      <span className="text-sm text-[#6b7280]">action={ep.action}</span>
                    </div>
                    <p className="text-sm text-[#6b7280]">{ep.description}</p>
                    {ep.params && (
                      <p className="text-xs text-[#6b7280] mt-1">
                        <span className="font-medium">Params:</span> {ep.params}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[#111827] mb-2">Example Request</h3>
              <pre className="p-4 bg-[#1e293b] rounded-[8px] text-sm font-mono text-green-400 overflow-x-auto">
{`curl -X POST ${window.location.origin}/api/v2 \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "YOUR_API_KEY",
    "action": "balance"
  }'`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
