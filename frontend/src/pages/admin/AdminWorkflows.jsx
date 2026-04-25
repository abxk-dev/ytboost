import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Loader2, Plus, Trash2, Pencil, Play, Pause, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function newCondition() {
  return {
    field: 'quantity',
    operator: '<=',
    value: 100,
    value2: null,
    actionSteps: [
      {
        stepNumber: 1,
        type: 'send_order',
        percentage: 100,
        providerId: '',
        providerServiceId: '',
      },
    ],
  };
}

function normalizeStepNumbers(steps) {
  return steps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
}

function pctTotal(steps) {
  return steps
    .filter((s) => s.type === 'send_order')
    .reduce((sum, s) => sum + Number(s.percentage || 0), 0);
}

function validateWorkflowDraft(draft) {
  if (!draft.name || !draft.name.trim()) return 'Workflow name is required';
  if (!draft.serviceId) return 'Service is required';
  if (!draft.conditions || draft.conditions.length < 1) return 'At least 1 condition is required';

  for (let i = 0; i < draft.conditions.length; i += 1) {
    const c = draft.conditions[i];
    if (!c.operator) return `Condition ${i + 1}: operator is required`;
    if (c.value == null || Number.isNaN(Number(c.value))) return `Condition ${i + 1}: value is required`;
    if (c.operator === 'between' && (c.value2 == null || Number.isNaN(Number(c.value2)))) {
      return `Condition ${i + 1}: value2 is required for between`;
    }
    if (!c.actionSteps || c.actionSteps.length < 1) return `Condition ${i + 1}: at least 1 action step is required`;
    const sendSteps = c.actionSteps.filter((s) => s.type === 'send_order');
    if (sendSteps.length < 1) return `Condition ${i + 1}: must include at least 1 Send Order step`;
    const total = pctTotal(c.actionSteps);
    if (Math.abs(total - 100) > 0.0001) return `Condition ${i + 1}: Send Order steps must total 100%`;
    for (let j = 0; j < c.actionSteps.length; j += 1) {
      const s = c.actionSteps[j];
      if (s.type === 'send_order') {
        if (!s.providerId) return `Condition ${i + 1}: step ${j + 1}: provider is required`;
        if (!s.providerServiceId || !String(s.providerServiceId).trim()) return `Condition ${i + 1}: step ${j + 1}: provider service id is required`;
        const p = Number(s.percentage || 0);
        if (!(p > 0 && p <= 100)) return `Condition ${i + 1}: step ${j + 1}: percentage must be 1-100`;
      }
      if (s.type === 'wait') {
        const d = Number(s.waitDuration || 0);
        if (Number.isNaN(d) || d < 0) return `Condition ${i + 1}: step ${j + 1}: wait duration invalid`;
        if (!['minutes', 'hours', 'days'].includes(String(s.waitUnit || 'minutes'))) return `Condition ${i + 1}: step ${j + 1}: wait unit invalid`;
      }
      if (s.type === 'check_status') {
        const interval = Number(s.checkInterval || 5);
        const timeout = Number(s.checkTimeout || 24);
        if (!interval || interval < 1) return `Condition ${i + 1}: step ${j + 1}: check interval invalid`;
        if (!timeout || timeout <= 0) return `Condition ${i + 1}: step ${j + 1}: timeout invalid`;
      }
    }
  }
  return '';
}

function ProviderSelect({ providers, value, onChange, className, theme }) {
  const c = t(theme);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || c.input}>
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent className={c.selectContent}>
        {(providers || []).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} {p.markup != null ? `(Markup ${p.markup}%)` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WorkflowBuilderDialog({ open, onOpenChange, services, providers, editingId, onSaved }) {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    serviceId: '',
    status: true,
    conditions: [newCondition()],
    settings: {
      defaultDelayMinutes: '',
      autoRetry: true,
      maxRetries: 3,
      notifyAdminOnFailure: true,
      notifyUserOnCompletion: true,
    },
  });

  const serviceOptions = useMemo(() => {
    return (services || []).map((s) => ({ id: s.id, name: s.name }));
  }, [services]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (!editingId) {
      setDraft({
        name: '',
        serviceId: '',
        status: true,
        conditions: [newCondition()],
        settings: {
          defaultDelayMinutes: '',
          autoRetry: true,
          maxRetries: 3,
          notifyAdminOnFailure: true,
          notifyUserOnCompletion: true,
        },
      });
      return;
    }

    setLoading(true);
    api
      .get(`/admin/workflows/${editingId}`)
      .then((res) => {
        const w = res.data;
        setDraft({
          name: w.name || '',
          serviceId: w.serviceId || '',
          status: Boolean(w.status),
          conditions: (w.conditions || []).map((cond) => ({
            field: 'quantity',
            operator: cond.operator || '<=',
            value: cond.value != null ? Number(cond.value) : 100,
            value2: cond.value2 != null ? Number(cond.value2) : null,
            actionSteps: normalizeStepNumbers(
              (cond.actionSteps || []).map((s) => ({
                stepNumber: Number(s.stepNumber || 1),
                type: s.type,
                percentage: s.percentage != null ? Number(s.percentage) : '',
                providerId: s.providerId || '',
                providerServiceId: s.providerServiceId || '',
                waitDuration: s.waitDuration != null ? Number(s.waitDuration) : '',
                waitUnit: s.waitUnit || 'minutes',
                checkInterval: s.checkInterval != null ? Number(s.checkInterval) : 5,
                checkTimeout: s.checkTimeout != null ? Number(s.checkTimeout) : 24,
              }))
            ),
          })),
          settings: {
            defaultDelayMinutes: w.settings?.defaultDelayMinutes != null ? String(w.settings.defaultDelayMinutes) : '',
            autoRetry: w.settings?.autoRetry !== false,
            maxRetries: Number(w.settings?.maxRetries ?? 3),
            notifyAdminOnFailure: w.settings?.notifyAdminOnFailure !== false,
            notifyUserOnCompletion: w.settings?.notifyUserOnCompletion !== false,
          },
        });
      })
      .catch((err) => toast.error(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [open, editingId]);

  const close = () => {
    onOpenChange(false);
  };

  const save = async () => {
    const error = validateWorkflowDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        serviceId: draft.serviceId,
        status: Boolean(draft.status),
        settings: {
          defaultDelayMinutes: draft.settings.defaultDelayMinutes !== '' ? Number(draft.settings.defaultDelayMinutes) : null,
          autoRetry: Boolean(draft.settings.autoRetry),
          maxRetries: Number(draft.settings.maxRetries || 3),
          notifyAdminOnFailure: Boolean(draft.settings.notifyAdminOnFailure),
          notifyUserOnCompletion: Boolean(draft.settings.notifyUserOnCompletion),
        },
        conditions: draft.conditions.map((cond) => ({
          field: 'quantity',
          operator: cond.operator,
          value: Number(cond.value),
          value2: cond.operator === 'between' ? Number(cond.value2) : null,
          actionSteps: normalizeStepNumbers(cond.actionSteps).map((s) => ({
            stepNumber: Number(s.stepNumber),
            type: s.type,
            percentage: s.type === 'send_order' ? Number(s.percentage) : null,
            providerId: s.type === 'send_order' ? s.providerId : null,
            providerServiceId: s.type === 'send_order' ? String(s.providerServiceId || '').trim() : null,
            waitDuration: s.type === 'wait' ? Number(s.waitDuration || 0) : null,
            waitUnit: s.type === 'wait' ? String(s.waitUnit || 'minutes') : null,
            checkInterval: s.type === 'check_status' ? Number(s.checkInterval || 5) : null,
            checkTimeout: s.type === 'check_status' ? Number(s.checkTimeout || 24) : null,
          })),
        })),
      };

      if (editingId) {
        await api.put(`/admin/workflows/${editingId}`, payload);
        toast.success('Workflow updated');
      } else {
        await api.post('/admin/workflows', payload);
        toast.success('Workflow created');
      }
      close();
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const updateCondition = (idx, patch) => {
    setDraft((d) => {
      const conditions = [...d.conditions];
      conditions[idx] = { ...conditions[idx], ...patch };
      return { ...d, conditions };
    });
  };

  const addCondition = () => {
    setDraft((d) => ({ ...d, conditions: [...d.conditions, newCondition()] }));
  };

  const deleteCondition = (idx) => {
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, i) => i !== idx) }));
  };

  const addStep = (condIdx) => {
    setDraft((d) => {
      const conditions = [...d.conditions];
      const steps = [...(conditions[condIdx].actionSteps || [])];
      steps.push({
        stepNumber: steps.length + 1,
        type: 'send_order',
        percentage: 10,
        providerId: '',
        providerServiceId: '',
      });
      conditions[condIdx] = { ...conditions[condIdx], actionSteps: normalizeStepNumbers(steps) };
      return { ...d, conditions };
    });
  };

  const deleteStep = (condIdx, stepIdx) => {
    setDraft((d) => {
      const conditions = [...d.conditions];
      const steps = (conditions[condIdx].actionSteps || []).filter((_, i) => i !== stepIdx);
      conditions[condIdx] = { ...conditions[condIdx], actionSteps: normalizeStepNumbers(steps) };
      return { ...d, conditions };
    });
  };

  const updateStep = (condIdx, stepIdx, patch) => {
    setDraft((d) => {
      const conditions = [...d.conditions];
      const steps = [...(conditions[condIdx].actionSteps || [])];
      steps[stepIdx] = { ...steps[stepIdx], ...patch };
      conditions[condIdx] = { ...conditions[condIdx], actionSteps: normalizeStepNumbers(steps) };
      return { ...d, conditions };
    });
  };

  const onDragEnd = (condIdx, result) => {
    if (!result?.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    setDraft((d) => {
      const conditions = [...d.conditions];
      const steps = [...(conditions[condIdx].actionSteps || [])];
      const [removed] = steps.splice(from, 1);
      steps.splice(to, 0, removed);
      conditions[condIdx] = { ...conditions[condIdx], actionSteps: normalizeStepNumbers(steps) };
      return { ...d, conditions };
    });
  };

  const conditions = draft.conditions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Smart Workflow' : 'Create Smart Workflow'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-[#7c3aed]" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    step === s ? 'bg-[#7c3aed] border-[#7c3aed] text-white' : 'border-[#334155] text-[#94a3b8]'
                  }`}
                >
                  Step {s}
                </button>
              ))}
            </div>

            {step === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Workflow Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]"
                    placeholder="Subscribers Split Workflow"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Service</Label>
                  <Select value={draft.serviceId} onValueChange={(v) => setDraft((d) => ({ ...d, serviceId: v }))}>
                    <SelectTrigger className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]">
                      <SelectValue placeholder="Choose service" />
                    </SelectTrigger>
                    <SelectContent className={c.selectContent}>
                      {serviceOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Status</Label>
                    <div className="text-xs text-[#94a3b8]">Active / Inactive</div>
                  </div>
                  <Switch checked={Boolean(draft.status)} onCheckedChange={(v) => setDraft((d) => ({ ...d, status: v }))} />
                </div>

                <div className="rounded-[12px] border border-[#334155] bg-[#1e293b] p-4 space-y-3">
                  <div className="text-sm font-semibold">Workflow Settings</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default delay between steps (minutes)</Label>
                      <Input
                        value={draft.settings.defaultDelayMinutes}
                        onChange={(e) => setDraft((d) => ({ ...d, settings: { ...d.settings, defaultDelayMinutes: e.target.value } }))}
                        className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]"
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max retries</Label>
                      <Input
                        value={draft.settings.maxRetries}
                        onChange={(e) => setDraft((d) => ({ ...d, settings: { ...d.settings, maxRetries: e.target.value } }))}
                        className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]"
                        placeholder="3"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[#e2e8f0]">Auto-retry failed steps</div>
                    <Switch
                      checked={Boolean(draft.settings.autoRetry)}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, settings: { ...d.settings, autoRetry: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[#e2e8f0]">Notify admin on workflow failure</div>
                    <Switch
                      checked={Boolean(draft.settings.notifyAdminOnFailure)}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, settings: { ...d.settings, notifyAdminOnFailure: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[#e2e8f0]">Notify user on workflow completion</div>
                    <Switch
                      checked={Boolean(draft.settings.notifyUserOnCompletion)}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, settings: { ...d.settings, notifyUserOnCompletion: v } }))}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="rounded-[12px] border border-[#334155] bg-[#0b1220] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Conditions</div>
                      <div className="text-xs text-[#94a3b8]">IF order quantity is...</div>
                    </div>
                    <Button type="button" className="bg-[#7c3aed] hover:bg-[#8b5cf6]" onClick={addCondition}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Condition
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {conditions.map((cond, idx) => (
                      <div key={idx} className="rounded-[12px] border border-[#334155] bg-[#0f172a] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[#f1f5f9]">Condition {idx + 1}</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                            onClick={() => deleteCondition(idx)}
                            disabled={conditions.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div className="space-y-2">
                            <Label>Field</Label>
                            <Select value="quantity" onValueChange={() => {}}>
                              <SelectTrigger className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className={c.selectContent}>
                                <SelectItem value="quantity">order quantity</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Operator</Label>
                            <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, { operator: v })}>
                              <SelectTrigger className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]">
                                <SelectValue placeholder="Operator" />
                              </SelectTrigger>
                              <SelectContent className={c.selectContent}>
                                {['<=', '>=', '=', '>', '<', 'between'].map((op) => (
                                  <SelectItem key={op} value={op}>
                                    {op}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                              value={cond.value}
                              onChange={(e) => updateCondition(idx, { value: e.target.value })}
                              className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]"
                              placeholder="100"
                            />
                          </div>
                          {cond.operator === 'between' ? (
                            <div className="space-y-2 sm:col-span-3">
                              <Label>Value 2</Label>
                              <Input
                                value={cond.value2 ?? ''}
                                onChange={(e) => updateCondition(idx, { value2: e.target.value })}
                                className="bg-[#0b1220] border-[#334155] text-[#f1f5f9]"
                                placeholder="200"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                {conditions.map((cond, condIdx) => {
                  const total = pctTotal(cond.actionSteps || []);
                  const ok = Math.abs(total - 100) <= 0.0001;
                  return (
                    <div key={condIdx} className="rounded-[12px] border border-[#334155] bg-[#0b1220] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Action Block for Condition {condIdx + 1}</div>
                          <div className="text-xs text-[#94a3b8]">
                            (quantity {cond.operator} {cond.value}
                            {cond.operator === 'between' ? ` and ${cond.value2}` : ''})
                          </div>
                        </div>
                        <div className="text-xs">
                          <span className={ok ? 'text-green-400' : 'text-red-400'}>
                            {Number(total).toFixed(0)}% {ok ? '✓' : 'Steps must total 100%'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <DragDropContext onDragEnd={(r) => onDragEnd(condIdx, r)}>
                          <Droppable droppableId={`cond-${condIdx}`}>
                            {(droppableProvided) => (
                              <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="space-y-3">
                                {(cond.actionSteps || []).map((s, stepIdx) => (
                                  <Draggable key={`${condIdx}-${s.stepNumber}-${s.type}`} draggableId={`${condIdx}-${s.stepNumber}-${s.type}`} index={stepIdx}>
                                    {(draggableProvided) => (
                                      <div
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        className={`rounded-[12px] border border-[#334155] p-4 ${
                                          s.type === 'send_order'
                                            ? 'bg-[#7c3aed]/10'
                                            : s.type === 'wait'
                                              ? 'bg-orange-500/10'
                                              : 'bg-blue-500/10'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3">
                                            <div
                                              {...draggableProvided.dragHandleProps}
                                              className="w-9 h-9 rounded-[10px] bg-[#0f172a] border border-[#334155] flex items-center justify-center text-xs text-[#94a3b8]"
                                            >
                                              {s.stepNumber}
                                            </div>
                                            <div className="space-y-1">
                                              <div className="text-sm font-semibold text-[#f1f5f9]">
                                                {s.type === 'send_order' ? 'Send Order' : s.type === 'wait' ? 'Wait' : 'Check Status'}
                                              </div>
                                              <div className="text-xs text-[#94a3b8]">Drag to reorder steps</div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Select value={s.type} onValueChange={(v) => updateStep(condIdx, stepIdx, { type: v })}>
                                              <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] h-9 w-[160px]">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className={c.selectContent}>
                                                <SelectItem value="send_order">Send Order</SelectItem>
                                                <SelectItem value="wait">Wait</SelectItem>
                                                <SelectItem value="check_status">Check Status</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                              onClick={() => deleteStep(condIdx, stepIdx)}
                                              disabled={(cond.actionSteps || []).length === 1}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>

                                        {s.type === 'send_order' ? (
                                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-2">
                                              <Label>Percentage</Label>
                                              <Input
                                                value={s.percentage}
                                                onChange={(e) => updateStep(condIdx, stepIdx, { percentage: e.target.value })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                placeholder="40"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Provider</Label>
                                              <ProviderSelect
                                                providers={providers}
                                                value={s.providerId || ''}
                                                onChange={(v) => updateStep(condIdx, stepIdx, { providerId: v })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                theme={theme}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Provider Service ID</Label>
                                              <Input
                                                value={s.providerServiceId || ''}
                                                onChange={(e) => updateStep(condIdx, stepIdx, { providerServiceId: e.target.value })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                placeholder="Service ID on provider panel"
                                              />
                                            </div>
                                          </div>
                                        ) : null}

                                        {s.type === 'wait' ? (
                                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-2">
                                              <Label>Duration</Label>
                                              <Input
                                                value={s.waitDuration ?? ''}
                                                onChange={(e) => updateStep(condIdx, stepIdx, { waitDuration: e.target.value })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                placeholder="30"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Unit</Label>
                                              <Select value={s.waitUnit || 'minutes'} onValueChange={(v) => updateStep(condIdx, stepIdx, { waitUnit: v })}>
                                                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className={c.selectContent}>
                                                  <SelectItem value="minutes">minutes</SelectItem>
                                                  <SelectItem value="hours">hours</SelectItem>
                                                  <SelectItem value="days">days</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Resume</Label>
                                              <div className="text-xs text-[#94a3b8]">Delay OR after previous step completes</div>
                                            </div>
                                          </div>
                                        ) : null}

                                        {s.type === 'check_status' ? (
                                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                              <Label>Check every (minutes)</Label>
                                              <Input
                                                value={s.checkInterval ?? 5}
                                                onChange={(e) => updateStep(condIdx, stepIdx, { checkInterval: e.target.value })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                placeholder="5"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Timeout after (hours)</Label>
                                              <Input
                                                value={s.checkTimeout ?? 24}
                                                onChange={(e) => updateStep(condIdx, stepIdx, { checkTimeout: e.target.value })}
                                                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                                                placeholder="24"
                                              />
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {droppableProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      </div>

                      <div className="mt-4">
                        <Button type="button" variant="outline" className="border-[#334155] text-[#e2e8f0]" onClick={() => addStep(condIdx)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Step
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={close} className="border-[#334155] text-[#e2e8f0]" disabled={saving}>
            Cancel
          </Button>
          <Button type="button" className="bg-[#7c3aed] hover:bg-[#8b5cf6]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWorkflows() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState([]);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [apiNotFound, setApiNotFound] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setApiNotFound(false);
      const [wfRes, svcRes, provRes] = await Promise.all([
        api.get('/admin/workflows'),
        api.get('/admin/services'),
        api.get('/admin/api-providers'),
      ]);
      setWorkflows(wfRes.data || []);
      setServices(svcRes.data || []);
      setProviders(provRes.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setApiNotFound(true);
        setWorkflows([]);
        setActiveJobs([]);
      } else {
        toast.error(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      setApiNotFound(false);
      const { data } = await api.get('/admin/workflows/jobs/active');
      setActiveJobs(data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setApiNotFound(true);
        setActiveJobs([]);
      } else {
        setActiveJobs([]);
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchJobs();
  }, [fetchAll, fetchJobs]);

  const openCreate = () => {
    setEditingId('');
    setDialogOpen(true);
  };

  const openEdit = (id) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const toggleStatus = async (wf) => {
    try {
      await api.patch(`/admin/workflows/${wf.id}/status`, { status: !wf.status });
      toast.success('Status updated');
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (wf) => {
    try {
      await api.delete(`/admin/workflows/${wf.id}`);
      toast.success('Workflow deleted');
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-workflows-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${c.text}`}>Smart Order Workflows</h1>
          <p className={`text-sm ${c.textMuted}`}>Create conditional splitting rules for services</p>
        </div>
        <Button className="bg-[#7c3aed] hover:bg-[#8b5cf6]" onClick={openCreate} disabled={apiNotFound}>
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {apiNotFound ? (
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <CardContent className="p-6">
            <div className="text-sm text-red-400 font-semibold">Workflows API not found (404)</div>
            <div className={`mt-2 text-sm ${c.textSecondary}`}>
              Your backend on Railway is running an older version that does not include the Workflows routes yet. Redeploy the backend, then refresh this page.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="workflows">
        <TabsList className={`${theme === 'dark' ? 'bg-[#1e293b] text-[#94a3b8]' : ''}`}>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows">
          <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
            <CardContent className="p-0">
              <div className="flex items-center justify-end px-4 py-3 border-b border-[#334155]">
                <Button variant="outline" size="sm" onClick={fetchAll} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : workflows.length === 0 ? (
                <div className={`py-12 text-center ${c.textMuted}`}>No workflows yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${c.border}`}>
                        {['Name', 'Service', 'Conditions', 'Status', 'Orders Processed', 'Actions'].map((h) => (
                          <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workflows.map((wf) => (
                        <tr key={wf.id} className={`border-b ${c.border} last:border-0`}>
                          <td className={`py-4 px-4 text-sm ${c.text} font-medium`}>{wf.name}</td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{wf.serviceName}</td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[320px] truncate`} title={wf.conditionsSummary}>
                            {wf.conditionsSummary}
                          </td>
                          <td className="py-4 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStatus(wf)}
                              className="h-8 px-2"
                              title="Toggle Active/Inactive"
                            >
                              <Badge className={`${wf.status ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} border text-xs`}>
                                {wf.status ? 'Active' : 'Inactive'}
                              </Badge>
                            </Button>
                          </td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{Number(wf.ordersProcessed || 0).toLocaleString()}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(wf.id)} className={`h-8 w-8 p-0 ${c.textSecondary} hover:${c.text}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => remove(wf)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => toggleStatus(wf)} className={`h-8 w-8 p-0 ${c.textSecondary} hover:${c.text}`}>
                                {wf.status ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
            <CardContent className="p-0">
              <div className="flex items-center justify-end px-4 py-3 border-b border-[#334155]">
                <Button variant="outline" size="sm" onClick={fetchJobs} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {jobsLoading ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-[#7c3aed]" />
                </div>
              ) : activeJobs.length === 0 ? (
                <div className={`py-12 text-center ${c.textMuted}`}>No active workflow jobs</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${c.border}`}>
                        {['Order', 'User', 'Service', 'Status', 'Progress', 'Next Run'].map((h) => (
                          <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeJobs.map((j) => (
                        <tr key={j.id} className={`border-b ${c.border} last:border-0`}>
                          <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{String(j.orderShort || '').slice(-8)}</td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{j.userEmail || '-'}</td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{j.serviceName}</td>
                          <td className="py-4 px-4">
                            <Badge className={`${j.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} border text-xs`}>
                              {j.status}
                            </Badge>
                          </td>
                          <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>
                            {Number(j.currentStep || 0)} / {Number(j.totalSteps || 0)}
                          </td>
                          <td className={`py-4 px-4 text-sm ${c.textMuted}`}>
                            {j.scheduledFor ? new Date(j.scheduledFor).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <WorkflowBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        services={services}
        providers={providers}
        editingId={editingId || ''}
        onSaved={() => {
          fetchAll();
          fetchJobs();
        }}
      />
    </div>
  );
}
