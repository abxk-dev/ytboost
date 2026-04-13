import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Search, ArrowRight, Play } from 'lucide-react';

function formatPriceUSD(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '';
  if (num < 1) return num.toFixed(3);
  return num.toFixed(2);
}

export default function Services() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [catsRes, svcRes] = await Promise.all([
          api.get('/categories'),
          api.get('/services'),
        ]);
        const cats = Array.isArray(catsRes.data) ? catsRes.data : [];
        const svcs = Array.isArray(svcRes.data) ? svcRes.data : [];
        setCategories(cats);
        setServices(svcs);
        setActiveCategoryId(cats[0]?.id || '');
      } catch (e) {
        setCategories([]);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const servicesByCategory = useMemo(() => {
    const map = new Map();
    for (const cat of categories) map.set(cat.id, []);
    for (const svc of services) {
      const list = map.get(svc.categoryId) || [];
      list.push(svc);
      map.set(svc.categoryId, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => {
        const ar = Number(a.rate);
        const br = Number(b.rate);
        if (Number.isFinite(ar) && Number.isFinite(br)) return ar - br;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      map.set(k, list);
    }
    return map;
  }, [categories, services]);

  const visibleCategories = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((cat) => {
      const list = servicesByCategory.get(cat.id) || [];
      return list.some((svc) => String(svc.name || '').toLowerCase().includes(query));
    });
  }, [categories, q, servicesByCategory]);

  const visibleServices = useMemo(() => {
    const list = servicesByCategory.get(activeCategoryId) || [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((svc) => String(svc.name || '').toLowerCase().includes(query));
  }, [servicesByCategory, activeCategoryId, q]);

  useEffect(() => {
    if (!activeCategoryId && visibleCategories[0]?.id) {
      setActiveCategoryId(visibleCategories[0].id);
    }
    if (activeCategoryId && !visibleCategories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(visibleCategories[0]?.id || '');
    }
  }, [activeCategoryId, visibleCategories]);

  return (
    <>
      <div className="min-h-screen bg-[#070a12] text-white">
        <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex items-center justify-between gap-3">
              <Link to="/" className="flex items-center gap-2">
                <span className="inline-flex h-8 w-10 items-center justify-center rounded-md bg-[#ff0000]">
                  <Play className="h-4 w-4" fill="#fff" />
                </span>
                <span className="text-xl font-extrabold tracking-tight">YTBoost</span>
                <span className="text-xl font-extrabold tracking-tight text-white/60">.io</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">
                  Sign In
                </Link>
                <Link to="/register" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                  Get Started
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_420px]">
              <div>
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  Browse Services
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                  Choose a category, compare options, and order in seconds after creating an account.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-white/60" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search services…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Categories</div>
            {loading ? (
              <div className="px-2 py-4 text-sm text-white/60">Loading…</div>
            ) : visibleCategories.length === 0 ? (
              <div className="px-2 py-4 text-sm text-white/60">No categories found.</div>
            ) : (
              <div className="space-y-1">
                {visibleCategories.map((cat) => {
                  const active = cat.id === activeCategoryId;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        active ? 'bg-white text-black' : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{cat.name}</span>
                        <span className={`text-xs ${active ? 'text-black/60' : 'text-white/40'}`}>
                          {(servicesByCategory.get(cat.id) || []).length}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                Loading services…
              </div>
            ) : visibleServices.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                No services found for this category.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleServices.map((svc) => {
                  const isPackage = svc.packagePrice != null && String(svc.packagePrice) !== '';
                  const price = isPackage ? svc.packagePrice : svc.rate;
                  const priceLabel = isPackage ? 'Package' : '/ 1000';
                  return (
                    <div key={svc.id} className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/5 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                            {svc.categoryName}
                          </div>
                          <div className="mt-1 truncate text-base font-bold">{svc.name}</div>
                        </div>
                        <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-right text-black">
                          <div className="text-xs font-semibold text-black/60">From</div>
                          <div className="text-lg font-extrabold">${formatPriceUSD(price)}</div>
                          <div className="text-[11px] font-semibold text-black/60">{priceLabel}</div>
                        </div>
                      </div>

                      {svc.description ? (
                        <p className="mt-3 line-clamp-2 text-sm text-white/70">{svc.description}</p>
                      ) : (
                        <p className="mt-3 text-sm text-white/60">Instant start, safe checkout, no password needed.</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                          Min: {Number(svc.minQty).toLocaleString()}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                          Max: {Number(svc.maxQty).toLocaleString()}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                          Type: {svc.type || 'Default'}
                        </span>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-2">
                        <div className="text-xs text-white/45">
                          Create an account to order this service.
                        </div>
                        <Link
                          to="/register"
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
                        >
                          Order
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 py-8">
          <div className="mx-auto max-w-6xl px-4 text-sm text-white/50">
            © 2026 YTBoost.io. All rights reserved.
          </div>
        </div>
      </div>
    </>
  );
}
