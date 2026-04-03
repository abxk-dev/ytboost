import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Star, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AddOrder() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catRes, svcRes] = await Promise.all([
          api.get('/categories'),
          api.get('/services/user')
        ]);
        setCategories(catRes.data);
        setServices(svcRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter services by selected category
  const filteredServices = useMemo(() => {
    if (!selectedCategory) return [];
    // Sort: special services first
    return services
      .filter(s => s.categoryId === selectedCategory)
      .sort((a, b) => (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0));
  }, [services, selectedCategory]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    if (!selectedService || !quantity) return 0;
    const qty = parseInt(quantity) || 0;
    return (qty / 1000) * selectedService.rate;
  }, [selectedService, quantity]);

  const handleServiceChange = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service);
    if (service) {
      setQuantity(service.minQty.toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedService) {
      setError('Please select a service');
      return;
    }

    const qty = parseInt(quantity);
    if (qty < selectedService.minQty || qty > selectedService.maxQty) {
      setError(`Quantity must be between ${selectedService.minQty.toLocaleString()} and ${selectedService.maxQty.toLocaleString()}`);
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/orders', {
        serviceId: selectedService.id,
        link,
        quantity: qty
      });
      toast.success('Order placed successfully!');
      navigate('/dashboard/orders');
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
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[8px] text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Category</Label>
              <Select value={selectedCategory} onValueChange={(val) => {
                setSelectedCategory(val);
                setSelectedService(null);
              }}>
                <SelectTrigger className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Service</Label>
              <Select 
                value={selectedService?.id || ''} 
                onValueChange={handleServiceChange}
                disabled={!selectedCategory}
              >
                <SelectTrigger className="h-11 rounded-[8px] border-[#e5e7eb]" data-testid="service-select">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {filteredServices.map(svc => (
                    <SelectItem key={svc.id} value={svc.id}>
                      <span className="flex items-center gap-2">
                        {svc.isSpecial && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        {svc.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            {selectedService && (
              <div className="space-y-2">
                <Label className="text-[#111827] font-medium">Description</Label>
                <Textarea
                  value={selectedService.description || 'No description available'}
                  readOnly
                  className="rounded-[8px] border-[#e5e7eb] bg-[#f9fafb] resize-none min-h-[80px]"
                  data-testid="service-description"
                />
              </div>
            )}

            {/* Link */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Link</Label>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
                className="h-11 rounded-[8px] border-[#e5e7eb]"
                data-testid="link-input"
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Quantity</Label>
              <Input
                type="number"
                placeholder="Enter quantity"
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
                  Min: {selectedService.minQty.toLocaleString()} &nbsp;|&nbsp; 
                  Price: ${selectedService.rate.toFixed(2)}/1,000
                </p>
              )}
            </div>

            {/* Total Price */}
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Total Price</Label>
              <Input
                type="text"
                value={`$${totalPrice.toFixed(4)}`}
                readOnly
                className="h-11 rounded-[8px] border-[#e5e7eb] bg-[#f9fafb] font-semibold"
                data-testid="total-price"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={submitting || !selectedService}
                className="h-11 px-8 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px] uppercase tracking-wider"
                data-testid="submit-order-btn"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SUBMIT'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
