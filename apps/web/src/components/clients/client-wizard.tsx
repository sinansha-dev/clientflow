import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createClientSchema } from '@clientflow/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../lib/api';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type { AuthUser } from '@clientflow/types';

type ClientInput = z.infer<typeof createClientSchema>;

interface ClientWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ClientWizard({ onClose, onSuccess }: ClientWizardProps) {
  const [step, setStep] = useState(1);
  const [managers, setManagers] = useState<AuthUser[]>([]);
  const notify = useToastStore((state) => state.notify);

  const form = useForm<ClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      companyName: '',
      companyLogo: '',
      industry: '',
      website: '',
      email: '',
      phone: '',
      billingAddress: '',
      shippingAddress: '',
      country: '',
      state: '',
      city: '',
      postalCode: '',
      currency: 'USD',
      timezone: 'UTC',
      status: 'ACTIVE',
      taxNumber: '',
      source: '',
      assignedManagerId: '',
      primaryContact: {
        name: '',
        position: '',
        email: '',
        phone: '',
        whatsapp: '',
      },
    },
  });

  const {
    register,
    formState: { errors, isSubmitting },
    trigger,
    getValues,
    setValue,
    watch,
  } = form;

  const billingAddressValue = watch('billingAddress');

  // Load account managers (users list)
  useEffect(() => {
    async function loadManagers() {
      try {
        const response = await api.get('/users');
        // Filter users who can be account managers (ADMIN or DEVELOPER)
        const staff = (response.data.data?.users ?? []).filter(
          (u: AuthUser) => u.role === 'ADMIN' || u.role === 'DEVELOPER',
        );
        setManagers(staff);
      } catch (err) {
        console.error('Failed to load managers:', err);
      }
    }
    loadManagers();
  }, []);

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) {
      fieldsToValidate = ['companyName', 'companyLogo', 'industry', 'website', 'email', 'phone'];
    } else if (step === 2) {
      fieldsToValidate = [
        'billingAddress',
        'shippingAddress',
        'country',
        'state',
        'city',
        'postalCode',
      ];
    } else if (step === 3) {
      fieldsToValidate = [
        'primaryContact.name',
        'primaryContact.position',
        'primaryContact.email',
        'primaryContact.phone',
        'primaryContact.whatsapp',
      ];
    } else if (step === 4) {
      fieldsToValidate = ['currency', 'timezone', 'taxNumber', 'source', 'assignedManagerId'];
    }

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setStep((s) => s - 1);
  };

  const copyBillingToShipping = () => {
    setValue('shippingAddress', billingAddressValue);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Clean empty fields
      const payload = { ...values };
      if (!payload.companyLogo) delete payload.companyLogo;
      if (!payload.taxNumber) delete payload.taxNumber;
      if (!payload.source) delete payload.source;
      if (!payload.assignedManagerId) delete payload.assignedManagerId;

      // Clean empty primary contact fields
      if (payload.primaryContact && !payload.primaryContact.name) {
        delete payload.primaryContact;
      } else if (payload.primaryContact && !payload.primaryContact.whatsapp) {
        delete payload.primaryContact.whatsapp;
      }

      await api.post('/clients', payload);
      notify({
        type: 'success',
        title: 'Client Created',
        message: 'Client company registered successfully',
      });
      onSuccess();
      onClose();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Creation Failed',
        message: errorMessage(err, 'Failed to create client'),
      });
    }
  });

  const values = getValues();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-full max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">Add New Client</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-foreground/50 hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {/* Steps Progress */}
        <div className="border-b border-border bg-muted/30 px-6 py-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground/60">
            <span className={step === 1 ? 'text-primary' : ''}>1. Company Info</span>
            <span className={step === 2 ? 'text-primary' : ''}>2. Address</span>
            <span className={step === 3 ? 'text-primary' : ''}>3. Primary Contact</span>
            <span className={step === 4 ? 'text-primary' : ''}>4. Billing Details</span>
            <span className={step === 5 ? 'text-primary' : ''}>5. Review</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="wizard-form" onSubmit={onSubmit} className="grid gap-4">
            {/* STEP 1: Company Info */}
            {step === 1 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Company Information</h3>
                <Input
                  label="Company Name *"
                  {...register('companyName')}
                  error={errors.companyName?.message}
                  placeholder="e.g. Acme Corporation"
                />
                <Input
                  label="Company Logo URL"
                  {...register('companyLogo')}
                  error={errors.companyLogo?.message}
                  placeholder="https://example.com/logo.png"
                />
                <Input
                  label="Industry *"
                  {...register('industry')}
                  error={errors.industry?.message}
                  placeholder="e.g. Software, Marketing, Finance"
                />
                <Input
                  label="Website *"
                  {...register('website')}
                  error={errors.website?.message}
                  placeholder="https://acme.com"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Company Email *"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                    placeholder="info@acme.com"
                  />
                  <Input
                    label="Company Phone *"
                    {...register('phone')}
                    error={errors.phone?.message}
                    placeholder="+1 (555) 019-2834"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Address */}
            {step === 2 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Address Details</h3>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Billing Address *</label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    rows={2}
                    {...register('billingAddress')}
                    placeholder="Street Address, Suite, PO Box"
                  />
                  {errors.billingAddress && (
                    <span className="text-xs text-danger">{errors.billingAddress.message}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Shipping Address *</label>
                  <button
                    type="button"
                    onClick={copyBillingToShipping}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Copy Billing Address
                  </button>
                </div>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={2}
                  {...register('shippingAddress')}
                  placeholder="Shipping Address if different"
                />
                {errors.shippingAddress && (
                  <span className="text-xs text-danger">{errors.shippingAddress.message}</span>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Country *"
                    {...register('country')}
                    error={errors.country?.message}
                    placeholder="United States"
                  />
                  <Input
                    label="State / Region *"
                    {...register('state')}
                    error={errors.state?.message}
                    placeholder="California"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="City *"
                    {...register('city')}
                    error={errors.city?.message}
                    placeholder="San Francisco"
                  />
                  <Input
                    label="Postal Code *"
                    {...register('postalCode')}
                    error={errors.postalCode?.message}
                    placeholder="94103"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Primary Contact */}
            {step === 3 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Primary Contact Person (Optional)</h3>
                <Input
                  label="Contact Name"
                  {...register('primaryContact.name')}
                  error={errors.primaryContact?.name?.message}
                  placeholder="John Doe"
                />
                <Input
                  label="Position / Role"
                  {...register('primaryContact.position')}
                  error={errors.primaryContact?.position?.message}
                  placeholder="Product Manager, CTO"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Contact Email"
                    type="email"
                    {...register('primaryContact.email')}
                    error={errors.primaryContact?.email?.message}
                    placeholder="johndoe@acme.com"
                  />
                  <Input
                    label="Contact Phone"
                    {...register('primaryContact.phone')}
                    error={errors.primaryContact?.phone?.message}
                    placeholder="+1 (555) 012-3456"
                  />
                </div>
                <Input
                  label="WhatsApp Number"
                  {...register('primaryContact.whatsapp')}
                  error={errors.primaryContact?.whatsapp?.message}
                  placeholder="Include country code, e.g. +15550123456"
                />
              </div>
            )}

            {/* STEP 4: Billing Details */}
            {step === 4 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Billing Details & Account Options</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Currency *</label>
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('currency')}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                    {errors.currency && (
                      <span className="text-xs text-danger">{errors.currency.message}</span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Timezone *</label>
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('timezone')}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">EST/EDT (New York)</option>
                      <option value="America/Chicago">CST/CDT (Chicago)</option>
                      <option value="America/Denver">MST/MDT (Denver)</option>
                      <option value="America/Los_Angeles">PST/PDT (Los Angeles)</option>
                      <option value="Europe/London">GMT/BST (London)</option>
                      <option value="Europe/Paris">CET/CEST (Paris)</option>
                      <option value="Asia/Tokyo">JST (Tokyo)</option>
                      <option value="Asia/Kolkata">IST (Kolkata)</option>
                    </select>
                    {errors.timezone && (
                      <span className="text-xs text-danger">{errors.timezone.message}</span>
                    )}
                  </div>
                </div>

                <Input
                  label="Tax Number / VAT ID"
                  {...register('taxNumber')}
                  error={errors.taxNumber?.message}
                  placeholder="e.g. US123456789"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Lead Source</label>
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('source')}
                    >
                      <option value="">Select source</option>
                      <option value="Referral">Referral</option>
                      <option value="Website">Website</option>
                      <option value="Cold Outreach">Cold Outreach</option>
                      <option value="Partner">Partner</option>
                      <option value="LinkedIn">LinkedIn</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Account Manager</label>
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('assignedManagerId')}
                    >
                      <option value="">Unassigned</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Review */}
            {step === 5 && (
              <div className="grid gap-6">
                <h3 className="text-base font-semibold">Review Information</h3>
                <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <div>
                    <h4 className="font-bold text-primary">Company Info</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Name:</span>{' '}
                      {values.companyName}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Industry:</span>{' '}
                      {values.industry}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Website:</span>{' '}
                      {values.website}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Email:</span> {values.email}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Phone:</span> {values.phone}
                    </p>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <h4 className="font-bold text-primary">Address</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Billing:</span>{' '}
                      {values.billingAddress}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Shipping:</span>{' '}
                      {values.shippingAddress}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Location:</span>{' '}
                      {values.city}, {values.state}, {values.postalCode}, {values.country}
                    </p>
                  </div>

                  {values.primaryContact && values.primaryContact.name && (
                    <>
                      <hr className="border-border" />
                      <div>
                        <h4 className="font-bold text-primary">Primary Contact</h4>
                        <p className="mt-1">
                          <span className="font-medium text-foreground/60">Name:</span>{' '}
                          {values.primaryContact.name} ({values.primaryContact.position})
                        </p>
                        <p>
                          <span className="font-medium text-foreground/60">Email:</span>{' '}
                          {values.primaryContact.email}
                        </p>
                        <p>
                          <span className="font-medium text-foreground/60">Phone:</span>{' '}
                          {values.primaryContact.phone}
                        </p>
                      </div>
                    </>
                  )}

                  <hr className="border-border" />

                  <div>
                    <h4 className="font-bold text-primary">Billing & Settings</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Currency:</span>{' '}
                      {values.currency} |{' '}
                      <span className="font-medium text-foreground/60">Timezone:</span>{' '}
                      {values.timezone}
                    </p>
                    {values.taxNumber && (
                      <p>
                        <span className="font-medium text-foreground/60">Tax ID:</span>{' '}
                        {values.taxNumber}
                      </p>
                    )}
                    {values.source && (
                      <p>
                        <span className="font-medium text-foreground/60">Lead Source:</span>{' '}
                        {values.source}
                      </p>
                    )}
                    {values.assignedManagerId && (
                      <p>
                        <span className="font-medium text-foreground/60">Account Manager ID:</span>{' '}
                        {values.assignedManagerId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
          >
            Back
          </Button>

          {step < 5 ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit" form="wizard-form" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Client'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
