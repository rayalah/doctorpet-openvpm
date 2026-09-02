"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Send,
  ArrowLeft,
  ArrowRight,
  Clock,
  Circle,
  Plus,
  Search,
  Inbox as InboxIcon,
  X,
  UserCheck,
  UserMinus,
  UserPlus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  isClientSearchInputValid,
} from "@/lib/clients/policy";
import {
  COMMUNICATION_SUBJECT_MAX_LENGTH,
  communicationContentMaxLength,
  isCommunicationContentValid,
  isCommunicationSubjectValid,
} from "@/lib/communications/policy";
import { communicationStatusLabel } from "@/lib/communications/status";
import { toast } from "sonner";
import { dateLocaleForLanguage } from "@/lib/i18n/language";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/messages";
import type { InboxSmsStatusKind } from "@/lib/messaging/inbox-status";

type FilterTab = "all" | "unread" | "sent";
type Channel = "phone" | "sms" | "email" | "portal";

type InboxListItem = {
  id: string;
  clientId: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  content: string | null;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  readAt?: Date | string | null;
  providerMessageId: string | null;
  createdAt: Date | string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  unreadCount?: number;
};

type ClientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type ConversationGroup =
  | {
      kind: "client";
      id: string;
      clientId: string;
      clientName: string;
      latest: InboxListItem;
      unreadCount: number;
    }
  | {
      kind: "unmatched";
      id: string;
      communicationId: string;
      clientName: string;
      latest: InboxListItem;
      unreadCount: number;
    };

const channelIcons: Record<Channel, React.ElementType> = {
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
  portal: Globe,
};

function channelLabel(channel: Channel, t: Translator): string {
  return t(
    channel === "phone"
      ? "messaging.phone"
      : channel === "sms"
        ? "messaging.sms"
        : channel === "email"
          ? "messaging.email"
          : "messaging.portal",
  );
}

function dateInputDayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

function formatInboxDate(
  date: Date,
  timeZone: string | null | undefined,
  locale: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeZone: timeZone ?? undefined,
  };

  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(locale, {
      ...options,
      timeZone: undefined,
    });
  }
}

function relativeTime(
  date: Date | string | null,
  timeZone?: string | null,
  locale = "en-US",
  t?: Translator,
): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t?.("messaging.justNow") ?? "Just now";
  if (diffMin < 60) return t?.("messaging.minutesAgo").replace("{count}", String(diffMin)) ?? `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t?.("messaging.hoursAgo").replace("{count}", String(diffHr)) ?? `${diffHr}h ago`;
  const todayDay = dateInputDayNumber(
    formatDateInputForTimeZone(now, timeZone),
  );
  const messageDay = dateInputDayNumber(
    formatDateInputForTimeZone(d, timeZone),
  );
  const diffDay =
    todayDay !== null && messageDay !== null
      ? todayDay - messageDay
      : Math.floor(diffHr / 24);
  if (diffDay === 1) return t?.("messaging.yesterday") ?? "Yesterday";
  if (diffDay < 7) return t?.("messaging.daysAgo").replace("{count}", String(diffDay)) ?? `${diffDay}d ago`;
  return formatInboxDate(d, timeZone, locale);
}

function localizedStatusLabel(status: string, t: Translator): string {
  const labels: Record<string, Parameters<Translator>[0]> = {
    Pending: "messaging.statusPending",
    Sent: "messaging.statusSent",
    Delivered: "messaging.statusDelivered",
    Read: "messaging.statusRead",
    Failed: "messaging.statusFailed",
    Unread: "messaging.statusUnread",
    "Read by clinic": "messaging.statusReadByClinic",
    "Read by client": "messaging.statusReadByClient",
    "Delivered to portal": "messaging.statusDeliveredToPortal",
  };
  const key = labels[status];
  return key ? t(key) : status;
}

function localizeSmsSummary(
  summary: { kind: InboxSmsStatusKind; title: string },
  t: Translator,
): { title: string; description: string; badge: string; actionLabel: string | null } {
  switch (summary.kind) {
    case "ready":
      return {
        title: t("messaging.smsSummary.readyTitle"),
        description: t("messaging.smsSummary.readyDescription"),
        badge: t("messaging.smsSummary.readyBadge"),
        actionLabel: null,
      };
    case "disabled":
      if (summary.title === "Texting is set up but sending is off") {
        return {
          title: t("messaging.smsSummary.disabledSendingTitle"),
          description: t("messaging.smsSummary.disabledSendingDescription"),
          badge: t("messaging.smsSummary.disabledSendingBadge"),
          actionLabel: t("messaging.smsSummary.enableSending"),
        };
      }
      return {
        title: t("messaging.smsSummary.disabledTitle"),
        description: t("messaging.smsSummary.disabledDescription"),
        badge: t("messaging.smsSummary.disabledBadge"),
        actionLabel: null,
      };
    case "not_configured":
      return {
        title: t("messaging.smsSummary.notConfiguredTitle"),
        description: t("messaging.smsSummary.notConfiguredDescription"),
        badge: t("messaging.smsSummary.notConfiguredBadge"),
        actionLabel: t("messaging.smsSummary.notConfiguredAction"),
      };
    case "action_required":
      return {
        title: t("messaging.smsSummary.actionRequiredTitle"),
        description: t("messaging.smsSummary.actionRequiredDescription"),
        badge: t("messaging.smsSummary.actionRequiredBadge"),
        actionLabel: t("messaging.smsSummary.reviewSetup"),
      };
    case "pending":
      return {
        title: t("messaging.smsSummary.pendingTitle"),
        description: t("messaging.smsSummary.pendingDescription"),
        badge: t("messaging.smsSummary.pendingBadge"),
        actionLabel: t("messaging.smsSummary.reviewSetup"),
      };
  }
}

function isUnreadInboxMessage(item: {
  direction: string;
  status: string;
  readAt?: Date | string | null;
}) {
  return item.direction === "inbound" && !item.readAt && item.status !== "read";
}

function canMutateInboxRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

export default function InboxPage() {
  const { data: session } = useSession();
  const language = useLanguage();
  const t = useTranslations();
  const locale = dateLocaleForLanguage(language);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedUnmatched, setSelectedUnmatched] =
    useState<InboxListItem | null>(null);
  const [linkClientSearch, setLinkClientSearch] = useState("");

  // Compose form state
  const [composeChannel, setComposeChannel] = useState<Channel>("portal");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");

  // New message client picker
  const [newMessageMode, setNewMessageMode] = useState(false);
  const [newClientSearch, setNewClientSearch] = useState("");
  const [smsBannerDismissed, setSmsBannerDismissed] = useState(false);
  const trimmedNewClientSearch = newClientSearch.trim();
  const trimmedLinkClientSearch = linkClientSearch.trim();
  const canSearchNewClients = isClientSearchInputValid(newClientSearch);
  const canSearchLinkClients = isClientSearchInputValid(linkClientSearch);

  const {
    data: inboxSettings,
    isLoading: inboxSettingsLoading,
    error: inboxSettingsError,
  } = trpc.communications.settings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: commsData,
    isLoading,
    error: inboxError,
  } = trpc.communications.listConversations.useQuery(
    { inboxFilter: filter, limit: 50, offset: 0 },
    { refetchInterval: 30000 },
  );

  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
  } = trpc.communications.getByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId },
  );

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = trpc.clients.search.useQuery(
    { query: trimmedNewClientSearch },
    { enabled: canSearchNewClients },
  );

  const {
    data: linkClientResults,
    isLoading: linkClientLoading,
    error: linkClientError,
  } = trpc.clients.search.useQuery(
    { query: trimmedLinkClientSearch },
    { enabled: Boolean(selectedUnmatched && canSearchLinkClients) },
  );

  const {
    data: messagingStatus,
    isLoading: messagingStatusLoading,
    error: messagingStatusError,
    refetch: refetchMessagingStatus,
  } = trpc.messaging.getInboxStatus.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });

  const utils = trpc.useUtils();
  const smsSummary = messagingStatus?.summary;
  const localizedSmsSummary = smsSummary
    ? localizeSmsSummary(smsSummary, t)
    : null;
  const smsStatusUnavailable =
    !messagingStatusLoading &&
    (Boolean(messagingStatusError) || !messagingStatus);
  const smsComposeBlocked =
    composeChannel === "sms" && smsSummary?.smsComposeEnabled !== true;
  const showSmsBanner = Boolean(smsSummary?.showBanner && !smsBannerDismissed);
  const showSmsStatusError = Boolean(
    smsStatusUnavailable && !smsBannerDismissed,
  );
  const currentUserId = session?.user?.id;
  const canMutateInbox = canMutateInboxRole(session?.user?.role);
  const inboxListError = inboxSettingsError ?? inboxError;
  const inboxListLoading = inboxSettingsLoading || isLoading;
  const inboxSettingsMissing =
    !inboxSettingsLoading && !inboxSettingsError && !inboxSettings;
  const inboxMessagesMissing = !isLoading && !inboxError && !commsData?.items;
  const inboxListMissing = inboxSettingsMissing || inboxMessagesMissing;
  const timelineDisplayError = inboxSettingsError ?? timelineError;
  const timelineDisplayLoading = inboxSettingsLoading || timelineLoading;
  const timelineMissing =
    Boolean(selectedClientId) &&
    !timelineLoading &&
    !timelineError &&
    !timeline;
  const timelineDisplayMissing = inboxSettingsMissing || timelineMissing;
  const searchMissing =
    canSearchNewClients && !searchLoading && !searchError && !searchResults;
  const linkClientMissing =
    Boolean(selectedUnmatched && canSearchLinkClients) &&
    !linkClientLoading &&
    !linkClientError &&
    !linkClientResults;
  const verifiedInboxSettings =
    inboxSettingsError || inboxSettingsMissing || !inboxSettings
      ? null
      : inboxSettings;
  const inboxTimeZone = verifiedInboxSettings
    ? verifiedInboxSettings.timezone
    : null;

  useEffect(() => {
    if (inboxSettingsError || inboxSettingsMissing) {
      setSelectedUnmatched(null);
    }
  }, [inboxSettingsError, inboxSettingsMissing]);

  const externalComposeRequest = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const createMutation = trpc.communications.create.useMutation({
    onSuccess: () => {
      externalComposeRequest.current = null;
      toast.success(t("messaging.messageSent"));
      utils.communications.listConversations.invalidate();
      if (selectedClientId) {
        utils.communications.getByClient.invalidate({
          clientId: selectedClientId,
        });
      }
      setComposeContent("");
      setComposeSubject("");
    },
    onError: (err) => {
      if (err.data?.code === "BAD_REQUEST") {
        externalComposeRequest.current = null;
      }
      toast.error(err.message);
      utils.communications.listConversations.invalidate();
      if (selectedClientId) {
        utils.communications.getByClient.invalidate({
          clientId: selectedClientId,
        });
      }
    },
  });

  const composeDeliveryChannel =
    composeChannel === "sms"
      ? "sms"
      : composeChannel === "portal"
        ? "portal"
        : "email";
  const composeContentMaxLength = communicationContentMaxLength(
    composeDeliveryChannel,
  );
  const composeContentInvalid =
    composeContent.length > 0 &&
    !isCommunicationContentValid(composeContent, composeDeliveryChannel);
  const composeSubjectInvalid =
    composeChannel === "email" && !isCommunicationSubjectValid(composeSubject);
  const canSendCompose =
    canMutateInbox &&
    Boolean(selectedClientId) &&
    isCommunicationContentValid(composeContent, composeDeliveryChannel) &&
    !composeSubjectInvalid &&
    !createMutation.isPending &&
    !smsComposeBlocked;

  const markReadMutation = trpc.communications.markClientRead.useMutation({
    onSuccess: (_data, variables) => {
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
  });

  const assignMutation = trpc.communications.assignClient.useMutation({
    onSuccess: (_data, variables) => {
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
    onError: (err, variables) => {
      toast.error(err.message);
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
  });

  const updateStatusMutation = trpc.communications.updateStatus.useMutation({
    onSuccess: () => {
      utils.communications.listConversations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const linkCommunicationMutation =
    trpc.communications.linkCommunicationToClient.useMutation({
      onSuccess: (_data, variables) => {
        utils.communications.listConversations.invalidate();
        utils.communications.getByClient.invalidate({
          clientId: variables.clientId,
        });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const conversationGroups = useMemo((): ConversationGroup[] => {
    if (!commsData?.items) return [];
    return (commsData.items as InboxListItem[]).map((item) => {
      const unreadCount = Number(
        item.unreadCount ?? (isUnreadInboxMessage(item) ? 1 : 0),
      );
      if (!item.clientId) {
        return {
          kind: "unmatched",
          id: `unmatched:${item.id}`,
          communicationId: item.id,
          clientName: t("messaging.unmatched").replace(
            "{channel}",
            channelLabel(item.channel as Channel, t),
          ),
          latest: item,
          unreadCount,
        };
      }

      return {
        kind: "client",
        id: `client:${item.clientId}`,
        clientId: item.clientId,
        clientName:
          item.clientFirstName && item.clientLastName
            ? `${item.clientFirstName} ${item.clientLastName}`
            : t("messaging.unknownClient"),
        latest: item,
        unreadCount,
      };
    });
  }, [commsData, t]);

  const selectedGroup = useMemo(
    () =>
      conversationGroups.find(
        (group) =>
          group.kind === "client" && group.clientId === selectedClientId,
      ),
    [conversationGroups, selectedClientId],
  );
  const assignmentSource = selectedGroup?.latest ?? timeline?.[0];
  const assignedTo = assignmentSource?.assignedTo ?? null;
  const assignedToName = assignmentSource?.assignedToName ?? null;
  const assignedToMe = Boolean(assignedTo && assignedTo === currentUserId);
  const assignmentLabel = assignedTo
    ? assignedToMe
      ? t("messaging.assignedToYou")
      : t("messaging.assignedToStaff").replace(
          "{staff}",
          assignedToName ?? t("messaging.staff"),
        )
    : t("messaging.unassigned");
  const SelectedUnmatchedIcon = selectedUnmatched
    ? (channelIcons[selectedUnmatched.channel as Channel] ?? MessageSquare)
    : MessageSquare;
  const selectedUnmatchedChannel = selectedUnmatched
    ? channelLabel(selectedUnmatched.channel as Channel, t)
    : t("messaging.message");

  function handleSelectClient(
    clientId: string,
    clientName: string,
    unreadCount = 0,
  ) {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setSelectedUnmatched(null);
    setLinkClientSearch("");
    setNewMessageMode(false);
    if (unreadCount > 0 && canMutateInbox) {
      markReadMutation.mutate({ clientId });
    }
  }

  function handleSelectUnmatched(item: InboxListItem) {
    setSelectedClientId(null);
    setSelectedClientName("");
    setSelectedUnmatched(item);
    setLinkClientSearch("");
    setNewMessageMode(false);

    if (isUnreadInboxMessage(item) && canMutateInbox) {
      updateStatusMutation.mutate({ id: item.id, status: "read" });
    }
  }

  function handleSend() {
    if (!selectedClientId) return;
    if (smsComposeBlocked) {
      toast.error(
        smsStatusUnavailable
          ? t("messaging.unableToCheckSms")
          : (localizedSmsSummary?.title ?? t("messaging.checkingSms")),
      );
      return;
    }
    if (!canSendCompose) return;
    const trimmedContent = composeContent.trim();
    const trimmedSubject = composeSubject.trim();
    let requestId: string | undefined;
    if (composeChannel === "sms" || composeChannel === "email") {
      const fingerprint = `${composeChannel}\u0000${selectedClientId}\u0000${trimmedSubject}\u0000${trimmedContent}`;
      if (externalComposeRequest.current?.fingerprint !== fingerprint) {
        externalComposeRequest.current = {
          fingerprint,
          requestId: crypto.randomUUID(),
        };
      }
      requestId = externalComposeRequest.current.requestId;
    }
    createMutation.mutate({
      clientId: selectedClientId,
      channel: composeChannel,
      direction: "outbound",
      subject:
        composeChannel === "email" ? trimmedSubject || undefined : undefined,
      content: trimmedContent,
      ...(requestId ? { requestId } : {}),
    });
  }

  function handleNewMessage() {
    if (!canMutateInbox) return;
    externalComposeRequest.current = null;
    setNewMessageMode(true);
    setSelectedClientId(null);
    setSelectedClientName("");
    setSelectedUnmatched(null);
    setLinkClientSearch("");
    setNewClientSearch("");
  }

  function handleAssignmentToggle() {
    if (!canMutateInbox || !selectedClientId) return;
    assignMutation.mutate({
      clientId: selectedClientId,
      action: assignedToMe ? "unassign" : "assign_to_me",
      expectedAssignedTo: assignedTo,
    });
  }

  function handleLinkUnmatchedClient(client: ClientSearchResult) {
    if (!canMutateInbox || !selectedUnmatched) return;
    const clientName = `${client.firstName} ${client.lastName}`;

    linkCommunicationMutation.mutate(
      {
        communicationId: selectedUnmatched.id,
        clientId: client.id,
      },
      {
        onSuccess: () => {
          toast.success(t("messaging.messageLinked"));
          setSelectedUnmatched(null);
          setSelectedClientId(client.id);
          setSelectedClientName(clientName);
          setLinkClientSearch("");
        },
      },
    );
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("messaging.all") },
    { key: "unread", label: t("messaging.unread") },
    { key: "sent", label: t("messaging.sent") },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">{t("messaging.inbox")}</h2>
          <p className="text-sm text-muted-foreground">{t("messaging.clientCommunications")}</p>
        </div>
        {canMutateInbox ? (
          <Button onClick={handleNewMessage} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("messaging.newMessage")}
          </Button>
        ) : null}
      </div>

      {showSmsStatusError ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-semibold text-destructive">
                  {t("messaging.unableToCheckSms")}
                </h3>
                <Badge variant="destructive">{t("messaging.smsStatusUnavailable")}</Badge>
              </div>
              <p className="mt-1 text-sm text-destructive/80">
                {t("messaging.retrySmsStatus")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetchMessagingStatus()}
                >
                  {t("reminders.retry")}
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label={t("messaging.dismissSmsWarning")}
              onClick={() => setSmsBannerDismissed(true)}
              className="h-8 w-8 shrink-0 rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      ) : showSmsBanner && smsSummary ? (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-base font-semibold">
                    {localizedSmsSummary?.title}
                  </h3>
                <Badge variant={smsSummary.badge.variant}>
                  {localizedSmsSummary?.badge}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {localizedSmsSummary?.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {messagingStatus?.canManage && localizedSmsSummary?.actionLabel ? (
                  <Button size="sm" asChild>
                    <Link href="/settings?tab=messaging&setup=texting">
                      {localizedSmsSummary.actionLabel}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("messaging.askAdministrator")}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={t("messaging.dismissSmsPrompt")}
              onClick={() => setSmsBannerDismissed(true)}
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Two-panel layout; below md the panes swap (list OR thread) so
          neither renders into ~half a phone screen. */}
      <div className="flex flex-1 rounded-lg border border-border bg-card overflow-hidden min-h-0">
        {/* Left panel - list */}
        <div
          data-tour="inbox-list"
          className={cn(
            "w-full flex-col border-border shrink-0 md:flex md:w-80 md:border-r",
            selectedClientId || selectedUnmatched || newMessageMode
              ? "hidden"
              : "flex",
          )}
        >
          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
                  filter === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Communication list */}
          <div className="flex-1 overflow-y-auto">
            {inboxListError || inboxListMissing ? (
              <div className="m-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {inboxListError?.message ?? t("messaging.unableToLoadInbox")}
              </div>
            ) : inboxListLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("messaging.loadingMessages")}
              </div>
            ) : conversationGroups.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent p-8"
                icon={InboxIcon}
                title={t("messaging.noMessages")}
              />
            ) : (
              conversationGroups.map((group) => {
                const Icon =
                  channelIcons[group.latest.channel as Channel] ??
                  MessageSquare;
                const isSelected =
                  group.kind === "client"
                    ? selectedClientId === group.clientId && !selectedUnmatched
                    : selectedUnmatched?.id === group.communicationId;
                const isUnread = group.unreadCount > 0;
                const preview =
                  group.latest.subject ||
                  group.latest.content?.slice(0, 60) ||
                  t("messaging.noContent");

                return (
                  <button
                    key={group.id}
                    onClick={() =>
                      group.kind === "client"
                        ? handleSelectClient(
                            group.clientId,
                            group.clientName,
                            group.unreadCount,
                          )
                        : handleSelectUnmatched(group.latest)
                    }
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-1.5 shrink-0">
                        {isUnread ? (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm truncate",
                              isUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {group.clientName}
                          </span>
                          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Icon className="h-3 w-3" />
                            <span className="text-xs">
                              {relativeTime(group.latest.createdAt, inboxTimeZone, locale, t)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {preview.length > 60
                            ? preview.slice(0, 60) + "..."
                            : preview}
                        </p>
                        {group.kind === "unmatched" ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">
                            {t("messaging.needsClient")}
                          </p>
                        ) : group.latest.assignedTo ? (
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            {group.latest.assignedTo === currentUserId
                              ? t("messaging.assignedToYou")
                              : t("messaging.assignedToStaff").replace(
                                  "{staff}",
                                  group.latest.assignedToName ?? t("messaging.staff"),
                                )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - detail/compose */}
        <div
          className={cn(
            "flex-1 flex-col min-w-0 md:flex",
            selectedClientId || selectedUnmatched || newMessageMode
              ? "flex"
              : "hidden",
          )}
        >
          {(selectedClientId || selectedUnmatched || newMessageMode) && (
            <button
              type="button"
              onClick={() => {
                setSelectedClientId(null);
                setSelectedUnmatched(null);
                setNewMessageMode(false);
              }}
              className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("messaging.backToConversations")}
            </button>
          )}
          {newMessageMode && canMutateInbox ? (
            /* New message - client search */
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-sm mb-2">{t("messaging.newMessage")}</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("messaging.searchClients")}
                    value={newClientSearch}
                    maxLength={CLIENT_SEARCH_MAX_LENGTH}
                    onChange={(e) => setNewClientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {searchError || searchMissing ? (
                  <div className="m-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {searchError?.message ?? t("messaging.unableToSearchClients")}
                  </div>
                ) : searchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("messaging.searchingClients")}
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((client) => (
                    <button
                      key={client.id}
                      onClick={() =>
                        handleSelectClient(
                          client.id,
                          `${client.firstName} ${client.lastName}`,
                        )
                      }
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="text-sm font-medium">
                        {client.firstName} {client.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.email || client.phone || t("messaging.noContactInfo")}
                      </div>
                    </button>
                  ))
                ) : canSearchNewClients ? (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={Search}
                    title={t("messaging.noClientsFound")}
                  />
                ) : (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={Search}
                    title={t("messaging.typeToSearchClient")}
                  />
                )}
              </div>
            </div>
          ) : selectedUnmatched ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => setSelectedUnmatched(null)}
                    className="lg:hidden p-1 hover:bg-accent rounded"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-sm">
                      {t("messaging.unmatchedInbound")}
                    </h3>
                    <Badge variant="secondary" className="mt-1">
                      {t("messaging.needsClient")}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-lg bg-muted px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <ArrowLeft className="h-3 w-3" />
                      <SelectedUnmatchedIcon className="h-3 w-3" />
                      <span className="text-[10px] uppercase font-medium">
                        {selectedUnmatchedChannel}
                      </span>
                    </div>

                    {selectedUnmatched.subject ? (
                      <p className="text-xs font-semibold mb-0.5">
                        {selectedUnmatched.subject}
                      </p>
                    ) : null}

                    <p className="text-sm whitespace-pre-wrap">
                      {selectedUnmatched.content || t("messaging.noContent")}
                    </p>

                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="text-[10px]">
                        {relativeTime(selectedUnmatched.createdAt, inboxTimeZone, locale, t)}
                      </span>
                      {selectedUnmatched.status ? (
                        <span className="text-[10px] ml-1 capitalize">
                          {localizedStatusLabel(selectedUnmatched.status, t)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium">{t("messaging.linkToClient")}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t("messaging.searchByContact")}
                    </p>
                  </div>
                </div>

                {canMutateInbox ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("messaging.searchClients")}
                        value={linkClientSearch}
                        maxLength={CLIENT_SEARCH_MAX_LENGTH}
                        onChange={(e) => setLinkClientSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                      {linkClientError || linkClientMissing ? (
                        <div className="m-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                          {linkClientError?.message ?? t("messaging.unableToSearchClients")}
                        </div>
                      ) : linkClientLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("messaging.searchingClients")}
                        </div>
                      ) : linkClientResults && linkClientResults.length > 0 ? (
                        linkClientResults.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => handleLinkUnmatchedClient(client)}
                            disabled={linkCommunicationMutation.isPending}
                            className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {client.firstName} {client.lastName}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {client.email || client.phone || t("messaging.noContactInfo")}
                              </div>
                            </div>
                            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))
                      ) : canSearchLinkClients ? (
                        <EmptyState
                          className="border-0 bg-transparent py-6"
                          icon={Search}
                          title={t("messaging.noClientsFound")}
                        />
                      ) : (
                        <EmptyState
                          className="border-0 bg-transparent py-6"
                          icon={Search}
                          title={t("messaging.typeToSearchClient")}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("messaging.viewerCannotLink")}
                  </p>
                )}
              </div>
            </div>
          ) : selectedClientId ? (
            /* Conversation timeline */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Conversation header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => setSelectedClientId(null)}
                    className="lg:hidden p-1 hover:bg-accent rounded"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-sm">
                      {selectedClientName}
                    </h3>
                    <Badge
                      variant={assignedTo ? "outline" : "secondary"}
                      className="mt-1"
                    >
                      {assignmentLabel}
                    </Badge>
                  </div>
                </div>
                {canMutateInbox ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAssignmentToggle}
                    disabled={assignMutation.isPending || !timeline?.length}
                    className="shrink-0 gap-1.5"
                  >
                    {assignedToMe ? (
                      <UserMinus className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                    {assignedToMe ? t("messaging.unassign") : t("messaging.assignToMe")}
                  </Button>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timelineDisplayError || timelineDisplayMissing ? (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {timelineDisplayError?.message ?? t("messaging.unableToLoadConversation")}
                  </div>
                ) : timelineDisplayLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("messaging.loadingMessages")}
                  </div>
                ) : timeline && timeline.length > 0 ? (
                  [...timeline].reverse().map((msg) => {
                    const Icon = channelIcons[msg.channel as Channel];
                    const isOutbound = msg.direction === "outbound";
                    const statusLabel = localizedStatusLabel(
                      communicationStatusLabel(msg),
                      t,
                    );

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          isOutbound ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isOutbound
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          {/* Direction + channel */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 mb-1",
                              isOutbound
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {isOutbound ? (
                              <ArrowRight className="h-3 w-3" />
                            ) : (
                              <ArrowLeft className="h-3 w-3" />
                            )}
                            <Icon className="h-3 w-3" />
                            <span className="text-[10px] uppercase font-medium">
                              {channelLabel(msg.channel as Channel, t)}
                            </span>
                          </div>

                          {msg.subject && (
                            <p
                              className={cn(
                                "text-xs font-semibold mb-0.5",
                                isOutbound
                                  ? "text-primary-foreground/90"
                                  : "text-foreground",
                              )}
                            >
                              {msg.subject}
                            </p>
                          )}

                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>

                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isOutbound
                                ? "text-primary-foreground/50"
                                : "text-muted-foreground",
                            )}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">
                              {relativeTime(msg.createdAt, inboxTimeZone, locale, t)}
                            </span>
                            {statusLabel ? (
                              <span className="text-[10px] ml-1 capitalize">
                                {statusLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={MessageSquare}
                    title={t("messaging.noMessagesWithClient")}
                  />
                )}
              </div>

              {/* Compose area */}
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={composeChannel}
                    onChange={(e) =>
                      setComposeChannel(e.target.value as Channel)
                    }
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="sms">SMS</option>
                    <option value="portal">Portal</option>
                  </select>

                  {composeChannel === "email" && (
                    <Input
                      placeholder={t("messaging.subject")}
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      maxLength={COMMUNICATION_SUBJECT_MAX_LENGTH}
                      aria-invalid={composeSubjectInvalid || undefined}
                      className="flex-1"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    placeholder={t("messaging.typeMessage")}
                    value={composeContent}
                    onChange={(e) => setComposeContent(e.target.value)}
                    maxLength={composeContentMaxLength}
                    aria-invalid={composeContentInvalid || undefined}
                    rows={2}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!canSendCompose}
                    size="sm"
                    className="self-end gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t("messaging.send")}
                  </Button>
                </div>
                {smsStatusUnavailable ? (
                  <p className="text-xs text-muted-foreground">
                    {t("messaging.retrySmsStatus")}
                  </p>
                ) : composeChannel === "portal" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("messaging.portalHint")}
                  </p>
                ) : smsComposeBlocked && smsSummary ? (
                  <p className="text-xs text-muted-foreground">
                    {localizedSmsSummary?.description}
                  </p>
                ) : smsComposeBlocked ? (
                  <p className="text-xs text-muted-foreground">
                    {t("messaging.checkingBeforeSms")}
                  </p>
                ) : composeChannel === "sms" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("messaging.serviceOnly")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : conversationGroups.length > 0 ? (
            /* Conversations exist but none is selected */
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                className="border-0 bg-transparent"
                icon={MessageSquare}
                title={t("messaging.selectConversation")}
                description={t("messaging.selectConversationDescription")}
              />
            </div>
          ) : (
            /* Truly empty inbox */
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                className="border-0 bg-transparent"
                icon={InboxIcon}
                title={t("messaging.noMessages")}
                description={
                  canMutateInbox
                    ? t("messaging.firstMessage")
                    : t("messaging.noCommunications")
                }
                action={
                  canMutateInbox
                    ? {
                        label: t("messaging.newMessage"),
                        onClick: handleNewMessage,
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
