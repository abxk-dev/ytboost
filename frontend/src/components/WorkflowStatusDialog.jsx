import React, { useEffect, useMemo, useState } from 'react';
import api, { formatApiError } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function formatStepTitle(step) {
  const type = step?.type;
  if (type === 'send_order') {
    const pct = Number(step?.percentage || 0);
    const qty = Number(step?.quantity || 0);
    const providerName = step?.providerName || 'Provider';
    return `Send ${pct}% (${qty}) to ${providerName}`;
  }
  if (type === 'wait') {
    const when = step?.scheduledFor ? new Date(step.scheduledFor).toLocaleString() : '';
    return when ? `Waiting until ${when}` : 'Waiting';
  }
  if (type === 'check_status') {
    return 'Checking previous step status';
  }
  return String(type || 'Step');
}

function stepStatusBadge(step) {
  const s = step?.status;
  if (s === 'completed') return { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (s === 'failed') return { label: 'Failed', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (s === 'cancelled') return { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (s === 'waiting') return { label: 'Waiting', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (s === 'processing' || s === 'sent') return { label: 'In Progress', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: String(s || 'Pending'), className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
}

export default function WorkflowStatusDialog({ open, onOpenChange, orderId, mode = 'admin' }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [working, setWorking] = useState(false);

  const endpoint = useMemo(() => {
    if (!orderId) return '';
    return mode === 'admin' ? `/admin/orders/${orderId}/workflow-status` : `/user/orders/${orderId}/workflow-status`;
  }, [orderId, mode]);

  const steps = useMemo(() => {
    const subs = data?.job?.subOrders || [];
    return [...subs].sort((a, b) => Number(a.stepNumber || 0) - Number(b.stepNumber || 0));
  }, [data]);

  const progress = useMemo(() => {
    const total = Number(data?.job?.totalSteps || 0);
    const current = Number(data?.job?.currentStep || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
  }, [data]);

  useEffect(() => {
    if (!open || !endpoint) return;
    let mounted = true;
    setLoading(true);
    api
      .get(endpoint)
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
      })
      .catch((err) => {
        if (!mounted) return;
        toast.error(formatApiError(err));
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, endpoint]);

  const forceNext = async () => {
    const jobId = data?.job?.id;
    if (!jobId) return;
    setWorking(true);
    try {
      await api.post(`/admin/workflow-jobs/${jobId}/force-next`);
      const { data: refreshed } = await api.get(endpoint);
      setData(refreshed);
      toast.success('Next step triggered');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const cancel = async () => {
    const jobId = data?.job?.id;
    if (!jobId) return;
    setWorking(true);
    try {
      await api.post(`/admin/workflow-jobs/${jobId}/cancel`);
      const { data: refreshed } = await api.get(endpoint);
      setData(refreshed);
      toast.success('Workflow cancelled');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a] border border-[#334155] text-[#f1f5f9] max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Workflow Status</span>
            {data?.workflow?.name ? (
              <span className="text-sm font-normal text-[#94a3b8]">{data.workflow.name}</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-[#7c3aed]" />
          </div>
        ) : !data ? (
          <div className="py-6 text-sm text-[#94a3b8]">No workflow data.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-[12px] border border-[#334155] bg-[#1e293b] p-4">
                <div className="text-xs text-[#94a3b8]">Order</div>
                <div className="text-sm font-mono text-[#f1f5f9]">#{String(data.order?.id || '').slice(-8)}</div>
              </div>
              <div className="rounded-[12px] border border-[#334155] bg-[#1e293b] p-4">
                <div className="text-xs text-[#94a3b8]">Progress</div>
                <div className="text-sm text-[#f1f5f9]">
                  Step {Number(data.job?.currentStep || 0)} of {Number(data.job?.totalSteps || 0)}
                </div>
                <div className="mt-2 h-2 w-full rounded bg-[#0b1220]">
                  <div className="h-2 rounded bg-[#7c3aed]" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="rounded-[12px] border border-[#334155] bg-[#1e293b] p-4">
                <div className="text-xs text-[#94a3b8]">Job Status</div>
                <div className="text-sm text-[#f1f5f9]">{data.job?.status || '-'}</div>
                {data.job?.scheduledFor ? (
                  <div className="mt-1 text-xs text-[#94a3b8]">Next check: {new Date(data.job.scheduledFor).toLocaleString()}</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[12px] border border-[#334155] bg-[#0b1220]">
              <div className="border-b border-[#334155] px-4 py-3 text-sm font-semibold">Steps</div>
              <div className="divide-y divide-[#334155]">
                {steps.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-[#94a3b8]">No steps executed yet.</div>
                ) : (
                  steps.map((s) => {
                    const badge = stepStatusBadge(s);
                    return (
                      <div key={`${s.type}-${s.stepNumber}-${s.providerOrderId || ''}`} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-[#f1f5f9]">{formatStepTitle(s)}</div>
                          <div className="mt-1 text-xs text-[#94a3b8]">
                            Step {s.stepNumber}
                            {s.providerOrderId ? ` · Provider Order ID: ${s.providerOrderId}` : ''}
                          </div>
                        </div>
                        <Badge className={`${badge.className} border text-xs`}>{badge.label}</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {mode === 'admin' ? (
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#334155] text-[#e2e8f0]"
                  onClick={cancel}
                  disabled={working}
                >
                  {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Workflow'}
                </Button>
                <Button
                  type="button"
                  className="bg-[#7c3aed] hover:bg-[#8b5cf6]"
                  onClick={forceNext}
                  disabled={working}
                >
                  {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Force Next Step'}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

