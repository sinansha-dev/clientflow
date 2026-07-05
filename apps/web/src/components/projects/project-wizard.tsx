import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createProjectSchema } from '@clientflow/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../lib/api';
import { useToastStore } from '../../stores/toast-store';
import { errorMessage } from '../../lib/errors';
import type { AuthUser, Client } from '@clientflow/types';

type ProjectInput = z.infer<typeof createProjectSchema>;

interface ProjectWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ProjectWizard({ onClose, onSuccess }: ProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const notify = useToastStore((state) => state.notify);

  // Additional state to manage team members assignments in wizard UI
  const [teamMembersInput, setTeamMembersInput] = useState<Array<{ userId: string; role: string }>>(
    [],
  );

  const form = useForm<ProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      clientId: '',
      projectName: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0] || '',
      deadline: '',
      priority: 'MEDIUM',
      budget: 0,
      estimatedHours: 0,
      status: 'PLANNING',
      projectManagerId: '',
      teamMembers: [],
    },
  });

  const {
    register,
    formState: { errors, isSubmitting },
    trigger,
    getValues,
  } = form;

  // Load clients and staff (users list)
  useEffect(() => {
    async function loadData() {
      try {
        const [cliRes, usrRes] = await Promise.all([
          api.get('/clients?limit=1000'),
          api.get('/users/staff'),
        ]);
        setClients(cliRes.data.data?.items ?? []);
        setStaff(usrRes.data.data?.users ?? []);
      } catch (err) {
        console.error('Failed to load project details selection options:', err);
        notify({
          type: 'error',
          title: 'Could not load team options',
          message: errorMessage(err, 'Refresh the page and try again.'),
        });
      }
    }
    loadData();
  }, [notify]);

  const nextStep = async () => {
    let fieldsToValidate: Array<keyof ProjectInput> = [];
    if (step === 1) {
      fieldsToValidate = ['clientId', 'projectName', 'description'];
    } else if (step === 2) {
      fieldsToValidate = ['startDate', 'deadline', 'priority', 'budget', 'estimatedHours'];
    } else if (step === 3) {
      fieldsToValidate = ['projectManagerId'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setStep((s) => s - 1);
  };

  // Team members adding/removing helpers
  const addTeamMember = () => {
    setTeamMembersInput((prev) => [...prev, { userId: '', role: 'Frontend Developer' }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembersInput((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, key: 'userId' | 'role', value: string) => {
    setTeamMembersInput((prev) =>
      prev.map((tm, i) => (i === index ? { ...tm, [key]: value } : tm)),
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Validate that PM is selected
      if (!values.projectManagerId) {
        notify({
          type: 'error',
          title: 'Validation Error',
          message: 'At least one Project Manager must be assigned',
        });
        return;
      }

      // Filter out invalid team members (missing userId)
      const cleanTeamMembers = teamMembersInput.filter((tm) => tm.userId !== '');

      // Combine payload
      const payload = {
        ...values,
        teamMembers: cleanTeamMembers,
      };

      await api.post('/projects', payload);
      notify({
        type: 'success',
        title: 'Project Created',
        message: 'Project registered successfully',
      });
      onSuccess();
      onClose();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Project Creation Failed',
        message: errorMessage(err, 'Failed to create project'),
      });
    }
  });

  const values = getValues();
  const selectedClient = clients.find((c) => c.id === values.clientId);
  const selectedPM = staff.find((s) => s.id === values.projectManagerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">Create New Project</h2>
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
            <span className={step === 1 ? 'text-primary' : ''}>1. Project Info</span>
            <span className={step === 2 ? 'text-primary' : ''}>2. Timeline & Budget</span>
            <span className={step === 3 ? 'text-primary' : ''}>3. Assign Team</span>
            <span className={step === 4 ? 'text-primary' : ''}>4. Review</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="project-wizard-form" onSubmit={onSubmit} className="grid gap-4">
            {/* STEP 1: Project Info */}
            {step === 1 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Project Information</h3>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Select Client *</label>
                  <select
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    {...register('clientId')}
                  >
                    <option value="">Choose a client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                  {errors.clientId && (
                    <span className="text-xs text-danger">{errors.clientId.message}</span>
                  )}
                </div>

                <Input
                  label="Project Name *"
                  {...register('projectName')}
                  error={errors.projectName?.message}
                  placeholder="e.g. Website Redesign 2026"
                />

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Description *</label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    rows={4}
                    {...register('description')}
                    placeholder="Provide overview of goals, scope, and target deliverables..."
                  />
                  {errors.description && (
                    <span className="text-xs text-danger">{errors.description.message}</span>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Timeline & Budget */}
            {step === 2 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Timeline & Budget</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Start Date *"
                    type="date"
                    {...register('startDate')}
                    error={errors.startDate?.message}
                  />
                  <Input
                    label="Deadline *"
                    type="date"
                    {...register('deadline')}
                    error={errors.deadline?.message}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Priority *</label>
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('priority')}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>

                  <Input
                    label="Budget ($) *"
                    type="number"
                    {...register('budget')}
                    error={errors.budget?.message}
                  />
                </div>

                <Input
                  label="Estimated Hours *"
                  type="number"
                  {...register('estimatedHours')}
                  error={errors.estimatedHours?.message}
                />
              </div>
            )}

            {/* STEP 3: Assign Team */}
            {step === 3 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Assign Project Manager & Team</h3>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Project Manager *</label>
                  <select
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    {...register('projectManagerId')}
                    disabled={staff.length === 0}
                  >
                    <option value="">Select project manager...</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                  {errors.projectManagerId && (
                    <span className="text-xs text-danger">{errors.projectManagerId.message}</span>
                  )}
                  {staff.length === 0 && (
                    <span className="text-xs text-warning">
                      No admin or developer users are available. Add team members first.
                    </span>
                  )}
                </div>

                {/* Additional Team Members */}
                <div className="border-t border-border pt-4 mt-2">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold">Additional Team Members</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={addTeamMember}
                      className="h-8 px-2 text-xs border border-border"
                    >
                      + Add Member
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {teamMembersInput.map((tm, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-center bg-muted/20 p-2 rounded-md border border-border/50"
                      >
                        <select
                          value={tm.userId}
                          onChange={(e) => updateTeamMember(idx, 'userId', e.target.value)}
                          className="h-10 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                          disabled={staff.length === 0}
                        >
                          <option value="">Choose User...</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                            </option>
                          ))}
                        </select>

                        <select
                          value={tm.role}
                          onChange={(e) => updateTeamMember(idx, 'role', e.target.value)}
                          className="h-10 w-44 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          <option value="Frontend Developer">Frontend</option>
                          <option value="Backend Developer">Backend</option>
                          <option value="Full Stack Developer">Full Stack</option>
                          <option value="UI/UX Designer">UI/UX Designer</option>
                          <option value="QA Tester">QA Tester</option>
                          <option value="DevOps">DevOps</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => removeTeamMember(idx)}
                          className="p-2 text-danger hover:bg-danger/10 rounded-md"
                          aria-label="Remove member"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Review */}
            {step === 4 && (
              <div className="grid gap-4">
                <h3 className="text-base font-semibold">Review & Confirm Project</h3>
                <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                  <div>
                    <h4 className="font-bold text-primary">Overview</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Project Name:</span>{' '}
                      {values.projectName}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Client:</span>{' '}
                      {selectedClient?.companyName}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Description:</span>{' '}
                      {values.description}
                    </p>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <h4 className="font-bold text-primary">Timeline & Budget</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Start Date:</span>{' '}
                      {values.startDate.toString()}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Deadline:</span>{' '}
                      {values.deadline.toString()}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Priority:</span>{' '}
                      {values.priority}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Budget:</span> $
                      {values.budget}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">Est. Hours:</span>{' '}
                      {values.estimatedHours} hrs
                    </p>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <h4 className="font-bold text-primary">Team assignments</h4>
                    <p className="mt-1">
                      <span className="font-medium text-foreground/60">Project Manager:</span>{' '}
                      {selectedPM?.firstName} {selectedPM?.lastName}
                    </p>
                    {teamMembersInput.filter((t) => t.userId).length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium text-foreground/60 block">
                          Assigned Staff:
                        </span>
                        <ul className="list-disc pl-5 mt-1 grid gap-0.5 text-xs">
                          {teamMembersInput
                            .filter((t) => t.userId)
                            .map((tm, i) => {
                              const u = staff.find((s) => s.id === tm.userId);
                              return (
                                <li key={i}>
                                  {u?.firstName} {u?.lastName} &mdash;{' '}
                                  <span className="italic">{tm.role}</span>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
          >
            Back
          </Button>

          {step < 4 ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit" form="project-wizard-form" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
