import { useEffect, useState } from 'react';
import { GlobeIcon } from 'lucide-react';
import { useWorkspace } from '@qwen-code/web-shell/daemon-react-sdk';
import { useI18n } from '../../i18n';
import {
  loadHomeChatModels,
  saveHomeChatOptions,
  type HomeChatModelCatalog,
  type HomeChatOptions,
} from '../homechat/homechat-api';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { ContentSkeleton } from '../ui/content-skeleton';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '../ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

export function VaneSettingsPanel() {
  const { baseUrl, token } = useWorkspace();
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<HomeChatModelCatalog>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setCatalog(undefined);
    setError('');
    void loadHomeChatModels(baseUrl, token).then(
      (next) => {
        if (active) setCatalog(next);
      },
      (failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error ? failure.message : String(failure),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [baseUrl, token, revision]);

  const options = catalog?.options;
  const selectedIndex =
    catalog?.models.findIndex(
      (model) =>
        model.providerId === options?.chatModel.providerId &&
        model.key === options.chatModel.key,
    ) ?? -1;
  const selected = catalog?.models[selectedIndex];
  const save = async (next: HomeChatOptions) => {
    setBusy(true);
    setError('');
    try {
      await saveHomeChatOptions(baseUrl, token, next);
      setCatalog((current) =>
        current ? { ...current, options: next } : current,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const select = (
    label: string,
    value: string,
    choices: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
    disabled = false,
  ) => (
    <Select value={value} onValueChange={onChange} disabled={busy || disabled}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="w-[min(300px,45vw)] bg-background max-md:w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GlobeIcon className="size-4" aria-hidden="true" />
          Vane
        </CardTitle>
        <CardDescription>{t('settings.vane.description')}</CardDescription>
      </CardHeader>
      <CardContent
        className="-mb-(--card-spacing) p-0"
        aria-busy={busy || (!catalog && !error) || undefined}
      >
        {error && (
          <Alert className="mx-5 mb-4 w-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!catalog && !error && (
          <div className="px-5 pb-4">
            <ContentSkeleton
              label={t('settings.loading')}
              variant="form"
              rows={4}
            />
          </div>
        )}
        {((!catalog && error) || (catalog && (!options || !selected))) && (
          <div className="px-5 pb-4">
            {catalog && (
              <p className="mb-3 text-sm text-muted-foreground">
                {t('settings.vane.unavailable')}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t('settings.models.retry')}
            </Button>
          </div>
        )}
        {options && selected && catalog && (
          <FieldGroup className="gap-0">
            {[
              {
                title: t('settings.vane.model'),
                description: t('settings.vane.modelHint'),
                control: select(
                  t('settings.vane.model'),
                  String(selectedIndex),
                  catalog.models.map((model, index) => ({
                    value: String(index),
                    label: `${model.name} · ${model.providerName}`,
                  })),
                  (value) => {
                    const model = catalog.models[Number(value)];
                    if (model)
                      void save({
                        ...options,
                        chatModel: {
                          providerId: model.providerId,
                          key: model.key,
                        },
                        thinking: model.reasoning && options.thinking,
                      });
                  },
                ),
              },
              {
                title: t('settings.vane.depth'),
                description: t('settings.vane.depthHint'),
                control: select(
                  t('settings.vane.depth'),
                  options.optimizationMode,
                  ['speed', 'balanced', 'quality'].map((value) => ({
                    value,
                    label: t(`settings.vane.${value}`),
                  })),
                  (value) =>
                    void save({
                      ...options,
                      optimizationMode:
                        value as HomeChatOptions['optimizationMode'],
                    }),
                ),
              },
              {
                title: t('settings.vane.thinking'),
                description: t(
                  selected.reasoning
                    ? 'settings.vane.thinkingHint'
                    : 'settings.vane.noReasoning',
                ),
                control: (
                  <Switch
                    aria-label={t('settings.vane.thinking')}
                    checked={options.thinking}
                    disabled={busy || !selected.reasoning}
                    onCheckedChange={(thinking) =>
                      void save({ ...options, thinking })
                    }
                  />
                ),
              },
              {
                title: t('settings.vane.effort'),
                description: t('settings.vane.effortHint'),
                control: select(
                  t('settings.vane.effort'),
                  options.effort,
                  ['low', 'medium', 'high'].map((value) => ({
                    value,
                    label: t(`settings.vane.${value}`),
                  })),
                  (value) =>
                    void save({
                      ...options,
                      effort: value as HomeChatOptions['effort'],
                    }),
                  !selected.reasoning || !options.thinking,
                ),
              },
            ].map((row, index) => (
              <div key={row.title}>
                {index > 0 && <Separator className="mx-5 w-auto max-md:mx-4" />}
                <Field
                  orientation="responsive"
                  className="min-h-20 gap-6 px-5 py-4 max-md:px-4"
                >
                  <FieldContent className="min-w-0">
                    <FieldTitle>{row.title}</FieldTitle>
                    <FieldDescription className="max-w-3xl">
                      {row.description}
                    </FieldDescription>
                  </FieldContent>
                  <div className="flex min-w-0 justify-end max-md:justify-start">
                    {row.control}
                  </div>
                </Field>
              </div>
            ))}
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}
