import { useState } from 'react';
import { Archive, ArchiveRestore, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
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
import type { HomeChatSummary } from './homechat-api';
import styles from './HomeChatApp.module.css';

export type HomeChatView = 'active' | 'pinned' | 'archived';
export type HomeChatAction = 'archive' | 'restore' | 'pin' | 'unpin' | 'delete';

export function HomeChatManager({
  chats,
  view,
  disabled,
  error,
  onViewChange,
  onSelect,
  onAction,
  onClose,
}: {
  chats: HomeChatSummary[];
  view: HomeChatView;
  disabled: boolean;
  error?: string;
  onViewChange: (view: HomeChatView) => void;
  onSelect: (id: string) => void;
  onAction: (ids: string[], action: HomeChatAction) => Promise<string[]>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visible = chats.filter(
    (chat) =>
      (view === 'archived'
        ? chat.archived
        : !chat.archived && (view !== 'pinned' || chat.pinned)) &&
      chat.title.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = visible.filter((chat) => selection.includes(chat.id));
  const allSelected = visible.length > 0 && selected.length === visible.length;
  const blocked = busy || disabled;
  const perform = async (action: HomeChatAction) => {
    if (blocked || !selected.length) return;
    setBusy(true);
    try {
      const failed = await onAction(
        selected.map((chat) => chat.id),
        action,
      );
      setSelection(failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.manager} aria-label="Менеджер чатов">
      <div className={styles.managerHeader}>
        <h1>Менеджер чатов</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Закрыть менеджер чатов"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <Tabs
        value={view}
        onValueChange={(value) => {
          setSelection([]);
          onViewChange(value as HomeChatView);
        }}
      >
        <TabsList variant="line" aria-label="Состояние чатов">
          <TabsTrigger value="active">Активные</TabsTrigger>
          <TabsTrigger value="pinned">Закреплённые</TabsTrigger>
          <TabsTrigger value="archived">Архивированные</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        type="search"
        value={query}
        placeholder="Поиск чатов"
        aria-label="Поиск чатов"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelection([]);
        }}
      />
      <div className={styles.managerActions}>
        <label className={styles.selectAll}>
          <Checkbox
            aria-label="Выбрать все"
            checked={
              allSelected ? true : selected.length ? 'indeterminate' : false
            }
            disabled={blocked || !visible.length}
            onCheckedChange={() =>
              setSelection(allSelected ? [] : visible.map((chat) => chat.id))
            }
          />
          <span>Выбрано: {selected.length}</span>
        </label>
        <div className={styles.bulkButtons}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={blocked || !selected.length}
            onClick={() =>
              void perform(view === 'archived' ? 'restore' : 'archive')
            }
          >
            {view === 'archived' ? <ArchiveRestore /> : <Archive />}
            {view === 'archived' ? 'Восстановить' : 'Архивировать'}
          </Button>
          {view !== 'archived' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={blocked || !selected.length}
              onClick={() =>
                void perform(
                  selected.every((chat) => chat.pinned) ? 'unpin' : 'pin',
                )
              }
            >
              {selected.length > 0 && selected.every((chat) => chat.pinned) ? (
                <PinOff />
              ) : (
                <Pin />
              )}
              {selected.length > 0 && selected.every((chat) => chat.pinned)
                ? 'Открепить'
                : 'Закрепить'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.dangerButton}
            disabled={blocked || !selected.length}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            Удалить
          </Button>
        </div>
      </div>
      {error && (
        <p className={styles.globalError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.managerList}>
        {visible.map((chat) => (
          <div className={styles.managerRow} key={chat.id}>
            <Checkbox
              checked={selection.includes(chat.id)}
              disabled={blocked}
              aria-label={`Выбрать чат ${chat.title}`}
              onCheckedChange={(checked) =>
                setSelection((current) =>
                  checked
                    ? [...current, chat.id]
                    : current.filter((id) => id !== chat.id),
                )
              }
            />
            <button
              type="button"
              className={styles.managerChat}
              disabled={blocked}
              onClick={() => onSelect(chat.id)}
            >
              <span>{chat.title}</span>
              <small>
                {new Date(chat.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </small>
            </button>
            {chat.pinned && <Pin size={14} aria-label="Закреплён" />}
          </div>
        ))}
        {!visible.length && (
          <p className={styles.managerEmpty}>
            {query
              ? 'Чаты не найдены'
              : view === 'archived'
                ? 'В архиве пока нет чатов'
                : view === 'pinned'
                  ? 'Пока нет закреплённых чатов'
                  : 'Пока нет чатов'}
          </p>
        )}
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные чаты?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено чатов: {selected.length}. Переписки нельзя будет
              восстановить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={blocked}
              onClick={() => void perform('delete')}
            >
              Удалить чаты
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
