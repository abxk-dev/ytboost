import React, { useEffect, useMemo, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/skeleton';
import { Loader2, Copy, Check, RefreshCw, Key, Code, BarChart3, Eye, EyeOff, Download } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function maskKey(k) {
  const s = String(k || '');
  if (!s) return '';
  if (s.length <= 10) return `sk-${s.slice(0, 2)}...${s.slice(-2)}`;
  return `sk-${s.slice(0, 4)}...${s.slice(-4)}`;
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0.00';
  return `$${v.toFixed(2)}`;
}

function fmtDT(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return '—';
  }
}

export default function ApiAccess() {
  const [tab, setTab] = useState('keys');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [downloading, setDownloading] = useState('');

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/user/api-stats');
      setStats(data);
    } catch (error) {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const apiKey = stats?.apiKey || '';
  const apiKeyMasked = stats?.apiKeyMasked || maskKey(apiKey);

  const handleCopy = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('API key copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api.post('/user/api-key/regenerate');
      toast.success('API key regenerated');
      setRegenOpen(false);
      await fetchStats();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRegenerating(false);
    }
  };

  const downloadBlob = async (url, filename, type) => {
    setDownloading(type);
    try {
      const resp = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: resp.data?.type || '' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success('Download started');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDownloading('');
    }
  };

  // Same-origin in dev (proxy) or production; external SMM panels must use your public site URL + /api/v2
  const baseUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/v2` : 'https://ytboost.io/api/v2';

  const callsChart = useMemo(() => {
    const arr = Array.isArray(stats?.callsPerDay) ? stats.callsPerDay : [];
    return arr.map((p) => ({ date: p.date, calls: p.count }));
  }, [stats]);

  return (
    <div className="max-w-[980px] mx-auto space-y-6" data-testid="api-access-page">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#111827]">API Access</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-[10px] border-[#e5e7eb]"
            onClick={() => downloadBlob('/user/price-list/csv', 'ytboost-my-price-list.csv', 'csv')}
            disabled={downloading !== ''}
          >
            {downloading === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            CSV
          </Button>
          <Button
            variant="outline"
            className="rounded-[10px] border-[#e5e7eb]"
            onClick={() => downloadBlob('/user/price-list/pdf', 'ytboost-my-price-list.pdf', 'pdf')}
            disabled={downloading !== ''}
          >
            {downloading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            PDF
          </Button>
        </div>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#7c3aed]" />
            <CardTitle className="text-lg font-semibold text-[#111827]">Reseller API</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-[#f9fafb] border border-[#e5e7eb]">
              <TabsTrigger value="keys">API Keys</TabsTrigger>
              <TabsTrigger value="docs">API Documentation</TabsTrigger>
              <TabsTrigger value="stats">Usage Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={showKey ? apiKey : apiKeyMasked}
                      readOnly
                      className="font-mono text-sm h-11 rounded-[10px] border-[#e5e7eb] bg-[#f9fafb]"
                      data-testid="api-key"
                    />
                    <Button variant="outline" onClick={() => setShowKey((v) => !v)} className="h-11 rounded-[10px] border-[#e5e7eb]">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" onClick={handleCopy} className="h-11 rounded-[10px] border-[#e5e7eb]" data-testid="copy-api-key">
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRegenOpen(true)}
                      className="h-11 rounded-[10px] border-[#e5e7eb]"
                      data-testid="regenerate-api-key"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-[#6b7280]">
                    Keep your API key secure. Regenerating will invalidate your current key immediately.
                  </p>
                </div>

                <div className="rounded-[12px] border border-[#e5e7eb] bg-[#fafafa] p-4">
                  <div className="text-sm font-semibold text-[#111827]">API Key Info</div>
                  <div className="mt-3 space-y-2 text-sm text-[#374151]">
                    {statsLoading ? (
                      <>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between"><span className="text-[#6b7280]">Created</span><span className="font-medium">{fmtDT(stats?.apiKeyCreatedAt)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[#6b7280]">Last used</span><span className="font-medium">{fmtDT(stats?.apiKeyLastUsedAt)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[#6b7280]">Total calls</span><span className="font-medium">{Number(stats?.totalCalls || 0).toLocaleString()}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[#6b7280]">Orders via API</span><span className="font-medium">{Number(stats?.ordersViaApi || 0).toLocaleString()}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
                <DialogContent className="bg-white border border-[#e5e7eb]">
                  <DialogHeader>
                    <DialogTitle>Regenerate API Key</DialogTitle>
                    <DialogDescription>
                      This will invalidate your current API key immediately. Any integrations using it will stop working.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" className="border-[#e5e7eb]" onClick={() => setRegenOpen(false)} disabled={regenerating}>
                      Cancel
                    </Button>
                    <Button className="bg-[#7c3aed] hover:bg-[#8b5cf6]" onClick={handleRegenerate} disabled={regenerating}>
                      {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="docs" className="mt-6">
              <div className="space-y-6">
                <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <Code className="w-4 h-4 text-[#7c3aed]" />
                    Endpoint
                  </div>
                  <div className="mt-2 font-mono text-sm text-[#111827] break-all">{baseUrl}</div>
                  <p className="mt-2 text-xs text-[#6b7280]">
                    On external SMM panels, set the API URL to this full address (it must end with <span className="font-mono">/api/v2</span>).
                    Use the same <span className="font-mono">POST</span> + <span className="font-mono">key</span> / <span className="font-mono">action</span> pattern as panels like{' '}
                    <a href="https://justanotherpanel.com/api" className="text-[#7c3aed] underline" target="_blank" rel="noreferrer">Just Another Panel</a>
                    .
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                    <div className="text-sm font-semibold text-[#111827]">cURL</div>
                    <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-4 text-xs overflow-x-auto">{`curl -X POST ${baseUrl} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=balance"`}</pre>
                  </div>
                  <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                    <div className="text-sm font-semibold text-[#111827]">PHP</div>
                    <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-4 text-xs overflow-x-auto">{`$data = [\n  'key' => 'YOUR_API_KEY',\n  'action' => 'balance'\n];\n\n$ch = curl_init('${baseUrl}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, $data);\n$result = curl_exec($ch);\necho $result;`}</pre>
                  </div>
                  <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                    <div className="text-sm font-semibold text-[#111827]">Python</div>
                    <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-4 text-xs overflow-x-auto">{`import requests\n\nresp = requests.post('${baseUrl}', data={\n  'key': 'YOUR_API_KEY',\n  'action': 'balance'\n})\nprint(resp.json())`}</pre>
                  </div>
                  <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                    <div className="text-sm font-semibold text-[#111827]">JavaScript</div>
                    <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-4 text-xs overflow-x-auto">{`const body = new URLSearchParams({\n  key: 'YOUR_API_KEY',\n  action: 'balance'\n});\n\nconst resp = await fetch('${baseUrl}', {\n  method: 'POST',\n  body\n});\nconsole.log(await resp.json());`}</pre>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                  <div className="text-sm font-semibold text-[#111827] mb-3">Actions</div>
                  <div className="space-y-3 text-sm text-[#374151]">
                    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] p-3">
                      <div className="font-semibold">action=services</div>
                      <div className="text-xs text-[#6b7280] mt-1">Response: service list with rate/min/max</div>
                      <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-3 text-xs overflow-x-auto">{`[{"service":"ID","name":"Service name","category":"Category","rate":0.25,"min":100,"max":10000,"type":"Default"}]`}</pre>
                    </div>
                    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] p-3">
                      <div className="font-semibold">action=add</div>
                      <div className="text-xs text-[#6b7280] mt-1">Request: key, action, service, link, quantity</div>
                      <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-3 text-xs overflow-x-auto">{`{"order":"65f0..."}\n\nError: {"error":"Insufficient balance"}`}</pre>
                    </div>
                    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] p-3">
                      <div className="font-semibold">action=status</div>
                      <div className="text-xs text-[#6b7280] mt-1">Request: key, action, order</div>
                      <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-3 text-xs overflow-x-auto">{`{"charge":1.5,"start_count":0,"status":"Pending","remains":1000}\n\nError: {"error":"Incorrect order ID"}`}</pre>
                    </div>
                    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] p-3">
                      <div className="font-semibold">action=balance</div>
                      <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-3 text-xs overflow-x-auto">{`{"balance":10.5,"currency":"USD"}`}</pre>
                    </div>
                    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] p-3">
                      <div className="font-semibold">action=cancel</div>
                      <pre className="mt-2 bg-[#111827] text-green-400 rounded-[10px] p-3 text-xs overflow-x-auto">{`{"cancel":"65f0..."}\n\nError: {"error":"Incorrect order ID"}`}</pre>
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                  <div className="text-sm font-semibold text-[#111827] mb-3">Error Responses</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                          <th className="py-2 pr-3">Response</th>
                          <th className="py-2">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['{ "error": "Invalid API key" }', 'API key missing/invalid'],
                          ['{ "error": "Insufficient balance" }', 'Not enough balance to place an order'],
                          ['{ "error": "Incorrect order ID" }', 'Order not found'],
                        ].map(([resp, meaning]) => (
                          <tr key={resp} className="border-b border-[#e5e7eb] last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs text-[#111827]">{resp}</td>
                            <td className="py-2 text-[#374151]">{meaning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="mt-6">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { title: 'Total API Calls', value: stats?.totalCalls, icon: BarChart3 },
                    { title: 'Calls Today', value: stats?.callsToday, icon: BarChart3 },
                    { title: 'Orders via API', value: stats?.ordersViaApi, icon: BarChart3 },
                    { title: 'Revenue via API', value: fmtMoney(stats?.revenueViaApi), icon: BarChart3 },
                  ].map((c) => (
                    <div key={c.title} className="rounded-[12px] border border-[#e5e7eb] bg-[#fafafa] p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-[#6b7280] uppercase">{c.title}</div>
                        <c.icon className="w-4 h-4 text-[#7c3aed]" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-[#111827]">
                        {statsLoading ? <Skeleton className="h-7 w-24" /> : (typeof c.value === 'string' ? c.value : Number(c.value || 0).toLocaleString())}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                  <div className="text-sm font-semibold text-[#111827] mb-3">API calls (last 30 days)</div>
                  <div className="h-[260px]">
                    {statsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-[220px] w-full" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={callsChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="calls" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#e5e7eb] p-4">
                  <div className="text-sm font-semibold text-[#111827] mb-3">Recent API Calls</div>
                  {statsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                            <th className="py-2 pr-3">Time</th>
                            <th className="py-2 pr-3">Action</th>
                            <th className="py-2 pr-3">Service</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2">Response Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stats?.logs || []).slice(0, 30).map((r) => (
                            <tr key={r.id} className="border-b border-[#e5e7eb] last:border-0">
                              <td className="py-2 pr-3 text-[#111827]">{fmtDT(r.createdAt)}</td>
                              <td className="py-2 pr-3 font-medium text-[#111827]">{r.action}</td>
                              <td className="py-2 pr-3 text-[#374151]">{r.service || '—'}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2 text-[#374151]">{Number(r.responseTime || 0)} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
