import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Star, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICONS = { 'Default': '', 'Custom Comments': '\uD83D\uDCAC', 'Package': '\uD83D\uDCE6', 'Mention': '@', 'Subscription': '\uD83D\uDD01' };
const QUALITY_COLORS = { 'Ultra High': 'bg-green-100 text-green-700 border-green-200', 'High': 'bg-teal-100 text-teal-700 border-teal-200', 'Medium': 'bg-amber-100 text-amber-700 border-amber-200', 'Low': 'bg-red-100 text-red-700 border-red-200' };
const DURATION_OPTS = [{ value: '7d', label: '7 Days', mult: 1.0 }, { value: '14d', label: '14 Days', mult: 1.8 }, { value: '30d', label: '30 Days', mult: 3.0 }];

function fmtRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '';
  if (n < 1) return n.toFixed(3);
  return n.toFixed(2);
}

/**
 * Panel-facing id: same as admin "ID" and reseller API `action=services` → `service` (from backend `serviceNumber` / `sid`).
 */
function getServiceListId(svc) {
  if (!svc) return '';
  const n = Number(svc.serviceNumber ?? svc.sid);
  if (Number.isFinite(n) && n > 0) return String(n);
  if (svc.sid != null && svc.sid !== '') return String(svc.sid);
  if (svc.serviceNumber != null && svc.serviceNumber !== '') return String(svc.serviceNumber);
  const id = svc.id;
  if (!id || String(id).length < 6) return '';
  const hex = String(id).replace(/[^a-f0-9]/gi, '').slice(-6);
  if (!hex) return '';
  const h = (parseInt(hex, 16) % 1_000_000) + 1;
  return String(h);
}

/** Fill serviceNumber/sid from public /services if /services/user is missing them (caches, proxies, old API). */
function mergeServicePanelIds(userList, publicList) {
  if (!userList || !userList.length) return userList || [];
  const pubById = Object.fromEntries((publicList || []).map((x) => [x.id, x]));
  return userList.map((s) => {
    const p = pubById[s.id];
    if (!p) return s;
    return {
      ...s,
      serviceNumber: s.serviceNumber ?? p.serviceNumber,
      sid: s.sid !== undefined && s.sid !== null && s.sid !== '' ? s.sid : p.sid,
    };
  });
}

function ServiceInfoCard({ service }) {
  const [liveStart, setLiveStart] = useState(service.startTime || '');
  const [liveSpeed, setLiveSpeed] = useState(service.speed || '');

  useEffect(() => {
    if (!service.startTime && !service.speed) return;
    const fluctuate = () => {
      if (service.startTime) {
        const nums = service.startTime.match(/\d+/g);
        if (nums && nums.length > 0) {
          const base = parseInt(nums[0]);
          const variance = Math.max(1, Math.floor(base * 0.2));
          const newVal = base + Math.floor(Math.random() * variance * 2) - variance;
          setLiveStart(service.startTime.replace(nums[0], Math.max(0, newVal).toString()));
        }
      }
      if (service.speed) {
        const nums = service.speed.match(/\d+/g);
        if (nums && nums.length > 0) {
          const base = parseInt(nums[0]);
          const variance = Math.max(1, Math.floor(base * 0.1));
          const newVal = base + Math.floor(Math.random() * variance * 2) - variance;
          setLiveSpeed(service.speed.replace(nums[0], Math.max(1, newVal).toString()));
        }
      }
    };
    const interval = setInterval(fluctuate, 2500 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, [service.startTime, service.speed]);

  const hasInfo = service.startTime || service.speed || service.refillTime || service.quality || service.country;
  if (!hasInfo) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-[#f0f4ff] border border-[#dde4f0] rounded-[10px]" data-testid="service-info-card">
      {service.startTime && (
        <div className="space-y-1">
          <p className="text-xs text-[#6b7280] font-medium">Start Time</p>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
            <span className="text-sm font-semibold text-[#111827]" data-testid="live-start-time">{liveStart}</span>
          </div>
        </div>
      )}
      {service.speed && (
        <div className="space-y-1">
          <p className="text-xs text-[#6b7280] font-medium">Speed</p>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1.5 bg-[#d1d5db] rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }}></div></div>
            <span className="text-sm font-semibold text-[#111827]" data-testid="live-speed">{liveSpeed}</span>
          </div>
        </div>
      )}
      {service.refillTime && (
        <div className="space-y-1">
          <p className="text-xs text-[#6b7280] font-medium">Refill Time</p>
          <span className="text-sm font-semibold text-[#111827]">{service.refillTime}</span>
        </div>
      )}
      {service.quality && (
        <div className="space-y-1">
          <p className="text-xs text-[#6b7280] font-medium">Quality</p>
          <Badge className={`${QUALITY_COLORS[service.quality] || 'bg-gray-100 text-gray-700'} border text-xs`}>{service.quality}</Badge>
        </div>
      )}
      {service.country && (
        <div className="space-y-1">
          <p className="text-xs text-[#6b7280] font-medium">Country</p>
          <span className="text-sm font-semibold text-[#111827]">{service.country}</span>
        </div>
      )}
    </div>
  );
}

export default function AddOrder() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customData, setCustomData] = useState('');
  const [duration, setDuration] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const bust = { params: { _: Date.now() } };
      try {
        const [catRes, pubRes, userRes] = await Promise.all([
          api.get('/categories', bust),
          api.get('/services', bust),
          api.get('/services/user', bust),
        ]);
        setCategories(catRes.data);
        setServices(mergeServicePanelIds(userRes.data, pubRes.data));
      } catch (err) {
        toast.error('Failed to load services');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredServices = useMemo(() => {
    if (!selectedCategory) return [];
    return services.filter(s => s.categoryId === selectedCategory).sort((a, b) => (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0));
  }, [services, selectedCategory]);

  const svcType = selectedService?.type || 'Default';
  const isPackage = svcType === 'Package';
  const isSub = svcType === 'Subscription';
  const isComments = svcType === 'Custom Comments';
  const isMention = svcType === 'Mention';

  // Line count for textarea-based types
  const lineCount = useMemo(() => {
    if (!customData.trim()) return 0;
    return customData.split('\n').filter(l => l.trim()).length;
  }, [customData]);

  // Auto-set quantity from line count for comments/mention
  useEffect(() => {
    if ((isComments || isMention) && lineCount > 0) {
      setQuantity(lineCount.toString());
    }
  }, [lineCount, isComments, isMention]);

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (isPackage) return selectedService.packagePrice || 0;
    const qty = parseInt(quantity) || 0;
    const base = (qty / 1000) * selectedService.rate;
    if (isSub) {
      const mult = DURATION_OPTS.find(d => d.value === duration)?.mult || 1;
      return base * mult;
    }
    return base;
  }, [selectedService, quantity, duration, isPackage, isSub]);

  const dailyDelivery = useMemo(() => {
    if (!isSub || !quantity) return 0;
    const days = parseInt(duration) || 7;
    return Math.ceil(parseInt(quantity) / days);
  }, [isSub, quantity, duration]);

  const handleServiceChange = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service);
    setCustomData('');
    setDuration('7d');
    if (service && !['Package'].includes(service.type)) {
      setQuantity(service.minQty.toString());
    } else {
      setQuantity('1');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedService) { setError('Please select a service'); return; }

    // Mention validation
    if (isMention && customData) {
      const lines = customData.split('\n').filter(l => l.trim());
      const invalid = lines.find(l => l.includes(' '));
      if (invalid) { setError('Usernames must not contain spaces. One per line, no @.'); return; }
    }

    const qty = isPackage ? 1 : parseInt(quantity);
    if (!isPackage && (qty < selectedService.minQty || qty > selectedService.maxQty)) {
      setError(`Quantity must be between ${selectedService.minQty.toLocaleString()} and ${selectedService.maxQty.toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/orders', {
        serviceId: selectedService.id,
        link,
        quantity: qty,
        customData: customData || undefined,
        duration: isSub ? duration : undefined
      });
      toast.success('Order placed successfully!');
      navigate('/dashboard/orders');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;

  return (
    <div className="max-w-[780px] mx-auto" data-testid="add-order-page">
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-7 py-5">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-[#111827]">New Order</CardTitle>
            <div className="h-0.5 w-16 bg-[#7c3aed] rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[8px] text-sm" data-testid="order-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Category</Label>
              <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setSelectedService(null); }}>
                <SelectTrigger className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="category-select"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Service</Label>
              <Select value={selectedService?.id || ''} onValueChange={handleServiceChange} disabled={!selectedCategory}>
                <SelectTrigger className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="service-select"><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {filteredServices.map(svc => {
                    const listId = getServiceListId(svc);
                    const idPrefix = listId ? `${listId} | ` : '';
                    return (
                    <SelectItem
                      key={svc.id}
                      value={svc.id}
                      textValue={`${idPrefix}${svc.name} $${fmtRate(svc.rate)}/1000`}
                    >
                      <div className="flex items-center justify-between gap-4 w-full min-w-0">
                        <span className="flex items-center gap-2 min-w-0">
                          {svc.isSpecial && (
                            <span title={`Your special rate: $${fmtRate(svc.rate)}/1000`} className="inline-flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-semibold text-amber-600">VIP</span>
                            </span>
                          )}
                          {TYPE_ICONS[svc.type] && <span className="shrink-0">{TYPE_ICONS[svc.type]}</span>}
                          <span className="truncate text-left">
                            {listId ? (
                              <>
                                <span className="font-mono text-xs font-semibold text-[#7c3aed] tabular-nums shrink-0">{listId}</span>
                                <span className="text-[#9ca3af] mx-1" aria-hidden>|</span>
                              </>
                            ) : null}
                            <span className="font-medium text-[#111827]">{svc.name}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {svc.isSpecial ? (
                            <>
                              <span className="text-xs text-[#9ca3af] line-through">${fmtRate(svc.publicRate)}/1000</span>
                              <span className="text-xs font-semibold text-green-600">${fmtRate(svc.rate)}/1000</span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-[#111827]">${fmtRate(svc.rate)}/1000</span>
                          )}
                        </span>
                      </div>
                    </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Service Info Card */}
            {selectedService && <ServiceInfoCard service={selectedService} />}

            {/* Service Type Badge */}
            {selectedService && svcType !== 'Default' && (
              <div className="flex items-center gap-2">
                <Badge className="bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/30 text-xs">{TYPE_ICONS[svcType]} {svcType}</Badge>
              </div>
            )}

            {/* Description */}
            {selectedService && selectedService.description && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">Description</Label>
                <Textarea value={selectedService.description} readOnly className="rounded-[8px] border-[#e5e7eb] bg-[#f9fafb] resize-none min-h-[60px]" data-testid="service-description" />
              </div>
            )}

            {/* Package Info */}
            {isPackage && selectedService && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-[10px]">
                <p className="text-sm font-semibold text-purple-700 mb-1">{selectedService.packageDescription || selectedService.name}</p>
                <p className="text-lg font-bold text-purple-900">${(selectedService.packagePrice || 0).toFixed(2)} <span className="text-xs font-normal text-purple-600">one-time</span></p>
              </div>
            )}

            {/* Link */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Link</Label>
              <Input type="url" placeholder="https://youtube.com/watch?v=..." value={link} onChange={(e) => setLink(e.target.value)} required className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="link-input" />
            </div>

            {/* Custom Comments / Mention textarea */}
            {(isComments || isMention) && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">
                  {isComments ? 'Your Comments (one per line)' : 'Usernames (one per line, no @)'}
                </Label>
                <Textarea
                  value={customData}
                  onChange={(e) => setCustomData(e.target.value)}
                  placeholder={isComments ? 'Great video!\nLove this content!\nAmazing work!' : 'username1\nusername2\nusername3'}
                  className="rounded-[8px] border-[#e5e7eb] min-h-[120px] font-mono text-sm"
                  data-testid="custom-data-input"
                />
                <p className="text-sm text-[#6b7280]">Lines: {lineCount} = Qty | Price: ${totalPrice.toFixed(4)}</p>
              </div>
            )}

            {/* Quantity (Default, Subscription) */}
            {!isPackage && !isComments && !isMention && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={selectedService?.minQty || 1}
                  max={selectedService?.maxQty || 1000000}
                  required
                  className="h-11 rounded-[8px] border-[#e5e7eb]"
                  data-testid="quantity-input"
                />
                {selectedService && (
                  <p className="text-sm text-[#6b7280]">
                    Min: {selectedService.minQty.toLocaleString()} | Price: ${selectedService.rate.toFixed(2)}/1,000
                  </p>
                )}
              </div>
            )}

            {/* Subscription Duration */}
            {isSub && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="duration-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label} ({d.mult}x)</SelectItem>)}
                  </SelectContent>
                </Select>
                {parseInt(quantity) > 0 && (
                  <p className="text-sm text-[#6b7280]">Daily delivery: ~{dailyDelivery.toLocaleString()}/day</p>
                )}
              </div>
            )}

            {/* Total Price */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Total Price</Label>
              <Input type="text" value={`$${totalPrice.toFixed(4)}`} readOnly className="h-11 rounded-[8px] border-[#e5e7eb] bg-[#f9fafb] font-semibold" data-testid="total-price" />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={submitting || !selectedService}
                className="h-11 px-8 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px] uppercase tracking-wider"
                data-testid="submit-order-btn"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isPackage ? 'ORDER NOW' : 'SUBMIT')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
