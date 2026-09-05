import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';
import {
  useSkills,
  useWorkspace,
  type DaemonWorkspaceSkillDetail,
  type DaemonWorkspaceSkillStatus,
} from '@qwen-code/web-shell/daemon-react-sdk';
import { useI18n } from '../../i18n';
import { skillDescriptionKey } from '../../constants/localCommands';
import {
  filterSkills,
  preserveSkillSelection,
  skillIdentity,
  skillExtensionLabel,
  type SkillLevelFilter,
  type SkillStatusFilter,
} from './skills-manager-logic';
import { Alert, AlertDescription } from '../ui/alert';
import { ManagementNotice } from '../ui/management-notice';
import { Badge } from '../ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { Button } from '../ui/button';
import { ContentSkeleton } from '../ui/content-skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Spinner } from '../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import type { EmbeddedManagerPage } from '../plugins/manager-page';
import { Markdown } from '../messages/Markdown';
import { SkillInstallDialog } from './SkillInstallDialog';

interface SkillsManagerPageProps {
  onClose: () => void;
  onUseSkill: (name: string) => void;
  embedded?: EmbeddedManagerPage;
}

function skillLevelLabel(
  skill: DaemonWorkspaceSkillStatus,
  t: ReturnType<typeof useI18n>['t'],
): string {
  return t(`skills.level.${skill.level}`);
}

function skillStatusLabel(
  skill: DaemonWorkspaceSkillStatus,
  t: ReturnType<typeof useI18n>['t'],
): string {
  return t(
    skill.status === 'disabled'
      ? 'skills.status.disabled'
      : 'skills.status.enabled',
  );
}

function skillStatusBadgeClass(skill: DaemonWorkspaceSkillStatus): string {
  return skill.status === 'disabled'
    ? ''
    : 'bg-[var(--success-bg)] text-[var(--success-color)]';
}

function toggleErrorMessage(
  error: unknown,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const body =
    error && typeof error === 'object'
      ? (error as { body?: unknown }).body
      : undefined;
  const code =
    body && typeof body === 'object'
      ? (body as { code?: unknown }).code
      : undefined;
  if (code === 'skill_inactive_extension') {
    return t('skills.error.inactiveExtension');
  }
  if (code === 'skill_not_toggleable') return t('skills.notToggleable');
  return error instanceof Error ? error.message : t('skills.toggleFailed');
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="break-words text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function ManualReferenceBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={compact ? 'text-[10px]' : undefined}
          >
            {t('skills.manualReference')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t('skills.manualReferenceHint')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SkillsManagerPage({
  onClose,
  onUseSkill,
  embedded,
}: SkillsManagerPageProps) {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const {
    status,
    skills,
    loading,
    error,
    reload,
    getDetail,
    setEnabled,
    install,
    remove,
  } = useSkills({ autoLoad: true });
  const canToggleSkills =
    workspace.capabilities?.features.includes(
      'workspace_skill_settings_toggle',
    ) === true;
  const canManageSkills =
    workspace.capabilities?.features.includes('workspace_skill_manage') ===
    true;
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<SkillLevelFilter>('all');
  const [statusFilter, setStatusFilter] =
    useState<SkillStatusFilter>('enabled');
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] =
    useState<DaemonWorkspaceSkillDetail | null>(null);
  const [skillDetailLoading, setSkillDetailLoading] = useState(false);
  const [skillDetailError, setSkillDetailError] = useState<string | null>(null);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    skillName: string;
    text: string;
    error: boolean;
  } | null>(null);
  const showInitialLoading =
    skills.length === 0 && status === undefined && !error;
  const displayedSkills = useMemo(
    () =>
      skills.map((skill) => {
        const descriptionKey = skillDescriptionKey(skill.name);
        return descriptionKey
          ? { ...skill, description: t(descriptionKey) }
          : skill;
      }),
    [skills, t],
  );
  const selectedSkill = useMemo(
    () =>
      displayedSkills.find(
        (skill) => skillIdentity(skill) === selectedIdentity,
      ),
    [displayedSkills, selectedIdentity],
  );
  const filteredSkills = useMemo(
    () => filterSkills(displayedSkills, query, levelFilter, statusFilter),
    [displayedSkills, levelFilter, query, statusFilter],
  );
  const disabledCount = displayedSkills.filter(
    (skill) => skill.status === 'disabled',
  ).length;
  const message = error?.message ?? status?.errors?.[0]?.error;
  const levelOptions: Array<{
    value: SkillLevelFilter;
    label: string;
  }> = [
    { value: 'all', label: t('skills.filter.all') },
    { value: 'user', label: t('skills.filter.user') },
    { value: 'project', label: t('skills.filter.project') },
    { value: 'extension', label: t('skills.filter.extension') },
    { value: 'bundled', label: t('skills.filter.bundled') },
  ];

  useEffect(() => {
    setSelectedIdentity((identity) =>
      preserveSkillSelection(identity, displayedSkills),
    );
  }, [displayedSkills]);

  useEffect(() => {
    if (!selectedSkill) {
      setSkillDetail(null);
      setSkillDetailError(null);
      setSkillDetailLoading(false);
      return;
    }
    let cancelled = false;
    setSkillDetail(null);
    setSkillDetailError(null);
    setSkillDetailLoading(true);
    void getDetail({
      name: selectedSkill.name,
      level: selectedSkill.level,
      ...(selectedSkill.extensionName
        ? { extensionName: selectedSkill.extensionName }
        : {}),
    })
      .then((detail) => {
        if (!cancelled) setSkillDetail(detail);
      })
      .catch((detailError: unknown) => {
        if (!cancelled) {
          setSkillDetailError(
            detailError instanceof Error
              ? detailError.message
              : t('skills.instructions.error'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSkillDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getDetail, selectedSkill, t]);

  useEffect(() => {
    embedded?.onDetailChange(Boolean(selectedSkill));
  }, [embedded, selectedSkill]);

  async function toggleSkill(skill: DaemonWorkspaceSkillStatus) {
    const enabled = skill.status === 'disabled';
    setBusySkill(skill.name);
    setNotice(null);
    try {
      const result = await setEnabled(skill.name, enabled);
      const refreshed = await reload();
      const refreshedSkill = refreshed?.skills.find(
        (item) => item.name.toLowerCase() === skill.name.toLowerCase(),
      );
      const expectedStatus = enabled ? 'ok' : 'disabled';
      setNotice({
        skillName: skill.name,
        text: !result.changed
          ? t('skills.settingUnchanged')
          : !refreshedSkill
            ? t('skills.settingUpdated')
            : refreshedSkill.status === expectedStatus
              ? t(enabled ? 'skills.enabled' : 'skills.disabled')
              : t('skills.settingUpdatedAvailabilityUnchanged'),
        error: false,
      });
    } catch (toggleError) {
      setNotice({
        skillName: skill.name,
        text: toggleErrorMessage(toggleError, t),
        error: true,
      });
    } finally {
      setBusySkill(null);
    }
  }

  async function installSkill(
    request: Parameters<typeof install>[0],
  ): Promise<void> {
    setListNotice(null);
    await install(request);
    setListNotice(t('skills.install.succeeded', { name: request.name.trim() }));
    await reload().catch(() => undefined);
  }

  async function deleteSkill(): Promise<void> {
    if (!selectedSkill) return;
    const scope = selectedSkill.level === 'project' ? 'workspace' : 'global';
    setBusySkill(selectedSkill.name);
    try {
      await remove(selectedSkill.name, scope);
      setDeleteOpen(false);
      setSelectedIdentity(null);
      setListNotice(t('skills.delete.succeeded', { name: selectedSkill.name }));
      await reload().catch(() => undefined);
    } catch (deleteError) {
      setDeleteOpen(false);
      setNotice({
        skillName: selectedSkill.name,
        text:
          deleteError instanceof Error
            ? deleteError.message
            : t('skills.delete.failed'),
        error: true,
      });
    } finally {
      setBusySkill(null);
    }
  }

  function returnToList(): void {
    setSelectedIdentity(null);
    void reload();
  }

  const standaloneNavigation = (
    <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
      <BreadcrumbList className="text-base">
        <BreadcrumbItem>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common.back')}
          >
            <ArrowLeftIcon />
          </Button>
        </BreadcrumbItem>
        <BreadcrumbItem>
          {selectedSkill ? (
            <BreadcrumbLink asChild>
              <button type="button" onClick={returnToList}>
                {t('skills.title')}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t('skills.title')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {selectedSkill ? <BreadcrumbSeparator /> : null}
        {selectedSkill ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{selectedSkill.name}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
  const navigation = embedded ? (
    selectedSkill ? (
      <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
        <BreadcrumbList className="h-8 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button
                type="button"
                onClick={() => {
                  returnToList();
                  embedded.onDetailChange(false);
                }}
              >
                {t('skills.title')}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{selectedSkill.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ) : null
  ) : (
    standaloneNavigation
  );
  if (selectedSkill) {
    const invocation = `/${selectedSkill.name}${
      selectedSkill.argumentHint ? ` ${selectedSkill.argumentHint}` : ''
    }`;
    return (
      <div data-motion="detail" className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="flex w-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <SparklesIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-semibold text-balance">
                  {selectedSkill.name}
                </h1>
                <Badge variant="outline">
                  {skillLevelLabel(selectedSkill, t)}
                </Badge>
                <Badge
                  variant="secondary"
                  className={skillStatusBadgeClass(selectedSkill)}
                >
                  {skillStatusLabel(selectedSkill, t)}
                </Badge>
                {!selectedSkill.modelInvocable ? (
                  <ManualReferenceBadge />
                ) : null}
              </div>
            </div>
            <Button
              disabled={selectedSkill.status === 'disabled'}
              onClick={() => onUseSkill(selectedSkill.name)}
            >
              <PlayIcon data-icon="inline-start" />
              {t('skills.run')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busySkill !== null}
                  aria-label={t('skills.actions')}
                  data-testid="skill-actions"
                >
                  {busySkill === selectedSkill.name ? (
                    <Spinner />
                  ) : (
                    <EllipsisVerticalIcon />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={busySkill !== null || !canToggleSkills}
                    title={
                      !canToggleSkills
                        ? t('skills.toggleUnsupported')
                        : undefined
                    }
                    onSelect={() => void toggleSkill(selectedSkill)}
                  >
                    {t(
                      selectedSkill.status === 'disabled'
                        ? 'skills.enable'
                        : 'skills.disable',
                    )}
                  </DropdownMenuItem>
                  {canManageSkills &&
                  (selectedSkill.level === 'project' ||
                    selectedSkill.level === 'user') ? (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busySkill !== null}
                      onSelect={() => setDeleteOpen(true)}
                    >
                      {t('skills.delete.action')}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {notice?.skillName === selectedSkill.name ? (
            <ManagementNotice
              tone={notice.error ? 'error' : 'success'}
              noticeKey={notice.text}
              closeLabel={t('common.close')}
              onDismiss={() => setNotice(null)}
            >
              {notice.text}
            </ManagementNotice>
          ) : null}

          {message || selectedSkill.error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>
                {selectedSkill.error || message}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="instructions">
            <TabsList variant="line" className="max-w-full overflow-x-auto">
              <TabsTrigger value="instructions">
                {t('skills.instructions')}
              </TabsTrigger>
              <TabsTrigger value="details">{t('skills.details')}</TabsTrigger>
            </TabsList>
            <TabsContent value="instructions" className="pt-4">
              <div className="border-y py-5">
                {skillDetailLoading ? (
                  <ContentSkeleton
                    label={t('skills.instructions.loading')}
                    variant="detail"
                    rows={4}
                  />
                ) : skillDetailError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{skillDetailError}</AlertDescription>
                  </Alert>
                ) : skillDetail?.markdown ? (
                  <Markdown content={skillDetail.markdown} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('skills.instructions.empty')}
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="details" className="pt-4">
              <div className="grid gap-6 border-y py-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <DetailField
                    label={t('skills.description')}
                    value={
                      selectedSkill.description || t('skills.noDescription')
                    }
                  />
                </div>
                <DetailField
                  label={t('skills.invocation')}
                  value={invocation}
                />
                <DetailField
                  label={t('skills.level')}
                  value={skillLevelLabel(selectedSkill, t)}
                />
                <DetailField
                  label={t('skills.modelAccess')}
                  value={
                    selectedSkill.modelInvocable
                      ? t('skills.modelAccess.enabled')
                      : t('skills.modelAccess.disabled')
                  }
                />
                <DetailField
                  label={t('skills.model')}
                  value={selectedSkill.model || '-'}
                />
                <DetailField
                  label={t('skills.extension')}
                  value={skillExtensionLabel(selectedSkill)}
                />
                {selectedSkill.hint ? (
                  <div className="sm:col-span-2">
                    <DetailField
                      label={t('skills.hint')}
                      value={selectedSkill.hint}
                    />
                  </div>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(open) => {
              if (!open && busySkill !== null) return;
              setDeleteOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('skills.delete.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('skills.delete.description', {
                    name: selectedSkill.name,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busySkill !== null}>
                  {t('common.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={busySkill !== null}
                  onClick={(event) => {
                    event.preventDefault();
                    void deleteSkill();
                  }}
                >
                  {busySkill ? <Spinner data-icon="inline-start" /> : null}
                  {t('skills.delete.action')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  return (
    <div
      data-motion="detail"
      className="flex w-full flex-col gap-6 pb-8"
      aria-busy={showInitialLoading || undefined}
    >
      {navigation}
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-balance">
              {t('skills.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t('skills.count', {
                count: skills.length,
                enabled: skills.length - disabledCount,
                disabled: disabledCount,
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void reload()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {t('common.refresh')}
            </Button>
            {canManageSkills ? (
              <Button onClick={() => setInstallOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                {t('skills.install.action')}
              </Button>
            ) : null}
          </div>
        </div>

        {message ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {listNotice ? (
          <ManagementNotice
            tone="success"
            noticeKey={listNotice}
            closeLabel={t('common.close')}
            onDismiss={() => setListNotice(null)}
          >
            {listNotice}
          </ManagementNotice>
        ) : null}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="skill-search"
            aria-label={t('skills.search')}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('skills.search')}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            type="single"
            value={levelFilter}
            onValueChange={(value) => {
              if (value) setLevelFilter(value as SkillLevelFilter);
            }}
            variant="outline"
            size="sm"
            aria-label={t('skills.filter.label')}
          >
            {levelOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as SkillStatusFilter)
            }
          >
            <SelectTrigger
              className="w-32"
              aria-label={t('skills.filter.status.label')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('skills.filter.status.all')}
              </SelectItem>
              <SelectItem value="enabled">
                {t('skills.filter.status.enabled')}
              </SelectItem>
              <SelectItem value="disabled">
                {t('skills.filter.status.disabled')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showInitialLoading ? (
          <ContentSkeleton label={t('skills.loading')} rows={5} />
        ) : filteredSkills.length ? (
          <div className="divide-y rounded-md border">
            {filteredSkills.map((skill) => (
              <button
                key={skillIdentity(skill)}
                data-motion-item
                type="button"
                aria-label={skill.name}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => setSelectedIdentity(skillIdentity(skill))}
              >
                <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {skill.name}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Badge
                        variant="secondary"
                        className={`${skillStatusBadgeClass(skill)} text-[10px]`}
                      >
                        {skillStatusLabel(skill, t)}
                      </Badge>
                      {!skill.modelInvocable ? (
                        <ManualReferenceBadge compact />
                      ) : null}
                    </span>
                  </span>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                          {skill.description || t('skills.noDescription')}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {skill.description || t('skills.noDescription')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {query || levelFilter !== 'all' || statusFilter !== 'all' ? (
                  <SearchIcon />
                ) : (
                  <SparklesIcon />
                )}
              </EmptyMedia>
              <EmptyTitle>
                {query || levelFilter !== 'all' || statusFilter !== 'all'
                  ? t('skills.noMatches')
                  : t('skills.empty')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      <SkillInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        onInstall={installSkill}
      />
    </div>
  );
}
