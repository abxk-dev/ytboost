import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Star, AlertCircle, Search, ClipboardPaste, MessageSquare, Package, AtSign, Repeat, Check } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_META = {
  'Custom Comments': { icon: MessageSquare, label: 'Custom comments' },
  Package: { icon: Package, label: 'Package' },
  Mention: { icon: AtSign, label: 'Mentions' },
  Subscription: { icon: Repeat, label: 'Subscription' },
};
const DURATION_OPTS = [
  { value: '7d', label: '7 days', mult: 1.0 },
  { value: '14d', label: '14 days', mult: 1.8 },
  { value: '30d', label: '30 days', mult: 3.0 },
];

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const money4 = (n) => `$${Number(n || 0).toFixed(4)}`;

function fmtRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '';
  if (n < 1) return n.toFixed(3);
  return n.toFixed(2);
}

/**
 * Panel-facing id: same as admin "ID" and reseller API `action=services` -> `service` (from backend `serviceNumber` / `sid`).
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

/** Quick quantity picks inside the service limits, e.g. 100 / 500 / 1,000 / 5,000. */
function quantityPresets(min, max) {
  const lo = Math.max(1, Number(min) || 1);
  const hi = Number(max) || lo;
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  const out = [lo];
  steps.forEach((m) => { const v = lo * m; if (v > lo && v <= hi && out.length < 4) out.push(v); });
  return out;
}

const Field = ({ label, hint, error, htmlFor, action, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 min-h-[20px]">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[#111827]">{label}</label>
      {action}
    </div>
    {children}
    {error ? (
      <p className="text-[13px] text-[#dc2626] break-words" role="alert">{error}</p>
    ) : hint ? (
      <p className="text-[13px] text-[#6b7280]">{hint}</p>
    ) : null}
  </div>
);

/** Delivery facts for the selected service. Values drift slightly like before, with no animated decoration. */
function useLiveValue(raw, pct, min) {
  const [value, setValue] = useState(raw || '');
  useEffect(() => {
    setValue(raw || '');
    if (!raw) return undefined;
    const id = setInterval(() => {
      const nums = raw.match(/\d+/g);
      if (!nums || !nums.length) return;
      const base = parseInt(nums[0], 10);
      const variance = Math.max(1, Math.floor(base * pct));
      const next = base + Math.floor(Math.random() * variance * 2) - variance;
      setValue(raw.replace(nums[0], Math.max(min, next).toString()));
    }, 2500 + Math.random() * 1500);
    return () => clearInterval(id);
  }, [raw, pct, min]);
  return value;
}

function DeliveryFacts({ service }) {
  const liveStart = useLiveValue(service.startTime, 0.2, 0);
  const liveSpeed = useLiveValue(service.speed, 0.1, 1);
  const rows = [
    service.startTime && ['Start time', liveStart, 'live-start-time'],
    service.speed && ['Speed', liveSpeed, 'live-speed'],
    service.refillTime && ['Refill', service.refillTime],
    service.quality && ['Quality', service.quality],
    service.country && ['Country', service.country],
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm" data-testid="service-info-card">
      {rows.map(([k, v, tid]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-[#6b7280]">{k}</dt>
          <dd className="mt-0.5 font-medium text-[#111827] tabular-nums break-words" data-testid={tid}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ServicePicker({ services, value, onChange, disabled, hasCategory }) {
  const [q, setQ] = useState('');
  useEffect(() => { setQ(''); }, [services]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return services;
    return services.filter((s) => `${getServiceListId(s)} ${s.name}`.toLowerCase().includes(t));
  }, [services, q]);

  if (disabled) {
    return (
      <div className="h-11 rounded-[8px] border border-dashed border-[#d1d5db] flex items-center px-3 text-sm text-[#6b7280]" data-testid="service-select">
        {hasCategory ? 'No services in this category' : 'Choose a category first'}
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[#e5e7eb] overflow-hidden bg-white" data-testid="service-select">
      {services.length > 6 && (
        <div className="relative border-b border-[#e5e7eb]">
          <Search className="w-4 h-4 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search services"
            className="w-full h-10 pl-9 pr-3 text-sm bg-transparent outline-none placeholder:text-[#9ca3af] focus-visible:bg-[#f9fafb]"
          />
        </div>
      )}
      <div role="radiogroup" aria-label="Service" className="max-h-[320px] overflow-y-auto divide-y divide-[#f1f2f4]">
        {shown.length === 0 && <p className="px-3 py-6 text-sm text-center text-[#6b7280]">No match</p>}
        {shown.map((svc) => {
          const id = getServiceListId(svc);
          const active = value === svc.id;
          return (
            <button
              key={svc.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(svc.id)}
              className={`w-full text-left px-3 py-3 flex items-start gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7c3aed] ${active ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]'}`}
            >
              <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${active ? 'bg-[#7c3aed] border-[#7c3aed]' : 'border-[#d1d5db]'}`}>
                {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[#111827] break-words">{svc.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6b7280]">
                  {id && <span className="font-mono tabular-nums">ID {id}</span>}
                  {svc.isSpecial && <span className="inline-flex items-center gap-1 text-[#b45309]"><Star className="w-3 h-3 fill-current" />Your rate</span>}
                  {TYPE_META[svc.type] && <span>{TYPE_META[svc.type].label}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-sm font-medium text-[#111827]">${fmtRate(svc.rate)}</span>
                {svc.isSpecial ? (
                  <span className="block text-xs text-[#9ca3af] line-through">${fmtRate(svc.publicRate)}</span>
                ) : (
                  <span className="block text-xs text-[#6b7280]">per 1,000</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AddOrder() {
  const { user } = useAuth();
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
  const detailsRef = useRef(null);

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
        const merged = mergeServicePanelIds(userRes.data, pubRes.data);
        setCategories(catRes.data);
        setServices(merged);
        // "Reorder": /dashboard/orders/add?serviceId=..&link=..&quantity=..
        // Applied here (same batch as the data) so the dropdowns mount with the right values.
        const sp = new URLSearchParams(window.location.search);
        const sid = sp.get('serviceId');
        if (sid) {
          const svc = merged.find((s) => s.id === sid);
          if (svc) {
            setSelectedCategory(svc.categoryId);
            setSelectedService(svc);
            const l = sp.get('link');
            if (l) setLink(l);
            const q = parseInt(sp.get('quantity'), 10);
            setQuantity(String(q >= svc.minQty && q <= svc.maxQty ? q : svc.minQty));
          } else {
            toast.error('That service is no longer available');
          }
        }
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
    return services.filter((s) => s.categoryId === selectedCategory).sort((a, b) => (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0));
  }, [services, selectedCategory]);

  const svcType = selectedService?.type || 'Default';
  const isPackage = svcType === 'Package';
  const isSub = svcType === 'Subscription';
  const isComments = svcType === 'Custom Comments';
  const isMention = svcType === 'Mention';
  const typeMeta = TYPE_META[svcType];

  const lineCount = useMemo(() => {
    if (!customData.trim()) return 0;
    return customData.split('\n').filter((l) => l.trim()).length;
  }, [customData]);

  // Auto-set quantity from line count for comments/mention
  useEffect(() => {
    if ((isComments || isMention) && lineCount > 0) setQuantity(lineCount.toString());
  }, [lineCount, isComments, isMention]);

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (isPackage) return selectedService.packagePrice || 0;
    const qty = parseInt(quantity) || 0;
    const base = (qty / 1000) * selectedService.rate;
    if (isSub) {
      const mult = DURATION_OPTS.find((d) => d.value === duration)?.mult || 1;
      return base * mult;
    }
    return base;
  }, [selectedService, quantity, duration, isPackage, isSub]);

  const dailyDelivery = useMemo(() => {
    if (!isSub || !quantity) return 0;
    const days = parseInt(duration) || 7;
    return Math.ceil(parseInt(quantity) / days);
  }, [isSub, quantity, duration]);

  const qtyNum = parseInt(quantity, 10);
  const qtyError = useMemo(() => {
    if (!selectedService || isPackage || isComments || isMention || quantity === '') return '';
    if (!Number.isFinite(qtyNum)) return 'Enter a number';
    if (qtyNum < selectedService.minQty) return `Minimum is ${selectedService.minQty.toLocaleString()}`;
    if (qtyNum > selectedService.maxQty) return `Maximum is ${selectedService.maxQty.toLocaleString()}`;
    return '';
  }, [selectedService, quantity, qtyNum, isPackage, isComments, isMention]);

  const balance = Number(user?.balance || 0);
  const shortBy = selectedService && totalPrice > balance ? totalPrice - balance : 0;

  const handleServiceChange = (serviceId) => {
    const service = services.find((s) => s.id === serviceId);
    setSelectedService(service);
    setCustomData('');
    setDuration('7d');
    setError('');
    if (service && !['Package'].includes(service.type)) setQuantity(service.minQty.toString());
    else setQuantity('1');
    // bring the details block into view on small screens
    if (window.innerWidth < 1024) setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const pasteLink = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (t) setLink(t);
    } catch {
      toast.error('Paste blocked by the browser, press Ctrl/Cmd + V instead');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedService) { setError('Select a service'); return; }

    if (isMention && customData) {
      const lines = customData.split('\n').filter((l) => l.trim());
      const invalid = lines.find((l) => l.includes(' '));
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
        duration: isSub ? duration : undefined,
      });
      toast.success('Order placed');
      navigate('/dashboard/orders');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;

  const inputCls = 'h-11 rounded-[8px] border-[#e5e7eb] bg-white';
  const canSubmit = !!selectedService && !submitting && !qtyError && !!link.trim();

  return (
    <div className="max-w-[1100px] mx-auto space-y-6" data-testid="add-order-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#111827]">New order</h1>
        <p className="text-sm text-[#6b7280] mt-1">Pick a service, paste the link, set the quantity. The price updates as you go.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Left: the order */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 sm:p-6 space-y-5">
            <h2 className="text-base font-medium text-[#111827]">Service</h2>
            <Field label="Category" htmlFor="order-category">
              <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setSelectedService(null); }}>
                <SelectTrigger id="order-category" className={inputCls} data-testid="category-select"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Service" action={filteredServices.length > 0 ? <span className="text-xs text-[#6b7280] tabular-nums">{filteredServices.length} available</span> : null}>
              <ServicePicker
                services={filteredServices}
                value={selectedService?.id || ''}
                onChange={handleServiceChange}
                disabled={!selectedCategory || filteredServices.length === 0}
                hasCategory={!!selectedCategory}
              />
            </Field>
          </section>

          <section ref={detailsRef} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 sm:p-6 space-y-5 scroll-mt-[96px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-medium text-[#111827]">Details</h2>
              {typeMeta && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] border border-[#e5e7eb] rounded-[6px] px-2 py-1">
                  <typeMeta.icon className="w-3.5 h-3.5" strokeWidth={1.5} />{typeMeta.label}
                </span>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] px-4 py-3 rounded-[8px] text-sm" data-testid="order-error" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words min-w-0">{error}</span>
              </div>
            )}

            {selectedService?.description && (
              <p className="text-sm text-[#4b5563] bg-[#f9fafb] border border-[#eef0f2] rounded-[8px] px-3 py-2.5 whitespace-pre-wrap break-words" data-testid="service-description">{selectedService.description}</p>
            )}

            <Field
              label="Link"
              htmlFor="order-link"
              action={<button type="button" onClick={pasteLink} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6d28d9] hover:text-[#5b21b6] transition-colors rounded px-1 py-1 -my-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]"><ClipboardPaste className="w-3.5 h-3.5" strokeWidth={1.5} />Paste</button>}
            >
              <Input id="order-link" type="url" inputMode="url" placeholder="https://youtube.com/watch?v=" value={link} onChange={(e) => setLink(e.target.value)} required className={inputCls} data-testid="link-input" />
            </Field>

            {(isComments || isMention) && (
              <Field
                label={isComments ? 'Comments, one per line' : 'Usernames, one per line, no @'}
                htmlFor="order-custom"
                hint={`${lineCount.toLocaleString()} ${lineCount === 1 ? 'line' : 'lines'} sets the quantity`}
              >
                <Textarea
                  id="order-custom"
                  value={customData}
                  onChange={(e) => setCustomData(e.target.value)}
                  placeholder={isComments ? 'Great video\nLove this content\nAmazing work' : 'username1\nusername2\nusername3'}
                  className="rounded-[8px] border-[#e5e7eb] min-h-[140px] font-mono text-sm"
                  data-testid="custom-data-input"
                />
              </Field>
            )}

            {!isPackage && !isComments && !isMention && (
              <Field
                label="Quantity"
                htmlFor="order-qty"
                error={qtyError}
                hint={selectedService ? `Min ${selectedService.minQty.toLocaleString()}, max ${selectedService.maxQty.toLocaleString()}` : 'Select a service first'}
              >
                <Input
                  id="order-qty"
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={selectedService?.minQty || 1}
                  max={selectedService?.maxQty || 1000000}
                  required
                  disabled={!selectedService}
                  aria-invalid={!!qtyError}
                  className={`${inputCls} tabular-nums ${qtyError ? 'border-[#dc2626] focus-visible:ring-[#dc2626]' : ''}`}
                  data-testid="quantity-input"
                />
                {selectedService && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quantityPresets(selectedService.minQty, selectedService.maxQty).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuantity(String(p))}
                        className={`h-8 px-3 rounded-[8px] border text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] ${String(p) === String(quantity) ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#6d28d9]' : 'border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]'}`}
                      >
                        {p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}

            {isSub && (
              <Field label="Duration" htmlFor="order-duration" hint={parseInt(quantity) > 0 ? `About ${dailyDelivery.toLocaleString()} per day` : undefined}>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="order-duration" className={inputCls} data-testid="duration-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label} ({d.mult}x price)</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </section>
        </div>

        {/* Right: summary */}
        <aside className="min-w-0 lg:sticky lg:top-[96px]">
          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 sm:p-6 space-y-5" data-testid="order-summary">
            <h2 className="text-base font-medium text-[#111827]">Summary</h2>

            {selectedService ? (
              <>
                <div className="min-w-0">
                  <p className="text-sm text-[#111827] break-words">{selectedService.name}</p>
                  <p className="mt-1 text-xs text-[#6b7280] tabular-nums">
                    {getServiceListId(selectedService) && <>ID {getServiceListId(selectedService)} &middot; </>}${fmtRate(selectedService.rate)} per 1,000
                  </p>
                </div>
                <DeliveryFacts service={selectedService} />
                {isPackage && (
                  <p className="text-sm text-[#4b5563] border-t border-[#eef0f2] pt-4 break-words">{selectedService.packageDescription || 'One-time package'}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[#6b7280]">Choose a service to see the price and delivery details.</p>
            )}

            <dl className="space-y-2 border-t border-[#eef0f2] pt-4 text-sm tabular-nums">
              {selectedService && !isPackage && (
                <div className="flex items-center justify-between gap-3"><dt className="text-[#6b7280]">Quantity</dt><dd className="text-[#111827]">{Number.isFinite(qtyNum) ? qtyNum.toLocaleString() : '0'}</dd></div>
              )}
              <div className="flex items-center justify-between gap-3"><dt className="text-[#6b7280]">Total</dt><dd className="text-xl font-medium text-[#111827]"><input readOnly aria-label="Total price" value={money4(totalPrice)} className="w-[8.5rem] text-right bg-transparent outline-none" data-testid="total-price" /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-[#6b7280]">Balance</dt><dd className="text-[#111827]">{money(balance)}</dd></div>
              {selectedService && (
                <div className="flex items-center justify-between gap-3"><dt className="text-[#6b7280]">After this order</dt><dd className={shortBy ? 'text-[#dc2626]' : 'text-[#111827]'}>{shortBy ? `-${money(shortBy)}` : money(balance - totalPrice)}</dd></div>
              )}
            </dl>

            {shortBy > 0 && (
              <p className="text-[13px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-[8px] px-3 py-2">
                Balance is short by {money(shortBy)}. <Link to="/dashboard/add-funds" className="underline underline-offset-2 font-medium">Add funds</Link>
              </p>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium rounded-[8px] transition-colors active:scale-[0.98]"
              data-testid="submit-order-btn"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isPackage ? 'Order package' : 'Place order')}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
