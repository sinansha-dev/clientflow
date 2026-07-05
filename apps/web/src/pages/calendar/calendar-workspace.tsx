import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToastStore } from '../../stores/toast-store';
import { useAuthStore } from '../../stores/auth-store';
import { errorMessage } from '../../lib/errors';
import type { CalendarEvent, Project, AuthUser } from '@clientflow/types';
import { ChevronLeft, ChevronRight, Plus, Video, CalendarDays, Clock, User } from 'lucide-react';

export function CalendarWorkspacePage() {
  const { user } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Nav date
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal scheduler
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isMeetingType, setIsMeetingType] = useState(true); // Toggle meeting vs custom event
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    projectId: '',
    eventType: 'REMINDER', // For custom event
    meetingType: 'INTERNAL', // For meeting
    platform: 'GOOGLE_MEET',
    meetingLink: '',
    participantIds: [] as string[],
  });

  const loadFilterOptions = async () => {
    try {
      const [prjRes, usrRes] = await Promise.all([
        api.get('/projects?limit=1000'),
        api.get('/users'),
      ]);
      setProjects(prjRes.data.data?.items ?? []);
      setTeam((usrRes.data.data ?? []).filter((u: AuthUser) => u.role !== 'CLIENT'));
    } catch (err) {
      console.error(err);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/calendar/events');
      setEvents(res.data.data ?? []);
    } catch (err) {
      notify({ type: 'error', title: 'Load Failed', message: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    loadEvents();
  }, []);

  // Drag and drop reschedule
  const handleDragStart = (e: React.DragEvent, eventId: string, eventType: string) => {
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.setData('resourceType', eventType);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dropDateStr: string) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    const resourceType = e.dataTransfer.getData('resourceType');
    if (!eventId) return;

    // Filter target event
    const eventItem = events.find((evt) => evt.id === eventId);
    if (!eventItem) return;

    // Format new date retaining previous hours
    const oldStart = new Date(eventItem.startTime);
    const oldEnd = new Date(eventItem.endTime);
    const diffMs = oldEnd.getTime() - oldStart.getTime();

    const targetDate = new Date(dropDateStr);
    const newStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      oldStart.getHours(),
      oldStart.getMinutes(),
    );
    const newEnd = new Date(newStart.getTime() + diffMs);

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((evt) =>
        evt.id === eventId ? { ...evt, startTime: newStart, endTime: newEnd } : evt,
      ),
    );

    try {
      if (resourceType === 'MEETING') {
        await api.patch(`/meetings/${eventId}`, {
          startTime: newStart,
          endTime: newEnd,
        });
      } else if (resourceType === 'TASK_DUE_DATE') {
        await api.patch(`/tasks/${eventId}`, {
          dueDate: newStart,
        });
      } else if (resourceType === 'DEADLINE') {
        await api.patch(`/projects/${eventId}`, {
          deadline: newStart,
        });
      } else {
        await api.patch(`/calendar/events/${eventId}`, {
          startTime: newStart,
          endTime: newEnd,
        });
      }
      notify({ type: 'success', title: 'Schedule updated' });
      loadEvents();
    } catch (err) {
      notify({ type: 'error', title: 'Reschedule Failed', message: errorMessage(err) });
      loadEvents(); // revert
    }
  };

  // Create event / meeting submit
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isMeetingType) {
        await api.post('/meetings', {
          projectId: eventForm.projectId || null,
          title: eventForm.title,
          description: eventForm.description,
          startTime: eventForm.startTime,
          endTime: eventForm.endTime,
          meetingType: eventForm.meetingType,
          platform: eventForm.platform,
          meetingLink: eventForm.meetingLink,
          participantIds: eventForm.participantIds,
        });
      } else {
        await api.post('/calendar/events', {
          title: eventForm.title,
          description: eventForm.description,
          startTime: eventForm.startTime,
          endTime: eventForm.endTime,
          eventType: eventForm.eventType,
          projectId: eventForm.projectId || null,
        });
      }
      notify({ type: 'success', title: 'Scheduled successfully' });
      setShowScheduleModal(false);
      setEventForm({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        projectId: '',
        eventType: 'REMINDER',
        meetingType: 'INTERNAL',
        platform: 'GOOGLE_MEET',
        meetingLink: '',
        participantIds: [],
      });
      loadEvents();
    } catch (err) {
      notify({ type: 'error', title: 'Action Failed', message: errorMessage(err) });
    }
  };

  const handleParticipantToggle = (memberId: string) => {
    const ids = eventForm.participantIds.includes(memberId)
      ? eventForm.participantIds.filter((id) => id !== memberId)
      : [...eventForm.participantIds, memberId];
    setEventForm({ ...eventForm, participantIds: ids });
  };

  // Navigation months
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Generate calendar days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days: Date[] = [];
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthTotalDays - i));
  }

  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }

  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(new Date(year, month + 1, i));
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  return (
    <div className="grid gap-6">
      {/* Navigation Headers */}
      <Card className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            {monthName} {year}
          </h2>
          <div className="flex gap-1.5 ml-2">
            <Button variant="ghost" onClick={prevMonth} className="h-8 w-8 p-0 border">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={nextMonth} className="h-8 w-8 p-0 border">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Schedule Event
        </Button>
      </Card>

      {/* Grid cells */}
      <Card className="p-0 overflow-hidden border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold uppercase tracking-wider text-foreground/60 py-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border bg-card">
          {days.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === month;
            const dateStr = date.toISOString().split('T')[0] || '';

            // Filter events due/scheduled on this date
            const daysEvents = events.filter((evt) => {
              const start = new Date(evt.startTime).toISOString().split('T')[0];
              return start === dateStr;
            });

            return (
              <div
                key={idx}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`min-h-[110px] p-2 space-y-1.5 flex flex-col transition ${
                  isCurrentMonth
                    ? 'text-foreground hover:bg-muted/10'
                    : 'bg-muted/10 text-foreground/30'
                }`}
              >
                <span className="text-xs font-bold font-mono self-end">{date.getDate()}</span>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {daysEvents.map((evt) => (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, evt.id, evt.eventType || 'REMINDER')}
                      className={`text-[9px] p-1 rounded font-semibold truncate cursor-grab active:cursor-grabbing border ${
                        evt.eventType === 'MEETING'
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          : evt.eventType === 'TASK_DUE_DATE'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : evt.eventType === 'DEADLINE'
                              ? 'bg-danger/10 text-danger border-danger/25'
                              : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                      title={`${evt.title}\n${evt.description || ''}`}
                    >
                      {evt.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl p-6 relative">
            <h3 className="text-base font-bold mb-3">Schedule Calendar Event</h3>

            {/* Toggle Meeting vs Custom Event */}
            <div className="flex gap-2 mb-4 bg-muted/40 p-1 rounded-lg text-xs font-bold self-start w-fit">
              <button
                type="button"
                onClick={() => setIsMeetingType(true)}
                className={`px-3 py-1.5 rounded-md transition ${isMeetingType ? 'bg-primary text-primary-foreground' : 'text-foreground/60'}`}
              >
                Board Meeting
              </button>
              <button
                type="button"
                onClick={() => setIsMeetingType(false)}
                className={`px-3 py-1.5 rounded-md transition ${!isMeetingType ? 'bg-primary text-primary-foreground' : 'text-foreground/60'}`}
              >
                Custom Event
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="grid gap-3 text-xs">
              <div className="grid gap-1">
                <label className="font-semibold">Event Title *</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g. Sprint Planning Review"
                  className="h-10 rounded border border-border bg-background px-3 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="font-semibold">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <label className="font-semibold">End Time *</label>
                  <input
                    type="datetime-local"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">Linked Project (Optional)</label>
                <select
                  value={eventForm.projectId}
                  onChange={(e) => setEventForm({ ...eventForm, projectId: e.target.value })}
                  className="h-10 rounded border border-border bg-background px-3"
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>

              {/* MEETING DETAILS */}
              {isMeetingType ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <label className="font-semibold">Meeting Type</label>
                      <select
                        value={eventForm.meetingType}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, meetingType: e.target.value })
                        }
                        className="h-10 rounded border border-border bg-background px-3"
                      >
                        <option value="INTERNAL">Internal</option>
                        <option value="CLIENT">Client</option>
                        <option value="SPRINT_PLANNING">Sprint Planning</option>
                        <option value="STAND_UP">Stand-up</option>
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <label className="font-semibold">Platform</label>
                      <select
                        value={eventForm.platform}
                        onChange={(e) => setEventForm({ ...eventForm, platform: e.target.value })}
                        className="h-10 rounded border border-border bg-background px-3"
                      >
                        <option value="GOOGLE_MEET">Google Meet</option>
                        <option value="ZOOM">Zoom</option>
                        <option value="MICROSOFT_TEAMS">MS Teams</option>
                        <option value="IN_PERSON">In Person</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="font-semibold">Meeting URL Link</label>
                    <input
                      type="url"
                      value={eventForm.meetingLink}
                      onChange={(e) => setEventForm({ ...eventForm, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      className="h-10 rounded border border-border bg-background px-3 outline-none"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="font-semibold">Invite Participants *</label>
                    <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto border p-2 bg-background rounded">
                      {team.map((t) => {
                        const selected = eventForm.participantIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleParticipantToggle(t.id)}
                            className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold transition ${
                              selected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'bg-muted text-foreground/75'
                            }`}
                          >
                            {t.firstName} {t.lastName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-1">
                  <label className="font-semibold">Event Type</label>
                  <select
                    value={eventForm.eventType}
                    onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                    className="h-10 rounded border border-border bg-background px-3"
                  >
                    <option value="REMINDER">Reminder</option>
                    <option value="LEAVE">Leave/Time-off</option>
                    <option value="HOLIDAY">Company Holiday</option>
                  </select>
                </div>
              )}

              <div className="grid gap-1">
                <label className="font-semibold">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={2}
                  className="rounded border border-border bg-background px-3 py-1.5 outline-none"
                  placeholder="Notes, agenda criteria etc."
                />
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <Button type="button" variant="ghost" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Schedule Event</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
