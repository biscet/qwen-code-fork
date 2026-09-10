/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

type MessageVariables = Record<string, string | number>;
type MessageValue = string | ((vars?: MessageVariables) => string);

function interpolateRu(pattern: string, values: unknown[]): string {
  return pattern.replace(/\{\{HC(\d+)\}\}/g, (_match, index: string) =>
    String(values[Number(index)]),
  );
}

function pluralRu(
  value: unknown,
  one: string,
  few: string,
  many: string,
): string {
  const count = Math.abs(Number(value));
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const RU = {
  'git.currentBranch': (v) =>
    interpolateRu('Текущая ветка Git: {{HC0}}', [v?.branch ?? '']),
  'git.detached': 'Отсоединённая HEAD',
  'git.clean': 'Рабочее дерево чистое',
  'git.operation.merge': 'Слияние',
  'git.operation.rebase': 'Перебазирование',
  'git.operation.cherry-pick': 'Перенос коммита',
  'git.operation.revert': 'Откат',
  'git.operation.bisect': 'Поиск проблемного коммита',
  'git.conflicted': (v) =>
    interpolateRu('{{HC0}} в конфликте', [v?.count ?? 0]),
  'git.staged': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'изменение добавлено', 'изменения добавлены', 'изменений добавлено')} в индекс`,
  'git.unstaged': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'изменение не добавлено', 'изменения не добавлены', 'изменений не добавлено')} в индекс`,
  'git.untracked': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'неотслеживаемый файл', 'неотслеживаемых файла', 'неотслеживаемых файлов')}`,
  'git.ahead': (v) => interpolateRu('{{HC0}} опережает', [v?.count ?? 0]),
  'git.behind': (v) => interpolateRu('{{HC0}} отстает', [v?.count ?? 0]),
  'git.stash': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'запись', 'записи', 'записей')} в stash`,
  'branchPicker.label': 'Git',
  'branchPicker.search': 'Поиск веток и действий',
  'branchPicker.loading': 'Загрузка веток…',
  'branchPicker.noBranches': 'Нет веток',
  'branchPicker.noTags': 'Нет тегов',
  'branchPicker.action.pull': 'Обновить проект',
  'branchPicker.action.push': 'Отправить',
  'branchPicker.action.commit': 'Создать коммит',
  'branchPicker.action.newBranch': 'Новая ветка…',
  'branchPicker.action.checkoutRef': 'Переключиться на тег или ревизию…',
  'branchPicker.action.viewChanges': 'Просмотреть изменения',
  'branchPicker.newBranchPlaceholder': 'Название ветки',
  'branchPicker.invalidBranchName':
    'Неверное название ветки — избегайте пробелов, ~, ^, :, ? * и начального -',
  'branchPicker.checkoutRefPlaceholder': 'Название тега или SHA коммита',
  'branchPicker.section.recent': 'Недавние',
  'branchPicker.section.local': 'Локальные',
  'branchPicker.section.remote': 'Удалённые',
  'branchPicker.section.tags': 'Теги',
  'branchPicker.checkedOut': (v) =>
    interpolateRu('Выбрана ветка {{HC0}}', [v?.branch ?? '']),
  'branchPicker.createdBranch': (v) =>
    interpolateRu('Создана ветка {{HC0}}', [v?.branch ?? '']),
  'branchPicker.pushSuccess': 'Успешно отправлено',
  'branchPicker.pullSuccess': 'Успешно обновлено',
  'branchPicker.pullBlocked':
    'Обновление заблокировано из-за несохранённых изменений',
  'branchPicker.pullStash': 'Отложить изменения и обновить',
  'branchPicker.pullDiscard': 'Отменить изменения и обновить…',
  'branchPicker.pullDiscardConfirm':
    'Отменить ВСЕ несохранённые изменения (включая не отслеживаемые файлы)? Это действие нельзя отменить.',
  'branchPicker.pullDiscardGo': 'Отменить и обновить',
  'branchPicker.pullStashConflict': (v) =>
    interpolateRu(
      'Обновление выполнено, но восстановить отложенные изменения не удалось. Они сохранены в stash {{HC0}} — устраните конфликты и восстановите изменения вручную.',
      [String(v?.sha ?? '').slice(0, 12) || '(см. git stash list)'],
    ),
  'branchPicker.cancel': 'Отмена',
  'branchPicker.hint.upToDate': 'Актуально',
  'branchPicker.hint.noUpstream': 'Нет вышестоящей ветки',
  'branchPicker.hint.upstreamGone': 'Вышестоящая ветка удалена',
  'branchPicker.hint.behindDirty': (v) =>
    interpolateRu('↓{{HC0}} · незакоммиченные изменения', [v?.count ?? 0]),
  'branchPicker.hint.setsUpstream':
    'Устанавливает вышестоящую ветку при отправке',
  'branchPicker.hint.aheadBehind': (v) =>
    interpolateRu('↑{{HC0}} ↓{{HC1}} · обновитесь сначала', [
      v?.ahead ?? 0,
      v?.behind ?? 0,
    ]),
  'branchPicker.hint.nothingToPush': 'Нечего отправлять',
  'branchPicker.hint.noChanges': 'Нет изменений',
  'branchPicker.hint.changes': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'изменение', 'изменения', 'изменений')}`,
  'branchPicker.hint.changesUntracked': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'изменение', 'изменения', 'изменений')} (${v?.untracked ?? 0} неотслеживаемых)`,
  'gitCommit.title': 'Создать коммит',
  'gitCommit.messagePlaceholder':
    'Сообщение коммита (⌘/Ctrl+Enter для создания)',
  'gitCommit.generating': 'Генерация сообщения коммита…',
  'gitCommit.genFailed':
    'Автоматическая генерация не удалась — напишите сообщение вручную',
  'gitCommit.prLogUnavailable':
    'Не удалось загрузить коммиты для выбранной базовой ветки.',
  'gitCommit.prPushFirst':
    'Отправьте вашу ветку на удалённый репозиторий перед созданием pull request.',
  'gitCommit.commit': 'Создать коммит',
  'gitCommit.commitAndPush': 'Создать коммит и отправить',
  'gitCommit.createPr': 'Создать Pull Request',
  'gitCommit.prTitlePlaceholder': 'Заголовок pull request',
  'gitCommit.prBodyPlaceholder': 'Описание (необязательно)',
  'gitCommit.prEdit': 'Редактировать',
  'gitCommit.prPreview': 'Предпросмотр',
  'gitCommit.prSubmit': 'Создать',
  'gitCommit.prCreated': (v) =>
    interpolateRu('Pull Request #{{HC0}} создан', [v?.number ?? '']),
  'gitCommit.commitSuccess': (v) =>
    interpolateRu('Закоммичено {{HC0}}', [v?.sha ?? '']),
  'gitCommit.commitPushSuccess': (v) =>
    interpolateRu('Закоммичено и отправлено на сервер {{HC0}}', [v?.sha ?? '']),
  'gitCommit.commitSuccessPushFailed': (v) =>
    interpolateRu('Закоммичено {{HC0}} — отправка не удалась: {{HC1}}', [
      v?.sha ?? '',
      v?.error ?? 'неизвестно',
    ]),
  'branchSelect.baseBranch': 'Базовая ветка',
  'branchSelect.search': 'Поиск веток…',
  'branchSelect.loading': 'Загрузка…',
  'branchSelect.noMatches': 'Ничего не найдено',
  'branchSelect.error': 'Не удалось загрузить ветки',
  'branchSelect.retry': 'Повторить',
  'branchSelect.local': 'локальный',
  'gitDiff.title': 'Изменения',
  'gitDiff.summary': (v) =>
    interpolateRu('{{HC0}} файлов · +{{HC1}} −{{HC2}}', [
      v?.count ?? 0,
      v?.added ?? 0,
      v?.removed ?? 0,
    ]),
  'gitDiff.loading': 'Загрузка изменений…',
  'gitDiff.empty': 'Нет изменений в рабочей области',
  'gitDiff.unavailable': 'Git недоступен для этой рабочей области',
  'gitDiff.error': 'Не удалось загрузить изменения',
  'gitDiff.binary': 'Бинарный файл',
  'gitDiff.untracked': 'Неотслеживаемый',
  'gitDiff.deleted': 'Удалённый',
  'gitDiff.noDiff': 'Нет изменений для отображения',
  'gitDiff.fileError': 'Не удалось загрузить этот дифф',
  'gitDiff.truncated': 'Дифф обрезан — файл слишком большой для полного показа',
  'gitDiff.hidden': (v) =>
    `Скрыто ещё ${v?.count ?? 0} ${pluralRu(v?.count, 'файл', 'файла', 'файлов')}`,
  'gitDiff.expand': (v) =>
    interpolateRu('Показать изменения для {{HC0}}', [v?.path ?? 'Файл']),
  'gitDiff.collapse': (v) =>
    interpolateRu('Скрыть изменения для {{HC0}}', [v?.path ?? 'Файл']),
  'gitMode.title': 'Режим Git',
  'gitMode.current': 'Текущая ветка',
  'gitMode.currentDesc': (v) =>
    interpolateRu('Разрабатывайте напрямую на {{HC0}}', [v?.branch ?? 'main']),
  'gitMode.branch': 'Новая ветка',
  'gitMode.branchDesc': (v) =>
    interpolateRu('Создайте новую ветку из {{HC0}}', [v?.branch ?? 'main']),
  'gitMode.branchPlaceholder': 'feat/my-feature',
  'gitMode.branchLabel': 'Название ветки',
  'gitMode.branchConflictWarning':
    'Одновременно в рабочей области может быть только одна сессия ветки',
  'gitMode.branchHint': 'Переключает рабочую директорию на новую ветку',
  'gitMode.branchInvalidName': 'Недопустимое название ветки',
  'gitMode.worktree': 'Рабочая область',
  'gitMode.worktreeDesc': 'Изолированная копия · можно запускать параллельно',
  'gitMode.confirmBranch': 'Создать ветку',
  'gitMode.confirmWorktree': 'Создать рабочую область',
  'gitMode.resetToCurrent': 'Сбросить к текущей ветке',
  'gitLog.title': 'История',
  'gitLog.subtitle': (v) => interpolateRu('{{HC0}} коммитов', [v?.count ?? 0]),
  'gitLog.loading': 'Загрузка истории…',
  'gitLog.empty': 'Коммитов пока нет',
  'gitLog.unavailable': 'Git недоступен для этой рабочей области',
  'gitLog.error': 'Не удалось загрузить историю',
  'gitLog.loadMore': 'Загрузить еще',
  'gitLog.loadingMore': 'Загрузка…',
  'gitLog.files': (v) =>
    interpolateRu('{{HC0}} файлов · +{{HC1}} −{{HC2}}', [
      v?.count ?? 0,
      v?.added ?? 0,
      v?.removed ?? 0,
    ]),
  'gitLog.detailError': 'Не удалось загрузить детали коммита',
  'gitLog.hidden': (v) =>
    `Скрыто ещё ${v?.count ?? 0} ${pluralRu(v?.count, 'файл', 'файла', 'файлов')}`,
  'gitLog.copySha': (v) =>
    interpolateRu('Копировать коммит {{HC0}}', [v?.sha ?? '']),
  'githubPrs.title': 'Запросы на слияние',
  'githubPrs.subtitle': (v) =>
    interpolateRu('{{HC0}} открыто', [v?.count ?? 0]),
  'githubPrs.loading': 'Загрузка запросов на слияние…',
  'githubPrs.empty': 'Открытых запросов на слияние нет',
  'githubPrs.unavailable': 'Эта рабочая область не является репозиторием Git',
  'githubPrs.error': 'Не удалось загрузить запросы на слияние',
  'githubPrs.cliUnavailable':
    'GitHub CLI (gh) не установлен на хосте демона.\nУстановите его и выполните `gh auth login`, затем повторите попытку.',
  'githubPrs.reviewApproved': 'Одобрено',
  'githubPrs.reviewChanges': 'Запрошены изменения',
  'githubPrs.reviewRequired': 'Требуется обзор',
  'githubPrs.checksPassing': 'Проверки проходят успешно',
  'githubPrs.checksFailing': 'Проверки не прошли',
  'githubPrs.checksPending': 'Проверки в ожидании',
  'githubPrs.open': (v) =>
    interpolateRu('Открыть pull request #{{HC0}} на GitHub', [v?.number ?? '']),
  'workspace.paneLabel': (v) =>
    interpolateRu('Рабочая область: {{HC0}}', [v?.name ?? '']),
  'about.auth': 'Аутентификация',
  'about.baseUrl': 'Базовый URL',
  'about.fastModel': 'Быстрая модель',
  'about.memoryUsage': 'Использование памяти',
  'about.model': 'Модель',
  'about.noProxy': 'без прокси',
  'about.noSandbox': 'без песочницы',
  'about.platform': 'ОС',
  'about.proxy': 'Прокси',
  'about.qwenCode': 'HomeCode',
  'about.runtime': 'Среда выполнения',
  'about.sandbox': 'Песочница',
  'about.sessionId': 'ID сессии',
  'about.title': 'Статус',
  'agent.back': 'Назад',
  'agent.builtInBadge': '(встроенный)',
  'agent.action.delete': 'Удалить агента',
  'agent.action.edit': 'Редактировать агента',
  'agent.action.view': 'Просмотреть агента',
  'agent.chooseAction': (v) =>
    interpolateRu('Выберите действие для {{HC0}}', [v?.name ?? '']),
  'agent.chooseActionTitle': 'Выберите действие',
  'agent.colorLabel': 'Цвет: ',
  'agent.colorUpdated': (v) =>
    interpolateRu('Обновлен цвет для {{HC0}}', [v?.name ?? '']),
  'agent.create': 'Создать нового субагента',
  'agent.create.button': 'Создать',
  'agent.create.confirm': 'Подтвердить и сохранить',
  'agent.create.desc': 'Создать нового субагента',
  'agent.create.descPlaceholder': 'Что делает этот агент?',
  'agent.create.describeAgent': 'Опишите требования',
  'agent.create.description': 'Описание',
  'agent.create.editAgain': 'Редактировать',
  'agent.create.enterDescription': 'Введите описание',
  'agent.create.enterName': 'Введите имя субагента',
  'agent.create.enterPrompt': 'Введите системный запрос',
  'agent.create.generateFailed': (v) =>
    interpolateRu('Не удалось создать субагента: {{HC0}}', [
      v?.error ?? 'Неизвестная ошибка',
    ]),
  'agent.create.generate': 'Сгенерировать',
  'agent.create.generatedDescription': 'Описание',
  'agent.create.generatedSystemPrompt': 'Системная подсказка',
  'agent.create.generatingConfig': 'Генерация конфигурации подагента...',
  'agent.create.generatingPrompt': 'Генерация...',
  'agent.create.loading': 'Создание...',
  'agent.create.location': 'Выберите расположение',
  'agent.create.method': 'Выберите метод генерации',
  'agent.create.method.manual': 'Ручное создание',
  'agent.create.method.qwen': 'Сгенерировать с помощью HomeCode',
  'agent.create.method.qwen.recommended':
    'Сгенерировать с помощью HomeCode (рекомендуется)',
  'agent.create.method.qwen.desc': 'LLM создаёт описание и системный запрос',
  'agent.create.name': 'Имя',
  'agent.create.namePlaceholder': 'my-agent',
  'agent.create.nameHelp':
    'Введите четкое, уникальное имя для этого подагента.',
  'agent.create.project': 'Проект',
  'agent.create.project.cli': 'Рабочая область',
  'agent.create.project.desc': 'Создать субагента уровня проекта',
  'agent.create.prompt': 'Системная подсказка',
  'agent.create.promptPlaceholder': 'Вы — специализированный агент, который...',
  'agent.create.promptPlaceholder.cli':
    'например, Вы экспертный ревьювер кода...',
  'agent.create.promptHelp':
    'Напишите системный промпт, определяющий поведение подагента. Будьте подробны для лучших результатов.',
  'agent.create.preview': 'Предпросмотр',
  'agent.create.qwenHint':
    'Объясните обязанности, сценарии использования и важные ограничения, затем заполните каждое поле отдельно.',
  'agent.create.qwenPlaceholder':
    '> например, эксперт-ревизор кода, проверяющий код на основе лучших практик...',
  'agent.create.regenerate': 'Сгенерировать черновик заново',
  'agent.create.required': 'Имя, описание и системный запрос обязательны.',
  'agent.create.tools': 'Разрешённые инструменты',
  'agent.create.toolsHelp':
    'Введите канонические имена инструментов через запятую или с новой строки. Инструменты MCP используют формат mcp__server__tool; оставьте пустым для наследования всех инструментов.',
  'agent.create.disallowedTools': 'Запрещённые инструменты',
  'agent.create.model': 'Модель',
  'agent.create.approvalMode': 'Режим утверждения',
  'agent.create.maxTurns': 'Максимальное количество ходов выполнения',
  'agent.create.maxTurnsHelp':
    'Ограничивает число раундов рассуждений модели для одной задачи. Выполнение останавливается при достижении лимита; оставьте пустым, чтобы не было ограничений, специфичных для агента.',
  'agent.create.maxTurnsInvalid':
    'Максимальное количество ходов выполнения должно быть положительным целым числом.',
  'agent.create.mcpServers': 'Серверы MCP',
  'agent.create.mcpServers.empty': 'Доступные серверы MCP отсутствуют.',
  'agent.create.mcpServers.select': 'Выберите сервер MCP',
  'agent.create.mcpServers.noneSelected': 'Серверы MCP не выбраны.',
  'agent.create.modelGenerate': 'Сгенерировать с помощью модели',
  'agent.create.modelGenerate.description':
    'Опишите, что вам нужно, затем сгенерируйте и просмотрите описание и системный запрос отдельно.',
  'agent.create.color': 'Цвет',
  'agent.color.inherit': 'Наследовать',
  'agent.color.auto': 'Автоматически',
  'agent.color.automatic': 'Распределён автоматически',
  'agent.color.red': 'Красный',
  'agent.color.blue': 'Синий',
  'agent.color.green': 'Зелёный',
  'agent.color.yellow': 'Жёлтый',
  'agent.color.purple': 'Фиолетовый',
  'agent.color.orange': 'Оранжевый',
  'agent.color.pink': 'Розовый',
  'agent.color.cyan': 'Голубой',
  'agent.create.jsonObjectHelp': 'Введите объект JSON или оставьте пустым.',
  'agent.create.save': 'Сохранить агента',
  'agent.create.scope': 'Категория',
  'agent.create.manualDescHelp':
    'Опишите, когда и как следует использовать этого подагента.',
  'agent.create.manualDescPlaceholder':
    'например, Проверяет код на соответствие лучшим практикам и потенциальные ошибки.',
  'agent.create.tools.builtin': 'Встроенные инструменты',
  'agent.create.tools.empty': 'Инструменты отсутствуют.',
  'agent.create.tools.mcp': 'Инструменты MCP',
  'agent.create.tools.type': 'Тип инструмента',
  'agent.create.tools.selectServer': 'Выберите сервер MCP',
  'agent.create.tools.selectTool': 'Выберите инструмент',
  'agent.create.tools.noneSelected': 'Инструменты не выбраны.',
  'agent.create.tools.initializing': 'Инициализация каталогов инструментов...',
  'agent.create.tools.preheatFailed': 'Разогрев ACP не завершен.',
  'agent.create.tools.loadFailed':
    'Не удалось загрузить встроенные инструменты.',
  'agent.create.removeSelection': (v) =>
    interpolateRu('Удалить {{HC0}}', [v?.name ?? '']),
  'agent.create.toolsSelectHelp':
    'Выберите инструменты, которые может использовать этот субагент. Оставьте все без отметки для наследования всех инструментов.',
  'agent.create.toolsSelection': 'Выбор инструментов',
  'agent.create.tools.all': 'Все инструменты',
  'agent.create.tools.allDefault': 'Все инструменты (по умолчанию)',
  'agent.create.tools.allInfo': 'Все инструменты выбраны, включая MCP tools',
  'agent.create.tools.allInfoFallback':
    'Все инструменты выбраны, включая MCP tools',
  'agent.create.tools.editLabel': '• Редактирование инструментов:',
  'agent.create.tools.executionLabel': '• Инструменты выполнения:',
  'agent.create.tools.none': '(нет)',
  'agent.create.tools.readEdit': 'Инструменты для чтения и редактирования',
  'agent.create.tools.readEditExecute':
    'Инструменты для чтения, редактирования и выполнения',
  'agent.create.tools.readOnlyLabel': '• Инструменты только для чтения:',
  'agent.create.tools.readOnly': 'Инструменты только для чтения',
  'agent.create.tools.selected': 'Выбранные инструменты:',
  'agent.create.user': 'Пользователь',
  'agent.create.user.cli': 'Глобальный',
  'agent.create.user.desc': 'Создать субагент уровня пользователя',
  'agent.create.useGenerated': 'Использовать этот черновик',
  'agent.approval.inherit': 'По умолчанию',
  'agent.approval.default': 'Утверждение по умолчанию',
  'agent.approval.plan': 'Только план',
  'agent.approval.auto-edit': 'Автоматическое утверждение изменений',
  'agent.approval.yolo': 'Автоматическое утверждение всех действий',
  'agent.approval.bubble': 'Пузырьковое утверждение',
  'agent.approval.desc.inherit':
    'Используйте правила утверждения субагента по умолчанию.',
  'agent.approval.desc.bubble':
    'Перенаправляйте запросы на утверждение инструментов в родительскую сессию.',
  'agent.createFirstHint':
    "Используйте '/agents create' для создания первого подагента.",
  'agent.created': (v) => interpolateRu('Создан {{HC0}}', [v?.name ?? '']),
  'agent.edit.save': 'Сохранить изменения',
  'agent.updated': (v) => interpolateRu('Обновлено {{HC0}}', [v?.name ?? '']),
  'agent.turnsBadge': (v) =>
    interpolateRu('{{HC0}} ходов агента', [v?.count ?? 0]),
  'agent.delete': 'Удалить',
  'agent.delete.confirm': (v) =>
    interpolateRu('Вы уверены, что хотите удалить «{{HC0}}»?', [v?.name ?? '']),
  'agent.delete.loading': 'Удаление...',
  'agent.delete.no': 'Нет',
  'agent.delete.title': (v) =>
    interpolateRu('Удалить {{HC0}}', [v?.name ?? '']),
  'agent.delete.yes': 'Да, удалить',
  'agent.deleted': (v) => interpolateRu('Удалён {{HC0}}', [v?.name ?? '']),
  'agent.edit': 'Редактировать',
  'agent.edit.color': 'Изменить цвет',
  'agent.edit.tools': 'Изменить инструменты',
  'agent.editColorTitle': (v) =>
    interpolateRu('Редактирование цвета: {{HC0}}', [v?.name ?? '']),
  'agent.editTitle': (v) =>
    interpolateRu('Редактировать {{HC0}}', [v?.name ?? '']),
  'agent.empty': 'Подагенты не найдены.',
  'agent.noMatches': 'Субагенты не найдены.',
  'agent.footer.back': 'Esc для возврата',
  'agent.footer.cliBack':
    'Enter для выбора, ↑↓ для навигации, Esc для возврата',
  'agent.footer.cliSelect':
    'Enter для выбора, ↑↓ для навигации, Esc для закрытия',
  'agent.footer.close': 'Esc для закрытия',
  'agent.footer.deleteConfirm': 'Enter для подтверждения, Esc для отмены',
  'agent.footer.enterNext': 'Нажмите Enter для продолжения, Esc для возврата',
  'agent.footer.generating': 'Esc для отмены',
  'agent.footer.createLocation':
    'Нажмите Enter для продолжения, ↑↓ для навигации, Esc для отмены',
  'agent.footer.createContinue':
    'Нажмите Enter для продолжения, ↑↓ для навигации, Esc для возврата',
  'agent.footer.final':
    'Enter для сохранения, e для сохранения и редактирования, Esc для возврата',
  'agent.footer.nav': '↑↓ навигация · Enter выбор · Esc назад',
  'agent.footer.navBack': '↑↓ навигация · Enter выбор · Esc назад',
  'agent.footer.navSelect': '↑↓ навигация · Enter выбор · Esc закрыть',
  'agent.footer.viewerBack': 'Esc для возврата',
  'agent.filePathLabel': 'Путь к файлу: ',
  'agent.label': 'Агент',
  'agent.location': 'Расположение',
  'agent.level.builtin': 'Встроенный',
  'agent.level.extension': 'Расширение',
  'agent.level.project': 'Проект',
  'agent.level.user': 'Пользователь',
  'agent.level.filter': 'Фильтр по уровню агента',
  'agent.manage': 'Управление',
  'agent.manage.desc': 'Управление существующими субагентами',
  'agent.modelLabel': 'Модель: ',
  'agent.overriddenBadge': '(переопределен агентом уровня проекта)',
  'agent.readonly': 'Этот агент доступен только для чтения.',
  'agent.select': 'Выберите агента.',
  'agent.selectAction': 'Выберите действие',
  'agent.descriptionLabel': 'Описание:',
  'agent.systemPromptLabel': 'Системный промпт:',
  'agent.level.label': 'Уровень',
  'agent.step': (v) => interpolateRu('Шаг {{HC0}}', [v?.n ?? '']),
  'agent.tools': 'Инструменты',
  'agent.toolsLabel': 'Инструменты: ',
  'agent.detail.overview': 'Основная информация',
  'agent.detail.tools': 'Инструменты',
  'agent.detail.mcp': 'MCP',
  'agent.detail.hooks': 'Хуки',
  'agent.detail.systemPrompt': 'Системный запрос',
  'agent.overview.instructions':
    'Системный запрос задаёт порядок работы, ограничения и ожидаемый результат.',
  'agent.builtin.generalPurpose.description':
    'Универсальный сабагент для сложных исследований, поиска кода и многошаговых задач.',
  'agent.builtin.explore.description':
    'Быстрый сабагент только для чтения: ищет файлы и код и объясняет устройство проекта.',
  'agent.builtin.statuslineSetup.description':
    'Настраивает строку состояния HomeCode, сохраняя корректность пользовательских настроек.',
  'agent.builtin.review.description':
    'Специализированный участник проверки кода, запускаемый встроенным навыком review.',
  'agent.toolsUpdated': (v) =>
    interpolateRu('Обновлены инструменты для {{HC0}}', [v?.name ?? '']),
  'agent.usingCount': (v) =>
    interpolateRu('Используется: {{HC0}} агентов', [v?.count ?? 0]),
  'agent.view': 'Просмотр',
  'agents.closed': 'Панель агентов закрыта.',
  'agents.title': 'Агенты',
  'subagent.result': 'Результат',
  'subagent.tools': (v) =>
    interpolateRu('Инструменты ({{HC0}})', [v?.count ?? 0]),
  'subagent.toolsCount': (v) =>
    interpolateRu('{{HC0}} инструментов', [v?.count ?? 0]),
  'subagent.toggleStream': 'Переключить детали потока агента',
  'subagent.pending': 'в ожидании',
  'subagent.running': 'запущен',
  'subagent.background': 'задний план задачи',
  'subagent.completed': 'задача завершена',
  'subagent.failed': 'неудача',
  'subagent.cancelled': 'отменена',
  'subagent.paused': 'приостановлен',
  'subagent.detailsLoading': 'Загрузка деталей агента...',
  'subagent.detailsLoadFailed': 'Не удалось загрузить детали агента.',
  'agentType.general-purpose': 'Универсальный',
  'agentType.explore': 'Исследовать',
  'agentType.statusline-setup': 'Настройка строки состояния',
  'agentType.review-agent': 'Агент проверки',
  'agentType.test-engineer': 'Инженер по тестированию',
  'agentType.fork': 'Ветка',
  'timeline.parallelAgents': 'Параллельные агенты',
  'timeline.thinking': 'Размышление',
  'timeline.assistantUpdate': 'Обновление агента',
  'timeline.toolCalls': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'вызов инструмента', 'вызова инструмента', 'вызовов инструментов')}`,
  'timeline.planUpdate': 'Обновление плана',
  'timeline.statusUpdate': 'Обновление статуса',
  'timeline.userTurn': 'Ход пользователя',
  'timeline.planDetail': 'обновление плана',
  'timeline.parallelAgentsDetail': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'параллельный агент', 'параллельных агента', 'параллельных агентов')}`,
  'timeline.noActivity': 'Нет активности',
  'timeline.sessionTimeline': 'Хронология сессии',
  'timeline.turnPrefix': (v) => interpolateRu('Ворд {{HC0}}', [v?.index ?? 0]),
  'timeline.currentTurn': 'Текущий ход',
  'timeline.kind.thought': 'мышление',
  'timeline.kind.commentary': 'обновление агента',
  'timeline.kind.tool': 'вызовы инструментов',
  'timeline.kind.agents': 'параллельные агенты',
  'timeline.kind.plan': 'обновление плана',
  'timeline.kind.status': 'обновление статуса',
  'timeline.kind.none': 'отключить',
  'common.copy': 'Копировать',
  'common.download': 'Скачать',
  'common.downloading': 'Загрузка…',
  'common.downloadFailed': (v) =>
    interpolateRu('Не удалось загрузить: {{HC0}}', [v?.message ?? '']),
  'common.open': 'Открыть',
  'common.openFailed': (v) =>
    interpolateRu('Не удалось открыть ссылку: {{HC0}}', [v?.message ?? '']),
  'artifact.openLink': 'Открыть ссылку',
  'common.na': 'Н/Д',
  'common.server': 'Сервер',
  'common.agent': 'агент',
  'common.auto': 'авто',
  'common.runtime': 'Среда выполнения',
  'common.failedToLoad': 'Не удалось загрузить',
  'auth.notSet': '(не задано)',
  'auth.apiKeyPlaceholder': 'sk-...',
  'auth.modelsPlaceholder': 'id-модели-1, id-модели-2',
  'model.usingModel': (v) =>
    interpolateRu('Использование модели {{HC0}}: {{HC1}}', [
      v?.isRuntime ? 'среда выполнения' : '',
      v?.modelId ?? '',
    ]),
  'mermaid.label': 'mermaid',
  'mermaid.errorLabel': 'mermaid (ошибка)',
  'user.uploadedImage': (v) =>
    interpolateRu('Пользователь загрузил изображение {{HC0}}', [v?.index ?? 1]),
  'voice.noSpeech': 'Голос не обнаружен.',
  'voice.stopDictation': 'Остановить диктовку',
  'voice.transcribing': 'Письмовая расшифровка…',
  'voice.starting': 'Запуск...',
  'voice.errorRetry': (v) =>
    interpolateRu('Ошибка голоса — нажмите для повторной попытки{{HC0}}', [
      v?.message ? interpolateRu(': {{HC0}}', [v.message]) : '',
    ]),
  'voice.noSpeechRetry': 'Не обнаружено речи — нажмите для повторной попытки',
  'voice.startDictation': 'Начать голосовой ввод',
  'voice.error': 'Ошибка голоса',
  'live.title': 'Живой голос',
  'live.open': 'Открыть живой голос',
  'live.manage': 'Управление активным живым голосом',
  'live.readyDescription':
    'Хост Qwen Live и все необходимые разрешения готовы.',
  'live.setupDescription':
    'Установите хост Qwen Live и завершите настройку всех разрешений перед запуском Живого голоса.',
  'live.noFallback':
    'Живой голос никогда не использует микрофон браузера или упрощенный режим без Appshot.',
  'live.shortcutHint': (v) =>
    interpolateRu('Глобальное сочетание клавиш: {{HC0}}', [v?.shortcut ?? '']),
  'settings.liveShortcut.capture': 'Нажмите комбинацию клавиш',
  'settings.liveShortcut.clear': 'Очистить',
  'settings.liveShortcut.off': 'Выключено',
  'settings.liveSetup.title': 'Qwen Live',
  'settings.liveSetup.experimental': 'Экспериментально',
  'settings.liveSetup.description':
    'Общайтесь с Qwen из любой точки этого Mac в реальном времени голосом, используя Appshot и передачу задач.',
  'settings.liveSetup.enable': 'Включить Qwen Live',
  'settings.liveSetup.apiKey': 'Ключ API DashScope Realtime',
  'settings.liveSetup.apiKeyPlaceholder': 'Введите ключ API DashScope',
  'settings.liveSetup.apiKeyReplace': 'Введите новый ключ для замены',
  'settings.liveSetup.configured': 'Настроено',
  'settings.liveSetup.notConfigured': 'Требуется',
  'settings.liveSetup.save': 'Сохранить',
  'settings.liveSetup.removeKey': 'Удалить ключ',
  'settings.liveSetup.shortcut': 'Глобальный ярлык',
  'settings.liveSetup.host': 'Хост Qwen Live',
  'settings.liveSetup.openHost': 'Открыть хост',
  'settings.liveSetup.retry': 'Повторить попытку',
  'settings.liveSetup.permission.microphone': 'Микрофон',
  'settings.liveSetup.permission.accessibility': 'Доступность',
  'settings.liveSetup.permission.screenRecording': 'Запись экрана',
  'settings.liveSetup.permissionHint':
    'Завершите все ожидающие запросы разрешений в хосте Qwen Live. Живой голос останется недоступным, пока не будут готовы все разрешения.',
  'settings.liveSetup.requirement.ready': 'Готов',
  'settings.liveSetup.requirement.missing': 'Отсутствует',
  'settings.liveSetup.requirement.denied': 'Не разрешено',
  'settings.liveSetup.requirement.unavailable': 'Недоступно',
  'settings.liveSetup.requirement.checking': 'Проверка',
  'settings.liveSetup.install.missing': 'Ожидание установки',
  'settings.liveSetup.install.checking': 'Проверка установки…',
  'settings.liveSetup.install.downloading': 'Загрузка подписанного хоста…',
  'settings.liveSetup.install.verifying':
    'Проверка подписи и контрольной суммы…',
  'settings.liveSetup.install.installing': 'Установка…',
  'settings.liveSetup.install.launching': 'Открытие хоста…',
  'settings.liveSetup.install.installed': 'Установлено',
  'settings.liveSetup.install.error': 'Настройка требует внимания',
  'settings.liveSetup.confirmTitle': 'Включить экспериментальный Qwen Live?',
  'settings.liveSetup.confirmDescription':
    'HomeCode загрузит, проверит, установит и откроет подписанное приложение Qwen Live Host. Затем macOS попросит предоставить доступ к микрофону, функциям доступности и записи экрана.',
  'settings.liveSetup.cancel': 'Отмена',
  'settings.liveSetup.confirm': 'Включить и установить',
  'live.refresh': 'Обновить статус',
  'live.startOrResume': 'Запустить или возобновить',
  'live.newConversation': 'Новый разговор',
  'live.stop': 'Остановить Qwen Live',
  'live.muteInput': 'Отключить микрофон',
  'live.unmuteInput': 'Включить микрофон',
  'live.muteOutput': 'Отключить динамик',
  'live.unmuteOutput': 'Включить динамик',
  'live.state.unavailable': 'Голосовой чат недоступен',
  'live.state.idle': 'Готов к голосовому чату',
  'live.state.starting': 'Запуск голосового чата…',
  'live.state.listening': 'Слушаю',
  'live.state.thinking': 'Думаю',
  'live.state.speaking': 'Говорю',
  'live.state.stopping': 'Остановка…',
  'live.state.error': 'Голосовой чат остановлен',
  'live.requirement.host': 'Qwen Live Host',
  'live.requirement.microphone': 'Микрофон',
  'live.requirement.accessibility': 'Функции доступности',
  'live.requirement.screenRecording': 'Запись экрана',
  'live.requirement.audioInput': 'Аудиовход',
  'live.requirement.audioOutput': 'Аудиовыход',
  'live.requirement.globalShortcut': 'Глобальный ярлык',
  'live.requirement.appshot': 'Appshot',
  'live.requirement.provider': 'Провайдер в реальном времени',
  'live.requirementState.ready': 'Готов',
  'live.requirementState.missing': 'Отсутствует',
  'live.requirementState.denied': 'Не разрешено',
  'live.requirementState.unavailable': 'Недоступно',
  'live.requirementState.checking': 'Проверка',
  'resume.failedToLoad': 'Не удалось загрузить сессии',
  'toast.dismiss': 'Скрыть уведомление',
  'toast.dismissShort': 'Закрыть',
  'insight.ready': 'Отчет Insight успешно создан!',
  'request.cancelled': 'Запрос отменен.',
  'visionBridge.model': 'Модель компьютерного зрения',
  'visionBridge.skipped': (v) =>
    interpolateRu('Мост зрения отменён.{{HC0}}', [
      v?.egressOccurred === 1
        ? interpolateRu(
            'Ваше изображение и запрос/контекст были отправлены в {{HC0}}.',
            [v?.target ?? ''],
          )
        : '',
    ]),
  'visionBridge.failed': (v) =>
    v?.egressOccurred === 1
      ? interpolateRu(
          'Мост зрения ({{HC0}}) не удался: запрос к модели зрения не выполнен. Ваше изображение и запрос/контекст были отправлены в {{HC1}}. Изображение не было интерпретировано.',
          [v?.modelName ?? '', v?.target ?? ''],
        )
      : interpolateRu(
          'Мост зрения ({{HC0}}) не удался: мост зрения не мог запуститься. Изображение не было интерпретировано.',
          [v?.target ?? ''],
        ),
  'visionBridge.ok': (v) => {
    const converted = v?.convertedCount ?? 0;
    const omitted = v?.omittedCount ?? 0;
    const omittedText = Number(omitted) > 0 ? ` Пропущено: ${omitted}.` : '';
    const egressText =
      v?.egressOccurred === 1
        ? ' Изображение и запрос с контекстом были отправлены этой модели.'
        : '';
    return `Преобразовано изображений: ${converted}. Модель: ${v?.target ?? ''}.${omittedText}${egressText}`;
  },
  'approval.execQuestion': (v) =>
    interpolateRu("Разрешить выполнение: '{{HC0}}'?", [v?.tool ?? '']),
  'approval.changeQuestion': 'Применить это изменение?',
  'approval.launchAgentQuestion': 'Запустить этого агента?',
  'approval.option.allowOnce': 'Да, разрешить один раз',
  'approval.option.allowOnceAndSwitchToDefault':
    'Разрешить один раз и переключиться в режим по умолчанию',
  'approval.option.restorePrevious': 'Да, восстановить предыдущий режим',
  'approval.option.rejectOnce': 'Нет, отклонить',
  'approval.option.allowAllEdits': 'Разрешить все правки',
  'approval.option.allowAlwaysProject': 'Всегда разрешать в этом проекте',
  'approval.option.allowAlwaysUser': 'Всегда разрешать для этого пользователя',
  'approval.option.allowAlwaysServer': 'Всегда разрешать для этого сервера',
  'approval.option.allowAlwaysTool': 'Всегда разрешать для этого инструмента',
  'assistant.branch': 'Ветка',
  'assistant.copy': 'Копировать',
  'at.category.extensions': 'Расширения',
  'at.category.extensions.description': 'Ссылка на активные расширения',
  'at.category.files': 'Файлы',
  'at.category.files.description': 'Ссылка на файлы рабочей области',
  'at.files.upload': 'Загрузить файл',
  'at.files.upload.description': 'Загрузить файл в эту папку',
  'composer.upload.pending': 'Ожидание',
  'composer.upload.uploading': 'Загрузка',
  'composer.upload.done': 'Загружено',
  'composer.upload.error': 'Ошибка',
  'composer.upload.error.noDaemon': 'Нет соединения с демоном',
  'composer.upload.error.tooLarge': (v) =>
    interpolateRu('Файл превышает лимит загрузки {{HC0}}', [v?.limit ?? '']),
  'composer.upload.error.tooManyFiles': (v) =>
    interpolateRu(
      '{{HC0}} дополнительных файлов не добавлено (лимит на пакет)',
      [v?.count ?? 0],
    ),
  'composer.upload.cancel': 'Отменить загрузку',
  'composer.upload.dismiss': 'Отклонить',
  'composer.upload.renamed': 'Сохранено как {{HC0}}',
  'composer.upload.drop': 'Перетащите файлы сюда',
  'composer.dropChoice.title': (v) =>
    Number(v?.count) === 1
      ? 'Добавить перетащенный файл'
      : `Добавить ${v?.count ?? 0} перетащенных файлов`,
  'composer.dropChoice.description':
    'Прикрепите файлы к сообщению, чтобы агент мог их прочитать, или загрузите их в рабочую область и добавьте ссылки через @.',
  'composer.dropChoice.cancel': 'Отмена',
  'composer.dropChoice.upload': 'Загрузить в рабочую область',
  'composer.dropChoice.reference': 'Прикрепить к сообщению',
  'composer.dropChoice.moreFiles': (v) =>
    interpolateRu('и еще {{HC0}} файлов', [v?.count ?? 0]),
  'composerAdd.trigger': 'Добавить к сообщению',
  'composerAdd.emptyState': 'Здесь нет доступных действий добавления',
  'composerAdd.noResults': 'Нет результатов',
  'composerAdd.loadError': 'Не удалось загрузить результаты',
  'composerAdd.unavailable': 'Недоступно',
  'composerAdd.file.label': 'Добавить файл',
  'composerAdd.file.attachDisabled': 'Вложения сообщений недоступны',
  'composerAdd.file.uploadDisabled': 'Загрузка в рабочую область недоступна',
  'composerAdd.referenceFile.label': 'Ссылка на файл',
  'composerAdd.referenceFile.searchPlaceholder': 'Поиск файлов рабочей области',
  'composerAdd.extensions.label': 'Расширения',
  'composerAdd.extensions.empty': 'Расширения не включены',
  'composerAdd.mcp.label': 'MCP',
  'composerAdd.mcp.empty': 'Серверы MCP недоступны',
  'composerAdd.skills.label': 'Навыки',
  'at.category.mcpResources': 'Ресурсы MCP',
  'at.category.mcpResources.description': 'Ссылки на ресурсы серверов MCP',
  'at.menu': 'Меню ссылок',
  'common.back': 'назад',
  'common.all': 'Все',
  'common.add': 'добавить',
  'common.cancel': 'отмены',
  'common.close': 'закрыть',
  'common.fullscreen': 'На весь экран',
  'common.exitFullscreen': 'Выйти из полноэкранного режима',
  'common.continue': 'Продолжить',
  'common.current': 'текущий',
  'common.disabled': 'отключен',
  'common.enabled': 'включен',
  'common.enterSelect': 'Enter для выбора',
  'common.invalid': 'недействительный',
  'common.loading': 'Загрузка...',
  'common.retry': 'Попробовать снова',
  'session.archived': 'Этот диалог архивирован',
  'session.archivedDescription': 'Разархивируйте его перед открытием диалога.',
  'session.capabilitiesFailed':
    'Не удалось загрузить возможности демона. Попробуйте снова перед открытием этого диалога.',
  'session.contextConflict':
    'Ссылка на автономный или живой диалог не может включать целевую рабочую область.',
  'session.loadFailed': 'Не удалось загрузить диалог',
  'session.notFound': 'Диалог не найден',
  'session.notFoundDescription': 'Этот автономный диалог больше не существует.',
  'session.resolving': 'Открытие диалога...',
  'session.standaloneUnavailable': 'Автономные диалоги недоступны',
  'session.standaloneUpgradeRequired':
    'Обновите демон, чтобы открыть автономные диалоги.',
  'session.stillCreating':
    'Диалог все еще создается. Попробуйте проверить позже.',
  'session.recoveryPending':
    'Создание могло завершиться успешно, но результат не удалось подтвердить. Отправка приостановлена для предотвращения создания дублирующего диалога.',
  'session.recoveryChecking': 'Проверка зарезервированного ID диалога...',
  'session.recoveryStillCreating':
    'Диалог все еще создается. Проверьте снова через мгновение.',
  'session.recoveryAbsent':
    'Для зарезервированного ID не существует диалога. Вы можете явно начать новый диалог.',
  'session.recoveryUnknown':
    'Результат создания все еще неизвестен. Проверьте перед началом нового диалога.',
  'session.recoveryArchived':
    'Восстановленный диалог архивирован. Разархивируйте его перед открытием.',
  'session.recoveryCheckFailed': 'Не удалось проверить создание диалога',
  'session.recoveryBlocksAction':
    'Разрешите состояние автономного диалога до завершения, прежде чем продолжить.',
  'session.checkStatus': 'Проверить статус',
  'session.retryCreation': 'Начать новый диалог',
  'session.directoryRecreated':
    'Транскрипт восстановлен, но файлы из предыдущего приватного каталога недоступны.',
  'session.directoryMissing':
    'Приватный рабочий каталог этого диалога отсутствует. Исправьте его перед отправкой нового запроса.',
  'session.directoryCompromised':
    'Этот приватный рабочий каталог небезопасен и не может быть исправлен автоматически. Экспортируйте транскрипт, затем удалите диалог.',
  'session.repair': 'Исправить каталог',
  'session.repairing': 'Исправление...',
  'session.repairFailed': 'Не удалось исправить приватный рабочий каталог',
  'session.repairSucceeded': 'Приватный рабочий каталог был исправлен.',
  'session.unarchive': 'Разархивировать',
  'session.unarchiveFailed': 'Не удалось разархивировать этот диалог.',
  'session.workspaceActionUnavailable':
    'Это действие доступно только в проектных диалогах.',
  'common.save': 'сохранить',
  'common.navigate': '↑↓ для навигации',
  'common.next': 'следующий',
  'common.noResults': 'Результатов не найдено',
  'common.previous': 'предыдущий',
  'common.expand': 'Развернуть',
  'common.collapse': 'Свернуть',
  'common.refresh': 'Обновить',
  'common.search': 'Поиск',
  'common.valid': 'действителен',
  'common.clients': (v) => interpolateRu('{{HC0}} клиентов', [v?.count ?? 0]),
  'agent.count': (v) => interpolateRu('{{HC0}} агентов', [v?.count ?? 0]),
  'askUser.submit': 'Отправить',
  'askUser.submitting': 'Отправка...',
  'askUser.submitFailed': 'Не удалось отправить ответ',
  'askUser.submitOptionUnavailable': 'Опция отправки недоступна',
  'askUser.ignore': 'Игнорировать',
  'askUser.multiHint': 'выбор из нескольких вариантов',
  'askUser.progress': (v) =>
    interpolateRu('{{HC0}}/{{HC1}} вопросов', [v?.current ?? 0, v?.total ?? 0]),
  'askUser.selectAnswer': 'Выберите ответ',
  'askUser.typePlaceholder': 'Введите что-то...',
  'askUser.shortcuts.previous': '← предыдущий',
  'askUser.shortcuts.optionsSingle': '↑↓ выбор · Enter отправка',
  'askUser.shortcuts.optionsNext': '↑↓ выбор · Enter следующий',
  'askUser.shortcuts.optionsFinal': '↑↓ выбор · Enter окончательная отправка',
  'askUser.shortcuts.multiSingle':
    '↑↓ перемещение · Пробел выбор/отмена выбора · Enter выбор и отправка',
  'askUser.shortcuts.multiNext':
    '↑↓ перемещение · Пробел выбор/отмена выбора · Enter выбор и следующий',
  'askUser.shortcuts.multiFinal':
    '↑↓ перемещение · Пробел выбор/отмена выбора · Enter выбор и окончательная отправка',
  'askUser.shortcuts.customTrigger': '↑↓ выбор · Enter редактирование',
  'askUser.shortcuts.customTriggerMulti':
    '↑↓ перемещение · Enter редактирование',
  'askUser.shortcuts.inputEmpty':
    'Введите ответ · Esc для остановки редактирования',
  'askUser.shortcuts.inputSingle':
    'Enter отправка · Esc для остановки редактирования',
  'askUser.shortcuts.inputNext':
    'Enter следующий · Esc для остановки редактирования',
  'askUser.shortcuts.inputFinal':
    'Enter окончательная отправка · Esc для остановки редактирования',
  'copy.failedFallback': 'Не удалось скопировать в буфер обмена',
  'copy.inlineLatexMissing':
    'В последнем выводе ИИ не найдено соответствующего строчного выражения LaTeX.',
  'copy.latexMissing': 'В последнем выводе ИИ не найден блок LaTeX.',
  'copy.noOutput': 'Нет вывода в истории',
  'copy.noText': 'Последний вывод ИИ не содержит текста для копирования.',
  'copy.codeMissing': 'В последнем выводе ИИ нет соответствующего блока кода.',
  'copy.outputCopied': 'Последний вывод скопирован в буфер обмена',
  'copy.toClipboard': (v) =>
    interpolateRu('{{HC0}} скопировано в буфер обмена', [
      v?.label ?? 'Выделение',
    ]),
  'code.copy': 'Копировать',
  'code.copied': 'Скопировано!',
  'echartsChart.noData': 'Нет данных',
  'echartsChart.tableNotice': (v) => {
    const omittedRows = Number(v?.omittedRows ?? 0);
    const omittedColumns = Number(v?.omittedColumns ?? 0);
    if (omittedRows > 0 && omittedColumns > 0) {
      return interpolateRu(
        'Отображение {{HC0}} из {{HC1}} строк и {{HC2}} из {{HC3}} столбцов',
        [
          v?.visibleRows ?? 0,
          v?.totalRows ?? 0,
          v?.visibleColumns ?? 0,
          v?.totalColumns ?? 0,
        ],
      );
    }
    if (omittedColumns > 0) {
      return interpolateRu('Отображение {{HC0}} из {{HC1}} столбцов', [
        v?.visibleColumns ?? 0,
        v?.totalColumns ?? 0,
      ]);
    }
    return interpolateRu('Отображение {{HC0}} из {{HC1}} строк', [
      v?.visibleRows ?? 0,
      v?.totalRows ?? 0,
    ]);
  },
  'echartsChart.rendering': 'Отрисовка графика',
  'echartsChart.renderFailed': 'Ошибка отрисовки графика.',
  'echartsChart.viewMode': 'Режим просмотра',
  'echartsChart.showChart': 'Показать график',
  'echartsChart.showData': 'Показать данные',
  'echartsChart.chart': 'График',
  'echartsChart.data': 'Данные',
  'markdownTable.blank': '(пусто)',
  'markdownTable.column': (v) =>
    interpolateRu('Столбец {{HC0}}', [v?.index ?? '']),
  'markdownTable.rows': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'строка', 'строки', 'строк')}`,
  'markdownTable.rowsFiltered': (v) =>
    interpolateRu('{{HC0}}/{{HC1}} строк', [v?.visible ?? 0, v?.total ?? 0]),
  'markdownTable.hint':
    'Нажмите заголовки для сортировки, откройте фильтры через ▾.',
  'markdownTable.filtersActive': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'активный фильтр', 'активных фильтра', 'активных фильтров')}`,
  'markdownTable.selection.selected': 'Выбрано',
  'markdownTable.selection.nonEmpty': 'Не пусто',
  'markdownTable.selection.numeric': 'Числовое',
  'markdownTable.selection.sum': 'Сумма',
  'markdownTable.selection.average': 'Среднее',
  'markdownTable.selection.min': 'Минимум',
  'markdownTable.selection.max': 'Максимум',
  'markdownTable.copyTsv': 'Копировать в TSV',
  'markdownTable.copyTsvHint':
    'Копировать как TSV для вставки в табличные приложения',
  'markdownTable.copyVisible': 'Копировать таблицу',
  'markdownTable.customColumns': 'Пользовательские столбцы',
  'markdownTable.customColumns.tableSection': 'Столбцы, отображаемые в таблице',
  'markdownTable.customColumns.detailSection':
    'Поля, отображаемые в развернутых строках',
  'markdownTable.customColumns.toggleAllTable':
    'Переключить все столбцы таблицы',
  'markdownTable.customColumns.toggleAllDetails':
    'Переключить все поля развернутых строк',
  'markdownTable.customColumns.reset': 'Сброс',
  'markdownTable.customColumns.noDetails':
    'Не выбраны поля развернутой строки.',
  'markdownTable.freezeFirstColumn': 'Заморозить первый столбец',
  'markdownTable.unfreezeFirstColumn': 'Разморозить первый столбец',
  'markdownTable.densityLabel': 'Плотность таблицы',
  'markdownTable.densityCurrent': (v) =>
    interpolateRu('{{HC0}} плотность', [v?.density ?? '']).trim(),
  'markdownTable.density': (v) =>
    interpolateRu('Плотность: {{HC0}}', [v?.density ?? '']),
  'markdownTable.density.standard': 'Стандартная',
  'markdownTable.density.compact': 'Компактная',
  'markdownTable.density.comfortable': 'Удобная',
  'markdownTable.expandLongText': 'Раскрыть текст',
  'markdownTable.collapseLongText': 'Свернуть текст',
  'markdownTable.emptyValue': '(пусто)',
  'markdownTable.hideColumn': 'Скрыть столбец',
  'markdownTable.showHiddenColumns': (v) =>
    `Показать ${v?.count ?? 0} ${pluralRu(v?.count, 'скрытый столбец', 'скрытых столбца', 'скрытых столбцов')}`,
  'markdownTable.moveColumn': (v) =>
    interpolateRu('Переместить {{HC0}}', [v?.column ?? '']),
  'markdownTable.resizeColumn': (v) =>
    interpolateRu('Изменить размер {{HC0}}', [v?.column ?? '']),
  'markdownTable.rowDetails': 'Детали',
  'markdownTable.rowDetailsAria': (v) =>
    interpolateRu('Показать детали для строки {{HC0}}', [v?.index ?? '']),
  'markdownTable.closeRowDetailsAria': (v) =>
    interpolateRu('Скрыть детали для строки {{HC0}}', [v?.index ?? '']),
  'markdownTable.detailsHeader': 'Детали строки',
  'markdownTable.cellDialogTitle': 'Значение текущего поля',
  'markdownTable.copyCell': 'Копировать',
  'markdownTable.close': 'Закрыть',
  'markdownTable.actions': 'Действия',
  'markdownTable.sortByColumn': (v) =>
    interpolateRu('Отсортировать по {{HC0}}', [v?.column ?? '']),
  'markdownTable.sortByColumnAsc': (v) =>
    interpolateRu('Отсортировать по {{HC0}}, возрастание', [v?.column ?? '']),
  'markdownTable.sortByColumnDesc': (v) =>
    interpolateRu('Отсортировать по {{HC0}}, убывание', [v?.column ?? '']),
  'markdownTable.filterColumn': (v) =>
    interpolateRu('Фильтр {{HC0}}', [v?.column ?? '']),
  'markdownTable.empty': 'В этой таблице нет данных.',
  'markdownTable.emptyFiltered': 'Ни одна строка не соответствует фильтрам.',
  'markdownTable.sort.asc': 'Сортировка по возрастанию',
  'markdownTable.sort.desc': 'Сортировка по убыванию',
  'markdownTable.sort.clear': 'Очистить сортировку',
  'markdownTable.filter.searchPlaceholder': 'Поиск значений фильтра',
  'markdownTable.filter.searchAria': (v) =>
    interpolateRu('Поиск по {{HC0}}', [v?.column ?? '']),
  'markdownTable.filter.selectVisible': 'Выбрать текущие результаты',
  'markdownTable.filter.optionLimit': (v) =>
    interpolateRu(
      'Отображаются первые {{HC0}} элементов. Используйте поиск для уточнения результатов.',
      [v?.count ?? 0],
    ),
  'markdownTable.filter.noOptions': 'Нет совпадений',
  'markdownTable.filter.custom': 'Пользовательский фильтр',
  'markdownTable.filter.numberAria': (v) =>
    interpolateRu('Числовой фильтр для {{HC0}}', [v?.column ?? '']),
  'markdownTable.filter.textAria': (v) =>
    interpolateRu('Текстовый фильтр для {{HC0}}', [v?.column ?? '']),
  'markdownTable.filter.numberPlaceholder': 'Значение',
  'markdownTable.filter.toPlaceholder': 'До',
  'markdownTable.filter.textPlaceholder': 'Введите условие фильтра',
  'markdownTable.filter.reset': 'Сброс',
  'markdownTable.filter.cancel': 'Отмена',
  'markdownTable.filter.confirm': 'Подтвердить',
  'markdownTable.filter.text.contains': 'Содержит',
  'markdownTable.filter.text.equals': 'Равно',
  'markdownTable.filter.text.notEquals': 'Не равно',
  'markdownTable.filter.text.startsWith': 'Начинается с',
  'markdownTable.filter.text.endsWith': 'Завершается на',
  'markdownTable.filter.number.gt': 'Больше чем',
  'markdownTable.filter.number.gte': 'Больше или равно',
  'markdownTable.filter.number.lt': 'Меньше чем',
  'markdownTable.filter.number.lte': 'Меньше или равно',
  'markdownTable.filter.number.between': 'Между',
  'mermaid.rendering': 'Рендеринг диаграммы...',
  'mermaid.viewCode': '</>',
  'mermaid.viewDiagram': '⊞',
  'mermaid.zoomIn': '+',
  'mermaid.zoomOut': '−',
  'mermaid.zoomReset': '↺',
  'contextUsage.active': 'активно',
  'contextUsage.autocompactBuffer': 'Буфер автоупаковки',
  'contextUsage.bodyLoaded': 'содержимое загружено',
  'contextUsage.builtinTools': 'Встроенные инструменты',
  'contextUsage.contextWindow': 'Контекстное окно',
  'contextUsage.detailHint':
    'Выполните /context detail для детализации по элементам.',
  'contextUsage.estimatedOverhead': 'Оценочные накладные расходы перед беседой',
  'contextUsage.estimatedUntilProviderUsage':
    'Использование токенов оценивается до получения данных от провайдера.',
  'contextUsage.free': 'Свободно',
  'contextUsage.memoryFiles': 'Файлы памяти',
  'contextUsage.messages': 'Сообщения',
  'contextUsage.mcpTools': 'Инструменты MCP',
  'contextUsage.model': 'Модель',
  'contextUsage.noSession':
    'Активной сессии пока нет. Отправьте первое сообщение перед просмотром использования контекста.',
  'contextUsage.noApiResponse':
    'Пока нет ответа от API. Отправьте сообщение, чтобы увидеть фактическое использование.',
  'contextUsage.overLimit':
    'Контекст превышает лимит! Используйте /compress или /clear для уменьшения.',
  'contextUsage.skills': 'Навыки',
  'contextUsage.systemPrompt': 'Системная подсказка',
  'contextUsage.title': 'Использование контекста',
  'contextUsage.tokens': 'токенов',
  'contextUsage.usageByCategory': 'Использование по категориям',
  'contextUsage.used': 'Использовано',
  'daemon.title': 'Статус демона',
  'daemon.details.loading': 'Загрузка диагностики...',
  'daemon.details.failed': 'Не удалось загрузить диагностику.',
  'daemon.refresh': 'Обновить',
  'daemon.logs.download': 'Скачать логи',
  'daemon.logs.saving': 'Сохранение…',
  'daemon.logs.saved': 'Логи сохранены',
  'daemon.logs.failed': 'Не удалось сохранить логи. Повторите попытку.',
  'daemon.loading': 'Загрузка статуса демона...',
  'daemon.loadFailed': 'Не удалось загрузить статус демона',
  'daemon.updatedAt': (v) =>
    interpolateRu('Обновлено {{HC0}}', [v?.time ?? '']),
  'daemon.none': 'нет',
  'daemon.level.ok': 'OK',
  'daemon.level.warning': 'Предупреждение',
  'daemon.level.error': 'Ошибка',
  'daemon.level.unavailable': 'Недоступно',
  'daemon.issues.title': 'Проблемы',
  'daemon.overview.title': 'Демон',
  'daemon.overview.version': 'Версия',
  'daemon.overview.pid': 'PID',
  'daemon.overview.mode': 'Режим',
  'daemon.overview.uptime': 'Время работы',
  'daemon.overview.workspace': 'Рабочая область',
  'daemon.runtime.title': 'Среда выполнения',
  'daemon.runtime.activeSessions': 'Активные сессии',
  'daemon.runtime.activePrompts': 'Активные запросы',
  'daemon.runtime.idle': 'Неактивен в течение',
  'daemon.runtime.noActivity': 'деятельности пока не зафиксировано',
  'daemon.runtime.pendingPermissions': 'Ожидание разрешений',
  'daemon.runtime.permissionPolicy': 'Политика разрешений',
  'daemon.runtime.channel': 'канал ACP',
  'daemon.runtime.channelLive': 'в эфире',
  'daemon.runtime.channelDown': 'отключен',
  'daemon.runtime.startingUp': 'Среда выполнения запускается...',
  'daemon.runtime.startFailed': 'Не удалось запустить среду выполнения',
  'daemon.runtime.channelWorker': 'Рабочий процесс канала',
  'daemon.runtime.channelWorkerRestarts': 'Перезапуски рабочих процессов',
  'daemon.runtime.memory': 'Память (RSS / куча)',
  'daemon.transport.title': 'Транспорт',
  'daemon.transport.restSse': 'Потоки REST SSE',
  'daemon.transport.acpDisabled': 'Транспорт ACP отключен',
  'daemon.transport.acpConnections': 'Соединения ACP',
  'daemon.transport.acpStreams': 'Потоки ACP (сессия/SSE/WS)',
  'daemon.transport.pendingRequests': 'Ожидание запросов клиента',
  'daemon.transport.rateLimitRejected': 'Отказы из-за ограничения скорости',
  'daemon.security.title': 'Безопасность',
  'daemon.security.token': 'Токен Bearer',
  'daemon.security.requireAuth': 'Требуется аутентификация',
  'daemon.security.loopback': 'Связь с локальным адресом',
  'daemon.security.allowOrigin': 'Разрешённые источники',
  'daemon.security.shell': 'Команды оболочки сессии',
  'daemon.security.configured': 'конфигурировано',
  'daemon.security.notConfigured': 'не настроено',
  'daemon.limits.title': 'Лимиты',
  'daemon.limits.unlimited': 'без ограничений',
  'daemon.limits.maxSessions': 'Макс. количество сессий',
  'daemon.limits.maxPendingPrompts':
    'Макс. количество ожидающих запросов / сессия',
  'daemon.limits.maxConnections': 'Макс. количество соединений слушателя',
  'daemon.limits.eventRing': 'Размер кольца событий',
  'daemon.limits.promptDeadline': 'Срок действия запроса',
  'daemon.limits.sessionIdle': 'Таймаут неактивности сессии',
  'daemon.capabilities.title': 'Возможности',
  'daemon.capabilities.titleCount': (v) =>
    interpolateRu('Возможности ({{HC0}})', [v?.count ?? 0]),
  'daemon.full.sessions.title': 'Сессии',
  'daemon.full.sessions.empty': 'Нет активных сессий',
  'daemon.full.session.pendingPrompts': (v) =>
    interpolateRu('{{HC0}} ожидающих запросов', [v?.count ?? 0]),
  'daemon.full.session.pendingPermissions': (v) =>
    interpolateRu('Ожидание разрешений для {{HC0}}', [v?.count ?? 0]),
  'daemon.full.session.prompting': 'Запрос',
  'daemon.full.workspace.title': 'Диагностика рабочей области',
  'daemon.full.workspace.empty':
    'Отчеты о диагностике рабочей области отсутствуют',
  'daemon.full.auth.title': 'Аутентификация',
  'daemon.full.auth.providers': 'Провайдеры потока устройств',
  'daemon.full.auth.pending': 'Ожидание потоков устройств',
  'daemon.full.acp.title': 'Соединения ACP',
  'daemon.tab.overview': 'Обзор',
  'daemon.tab.usage': 'Использование',
  'daemon.tab.metrics': 'Метрики',
  'daemon.tab.diagnostics': 'Диагностика',
  'daemon.charts.title': 'Метрики',
  'daemon.charts.empty': 'Сбор метрик… графики появятся после первого образца.',
  'daemon.charts.concurrency': 'Конкуренция',
  'daemon.charts.activePrompts': 'Активные задачи',
  'daemon.charts.activeSessions': 'Сессии',
  'daemon.charts.requests': 'Запросы',
  'daemon.charts.reqTotal': 'Всего',
  'daemon.charts.reqErrors': 'Ошибки',
  'daemon.charts.apiLatency': 'Задержка API',
  'daemon.charts.promptLatency': 'Задержка запроса',
  'daemon.charts.queueWait': 'Ожидание в очереди',
  'daemon.charts.promptDuration': 'Длительность',
  'daemon.charts.eventLoop': 'Задержка цикла событий',
  'daemon.charts.eventLoopLag': 'Задержка p99',
  'daemon.charts.queuedPrompts': 'В очереди',
  'daemon.charts.reqRejected': 'Отклонено',
  'daemon.charts.llmLatency': 'Задержка LLM API',
  'daemon.charts.apiHealth': 'Здоровье модели API',
  'daemon.charts.apiErrors': 'Ошибки API',
  'daemon.charts.apiRetries': 'Повторы',
  'daemon.charts.cpu': 'CPU',
  'daemon.charts.pipe': 'Труба IPC',
  'daemon.charts.pipeIn': 'Вход',
  'daemon.charts.pipeOut': 'Вывод',
  'daemon.charts.connections': 'Соединения',
  'daemon.charts.cpuDaemon': 'Демон',
  'daemon.charts.cpuChild': 'Потомок',
  'daemon.charts.rssDaemon': 'RSS демона',
  'daemon.charts.rssChild': 'RSS потомка',
  'daemon.charts.memory': 'Память',
  'daemon.charts.heap': 'Куча',
  'daemon.charts.tokens': 'Расход токенов',
  'daemon.charts.tokensIn': 'Ввод',
  'daemon.charts.tokensOut': 'Вывод',
  'daemon.charts.peak': 'пик',
  'daemon.charts.concurrency.help':
    'Загрузка в реальном времени для каждого образца: выполняющиеся сейчас запросы, ожидающие в очереди (приняты, но ещё не отправлены) и активные сессии. Рост очередей выше активных означает обратное давление.',
  'daemon.charts.requests.help':
    'Трафик HTTP клиент↔демон за окно — НЕ вызовы модели. Всего запросов, вернувших 4xx/5xx и отклонённых ограничителем скорости.',
  'daemon.charts.apiLatency.help':
    'Длительность HTTP-запроса клиент↔демон (p50/p95) — скорость ответа демона, а не модели. Сравните с задержкой LLM API, чтобы разделить «мы медленные» и «модель медленная».',
  'daemon.charts.llmLatency.help':
    'Обратный ход API модели по кругу (daemon→model→daemon), p50/p95. Задержка на стороне модели, отличная от HTTP-задержки выше.',
  'daemon.charts.apiHealth.help':
    'Сбои LLM со стороны провайдера. Каждая неудачная попытка = 1 ошибка; каждый автоматический откат = 1 повтор. Преходящие 429/5xx обычно поглощаются повторами (ошибки ≈ повторы); если ошибки растут выше повторов, вызовы падают сразу.',
  'daemon.charts.promptLatency.help':
    'Для каждого запроса (задачи): p95 времени ожидания в очереди сессии перед отправкой и p95 общего времени выполнения. Рост времени ожидания очереди сигнализирует об обратном давлении.',
  'daemon.charts.eventLoop.help':
    'Задержка цикла событий демона p99 за окно — сигнал насыщения CPU / блокировки. Высокая задержка означает голодание демона и замедление всего.',
  'daemon.charts.cpu.help':
    'Использование CPU (% от всех ядер) для каждого образца: демон и потомок ACP (где выполняется работа LLM/инструментов). 0% у потомка означает, что он не работает.',
  'daemon.charts.memory.help':
    'Резидентная память для каждого образца: RSS демона, куча V8 демона и RSS потомка ACP. Стабильный рост со временем указывает на утечку.',
  'daemon.charts.pipe.help':
    'Байты, переданные через stdio-канал в дочерний процесс ACP и из него за выбранный период. Стабильно высокий объём указывает на активный обмен данными между демоном и дочерним процессом.',
  'daemon.charts.connections.help':
    'Активные транспортные соединения клиентов для каждого образца: потоки REST/SSE, потоки WebSocket ACP и соединения ACP.',
  'daemon.charts.tokens.help':
    'Входящие (запрос) и исходящие (ответ) токены, приписанные ходам модели за окно — расход модели со временем.',
  'daemon.usage.today': 'Сегодня',
  'daemon.usage.period7d': '7Д',
  'daemon.usage.period30d': '30Д',
  'daemon.usage.rangeWeek': 'Последние 7 дней',
  'daemon.usage.rangeMonth': 'Последние 30 дней',
  'daemon.usage.rangeGroup': 'Период сводки',
  'daemon.usage.tokensConsumed': 'Потреблённые токены',
  'daemon.usage.sessions': 'Сессии',
  'daemon.usage.requests': 'Запросы',
  'daemon.usage.tools': 'Инструменты',
  'daemon.usage.changes': 'Изменения',
  'daemon.usage.breakdownTitle': 'Разбивка по токенам',
  'daemon.usage.inputTokens': 'Входящие токены',
  'daemon.usage.inputHint': 'запрос + чтение кэша',
  'daemon.usage.outputTokens': 'Исходящие токены',
  'daemon.usage.outputHint': 'ответ + рассуждение',
  'daemon.usage.cacheRead': 'Чтение из кэша',
  'daemon.usage.cacheHint': 'Поделиться чтением из кэша',
  'daemon.usage.heatmapTitle': 'Тепловая карта токенов',
  'daemon.usage.heatmapSub': (v) =>
    interpolateRu(
      'последние {{HC0}} месяцев · агрегированные токены ежедневно',
      [v?.months ?? 12],
    ),
  'daemon.usage.low': 'Низкий',
  'daemon.usage.high': 'Высокий',
  'daemon.usage.dowMon': 'Пн',
  'daemon.usage.dowWed': 'Ср',
  'daemon.usage.dowFri': 'Пт',
  'daemon.usage.empty': 'Использование токенов не записано.',
  'daemon.usage.loading': 'Загрузка использования…',
  'daemon.usage.failed': 'Не удалось загрузить использование',
  'daemon.usage.cellTokens': (v) =>
    interpolateRu('{{HC0}} · Токены: {{HC1}} · Кэш: {{HC2}}%', [
      v?.date ?? '',
      v?.tokens ?? '0',
      v?.cache ?? 0,
    ]),
  'daemon.usage.rangeWordToday': 'Сегодня',
  'daemon.usage.rangeWordWeek': '7 дней',
  'daemon.usage.rangeWordMonth': '30 дней',
  'daemon.usage.modelShareTitle': 'Поделиться моделью',
  'daemon.usage.modelShareSub':
    'доля токенов · светло-зелёный показывает чтение из кэша',
  'daemon.usage.modelMeta': (v) =>
    interpolateRu('{{HC0}} токенов · кэш {{HC1}}%', [
      v?.tokens ?? '0',
      v?.cache ?? 0,
    ]),
  'daemon.usage.skillTitle': 'вызовы навыков',
  'daemon.usage.skillSub': 'название навыка / количество',
  'daemon.usage.skillName': 'Название навыка',
  'daemon.usage.skillCount': 'Количество',
  'daemon.usage.dailyTokensTitle': 'токенов',
  'daemon.usage.dailyTokensSub': 'ежедневные итоги токенов',
  'daemon.usage.dailySessionsTitle': 'сессии',
  'daemon.usage.dailySessionsSub': 'количество активных сессий в день',
  'delete.cannotCurrent': 'Нельзя удалить текущую активную сессию.',
  'delete.action': 'Удалить',
  'delete.deleted': 'Сессия удалена.',
  'delete.deletedCount': (v) =>
    interpolateRu('Удалено {{HC0}} сессий.', [v?.count ?? 0]),
  'delete.deleting': 'Удаление…',
  'delete.failed': (v) =>
    `Не удалось удалить сессию.${v?.reason ? ` ${v.reason}` : ''}`,
  'delete.footer':
    '↑↓ навигация · Пробел для выбора · Enter для удаления · Esc для отмены',
  'delete.noMatch': (v) =>
    interpolateRu('Сессия с именем «{{HC0}}» не найдена', [v?.query ?? '']),
  'delete.none': 'Нет сессий для удаления',
  'delete.allFailed': (v) =>
    `Не удалось удалить ${v?.count ?? 0} ${pluralRu(v?.count, 'сессию', 'сессии', 'сессий')}: ${v?.reason ?? 'неизвестная ошибка'}`,
  'delete.nonRemoved': 'Ни одна сессия не была удалена.',
  'delete.notFound': 'Сессия не найдена — возможно, она уже была удалена.',
  'delete.partialFail': (v) =>
    interpolateRu('{{HC0}} удалено, {{HC1}} не удалено: {{HC2}}', [
      v?.removed ?? 0,
      v?.failed ?? 0,
      v?.detail ?? 'Не удалось удалить часть сессий',
    ]),
  'delete.matches': (v) => interpolateRu('{{HC0}} совпадений', [v?.count ?? 0]),
  'delete.pressSearch':
    'Нажмите / для поиска; Пробел — выбрать; Enter — удалить',
  'delete.selected': (v) => interpolateRu('{{HC0}} выбрано', [v?.count ?? 0]),
  'delete.title': 'Удалить сессию',
  'time.justNow': 'только что',
  'time.minutesAgo': (v) =>
    interpolateRu('{{HC0}} мин. назад', [v?.count ?? 0]),
  'time.hoursAgo': (v) => interpolateRu('{{HC0}}ч. назад', [v?.count ?? 0]),
  'time.daysAgo': (v) => interpolateRu('{{HC0}}д. назад', [v?.count ?? 0]),
  'dialog.footer.close': 'Esc для закрытия',
  'dialog.footer.confirmCancel': 'Enter для подтверждения · Esc для отмены',
  'release.cannotCurrent': 'Нельзя освободить текущую активную сессию.',
  'release.action': 'Освободить',
  'release.released': 'Сессия успешно освобождена.',
  'release.failed': (v) =>
    interpolateRu('Не удалось освободить сессию.{{HC0}}', [
      v?.reason ? interpolateRu('{{HC0}}', [v.reason]) : '',
    ]),
  'release.footer': '↑↓ для навигации · Enter — освободить · Esc — отмена',
  'release.inactive': 'Только активные живые сессии могут быть освобождены.',
  'release.inactiveBadge': 'неактивна',
  'release.noMatch': (v) =>
    interpolateRu('Сессия, совпадающая с "{{HC0}}", не найдена', [
      v?.query ?? '',
    ]),
  'release.matches': (v) =>
    interpolateRu('{{HC0}} совпадений', [v?.count ?? 0]),
  'release.none': 'Нет живых сессий для освобождения',
  'release.pressSearch':
    'Нажмите / для поиска; Enter — освободить выбранную живую сессию',
  'release.releasing': 'Освобождение...',
  'release.title': 'Освободить сессию',
  'dialog.footer.menu': 'Esc — в меню',
  'dialog.footer.mcpServers':
    '↑↓ для навигации · Enter — детали · r — обновить · Esc — закрыть',
  'dialog.footer.mcpSelect': '↑↓ для навигации · Enter — выбрать · Esc — назад',
  'dialog.footer.modelFast':
    '↑↓ для навигации · / для поиска · c — своя модель · Enter — установить быструю модель · Esc — отмена',
  'dialog.footer.navSelectCancel':
    '↑↓ для навигации · Enter — выбрать · Esc — отмена',
  'dialog.footer.navSelectClose':
    '↑↓ для навигации · Enter — выбрать · Esc — закрыть',
  'dialog.footer.navSelectMenu':
    '↑↓ для навигации · Enter — выбрать · Esc — в меню',
  'dialog.footer.navOpenClose':
    '↑↓ для навигации · Enter — открыть · Esc — закрыть',
  'dialog.footer.navOpenMenu':
    '↑↓ для навигации · Enter — открыть · Esc — в меню',
  'dialog.footer.back': 'Esc для возврата',
  'dialog.footer.backClose': 'Esc для закрытия',
  'dialog.footer.saveClose':
    '↑↓ переключение полей · ⌘/Ctrl+Enter — сохранить · Esc — закрыть',
  'dialog.footer.saveMenu':
    '↑↓ переключение полей · ⌘/Ctrl+Enter — сохранить · Esc — в меню',
  'dialog.footer.search':
    'Введите текст для поиска · Enter — подтвердить · Esc — очистить',
  'dialog.footer.select': 'Enter — выбрать',
  'editor.escClearHint': 'Нажмите Esc ещё раз, чтобы очистить',
  'editor.hintCommands': 'команды',
  'editor.hintFiles': 'Файлы',
  'editor.hintNext': 'следующий',
  'editor.hintPrev': 'предыдущий',
  'editor.hintSearch': 'поиск',
  'editor.noHistory': 'История совпадений отсутствует',
  'editor.placeholder': 'Введите сообщение или @ путь к файлу',
  'history.loadingEarlier': 'Загрузка предыдущих сообщений…',
  'history.capacityReached':
    'Достигнут предел отображения истории. Предыдущие сообщения сохранены.',
  'history.paginationError': 'Не удалось загрузить предыдущую историю.',
  'history.retry': 'Повторить',
  'editor.shellPlaceholder': 'Введите команду терминала',
  'editor.send': 'Отправить сообщение',
  'editor.imagesSkipped': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'недоступный файл пропущен', 'недоступных файла пропущены', 'недоступных файлов пропущено')}.`,
  'editor.imagesReadFailed': (v) =>
    `Не удалось прочитать ${v?.count ?? 0} ${pluralRu(v?.count, 'файл', 'файла', 'файлов')}.`,
  'editor.imagesTooLarge': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'файл превышает', 'файла превышают', 'файлов превышают')} допустимый размер вложения.`,
  'editor.connectionDisconnected':
    'Соединение прервано. Пожалуйста, попробуйте снова после восстановления соединения.',
  'editor.sessionLoading': 'Сессия загружается. Попробуйте позже.',
  'editor.processing': 'Обработка. Новые сообщения будут добавлены в очередь.',
  'editor.searchHint':
    'ctrl+r поиск · tab принять · enter отправить · esc отменить',
  'editor.searchLabel': 'reverse-i-search:',
  'editor.searchPlaceholder': 'введите текст для поиска...',
  'editor.newSessionSuggestionTitle': 'Это похоже на новую тему',
  'editor.newSessionSuggestionStart': 'Отправить в новой сессии',
  'editor.btwSuggestionTitle': 'Это похоже на дополнительный вопрос',
  'editor.btwSuggestionSend': 'Запросить через BTW',
  'quickActions.open': 'Дополнительные действия',
  'quickActions.title': 'Дополнительные действия',
  'quickActions.mcp': 'MCP',
  'quickActions.context': 'Контекст',
  'quickActions.status': 'Статус',
  'quickActions.stats': 'Сессия',
  'quickActions.memory': 'Память',
  'quickActions.extensions': 'Расширения',
  'quickActions.skills': 'Навыки',
  'quickActions.tools': 'Инструменты',
  'quickActions.agents': 'Агенты',
  'quickActions.help': 'Помощь',
  'quickActions.theme': 'Установить тему',
  'quickActions.auth': 'Аутентификация',
  'quickActions.settings': 'Настройки',
  'quickActions.new': 'Новая сессия',
  'quickActions.resume': 'Переключиться на сессию',
  'quickActions.delete': 'Удалить сессию',
  'quickActions.branch': 'Копировать сессию',
  'quickActions.rewind': 'Вернуть сессию к прежнему состоянию',
  'quickActions.historyQuestion': 'История вопросов',
  'quickActions.recap': 'Сгенерировать краткое содержание',
  'quickActions.copy': 'Копировать вывод',
  'quickActions.shellMode': 'Режим терминала',
  'quickActions.exitShellMode': 'Выйти из режима оболочки',
  'quickActions.setGoal': 'Установить цель',
  'session.missing': 'Текущая сессия отсутствует',
  'session.new': 'Новая сессия',
  'workspace.loadFailed': 'Не удалось загрузить рабочую область',
  'workspace.notFound': 'Рабочая область не найдена',
  'workspace.notFoundDescription':
    'Эта рабочая область может быть удалена, или ссылка больше не действительна.',
  'workspace.loadFailedDescription':
    'Сервис рабочей области недоступен. Проверьте демон и повторите попытку.',
  'scheduledTasks.title': 'Запланированные задачи',
  'scheduledTasks.subtitle':
    'Выполняйте задачи автоматически по расписанию или запускайте их вручную в любое время.',
  'scheduledTasks.loading': 'Загрузка…',
  'scheduledTasks.count': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'задача', 'задачи', 'задач')}`,
  'scheduledTasks.refresh': 'Обновить',
  'scheduledTasks.new': 'Новая запланированная задача',
  'scheduledTasks.createViaChat': 'Создать через чат',
  'scheduledTasks.chatStarter':
    'Помогите мне создать повторяющуюся задачу. Что я хочу: ',
  'scheduledTasks.name': 'Название',
  'scheduledTasks.workspace': 'Рабочая область',
  'scheduledTasks.session.label': 'Разговор',
  'scheduledTasks.session.dedicated': 'Выделенный разговор задачи',
  'scheduledTasks.session.current': 'Текущий разговор',
  'scheduledTasks.session.dedicatedHint':
    'Каждый запуск выполняется в отдельном диалоге, созданном для этой задачи.',
  'scheduledTasks.session.currentHint':
    'Все будущие запуски будут выполняться в открытом сейчас диалоге.',
  'scheduledTasks.session.currentUnsupported':
    'Планирование текущего разговора недоступно на этом демоне.',
  'scheduledTasks.session.currentUnavailable':
    'Сначала откройте существующий диалог.',
  'scheduledTasks.session.currentBusy':
    'Подождите завершения текущего действия или обработки запроса.',
  'scheduledTasks.session.currentIneligible':
    'Этот тип диалога нельзя использовать для запланированной задачи.',
  'scheduledTasks.session.currentWorkspaceMismatch':
    'Текущий диалог относится к другой рабочей области.',
  'scheduledTasks.session.currentAlreadyBound':
    'Текущий диалог уже привязан к запланированной задаче.',
  'scheduledTasks.taskId': 'ID задачи',
  'scheduledTasks.schedule': 'Расписание',
  'scheduledTasks.type': 'Тип',
  'scheduledTasks.status': 'Статус',
  'scheduledTasks.namePlaceholder':
    'Необязательно — по умолчанию используется запрос',
  'scheduledTasks.prompt': 'Промпт',
  'scheduledTasks.promptPlaceholder': 'Опишите, что должна делать эта задача.',
  'scheduledTasks.reference.extension': 'Расширения',
  'scheduledTasks.reference.skill': 'Навыки',
  'scheduledTasks.reference.mcp': 'MCP',
  'scheduledTasks.referencePicker': 'Выбор ссылки',
  'scheduledTasks.reference.remove': 'Удалить',
  'scheduledTasks.reference.loading': 'Загрузка…',
  'scheduledTasks.reference.empty': 'Нет доступных элементов.',
  'scheduledTasks.frequency': 'Частота',
  'scheduledTasks.freq.daily': 'Ежедневно',
  'scheduledTasks.freq.weekdays': 'Рабочие дни',
  'scheduledTasks.freq.weekly': 'Еженедельно',
  'scheduledTasks.freq.hourly': 'Ежечасно',
  'scheduledTasks.freq.minutes': 'Каждые N минут',
  'scheduledTasks.freq.custom': 'Свой (cron)',
  'scheduledTasks.time': 'Время',
  'scheduledTasks.weekday': 'Рабочий день',
  'scheduledTasks.interval': 'Минуты',
  'scheduledTasks.cron': 'Выражение cron',
  'scheduledTasks.weekdayNames': 'Пн,Вт,Ср,Чт,Пт,Сб,Вс',
  'scheduledTasks.human.daily': (v) =>
    interpolateRu('Ежедневно в {{HC0}}', [v?.time ?? '']),
  'scheduledTasks.human.weekdays': (v) =>
    interpolateRu('Будние дни в {{HC0}}', [v?.time ?? '']),
  'scheduledTasks.human.weekly': (v) =>
    interpolateRu('Каждую {{HC0}} в {{HC1}}', [v?.day ?? '', v?.time ?? '']),
  'scheduledTasks.human.hourly': (v) =>
    interpolateRu('Ежечасово в :{{HC0}}', [v?.min ?? '00']),
  'scheduledTasks.human.everyMinutes': (v) =>
    interpolateRu('Каждые {{HC0}} минут', [v?.n ?? '']),
  'scheduledTasks.never': 'Никогда не запускать',
  'scheduledTasks.repeats': 'Повторяется',
  'scheduledTasks.runsOnce': 'Запускается один раз',
  'scheduledTasks.lastFired': (v) =>
    interpolateRu('Последний запуск: {{HC0}}', [v?.when ?? '']),
  'scheduledTasks.runNow': 'Запустить сейчас',
  'scheduledTasks.enable': 'Включить',
  'scheduledTasks.disable': 'Отключить',
  'scheduledTasks.delete': 'Удалить',
  'scheduledTasks.deleteConfirmTitle': 'Удаление запланированной задачи',
  'scheduledTasks.deleteConfirm': (v) =>
    interpolateRu('Удалить запланированную задачу «{{HC0}}»?', [v?.name ?? '']),
  'scheduledTasks.deletedSnapshot':
    'Эта запланированная задача была удалена. Отображается снимок состояния на момент её создания.',
  'scheduledTasks.sessionScopedSnapshot':
    'Это задача с ограничением по сессии. Отображается снимок состояния на момент её создания.',
  'scheduledTasks.empty':
    'Запланированных задач пока нет. Создайте одну, чтобы начать работу.',
  'scheduledTasks.create': 'Создать',
  'scheduledTasks.creating': 'Создание…',
  'scheduledTasks.cancel': 'Отмена',
  'scheduledTasks.error.invalidSchedule': 'Неверное расписание',
  'scheduledTasks.error.emptyPrompt': 'Требуется запрос',
  'scheduledTasks.error.promptTooLong': (v) =>
    interpolateRu('Запрос превышает лимит в {{HC0}} символов', [
      v?.max ?? 100_000,
    ]),
  'scheduledTasks.error.goalActive':
    'Нельзя запустить запланированную задачу во время активной цели.',
  'scheduledTasks.error.toggleFailed': 'Не удалось обновить задачу',
  'scheduledTasks.error.deleteFailed': 'Не удалось удалить задачу',
  'scheduledTasks.edit': 'Редактировать',
  'scheduledTasks.editTitle': 'Редактировать запланированную задачу',
  'scheduledTasks.save': 'Сохранить',
  'scheduledTasks.saving': 'Сохранение…',
  'scheduledTasks.runHistory': (v) =>
    interpolateRu('История выполнения ({{HC0}})', [v?.count ?? 0]),
  'scheduledTasks.viewHistory': (v) =>
    interpolateRu('Просмотр диалога ({{HC0}})', [v?.count ?? 0]),
  'scheduledTasks.viewHistoryEmpty': 'Открыть диалог',
  'scheduledTasks.viewHistoryHint':
    'Откройте сессию задачи, чтобы увидеть её выполнения',
  'scheduledTasks.runKind.catchUp': 'догоняющий запуск',
  'scheduledTasks.runKind.manual': 'вручную',
  'scheduledTasks.runKind.withheld': 'пропущено',
  'scheduledTasks.runKind.sessionDispatchFailed':
    'создание новой сессии не удалось, ничего не выполнено',
  'scheduledTasks.runKind.sessionDispatchFallback':
    'создание новой сессии не удалось, выполнение проведено в сессии задачи',
  'scheduledTasks.openRunSession': 'Открыть эту сессию выполнения',
  'scheduledTasks.runContext.title': 'Выполнение запланированной задачи',
  'scheduledTasks.runContext.taskId': 'ID задачи',
  'scheduledTasks.runContext.schedule': 'Расписание',
  'scheduledTasks.runContext.triggeredAt': 'Запущено',
  'scheduledTasks.runContext.trigger.scheduled': 'Запланировано',
  'scheduledTasks.runContext.trigger.manual': 'Запустить вручную',
  'scheduledTasks.error.runFailed': 'Не удалось записать выполнение',
  'scheduledTasks.error.oneShotConsumedButFailed':
    'Задача была удалена, но запрос не был доставлен — он никогда не выполнялся. Создайте её заново, чтобы повторить попытку.',
  'scheduledTasks.dueNow': 'Срок наступил сейчас',
  'scheduledTasks.nextRunTooltip': (v) =>
    interpolateRu('Следующий запуск: {{HC0}}', [v?.when ?? '']),
  'scheduledTasks.dur.d': 'д',
  'scheduledTasks.dur.h': 'ч',
  'scheduledTasks.dur.m': 'м',
  'scheduledTasks.dur.s': 'с',
  'scheduledTasks.runIn': 'Выполнить через',
  'scheduledTasks.sessionMode.perRun': 'Новая сессия при каждом запуске',
  'scheduledTasks.sessionMode.persistent': 'Постоянная сессия задачи',
  'scheduledTasks.sessionMode.perRun.hint':
    'Каждое выполнение получает чистый контекст и свой собственный диалог.',
  'scheduledTasks.sessionMode.persistent.hint':
    'Все выполнения продолжаются в одном диалоге задачи.',
  'scheduledTasks.condition': 'Предусловие (необязательно)',
  'scheduledTasks.conditionPlaceholder':
    'Например: проверьте, появились ли изменения в ветке main со вчерашнего дня. Если изменений нет, задача не должна запускаться.',
  'scheduledTasks.condition.hint':
    'Проверяется в отдельной сессии этой задачи перед каждым запуском. Запрос выполняется в новой сессии только при положительном результате проверки — иначе запуск пропускается.',
  'scheduledTasks.condition.cardPrefix': 'Если:',
  'turnOutputs.filesEdited': (v) =>
    interpolateRu('Изменено {{HC0}} файлов', [v?.count ?? 0]),
  'turnOutputs.imagePreview': 'Предпросмотр изображения',
  'turnOutputs.viewChanges': 'Просмотр изменений',
  'turnOutputs.review': 'Изменения',
  'turnOutputs.reviewLatest': 'Просмотр последних изменений файлов',
  'codeReview.authoritativeVerdict': 'Окончательное решение',
  'codeReview.targetEffort': (v) =>
    interpolateRu('Цель: {{HC0}} · Усилие: {{HC1}}', [
      v?.target ?? '',
      v?.effort ?? '',
    ]),
  'codeReview.openReport': 'Открыть Markdown-отчёт',
  'codeReview.loadingReport': 'Загрузка Markdown-отчёта...',
  'codeReview.back': 'Назад к обзору',
  'codeReview.reviewCounts': 'Количество проверок',
  'codeReview.total': 'Всего',
  'codeReview.confidence': (v) =>
    interpolateRu('{{HC0}} уверенность', [v?.value ?? '']),
  'codeReview.held': 'Отложено',
  'codeReview.heldByMeasurement':
    'Не повышено до Critical по результатам измерения',
  'codeReview.caps': 'Заглавные буквы',
  'codeReview.none': 'Нет',
  'codeReview.severity': 'Критичность',
  'codeReview.confidenceLabel': 'Уверенность',
  'codeReview.all': 'Все',
  'codeReview.noMatches': 'Ни один результат не соответствует этим фильтрам.',
  'codeReview.source': (v) =>
    interpolateRu('Источник: {{HC0}}', [v?.value ?? '']),
  'codeReview.failureScenario': 'Сценарий сбоя',
  'codeReview.witness': 'Наблюдатель',
  'codeReview.suggestedFix': 'Предлагаемое исправление',
  'codeReview.outcome': 'Итог',
  'codeReview.locations': 'Локации',
  'codeReview.evidence': 'Подтверждение',
  'codeReview.notLinked': 'не связано',
  'codeReview.loadErrorTitle': 'Не удалось отобразить обзор кода',
  'codeReview.loading': 'Загрузка обзора кода...',
  'codeReview.artifactTruncated':
    'Артефакт обзора кода обрезан и не может быть проверен.',
  'codeReview.reportTruncated': 'Markdown-отчёт обрезан.',
  'codeReview.unavailable': (v) =>
    interpolateRu(
      'Этот обзор кода больше не является авторитетным, так как статус артефакта {{HC0}}. Сгенерируйте обзор заново для просмотра.',
      [v?.status ?? 'неизвестно'],
    ),
  'codeReview.workspaceRequired':
    'Артефакты обзора кода должны быть читаемыми файлами рабочей области.',
  'sideTask.title': 'Дополнительная задача',
  'sideTask.description': 'Просмотр и создание дополнительных задач',
  'sideTask.new': 'Новая задача',
  'sideTask.create': 'Создать дополнительную задачу',
  'terminal.title': 'Терминал',
  'terminal.open': 'Открыть терминал',
  'terminal.notice.exited': (v) =>
    interpolateRu('Процесс завершился с кодом {{HC0}}', [v?.exitCode ?? '?']),
  'terminal.notice.error': (v) =>
    interpolateRu('Ошибка: {{HC0}}', [v?.message ?? '']),
  'terminal.notice.unknownError': 'Неизвестная ошибка',
  'terminal.notice.reconnecting': 'Соединение потеряно — восстановление…',
  'rightPanel.add': 'Добавить панель',
  'attachment.showPreview': 'Предпросмотр',
  'attachment.showSource': 'Источник',
  'attachment.previewUnsupported':
    'Предпросмотр недоступен для этого типа файла.',
  'attachment.readFailed': 'Ошибка чтения вложения.',
  'attachment.loadingFile': 'Загрузка файла...',
  'attachment.loadingPreview': 'Загрузка предпросмотра...',
  'sideTask.creating': 'Создание дополнительной задачи…',
  'sideTask.createFailed': 'Не удалось создать дополнительную задачу',
  'sideTask.promptFailed': 'Не удалось отправить запрос дополнительной задаче',
  'sideTask.renameFailed': 'Не удалось назвать дополнительную задачу',
  'turnOutputs.preview': 'Предпросмотр',
  'turnOutputs.collapseFiles': 'Свернуть файлы',
  'turnOutputs.showMoreFiles': (v) =>
    interpolateRu('Показать ещё {{HC0}} файлов', [v?.count ?? 0]),
  'turnOutputs.collapseArtifacts': 'Свернуть артефакты',
  'turnOutputs.showMoreArtifacts': (v) =>
    interpolateRu('Показать ещё {{HC0}} артефактов', [v?.count ?? 0]),
  'turnOutputs.previousTurn': 'Предыдущий ход',
  'turnOutputs.fileCount': (v) =>
    interpolateRu('{{HC0}} файлов', [v?.count ?? 0]),
  'turnOutputs.openFileTree': 'Открыть дерево файлов',
  'turnOutputs.closeFileTree': 'Закрыть дерево файлов',
  'turnOutputs.artifactMissing': 'Файл не найден в рабочей области',
  'turnOutputs.artifactUnavailable': (v) =>
    v?.path
      ? interpolateRu('Файл не найден в рабочей области · {{HC0}}', [v.path])
      : 'Файл не найден в рабочей области',
  'sidebar.label': 'Боковая панель рабочей области',
  'sidebar.toggleMenu': 'Переключить меню',
  'sidebar.newChat': 'Новый чат',
  'sidebar.newTask': 'Новая задача',
  'sidebar.newWorktreeTask': 'Новая задача для рабочей ветки',
  'sidebar.plugins': 'Плагины',
  'sidebar.channels': 'Каналы',
  'sidebar.sessionSource': 'Источник сессии',
  'sidebar.sessionSource.tasks': 'Задачи',
  'sidebar.sessionSource.channels': 'Каналы',
  'sidebar.channelType.other': 'Другие каналы',
  'sidebar.live': 'В прямом эфире',
  'sidebar.project': 'Проект',
  'sidebar.pinnedSessions': 'Закрепленные',
  'sidebar.workspaceSelectLabel': 'Рабочая область',
  'sidebar.noWorkspace': 'Нет рабочей области (автономно)',
  'sidebar.copySessionId': 'Скопировать ID сессии',
  'sidebar.copySessionIdFailed': 'Не удалось скопировать ID сессии',
  'sidebar.sessionIdCopied': 'ID сессии скопирован',
  'sidebar.workspaceUntrusted': 'недоверенная',
  'sidebar.manageWorkspaces': 'Управление рабочими областями…',
  'sidebar.workspaceReadOnly': 'только чтение',
  'sidebar.workspaceTrustToOpen':
    'Доверьте эту рабочую область для открытия сессии.',
  'sidebar.addWorkspace': 'Добавить рабочую область',
  'sidebar.newWorkspace': 'Новая рабочая область',
  'sidebar.startFromScratch': 'Начать с чистого листа',
  'sidebar.useExistingFolder': 'Использовать существующую папку…',
  'sidebar.scratchOutcomeUnknownTitle': 'Проверить создание рабочей области',
  'sidebar.scratchOutcomeUnknown':
    'Ответ демона был прерван. Проверьте обновленный список рабочих областей перед созданием новой.',
  'sidebar.scratchOutcomeRefresh': 'Обновить список рабочих областей',
  'sidebar.scratchOutcomeAcknowledge': 'Я проверил список рабочих областей',
  'sidebar.addWorkspaceTitle': 'Добавление рабочей области',
  'sidebar.addWorkspacePath': 'Путь к директории',
  'sidebar.addWorkspaceBrowse': 'Обзор…',
  'sidebar.addWorkspaceBrowseError':
    'Не удалось открыть системный выборщик папок. Введите абсолютный путь.',
  'sidebar.addWorkspaceDisplayName': 'Отображаемое имя (необязательно)',
  'sidebar.addWorkspaceDisplayNameHint':
    'Показывается в Web Shell; путь к директории остается идентификатором рабочей области.',
  'sidebar.addWorkspaceRegister': 'Зарегистрировать',
  'sidebar.addWorkspaceCancel': 'Отмена',
  'sidebar.addWorkspaceError': 'Не удалось добавить рабочую область',
  'sidebar.addWorkspaceBusyError': 'Идет другая операция с рабочей областью',
  'sidebar.addWorkspacePersistenceError':
    'Демон не подтвердил постоянную регистрацию рабочей области',
  'sidebar.addWorkspaceRefreshError':
    'Рабочая область добавлена, но список рабочих областей не удалось обновить',
  'sidebar.addWorkspaceAbsError': 'Путь должен быть абсолютным',
  'sidebar.addWorkspaceHint': 'Введите абсолютный путь к директории проекта.',
  'sidebar.addWorkspaceSuggestions': 'Предложения по директориям',
  'sidebar.addWorkspacePersist': 'Сохранять после перезапуска демона',
  'sidebar.addWorkspacePersistHint':
    'Сохраните эту регистрацию рабочей области в конфигурации демона.',
  'sidebar.addWorkspaceAdding': 'Добавление…',
  'sidebar.removeWorkspace': 'Удалить рабочую область',
  'sidebar.workspaceActions': 'Действия рабочей области',
  'sidebar.renameWorkspace': 'Переименовать…',
  'sidebar.renameWorkspaceTitle': 'Переименование рабочей области',
  'sidebar.workspaceNamePrompt': 'Отображаемое имя',
  'sidebar.workspaceNameHint': 'Оставьте пустым, чтобы показать имя папки.',
  'sidebar.workspaceNameInvalid':
    'Имена не могут содержать управляющие символы.',
  'sidebar.renameWorkspaceFailed': 'Не удалось переименовать рабочую область',
  'sidebar.copyWorkspacePath': 'Копировать путь',
  'sidebar.copyWorkspacePathFailed':
    'Не удалось скопировать путь рабочей области',
  'sidebar.openWorkspaceFolder': 'Открыть папку',
  'sidebar.openWorkspaceFolderFailed':
    'Не удалось открыть папку рабочей области',
  'sidebar.openWorkspaceFolderOpened': 'Папка рабочей области открыта',
  'sidebar.openWorkspaceTerminal': 'Открыть терминал',
  'sidebar.openWorkspaceTerminalFailed': 'Не удалось открыть терминал',
  'sidebar.openWorkspaceTerminalOpened': 'Терминал открыт в рабочей области',
  'sidebar.manageWorkspace': 'Управление',
  'sidebar.reloadWorkspace': 'Перезагрузить среду выполнения',
  'sidebar.reloadWorkspaceFailed':
    'Не удалось перезагрузить среду выполнения рабочей области',
  'sidebar.workspaceCount': (v) =>
    interpolateRu('{{HC0}} рабочих областей', [v?.count ?? 0]),
  'sidebar.sessionsRunning': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'запущенная сессия', 'запущенные сессии', 'запущенных сессий')}`,
  'sidebar.sessionsAttention': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'сессия ожидает', 'сессии ожидают', 'сессий ожидают')} вашего внимания`,
  'sidebar.sessionsTotal': (v) =>
    `${v?.count ?? 0}${v?.truncated ? '+' : ''} ${pluralRu(v?.count, 'сессия', 'сессии', 'сессий')}`,
  'sidebar.overview.sessions': 'Сессии',
  'sidebar.overview.mcp': 'MCP',
  'sidebar.overview.skills': 'Навыки',
  'sidebar.overview.extensions': 'Расширения',
  'sidebar.overview.channels': 'Каналы',
  'sidebar.overview.context': 'Контекст',
  'sidebar.overview.hooks': 'Хуки',
  'sidebar.overview.settings': 'Настройки',
  'sidebar.overview.mcpDetail': (v) =>
    interpolateRu('{{HC0}} из {{HC1}} подключено', [
      v?.connected ?? 0,
      v?.configured ?? 0,
    ]) +
    (Number(v?.failed) > 0
      ? interpolateRu(', {{HC0}} ошибок', [v?.failed])
      : '') +
    (Number(v?.disabled) > 0
      ? interpolateRu(', {{HC0}} отключено', [v?.disabled])
      : ''),
  'sidebar.overview.skillsDetail': (v) =>
    interpolateRu('{{HC0}} из {{HC1}} включено', [
      v?.enabled ?? 0,
      v?.total ?? 0,
    ]),
  'sidebar.overview.extensionsDetail': (v) =>
    interpolateRu('{{HC0}} из {{HC1}} активно', [
      v?.active ?? 0,
      v?.total ?? 0,
    ]),
  'sidebar.overview.channelsDetail': (v) =>
    interpolateRu('{{HC0}} из {{HC1}} подключено', [
      v?.connected ?? 0,
      v?.configured ?? 0,
    ]) +
    (Number(v?.failed) > 0
      ? interpolateRu(', {{HC0}} не удалось', [v?.failed])
      : ''),
  'sidebar.overview.contextDetail': (v) =>
    `${v?.files ?? 0} ${pluralRu(v?.files, 'файл контекста', 'файла контекста', 'файлов контекста')}, ${v?.rules ?? 0} ${pluralRu(v?.rules, 'правило', 'правила', 'правил')}`,
  'sidebar.overview.hooksDetail': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'хук', 'хука', 'хуков')}`,
  'sidebar.overview.hooksDisabled': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'хук отключён', 'хука отключены', 'хуков отключено')}`,
  'sidebar.forceRemoveWorkspace': 'Принудительное удаление',
  'sidebar.removeWorkspaceTitle': 'Удаление рабочей области',
  'sidebar.removeWorkspaceConfirm': (v) =>
    interpolateRu(
      'Удалить среду выполнения и постоянную регистрацию для «{{HC0}}»? Файлы, настройки и история сессий не будут удалены.',
      [v?.name ?? ''],
    ),
  'sidebar.removeWorkspaceBusy': (v) =>
    interpolateRu(
      '«{{HC0}}» всё ещё имеет активные ресурсы среды выполнения. Принудительное удаление завершит их работу.',
      [v?.name ?? ''],
    ),
  'sidebar.removeWorkspaceCurrentSession':
    'Переключитесь на другую рабочую область или закройте текущую сессию перед принудительным удалением.',
  'sidebar.removeWorkspaceInProgress':
    'Другой клиент уже удаляет эту рабочую область. Обновите после завершения этой операции.',
  'sidebar.removeWorkspaceError': 'Не удалось удалить рабочую область',
  'sidebar.removeWorkspaceSessions': (v) =>
    interpolateRu('Сессии: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspacePrompts': (v) =>
    interpolateRu('Активные запросы: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspaceStarts': (v) =>
    interpolateRu('Ожидаемые старты сессий: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspaceConnections': (v) =>
    interpolateRu('Подключения ACP: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspaceMemoryTasks': (v) =>
    interpolateRu('Задачи памяти: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspaceWorkers': (v) =>
    interpolateRu('Рабочие каналы: {{HC0}}', [v?.count ?? 0]),
  'sidebar.removeWorkspaceVoiceSessions': (v) =>
    interpolateRu('Голосовые сессии: {{HC0}}', [v?.count ?? 0]),
  'sidebar.noSessions': 'Нет сессий.',
  'sidebar.projectFallback': 'Проект',
  'sidebar.sessionsOverview': 'Обзор сессий',
  'sidebar.splitView': 'Разделенный вид',
  'sidebar.settings': 'Настройки',
  'sidebar.daemonStatus': 'Статус демона',
  'sidebar.scheduledTasks': 'Запланированные задачи',
  'sidebar.goals': 'Цели',
  'sidebar.themeLight': 'Переключиться на светлую тему',
  'sidebar.themeDark': 'Переключиться на тёмную тему',
  'sidebar.collapse': 'Свернуть',
  'sidebar.expand': 'Развернуть',
  'sidebar.showAllSessions': 'Показать все',
  'sidebar.collapseProject': 'Свернуть проект',
  'sidebar.expandProject': 'Развернуть проект',
  'sidebar.search': 'Поиск сессий',
  'sidebar.searchPlaceholder': 'Поиск сессий',
  'sidebar.rename': 'Переименовать',
  'sidebar.export': 'Экспортировать запись разговора',
  'sidebar.exportFailed': 'Не удалось экспортировать сессию',
  'sidebar.delete': 'Удалить',
  'sidebar.archive': 'Архивировать',
  'sidebar.unarchive': 'Восстановить',
  'sidebar.moreActions': 'Дополнительные действия',
  'sidebar.archiveCurrentDisabled': 'Текущую сессию нельзя архивировать',
  'sidebar.archiveRunningDisabled':
    'Работающую сессию нельзя архивировать; архивация завершит её ход',
  'sidebar.archivedTitle': 'Архивировано',
  'sidebar.recents': 'Недавние',
  'sidebar.noRecents': 'Нет недавних разговоров',
  'sidebar.sessionActions': 'Действия с разговором',
  'sidebar.standaloneLoadFailed': 'Не удалось загрузить недавние разговоры',
  'sidebar.standaloneActionFailed': 'Действие с разговором не удалось',
  'sidebar.standaloneDeleteConfirm':
    'Удалить этот разговор и его приватные файлы?',
  'sidebar.standaloneCleanupPending':
    'Разговор удалён. Очистка приватных файлов завершится автоматически.',
  'sidebar.archivedEmpty': 'Нет архивированных сессий.',
  'sidebar.archiveFailed': 'Не удалось архивировать сессию',
  'sidebar.unarchiveFailed': 'Не удалось восстановить сессию',
  'sidebar.loadingSessions': 'Загрузка сессий...',
  'sidebar.loadFailed':
    'Не удалось загрузить сессии. Нажмите, чтобы повторить.',
  'sidebar.renameFailed': 'Не удалось переименовать сессию',
  'sidebar.deleteFailed': 'Не удалось удалить сессию',
  'sidebar.newSessionFailed': 'Не удалось создать новый чат',
  'sidebar.switchFailed': 'Не удалось переключить сессию',
  'sidebar.currentDeleteDisabled': 'Текущую сессию нельзя удалить',
  'sidebar.deleteConfirmDescription': (v) =>
    interpolateRu('Удалить «{{HC0}}»? Это действие нельзя отменить.', [
      v?.name ?? '',
    ]),
  'sidebar.clients': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'клиент', 'клиента', 'клиентов')}`,
  'sidebar.running': 'Выполняется',
  'sidebar.waitingForApproval': 'Ожидание утверждения',
  'sidebar.waitingForApprovalShort': 'Утверждение',
  'sidebar.sessionPr': (v) =>
    interpolateRu('Pull Request #{{HC0}}', [v?.number ?? '']),
  'sidebar.sessionPrMultiple': (v) =>
    interpolateRu('Запрос на пересборку #{{HC0}} (всего {{HC1}})', [
      v?.number ?? '',
      v?.count ?? 0,
    ]),
  'sidebar.sessionPrStateMerged': 'Объединено',
  'sidebar.sessionPrStateClosed': 'Закрыто',
  'sidebar.sessionIssue': (v) =>
    interpolateRu('Проблема #{{HC0}}', [v?.number ?? '']),
  'sidebar.sessionIssueStateCompleted': 'Завершено',
  'sidebar.sessionIssueStateNotPlanned': 'Не запланировано',
  'sidebar.userInputNeeded': 'Требуется ввод пользователя',
  'sidebar.userInputNeededShort': 'Ввод',
  'sidebar.completedUnread': 'Завершено',
  'sidebar.pin': 'Закрепить',
  'sidebar.unpin': 'Открепить',
  'sidebar.sessionGroup': 'Группа',
  'sidebar.groupFilter': 'Группа сессий',
  'sidebar.groupAll': 'Все',
  'sidebar.groupPinned': 'Закрепленные',
  'sidebar.groupUngrouped': 'Без группировки',
  'sidebar.groupRecent': 'Недавние',
  'sidebar.groupCreate': 'Создать группу',
  'sidebar.groupRename': 'Переименовать группу',
  'sidebar.groupDelete': 'Удалить группу',
  'sidebar.groupColor': 'Цвет группы',
  'sidebar.groupNamePrompt': 'Название группы',
  'sidebar.groupDeleteConfirm': (v) =>
    interpolateRu('Удалить группу «{{HC0}}»?', [v?.name ?? '']),
  'sidebar.groupsLoadFailed': 'Не удалось загрузить группы сессий',
  'sidebar.groupCreateFailed': 'Не удалось создать группу',
  'sidebar.groupAssignFailedAfterCreate':
    'Группа создана, но не удалось переместить в неё сессию',
  'sidebar.groupUpdateFailed': 'Не удалось обновить группу',
  'sidebar.groupDeleteFailed': 'Не удалось удалить группу',
  'sidebar.organizationFailed': 'Не удалось обновить организацию сессии',
  'sidebar.groupColor.red': 'Красный',
  'sidebar.groupColor.orange': 'Оранжевый',
  'sidebar.groupColor.yellow': 'Желтый',
  'sidebar.groupColor.green': 'Зеленый',
  'sidebar.groupColor.blue': 'Синий',
  'sidebar.groupColor.purple': 'Фиолетовый',
  'sidebar.groupColor.custom': 'Пользовательский…',
  'sidebar.groupColor.picker': 'Выберите цвет группы',
  'sidebar.groupColor.hex': 'Цвет в формате HEX',
  'sidebar.groupColor.invalid':
    'Введите шестизначный код цвета, например #416ef5.',
  'quickKeys.cursor': 'Переместить курсор',
  'quickKeys.escape': 'Отмена выполнения',
  'quickKeys.history': 'История',
  'quickKeys.retry': 'Повторить неудачное действие',
  'quickKeys.searchHistory': 'Поиск в истории',
  'quickKeys.tab': 'Принять автодополнение',
  'error.unsupportedTheme':
    'Неподдерживаемая тема. Используйте /theme light или /theme dark.',
  'queue.delete': 'Удалить',
  'queue.edit': 'Редактировать',
  'queue.insert': 'Вставить',
  'queue.cleared': 'Очередь очищена.',
  'queue.deleteTip': 'Удалить из очереди',
  'queue.editTip': 'Удалить из очереди и отредактировать заново',
  'queue.submitting': 'Отправка…',
  'queue.midTurnQueued': 'Добавлено в очередь…',
  'queue.serverQueued': 'Ожидает обработки на сервере…',
  'queue.editing': 'Редактирование…',
  'queue.inserting': 'Вставка…',
  'queue.removing': 'Удаление…',
  'queue.submittingDisabled': 'Отправка сообщения из очереди…',
  'queue.summaryEditDisabled':
    'Это восстановленное резюме очереди не может вернуть свои исходные вложения.',
  'queue.admissionUnknown':
    'Доставка неуверенна. Проверьте сессию перед повторной попыткой.',
  'queue.restoreUnknown': 'Восстановить локальную копию',
  'queue.discardUnknown': 'Отклонить локальную копию',
  'queue.continueEditing': 'Продолжить редактирование',
  'queue.continueEditingConfirm':
    'Запрос может уже выполняться. Продолжить редактирование, только если вы готовы к риску отправки его дважды.',
  'queue.commandBlocked':
    'Слэш-команды нельзя добавлять в очередь во время выполнения хода.',
  'queue.commandGoalBlocked':
    'Слэш-команды недоступны, пока цель владеет сессией или её состояние загружается.',
  'queue.shellQueued':
    'Команда оболочки добавлена в очередь — она выполнится после завершения текущего хода.',
  'queue.shellDropped': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'команда из очереди не будет выполнена', 'команды из очереди не будут выполнены', 'команд из очереди не будут выполнены')}`,
  'queue.queueFailed': 'Не удалось добавить сообщение в очередь',
  'queue.deleteFailed': 'Не удалось переместить сообщение из очереди',
  'queue.editFailed': 'Не удалось отредактировать сообщение в очереди',
  'queue.insertFailed': 'Не удалось вставить сообщение в текущий ход',
  'queue.insertTip': 'Вставить в текущий ход',
  'queue.insertCommandDisabled': 'Команды нельзя добавлять во время хода',
  'queue.footer':
    'Нажмите ↑ для редактирования последнего сообщения в очереди · Esc для очистки очереди',
  'queue.imageCount': (v) =>
    interpolateRu('(+{{HC0}} изображений)', [v?.count ?? 0]),
  'queue.fileCount': (v) => interpolateRu('(+{{HC0}} файлов)', [v?.count ?? 0]),
  'queue.more': (v) => `... (ещё ${v?.count ?? 0})`,
  'help.builtIn': 'Встроенные команды',
  'help.commandCount': (v) => interpolateRu('{{HC0}} команд', [v?.count ?? 0]),
  'help.commandMeta.builtIn': 'встроенные',
  'help.commandMeta.custom': 'пользовательские',
  'help.commandMeta.subcommands': (v) =>
    interpolateRu('{{HC0}} подкоманд', [v?.count ?? 0]),
  'help.commandsIntro': 'Обзор встроенных команд:',
  'help.customGroup': 'Пользовательские, навыки, плагины, MCP',
  'help.customIntro': 'Обзор пользовательских, навыков, плагинов и команд MCP:',
  'help.empty': 'В данный момент команды недоступны.',
  'help.emptyCustom': 'В данный момент пользовательские команды недоступны.',
  'help.footer':
    'Tab/Shift+Tab для переключения вкладок · ↑/↓ или PgUp/PgDn для прокрутки · Esc для закрытия',
  'help.intro':
    'HomeCode понимает ваш код, вносит изменения с вашего разрешения и выполняет команды прямо из терминала.',
  'help.section.shortcuts': 'Сочетания клавиш',
  'help.search': 'Поиск команд',
  'help.shortcut.addContext': 'Добавить файлы или папки как контекст',
  'help.shortcut.altWords': 'Переход по словам',
  'help.shortcut.clear': 'Очистить экран',
  'help.shortcut.commandMenu': 'Открыть меню команд',
  'help.shortcut.completion':
    'Подтвердить автодополнение или переключить вкладки справки',
  'help.shortcut.history':
    'Перебирать историю запросов или прокручивать списки',
  'help.shortcut.searchHistory': 'Поиск в истории запросов',
  'help.shortcut.newline': 'Вставить новую строку',
  'help.shortcut.pasteImages': 'Вставить изображения',
  'help.shortcut.shell': 'Выполнить команды оболочки',
  'help.shortcut.togglePanel': 'Переключить эту панель',
  'help.shortcut.retry': 'Повторить последний запрос',
  'retry.hint': 'Нажмите Ctrl+Y или щёлкните, чтобы повторить',
  'retry.none': 'Нет неудачных запросов для повтора.',
  'system.taskNotification': 'Уведомление о задаче',
  'system.taskCompleted': 'Фоновая задача завершена',
  'system.taskFailed': 'Фоновая задача не удалась',
  'system.taskCancelled': 'Фоновая задача отменена',
  'notification.shell.completed': (v) =>
    interpolateRu('Фоновый оболочка «{{HC0}}» завершена.', [v?.command ?? '']),
  'notification.shell.failed': (v) =>
    interpolateRu('Фоновый shell "{{HC0}}" завершён с ошибкой.', [
      v?.command ?? '',
    ]),
  'notification.shell.cancelled': (v) =>
    interpolateRu('Фоновый shell "{{HC0}}" был отменён.', [v?.command ?? '']),
  'notification.monitor.completed': (v) =>
    interpolateRu('Монитор "{{HC0}}" завершен. ({{HC1}} событий{{HC2}})', [
      v?.description ?? '',
      v?.events ?? 0,
      v?.droppedLines
        ? interpolateRu(
            ', {{HC0}} строк пропущено из-за ограничения скорости',
            [v.droppedLines],
          )
        : '',
    ]),
  'notification.monitor.failed': (v) =>
    interpolateRu(
      'Монитор "{{HC0}}" завершён с ошибкой. ({{HC1}} событий{{HC2}})',
      [
        v?.description ?? '',
        v?.events ?? 0,
        v?.droppedLines
          ? interpolateRu(
              ', {{HC0}} строк пропущено из-за ограничения скорости',
              [v.droppedLines],
            )
          : '',
      ],
    ),
  'notification.monitor.cancelled': (v) =>
    interpolateRu('Монитор "{{HC0}}" был отменён. ({{HC1}} событий{{HC2}})', [
      v?.description ?? '',
      v?.events ?? 0,
      v?.droppedLines
        ? interpolateRu(
            ', {{HC0}} строк пропущено из-за ограничения скорости',
            [v.droppedLines],
          )
        : '',
    ]),
  'notification.agent.completed': (v) =>
    interpolateRu('Фоновый агент "{{HC0}}" завершен.', [v?.description ?? '']),
  'notification.agent.failed': (v) =>
    interpolateRu('Фоновый агент "{{HC0}}" завершён с ошибкой.', [
      v?.description ?? '',
    ]),
  'notification.agent.cancelled': (v) =>
    interpolateRu('Фоновый агент "{{HC0}}" был отменён.', [
      v?.description ?? '',
    ]),
  'branch.failed': 'Не удалось создать ветку сессии.',
  'branch.stale':
    'Этот ответ больше не находится в активном пути истории. Транскрипт обновлен.',
  'branch.staleRefreshFailed':
    'Этот ответ больше не находится в активном пути истории, и транскрипт не удалось обновить. Пожалуйста, повторите попытку.',
  'branch.staleUnsupported':
    'Этот ответ больше не находится в активном пути истории. Ветвление с этой точки не поддерживается текущей сессией.',
  'branch.success': (v) =>
    interpolateRu(
      'Сессия скопирована. Имя новой сессии: "{{HC0}}". Переключено на новую сессию.',
      [v?.name ?? ''],
    ),
  'fork.empty': 'Укажите инструкцию. Использование: /fork <инструкция>',
  'fork.failed': (v) =>
    interpolateRu('Не удалось запустить форк: {{HC0}}', [v?.reason ?? '']),
  'fork.notStarted': 'Фоновый агент не был запущен.',
  'fork.started': (v) =>
    interpolateRu(
      'Запущен фоновый агент: "{{HC0}}". Отслеживайте его в списке задач.',
      [v?.name ?? ''],
    ),
  'command.hidden': 'Эта команда недоступна.',
  'help.shortcut.approvals': 'Переключение режимов подтверждения',
  'help.shortcut.cancel': 'Закрыть диалоги или отменить операцию',
  'bug.failed':
    'Не удалось загрузить информацию о системе для отчета об ошибке.',
  'bug.popupBlocked':
    'Всплывающее окно заблокировано — разрешите всплывающие окна и попробуйте снова.',
  'bug.submitted': 'Отчет об ошибке открыт в новой вкладке.',
  'clear.blocked':
    'Нельзя очистить во время потоковой передачи — сначала отмените (Esc).',
  'error.unknown': 'Неизвестная ошибка',
  'error.modelStreamInterrupted':
    'Поток ответа модели был прерван. Пожалуйста, повторите попытку.',
  'error.loopDetected':
    'Модель застряла при использовании инструментов или достигла предела безопасности, поэтому этот ход был остановлен. Ваша сессия все еще открыта — попробуйте более конкретную инструкцию для продолжения.',
  'shell.command': 'Команда оболочки',
  'help.subcommands': 'подкоманды',
  'help.tab.commands': 'Встроенные команды',
  'help.tab.custom': 'пользовательские-команды',
  'help.tab.general': 'горячие клавиши',
  'help.title': 'Помощь',
  'slash.category.custom': 'Пользовательские команды',
  'slash.category.skill': 'Команды навыков',
  'slash.category.system': 'Системные команды',
  'language.changed': (v) =>
    interpolateRu('Язык интерфейса изменён на {{HC0}}', [v?.language ?? '']),
  'language.current': (v) =>
    interpolateRu('Текущий язык интерфейса: {{HC0}}', [v?.language ?? '']),
  'language.invalid': 'Неверный язык. Доступны: en, zh-CN, ru',
  'language.options': 'Доступные варианты:',
  'language.set': 'Установка языка интерфейса',
  'language.usage': 'Использование: /language ui [en|zh-CN|ru]',
  'localCommand.noSession':
    'Пока нет активной сессии. Отправьте первое сообщение перед использованием этой команды.',
  'localCommand.diffNoWorkspace':
    'Рабочая область пока недоступна для отображения изменений.',
  'localCommand.logNoWorkspace':
    'Рабочая область пока недоступна для отображения истории.',
  'localCommand.prsNoWorkspace':
    "Рабочая область пока недоступна для отображения pull request'ов.",
  'localCommand.prsUnsupported':
    "Этот демон не поддерживает перечисление pull request'ов.",
  'local.agents': 'Управление субагентами',
  'local.bug': 'Отправить отчет об ошибке',
  'local.compress': 'Сжать контекст в сводку',
  'local.compressFast': 'Быстрое сжатие контекста без ИИ',
  'local.config':
    'Получить или установить любое значение настройки по ключу dot-path',
  'local.diff':
    'Показать статистику изменений рабочей области относительно HEAD',
  'local.log': 'Показать историю коммитов для рабочей области',
  'local.prs': "Показать открытые pull request'ы GitHub для рабочей области",
  'local.directory': 'Управление директориями рабочего пространства',
  'local.docs': 'Открыть полную документацию HomeCode',
  'local.doctor': 'Запустить диагностику установки и окружения',
  'local.dream': 'Объединить тематические файлы управляемой автопамяти',
  'local.effort':
    'Установить уровень усилий для размышлений в моделях с возможностями',
  'local.export': 'Экспортировать историю текущей сессии в файл',
  'local.forget': 'Удалить соответствующие записи из управляемой автопамяти',
  'local.hooks': 'Управление хуками HomeCode',
  'local.importConfig': 'Импортировать серверы MCP из конфигураций Claude',
  'local.init': 'Проанализировать проект и создать файл QWEN.md',
  'local.insight': 'Сгенерировать программные инсайты на основе истории чата',
  'local.lsp': 'Показать статус сервера LSP',
  'local.remember': 'Сохранить долговременную память в систему памяти',
  'local.summary': 'Сгенерировать файл сводки проекта',
  'local.workflows':
    'Перечислить запуски рабочих процессов или совместно приостановить/возобновить активный запуск',
  'skilldesc.batch':
    'Выполнение пакетных операций параллельно во многих файлах',
  'skilldesc.computerUse':
    'Управление интерфейсами локальных приложений через Computer Use',
  'skilldesc.coordinate':
    'Координация небольшой команды агентов с чётко ограниченными обязанностями',
  'skilldesc.dataviz':
    'Проектирование руководств для графиков и визуализации данных',
  'skilldesc.extensionCreator':
    'Создание, тестирование и настройка расширений HomeCode',
  'skilldesc.goalDraft':
    'Преобразование размытого намерения в проверяемую цель /goal',
  'skilldesc.loop':
    'Выполнение запроса по расписанию или при самообученных пробуждениях',
  'skilldesc.newApp': 'Рабочий процесс для создания нового приложения с нуля',
  'skilldesc.qcHelper': 'Ответы на вопросы по использованию HomeCode',
  'skilldesc.review':
    'Проверка измененного кода на наличие ошибок, уязвимостей и обеспечение качества',
  'skilldesc.simplify':
    'Очистка последних изменений для повторного использования и простоты',
  'skilldesc.stuck': 'Диагностика зависших или медленных сессий HomeCode',
  'skilldesc.agentReproduceAlign':
    'Согласование перенесенной функции Codex/Claude Code с оригиналом',
  'skilldesc.agentReproduceFeature':
    'Воспроизведение существующей функции Codex/Claude Code',
  'skilldesc.autofix':
    'Проверка и исправление локальных изменений или запуск рабочих процессов Autofix репозитория',
  'skilldesc.bugfix':
    'Исправление ошибки из GitHub issue, метод воспроизведения в первую очередь',
  'skilldesc.codegraph': 'Анализ кодовой базы через граф и векторный индекс',
  'skilldesc.createIssue': 'Составление и отправка GitHub issue на основе идеи',
  'skilldesc.docsAuditAndRefresh':
    'Проверка и обновление документации/ относительно кодовой базы',
  'skilldesc.docsUpdateFromDiff':
    'Обновление официальной документации по локальному diff git',
  'skilldesc.e2eTesting': 'Запуск сквозных тестов CLI HomeCode',
  'skilldesc.featDev': 'Сквозной рабочий процесс для нетривиальной функции',
  'skilldesc.memoryLeakDebug':
    'Диагностика утечек памяти CLI через снимки кучи',
  'skilldesc.preparePr': 'Подготовка заголовка и описания GitHub PR из ветки',
  'skilldesc.qwenCodeClaw': 'Использование HomeCode как агента понимания кода',
  'skilldesc.structuredDebugging':
    'Методология, основанная на гипотезах, для сложных ошибок',
  'skilldesc.terminalCapture':
    'Автоматизация тестирования скриншотов UI терминала',
  'skilldesc.tmuxRealUserTesting':
    'Тестирование реальными пользователями с tmux и сохранением логов',
  'skilldesc.triage': 'Сортировка и проверка задач HomeCode и PR',
  'local.approvalMode': 'Изменение режима утверждения',
  'local.auth': 'Открыть настройки моделей',
  'auth.title': 'Подключить провайдера',
  'auth.step.group': 'Тип',
  'auth.step.provider': 'Провайдер',
  'auth.step.protocol': 'Протокол',
  'auth.step.baseUrl': 'Основной URL',
  'auth.step.apiKey': 'API-ключ',
  'auth.step.models': 'ID моделей',
  'auth.step.advanced': 'Расширенная конфигурация',
  'auth.protocol.openai': 'Совместимый с OpenAI',
  'auth.protocol.openaiDesc':
    'Стандартный формат API OpenAI (наиболее распространен)',
  'auth.protocol.anthropic': 'Совместимый с Anthropic',
  'auth.protocol.anthropicDesc': 'Формат API сообщений Anthropic',
  'auth.protocol.gemini': 'Совместимый с Gemini',
  'auth.protocol.geminiDesc': 'Формат API Google Gemini',
  'auth.apiKeyRequired': 'API Key не может быть пустым.',
  'auth.baseUrlInvalid':
    'Основной URL должен начинаться с http:// или https://.',
  'auth.baseUrlPrompt': 'Введите конечную точку API для этого протокола.',
  'auth.baseUrlRequired': 'Основной URL не может быть пустым.',
  'auth.documentation': 'Документация',
  'auth.modelsRequired': 'ID моделей не могут быть пустыми.',
  'auth.review': 'Обзор',
  'auth.reviewText': 'Следующий JSON будет сохранен в settings.json:',
  'auth.save': 'Сохранить',
  'auth.saving': 'Сохранение...',
  'auth.termsTitle': 'Условия обслуживания и уведомление о конфиденциальности',
  'auth.continue': 'Продолжить',
  'auth.modelsPrompt': (v) =>
    interpolateRu(
      'Введите ID моделей, разделенные запятыми. Примеры: {{HC0}}',
      [v?.modelIds ?? ''],
    ),
  'auth.advanced.prompt':
    'Опционально: настройте расширенные параметры генерации.',
  'auth.advanced.thinking': 'Включить размышления',
  'auth.advanced.thinkingDesc':
    'Разрешает модели выполнять расширенное рассуждение перед ответом.',
  'auth.advanced.modality': 'Включить модальность',
  'auth.advanced.modalityDesc':
    'Включает возможности многомодального ввода (изображения, видео и т. д.).',
  'auth.advanced.modalityImage': 'Изображение',
  'auth.advanced.modalityVideo': 'Видео',
  'auth.advanced.modalityAudio': 'Аудио',
  'auth.advanced.modalityPdf': 'PDF',
  'auth.advanced.contextWindow': 'Контекстное окно',
  'auth.advanced.contextDesc':
    'Максимальное количество токенов входных данных (оставьте пустым для автоматического определения по имени модели).',
  'auth.advanced.contextPlaceholder': 'Окно контекста (необязательно)',
  'local.btw':
    'Задайте быстрый дополнительный вопрос, не влияющий на основное обсуждение. Использование: /btw <ваш вопрос>',
  'btw.empty': 'Пожалуйста, укажите вопрос. Использование: /btw <ваш вопрос>',
  'btw.side.empty':
    'Пожалуйста, укажите вопрос. Использование: /btw side <ваш вопрос>',
  'btw.emptyAnswer': 'Ответ не получен.',
  'btw.failed': 'Не удалось ответить на дополнительный вопрос',
  'btw.answering': '+ Ответ формируется...',
  'btw.shortcuts.pending': 'Нажмите Escape, Ctrl+C или Ctrl+D для отмены',
  'btw.shortcuts.done': 'Нажмите Space, Enter или Escape для закрытия',
  'local.clear':
    'Начните новую сессию с пустым контекстом; предыдущая сессия останется на диске (можно возобновить с помощью /resume)',
  'local.context':
    'Показать разбивку использования окна контекста. Используйте "/context detail" для детализации по элементам.',
  'local.copy': 'Скопируйте последний вывод или фрагмент',
  'local.delete': 'Удалите сессию навсегда',
  'local.release': 'Завершить активную сессию',
  'local.rewind': 'Отмотать текущий разговор назад',
  'local.branch': 'Создать ветку текущего разговора в новой сессии',
  'local.fork': 'Запустить фоновый агент из этого разговора',
  'local.help': 'Показать справку и команды',
  'local.language': 'Изменить язык интерфейса',
  'local.mcp': 'Управление MCP-серверами',
  'local.memory': 'Управлять памятью',
  'local.model': 'Переключить модель или установить быструю модель',
  'local.new': 'Начать новый разговор',
  'local.plan': 'Войти в режим планирования',
  'local.goal': 'Установить цель и продолжать работу до её достижения',
  'local.recap': 'Сгенерировать краткое содержание сессии',
  'recap.label': 'Краткое содержание',
  'recap.loading': 'Генерация краткого содержания...',
  'recap.empty':
    'Контекста разговора для краткого содержания пока недостаточно.',
  'recap.failed': 'Не удалось сгенерировать краткое содержание',
  'rewind.action': 'Отмотать назад',
  'rewind.confirm': 'Подтвердить отмотку',
  'rewind.empty': 'Для этой сессии нет доступных снимков для отмотки.',
  'rewind.failed': (v) =>
    interpolateRu('Не удалось отмотать сессию: {{HC0}}', [v?.reason ?? '']),
  'rewind.loading': 'Загрузка снимков отмотки...',
  'rewind.promptFallback': (v) =>
    interpolateRu('Запрос {{HC0}}', [v?.id ?? '']),
  'rewind.rewinding': 'Отматывание...',
  'rewind.subtitle': 'Отматывается только разговор. Файлы не изменяются.',
  'rewind.title': 'Перемотка разговора',
  'rewind.turn': (v) => interpolateRu('Поворот {{HC0}}', [v?.turn ?? 0]),
  'local.rename': 'Переименовать текущую сессию',
  'rename.empty':
    'Пожалуйста, введите имя сессии, например /rename project debugging, или используйте /rename --auto.',
  'rename.success': (v) =>
    interpolateRu('Сессия переименована в {{HC0}}', [v?.name ?? '']),
  'local.reset': 'Сбросить текущий разговор',
  'local.resume': 'Продолжить предыдущую сессию',
  'local.skills': 'Просмотр доступных навыков',
  'local.stats': 'Показать статистику сессии',
  'local.tasks': 'Просмотр фоновых задач',
  'local.status': 'Показать информацию о версии',
  'local.theme': 'Изменить тему',
  'local.settings': 'Просмотр и редактирование настроек',
  'local.schedule': 'Управлять запланированными задачами',
  'local.extensions':
    'Управление расширениями. Использование: /extensions manage|install <source>',
  'extensions.label': 'расширение',
  'extensions.action.failed': (v) =>
    interpolateRu('Действие расширения не выполнено{{HC0}}: {{HC1}}', [
      v?.name
        ? interpolateRu(' для "{{HC0}}"', [v.name])
        : v?.source
          ? interpolateRu(' из "{{HC0}}"', [v.source])
          : '',
      v?.error ?? 'Неизвестная ошибка',
    ]),
  'extensions.commands.refreshFailed':
    'Не удалось обновить команды расширения.',
  'extensions.install.failed': (v) =>
    interpolateRu('Не удалось установить расширение {{HC0}}: {{HC1}}', [
      v?.source ? interpolateRu(' из «{{HC0}}»', [v.source]) : '',
      v?.error ?? 'Неизвестная ошибка',
    ]),
  'extensions.manage.agents': 'Агенты:',
  'extensions.manage.actions': 'Действия расширения',
  'extensions.manage.add': 'Добавить',
  'extensions.manage.checkingUpdates': 'Проверка обновлений...',
  'extensions.manage.checkUpdates': 'Проверить обновления',
  'extensions.manage.commands': 'Команды:',
  'extensions.manage.contextFiles': 'Контекстные файлы:',
  'extensions.manage.count': (v) =>
    interpolateRu('{{HC0}} расширений установлено', [v?.count ?? 0]),
  'extensions.manage.setting.disabled': 'Отключено',
  'extensions.manage.setting.default': 'По умолчанию',
  'extensions.manage.setting.enabled': 'Включено',
  'extensions.manage.setting.unknown': 'Недоступно',
  'extensions.manage.setting.unavailableDescription':
    'Сервис не вернул настройки расширений для области видимости. Перезапустите qwen serve и попробуйте снова.',
  'extensions.manage.userSetting': 'Глобальная настройка',
  'extensions.manage.userSettingDescription':
    'Применяется к вашим рабочим областям, если она не переопределена настройкой рабочей области.',
  'extensions.manage.workspaceSetting': 'Настройка рабочей области',
  'extensions.manage.workspaceSettingDescription':
    'Применяется только к текущей рабочей области.',
  'extensions.manage.disable': 'Отключить расширение',
  'extensions.manage.disabled': (v) =>
    interpolateRu('Расширение «{{HC0}}» отключено.', [v?.name ?? 'расширение']),
  'extensions.manage.disabling': (v) =>
    interpolateRu('Отключение расширения «{{HC0}}»…', [
      v?.name ?? 'расширение',
    ]),
  'extensions.manage.inherited': (v) =>
    interpolateRu(
      'Расширение «{{HC0}}» теперь использует глобальную настройку.',
      [v?.name ?? 'расширение'],
    ),
  'extensions.manage.inheriting': (v) =>
    interpolateRu('Сброс расширения «{{HC0}}» к глобальной настройке…', [
      v?.name ?? 'расширение',
    ]),
  'extensions.manage.empty': 'Расширения не установлены.',
  'extensions.manage.emptyAgents': 'У этого расширения нет агентов.',
  'extensions.manage.emptyCommands': 'У этого расширения нет команд.',
  'extensions.manage.emptyContextFiles':
    'У этого расширения нет файлов контекста.',
  'extensions.manage.emptyDescription':
    'Установите расширение, чтобы добавить команды, навыки, агенты или серверы MCP.',
  'extensions.manage.emptyMcpServers': 'У этого расширения нет серверов MCP.',
  'extensions.manage.emptySkills': 'У этого расширения нет навыков.',
  'extensions.manage.enable': 'Включить расширение',
  'extensions.manage.enabled': (v) =>
    interpolateRu('Расширение «{{HC0}}» включено.', [v?.name ?? 'расширение']),
  'extensions.manage.enabling': (v) =>
    interpolateRu('Включение расширения «{{HC0}}»…', [v?.name ?? 'расширение']),
  'extensions.manage.install': 'Установить',
  'extensions.manage.installDescription':
    'Введите источник GitHub, Git или npm, либо загрузите архив расширения.',
  'extensions.manage.sourceTab': 'Источник',
  'extensions.manage.archiveTab': 'Архив',
  'extensions.manage.archiveSelect': 'Выберите архив .zip или .tar.gz.',
  'extensions.manage.archiveSelected': (v) =>
    interpolateRu('Выбранный архив: {{HC0}}', [v?.name ?? 'архив расширения']),
  'extensions.manage.archiveTooLarge':
    'Архивы расширений должны быть не больше 10 МБ.',
  'extensions.manage.archiveEmpty': 'Выбранный архив расширения пуст.',
  'extensions.manage.archiveInvalid':
    'Выберите архив расширения .zip или .tar.gz с корректным именем файла до 255 байт.',
  'extensions.manage.installSelectPluginDescription': (v) =>
    interpolateRu('Выберите плагин из «{{HC0}}».', [
      v?.marketplace ?? 'этот маркетплейс',
    ]),
  'extensions.manage.installTitle': 'Добавить расширение',
  'extensions.manage.installType': 'Тип установки:',
  'extensions.manage.mcpServers': 'Серверы MCP:',
  'extensions.manage.marketplaceRoot': 'Корень маркетплейса',
  'extensions.manage.name': 'Имя:',
  'extensions.manage.notUpdatable': 'обновление недоступно',
  'extensions.manage.operationFailed': 'Ошибка операции расширения.',
  'extensions.manage.noDescription': 'Описание отсутствует',
  'extensions.manage.noMatches': 'Расширения не найдены.',
  'extensions.manage.origin': 'Источник:',
  'extensions.manage.overview': 'Обзор',
  'extensions.manage.path': 'Путь:',
  'extensions.manage.queued': (v) =>
    interpolateRu('Действие с расширением для «{{HC0}}» добавлено в очередь.', [
      v?.name ?? 'расширение',
    ]),
  'extensions.manage.refreshFailed': (v) =>
    interpolateRu(
      'Действие с расширением выполнено, но обновление сессии не удалось{{HC0}}',
      [v?.error ? interpolateRu(': {{HC0}}', [v.error]) : '.'],
    ),
  'extensions.manage.restartRequired': 'обновлено; требуется перезапуск',
  'extensions.manage.search': 'Поиск расширений…',
  'extensions.manage.selectExtension': 'Выберите расширение',
  'extensions.manage.settings': 'Настройки:',
  'extensions.manage.skills': 'Навыки:',
  'extensions.manage.source': 'Источник:',
  'extensions.manage.sourcePlaceholder': 'https://github.com/owner/repository',
  'extensions.manage.status': 'Статус:',
  'extensions.manage.status.disabled': 'отключен',
  'extensions.manage.status.enabled': 'включен',
  'extensions.manage.title': 'Управление расширениями',
  'extensions.manage.unknownUpdate': 'неизвестно',
  'extensions.manage.uninstalled': (v) =>
    interpolateRu('Расширение «{{HC0}}» удалено.', [v?.name ?? 'расширение']),
  'extensions.manage.uninstalling': (v) =>
    interpolateRu('Удаление расширения «{{HC0}}»…', [v?.name ?? 'расширение']),
  'extensions.manage.uninstallAction': 'Удалить расширение',
  'extensions.manage.uninstallConfirm': (v) =>
    interpolateRu('Удалить расширение «{{HC0}}»?', [v?.name ?? 'расширение']),
  'extensions.manage.upToDate': 'актуально',
  'extensions.manage.update': 'Обновить расширение',
  'extensions.manage.updateAvailable': 'доступно обновление',
  'extensions.manage.updateError': 'проверка обновлений не удалась',
  'extensions.manage.updateComplete': 'обновлено',
  'extensions.manage.updatedWithWarnings': 'обновлено с предупреждениями',
  'extensions.manage.updateStatus': 'Статус обновления:',
  'extensions.manage.updating': 'обновление…',
  'extensions.manage.updatingExtension': (v) =>
    interpolateRu('Обновление расширения «{{HC0}}»…', [
      v?.name ?? 'расширение',
    ]),
  'extensions.manage.updated': (v) =>
    interpolateRu('Расширение «{{HC0}}» обновлено.', [v?.name ?? 'расширение']),
  'extensions.manage.updatedWithVersion': (v) =>
    interpolateRu('Расширение «{{HC0}}» обновлено до версии v{{HC1}}.', [
      v?.name ?? 'расширение',
      v?.version ?? '',
    ]),
  'extensions.manage.version': 'Версия:',
  'extensions.manage.viewDetails': 'Просмотреть сведения',
  'extensions.install.installed': (v) =>
    interpolateRu('Расширение «{{HC0}}» установлено.', [
      v?.name ?? 'расширение',
    ]),
  'extensions.install.installedWithVersion': (v) =>
    interpolateRu('Установлено расширение «{{HC0}}» версии v{{HC1}}.', [
      v?.name ?? 'расширение',
      v?.version ?? '',
    ]),
  'extensions.install.missingOptionValue': (v) =>
    interpolateRu('Отсутствует значение для {{HC0}}', [
      v?.option ?? 'параметр',
    ]),
  'extensions.install.requestFailed': 'Не удалось установить расширение',
  'extensions.install.started': (v) =>
    interpolateRu('Установка расширения из «{{HC0}}»…', [v?.source ?? '']),
  'extensions.install.unknownOption': (v) =>
    interpolateRu('Неизвестный параметр {{HC0}}', [v?.option ?? '']),
  'extensions.install.usage':
    'Использование: /extensions manage|install <источник>',
  'extensions.install.waitForSession':
    'Дождитесь подключения сессии перед установкой расширения.',
  'local.tools': 'Список доступных инструментов. Использование: /tools [desc]',
  'loadWarning.commands':
    'Не удалось загрузить список команд; слэш-команды могут быть неполными.',
  'loadWarning.context':
    'Не удалось загрузить контекст сессии; текущий режим может быть неточным.',
  'loadWarning.models':
    'Не удалось загрузить список моделей; некоторые детали моделей могут быть недоступны.',
  'mcp.action.auth': 'Аутентификация',
  'mcp.action.authHint': 'Пока не экспонируется демоном',
  'mcp.action.authMessage':
    'Демон serve пока не экспонирует аутентификацию MCP.',
  'mcp.action.clearAuth': 'Очистить аутентификацию',
  'mcp.action.disable': 'Отключить',
  'mcp.action.done': (v) =>
    interpolateRu('{{HC0}} завершено.', [v?.action ?? 'Действие']),
  'mcp.action.enable': 'Включить',
  'mcp.action.enableMessage':
    'Демон serve пока не экспонирует включение/выключение MCP.',
  'mcp.action.failed': (v) =>
    interpolateRu('Ошибка: {{HC0}}', [v?.error ?? '']),
  'mcp.action.running': (v) =>
    interpolateRu('{{HC0}}...', [v?.action ?? 'Действие']),
  'mcp.action.reauth': 'Повторная аутентификация',
  'mcp.action.approve': 'Одобрить',
  'mcp.actions': 'Действия сервера',
  'mcp.annotation.destructive': 'деструктивный',
  'mcp.annotation.idempotent': 'идемпотентный',
  'mcp.annotation.openWorld': 'открытый мир',
  'mcp.annotation.readOnly': 'только чтение',
  'mcp.annotations': 'Аннотации',
  'mcp.oauth.server': 'Сервер',
  'mcp.oauth.starting': (v) =>
    interpolateRu("Запуск аутентификации OAuth для сервера MCP '{{HC0}}'...", [
      v?.name ?? '',
    ]),
  'mcp.oauth.title': 'OAuth-аутентификация',
  'mcp.oauth.timeout':
    'Время аутентификации истекло. Обновите, чтобы проверить статус.',
  'mcp.oauth.authenticationFailed': 'Аутентификация не удалась.',
  'mcp.oauth.statusFailed': 'Не удалось проверить статус аутентификации.',
  'mcp.oauth.serverRemoved': 'Сервер MCP был удалён во время аутентификации.',
  'mcp.clientBudget': (v) =>
    interpolateRu('{{HC0}}/{{HC1}} клиентов · {{HC2}}', [
      v?.count ?? 0,
      v?.budget ?? 0,
      v?.mode ?? 'выкл',
    ]),
  'mcp.command': 'Команда',
  'mcp.description': 'Описание:',
  'mcp.descriptionTitle': 'Описание',
  'mcp.basicInfo': 'Основная информация',
  'mcp.action.reconnect': 'Переподключить',
  'mcp.action.edit': 'Редактировать',
  'mcp.reconnect.skipped': (v) =>
    interpolateRu('Переподключение не завершено: {{HC0}}.', [
      v?.reason ?? 'неизвестная причина',
    ]),
  'mcp.reconnect.authenticationRequired':
    'Требуется аутентификация перед повторным подключением.',
  'mcp.action.restart': 'Перезапустить',
  'mcp.action.tools': 'Просмотреть инструменты',
  'mcp.action.toolsHint': 'Введите для проверки',
  'mcp.empty': 'Серверы MCP не настроены.',
  'mcp.emptyDescription': 'Добавьте сервер MCP, чтобы управлять им здесь.',
  'mcp.emptyTools': 'Инструменты не обнаружены.',
  'mcp.expand': 'Развернуть сервер MCP',
  'mcp.collapse': 'Свернуть сервер MCP',
  'mcp.inputSchema': 'Входная схема',
  'mcp.loadingStatus': 'Загрузка статуса MCP...',
  'mcp.loadingTools': 'Загрузка инструментов...',
  'mcp.name': 'Имя',
  'mcp.noDescription': 'Описание отсутствует',
  'mcp.tool.find_declaration.title': 'Найти объявление',
  'mcp.tool.find_declaration.description': 'Находит объявление символа.',
  'mcp.tool.find_implementations.title': 'Найти реализации',
  'mcp.tool.find_implementations.description':
    'Находит реализации указанного символа.',
  'mcp.tool.find_referencing_symbols.title': 'Найти ссылки на символ',
  'mcp.tool.find_referencing_symbols.description':
    'Находит символы и участки кода, которые ссылаются на указанный символ.',
  'mcp.tool.find_symbol.title': 'Найти символ',
  'mcp.tool.find_symbol.description':
    'Ищет классы, методы и другие сущности по пути имени.',
  'mcp.tool.get_diagnostics_for_file.title': 'Проверить файл',
  'mcp.tool.get_diagnostics_for_file.description':
    'Возвращает диагностические сообщения для файла, сгруппированные по символам.',
  'mcp.tool.get_symbols_overview.title': 'Обзор символов файла',
  'mcp.tool.get_symbols_overview.description':
    'Показывает классы, функции, методы и другие символы в файле.',
  'mcp.tool.initial_instructions.title': 'Открыть руководство Serena',
  'mcp.tool.initial_instructions.description':
    'Возвращает основные инструкции по работе с инструментами Serena.',
  'mcp.tool.insert_after_symbol.title': 'Вставить после символа',
  'mcp.tool.insert_after_symbol.description':
    'Вставляет код после определения выбранного класса, метода или функции.',
  'mcp.tool.insert_before_symbol.title': 'Вставить перед символом',
  'mcp.tool.insert_before_symbol.description':
    'Вставляет код перед определением выбранного класса, метода или функции.',
  'mcp.tool.rename_symbol.title': 'Переименовать символ',
  'mcp.tool.rename_symbol.description':
    'Переименовывает символ и обновляет его ссылки в проекте.',
  'mcp.tool.replace_symbol_body.title': 'Заменить тело символа',
  'mcp.tool.replace_symbol_body.description':
    'Заменяет тело выбранного класса, метода или функции.',
  'mcp.tool.safe_delete_symbol.title': 'Безопасно удалить символ',
  'mcp.tool.safe_delete_symbol.description':
    'Удаляет символ, если на него нет ссылок; иначе возвращает найденные ссылки.',
  'mcp.noMatches': 'Серверов MCP не найдено.',
  'mcp.add.button': 'Добавить',
  'mcp.add.adding': 'Добавление сервера MCP…',
  'mcp.add.title': 'Добавить сервер MCP',
  'mcp.add.description':
    'Сохраните сервер MCP в этой рабочей области с именем и конфигурацией.',
  'mcp.add.name': 'Имя',
  'mcp.add.serverDescription': 'Описание',
  'mcp.add.serverDescriptionPlaceholder': 'Опишите этот сервер MCP',
  'mcp.add.scope': 'Расположение',
  'mcp.add.scope.global': 'Глобальный',
  'mcp.add.nameRequired': 'Введите имя сервера MCP.',
  'mcp.add.config': 'Конфигурация (JSON)',
  'mcp.add.configInvalid': 'Конфигурация должна быть объектом JSON.',
  'mcp.add.done': (v) =>
    interpolateRu('Добавлено {{HC0}}.', [v?.name ?? 'Сервер MCP']),
  'mcp.edit.title': 'Редактирование сервера MCP',
  'mcp.edit.description':
    'Обновите описание или конфигурацию. Имя и расположение изменить нельзя.',
  'mcp.edit.save': 'Сохранить изменения',
  'mcp.edit.saving': 'Сохранение изменений…',
  'mcp.edit.done': (v) =>
    interpolateRu('Обновлено {{HC0}}.', [v?.name ?? 'Сервер MCP']),
  'mcp.edit.notFound': 'Сервер MCP больше не присутствует в настройках.',
  'mcp.runtime.notUpdated':
    'Конфигурация сохранена, но текущая сессия не обновлена.',
  'mcp.runtime.removeNotUpdated':
    'Конфигурация удалена, но текущая сессия не обновлена.',
  'mcp.discovery.empty': 'Серверы MCP не настроены.',
  'mcp.discovery.timeout':
    'Обнаружение MCP занимает больше времени, чем ожидается. Обновите страницу для повторной проверки.',
  'mcp.add.settingsUnavailable': 'Настройки рабочей области недоступны.',
  'mcp.action.remove': 'Удалить',
  'mcp.remove.title': 'Удаление сервера MCP',
  'mcp.remove.description': (v) =>
    interpolateRu('Удалить сервер MCP «{{HC0}}» из этой рабочей области?', [
      v?.name ?? '',
    ]),
  'mcp.remove.description.global': (v) =>
    interpolateRu('Удалить сервер MCP «{{HC0}}» из глобальных настроек?', [
      v?.name ?? '',
    ]),
  'mcp.remove.done': (v) =>
    interpolateRu('Удалено {{HC0}}.', [v?.name ?? 'Сервер MCP']),
  'mcp.remove.notWorkspace':
    'Этот сервер MCP не определен в настройках рабочей области.',
  'mcp.source.all': 'Все',
  'mcp.noSchema': 'Отсутствует схема ввода.',
  'mcp.oauth.open': 'Открыть страницу аутентификации',
  'mcp.serverTool': 'Инструмент сервера',
  'mcp.servers': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'сервер', 'сервера', 'серверов')}`,
  'mcp.configuredServers': 'Настроенные MCP-серверы:',
  'mcp.fromExtension': (v) => interpolateRu('(из {{HC0}})', [v?.name ?? '']),
  'mcp.extensionMcp': 'Расширение MCP',
  'mcp.invalidReason': (v) =>
    interpolateRu('неверно: {{HC0}}', [v?.reason ?? '']),
  'mcp.invalidReasonLabel': 'Причина:',
  'mcp.invalidToolHelp':
    'Инструменты должны иметь как имя, так и описание, чтобы использоваться LLM.',
  'mcp.invalidToolWarning':
    'Предупреждение: Этот инструмент не может быть вызван LLM',
  'mcp.manageServers': 'Управление MCP-серверами',
  'mcp.viewDetails': 'Подробнее',
  'mcp.parameters': 'Параметры:',
  'mcp.required': 'обязательно',
  'mcp.resources': 'Ресурсы',
  'mcp.resourcesUnavailable': 'Детали ресурсов недоступны.',
  'mcp.noResources': 'Нет ресурсов.',
  'mcp.resourceCount': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'ресурс', 'ресурса', 'ресурсов')}`,
  'mcp.promptCount': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'запрос', 'запроса', 'запросов')}`,
  'mcp.resource.uriLabel': 'URI:',
  'mcp.resource.nameLabel': 'Имя:',
  'mcp.resource.mimeTypeLabel': 'Тип MIME:',
  'mcp.resource.sizeLabel': 'Размер:',
  'mcp.resource.bytes': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'байт', 'байта', 'байт')}`,
  'mcp.scrollPosition': (v) =>
    interpolateRu('{{HC0}}/{{HC1}}', [v?.current ?? 0, v?.total ?? 0]),
  'mcp.shortcut.back': 'Esc для возврата',
  'mcp.shortcut.close': 'Esc для закрытия',
  'mcp.shortcut.selectBack': '↑↓ для навигации · Enter — выбрать · Esc — назад',
  'mcp.shortcut.selectClose':
    '↑↓ для навигации · Enter — выбрать · Esc — закрыть',
  'mcp.settings': 'Настройки',
  'mcp.extension': (v) => interpolateRu('Расширение: {{HC0}}', [v?.name ?? '']),
  'mcp.starting': (v) =>
    interpolateRu('⏳ Серверы MCP запускаются (инициализация {{HC0}})...', [
      v?.count ?? 0,
    ]),
  'mcp.startingNote':
    'Примечание: Первый запуск может занять больше времени. Доступность инструментов обновится автоматически.',
  'mcp.restartSkipped': (v) =>
    interpolateRu('Пропущено {{HC0}}: {{HC1}}', [
      v?.name ?? '',
      v?.reason ?? '',
    ]),
  'mcp.restarted': (v) =>
    interpolateRu('Перезагружен {{HC0}} за {{HC1}} мс', [
      v?.name ?? '',
      v?.duration ?? 0,
    ]),
  'mcp.restartEntries': (v) =>
    interpolateRu(
      'Перезагружено записей {{HC0}}/{{HC1}} {{HC2}} инструмента{{HC3}}',
      [
        v?.restarted ?? 0,
        v?.total ?? 0,
        v?.name ?? '',
        v?.failedReasons
          ? interpolateRu(' (ошибка: {{HC0}})', [v.failedReasons])
          : '',
      ],
    ),
  'mcp.source': 'Источник',
  'mcp.source.extension': 'Расширение',
  'mcp.source.project': 'Проектный MCP (.mcp.json)',
  'mcp.source.workspace': 'Настройки рабочего пространства',
  'mcp.source.user': 'Глобальные настройки',
  'mcp.status': 'Статус',
  'mcp.status.blocked': 'Заблокировано',
  'mcp.status.authenticating': 'Аутентификация...',
  'mcp.status.authenticationFailed': 'Ошибка аутентификации',
  'mcp.status.needsAuthentication': 'Требуется аутентификация',
  'mcp.status.needsApproval': 'Требуется одобрение',
  'mcp.status.rejected': 'Отклонено',
  'mcp.status.connected': 'подключен',
  'mcp.status.connecting': 'подключение',
  'mcp.status.disconnected': 'отключен',
  'mcp.status.disconnectedTitle': 'Отключен',
  'mcp.status.disabled': 'отключен',
  'mcp.status.ready': 'Готов',
  'mcp.status.starting':
    'Запуск... (первый запуск может занять больше времени)',
  'mcp.status.unknown': 'неизвестно',
  'mcp.tipDesc': 'для показа описаний сервера и инструментов',
  'mcp.tipNodesc': 'для скрытия описаний',
  'mcp.tipSchema': 'для показа схем параметров инструментов',
  'mcp.tips': '💡 Советы:',
  'mcp.toolCount': (v) => interpolateRu('{{HC0}} инструмент', [v?.count ?? 0]),
  'mcp.toolsCount': (v) =>
    interpolateRu('{{HC0}} инструментов', [v?.count ?? 0]),
  'mcp.toolsLabel': 'Инструменты:',
  'mcp.title': 'Серверы MCP',
  'mcp.toolDetail': 'Детали инструмента',
  'mcp.tools': 'Инструменты',
  'mcp.toolsForServer': (v) =>
    interpolateRu('Инструменты для {{HC0}}', [v?.name ?? 'Сервер']),
  'mcp.transport': 'Протокол передачи данных',
  'mcp.use': 'Используйте',
  'mcp.userMcp': 'Глобальный MCP',
  'mcp.workingDirectory': 'Рабочая директория',
  'goal.aborted': 'Цель отменена',
  'goal.paused': 'Цель приостановлена',
  'goal.achieved': 'Цель достигнута',
  'goal.check': 'Проверка цели',
  'goal.cleared': 'Цель выполнена',
  'goal.failed': 'Цель не достигнута',
  'goal.judge': 'Судья',
  'goal.label': 'Цель',
  'goal.lastCheck': 'Последняя проверка',
  'goal.notYetMet': 'ещё не выполнено',
  'goal.set': 'Установлена цель',
  'goal.statusActive': '/goal активен',
  'goal.status.active': 'В процессе',
  'goal.status.paused': 'Приостановлено',
  'goal.status.blocked': 'Заблокировано',
  'goal.status.usage_limited': 'Лимит использования исчерпан',
  'goal.status.complete': 'Завершено',
  'goal.activity.idle': 'Ожидание',
  'goal.activity.running': 'Работа над задачей',
  'goal.activity.verifying': 'Проверка',
  'goal.edit': 'Редактировать цель',
  'goal.pause': 'Пауза цели',
  'goal.resume': 'Продолжить цель',
  'goal.turn': (v) => interpolateRu('{{HC0}} ход', [v?.count ?? 0]),
  'goal.turnLabel': (v) => interpolateRu('ход {{HC0}}', [v?.count ?? 0]),
  'goal.turns': (v) => interpolateRu('{{HC0}} ходов', [v?.count ?? 0]),
  'goals.title': 'Цели',
  'goals.subtitle':
    'Цель поддерживает работу сессии до выполнения условия. Здесь отображаются только загруженные сессии — цель продвигается только во время работы её сессии.',
  'goals.loading': 'Загрузка целей…',
  'goals.count': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'активная цель', 'активные цели', 'активных целей')}`,
  'goals.empty':
    'Нет активных целей. Установите одну командой /goal <условие>.',
  'goals.refresh': 'Обновить',
  'goals.new': 'Новая цель',
  'goals.newHint':
    'Цель запускается в новой сессии и работает до выполнения условия.',
  'goals.condition': 'Условие',
  'goals.conditionPlaceholder':
    'Например: `npm test` завершается с кодом 0, а `npm run lint` не выводит предупреждений (вставьте вывод); не изменяйте файлы тестов; остановитесь после блокировки через 20 ходов',
  'goals.cancel': 'Отмена',
  'goals.create': 'Установить цель',
  'goals.creating': 'Запуск…',
  'goals.saving': 'Сохранение…',
  'goals.save': 'Сохранить',
  'goals.edit': 'Редактировать цель',
  'goals.objective': 'Цель',
  'goals.clear': 'Очистить цель',
  'goals.clearConfirm': (v) =>
    interpolateRu('Очистить цель "{{HC0}}"?', [v?.condition ?? '']),
  'goals.running': 'Работа над целью',
  'goals.idle': 'В ожидании',
  'goals.dropped': (v) =>
    `Не удалось связаться с ${v?.count ?? 0} ${pluralRu(v?.count, 'сессией', 'сессиями', 'сессиями')} — выполняемые в них цели отсутствуют в этом списке.`,
  'goals.notYetEvaluated': 'Ещё не оценена',
  'goals.openSessionHint': 'Открыть сессию для этой цели',
  'goals.error.emptyCondition': 'Укажите условие для цели.',
  'goals.error.clearKeyword': (v) =>
    interpolateRu(
      '"{{HC0}}" очищает цель, а не устанавливает её. Опишите условие для достижения.',
      [v?.word ?? ''],
    ),
  'goals.error.createFailed': 'Не удалось запустить цель',
  'goals.error.saveFailed': 'Не удалось сохранить цель',
  'goals.error.goalUnavailable': 'Цель больше недоступна.',
  'goals.error.requiresObjective': (v) =>
    interpolateRu('/goal {{HC0}} требует цели.', [v?.keyword ?? 'установлено']),
  'goals.error.invalidCommand': 'Команда /goal некорректна',
  'goals.error.goalsUnavailable':
    'Просмотр целей недоступен на этой поверхности.',
  'goals.error.attachmentsUnsupported':
    'Удалите вложения перед использованием команды /goal.',
  'goals.error.editFailed': 'Не удалось отредактировать цель',
  'goals.error.pauseFailed': 'Не удалось приостановить цель',
  'goals.error.resumeFailed': 'Не удалось возобновить цель',
  'goals.error.clearFailed': 'Не удалось очистить цель',
  'goals.error.controlBusy':
    'Другой контроллер цели всё ещё работает. Попробуйте снова после его завершения.',
  'memory.add': 'Добавить',
  'memory.add.desc': 'Записать долговременную память',
  'memory.autoDream': (v) =>
    interpolateRu('Авто-сон: {{HC0}} · {{HC1}} · /dream для запуска', [
      v?.status ?? 'неизвестно',
      v?.lastDream ?? 'никогда',
    ]),
  'memory.autoDreamUnsupported':
    'Настройки авто-сна пока недоступны из web-shell.',
  'memory.autoFolder': 'Открыть папку автопамяти',
  'memory.autoMemory': (v) =>
    interpolateRu('Авто-память: {{HC0}}', [v?.status ?? 'неизвестно']),
  'memory.autoMemoryUnsupported':
    'Настройки авто-памяти пока недоступны из web-shell.',
  'memory.autoSkill': (v) =>
    interpolateRu('Авто-навык: {{HC0}}', [v?.status ?? 'неизвестно']),
  'memory.autoSkillUnsupported':
    'Настройки авто-навыков пока недоступны из web-shell.',
  'memory.chooseScope': 'Выберите место для сохранения памяти',
  'memory.closed': 'Панель памяти закрыта.',
  'memory.contentEmpty': 'Контент памяти пуст.',
  'memory.file': 'Файл памяти',
  'memory.fileOpen': 'Файл памяти открыт.',
  'memory.fileTruncated': 'Файл памяти открыт. Контент обрезан.',
  'memory.files': 'Файлы памяти',
  'memory.footer': 'Enter для подтверждения · Esc для отмены',
  'memory.footer.back': 'Esc для возврата',
  'memory.global': 'Пользователь',
  'memory.global.desc': 'Сохранено в глобальный файл пользовательской памяти',
  'memory.globalReadUnsupported':
    'Глобальная память находится за пределами рабочей области, поэтому текущий API чтения файлов демона не может открыть её содержимое.',
  'memory.loading': 'Загрузка памяти...',
  'memory.loadingFile': 'Загрузка файла памяти...',
  'memory.lastDream': '5 часов назад',
  'memory.menu': 'Память',
  'memory.never': 'никогда',
  'memory.noFiles': 'Файлы памяти не найдены.',
  'memory.on': 'вкл',
  'memory.openFolderUnsupported':
    'Открытие авто-папки памяти пока недоступно из веб-оболочки.',
  'memory.placeholder': (v) =>
    interpolateRu('Введите содержимое {{HC0}}...', [v?.scope ?? 'память']),
  'memory.project': 'Проект',
  'memory.project.desc': 'Сохранено в файл памяти этой рабочей области',
  'memory.refresh': 'Обновить',
  'memory.refresh.desc': 'Перезагрузить информацию о файле памяти',
  'memory.refreshed': 'Память обновлена.',
  'memory.save': 'Сохранить память',
  'memory.savedIn': (v) =>
    interpolateRu('Сохранено в {{HC0}}', [v?.path ?? '']),
  'memory.saved': (v) =>
    interpolateRu('{{HC0}} сохранено: {{HC1}} байт -> {{HC2}}', [
      v?.scope ?? 'Память',
      v?.bytes ?? 0,
      v?.path ?? '',
    ]),
  'memory.saving': 'Сохранение...',
  'memory.show': 'Показать',
  'memory.show.desc': 'Показать настроенные файлы памяти',
  'memory.status': 'Файлы рабочей и пользовательской памяти',
  'memory.unknown': 'неизвестно',
  'memory.write': 'Запись содержимого памяти',
  'mode.auto': 'Утверждение классификатора',
  'mode.auto.desc':
    'Использует классификатор для утверждения безопасных вызовов инструментов и блокировки или запроса подтверждения рискованных.',
  'mode.auto.notice':
    'Включен режим авто. Классификатор LLM оценивает каждый вызов инструмента, автоматически утверждает безопасные действия и блокирует рискованные. Для выхода: Shift+Tab или /approval-mode по умолчанию.',
  'mode.footer': '(Используйте Enter для выбора, Esc для отмены)',
  'mode.name.plan': 'План',
  'mode.name.default': 'По умолчанию',
  'mode.name.auto-edit': 'Автоправки',
  'mode.name.auto': 'Авто',
  'mode.name.yolo': 'Полный доступ',
  'mode.label.plan': 'План',
  'mode.label.planReview': 'План и обзор',
  'mode.label.default': 'Запросить утверждение',
  'mode.label.auto-edit': 'Авторедактирование',
  'mode.label.auto': 'Утверждение классификатора',
  'mode.label.yolo': 'Полный доступ',
  'mode.listLabel.plan': 'План (plan)',
  'mode.listLabel.planReview': 'План и обзор (plan)',
  'mode.listLabel.default': 'Запрос одобрения (по умолчанию)',
  'mode.listLabel.auto-edit': 'Автоматическая правка (auto-edit)',
  'mode.listLabel.auto': 'Классификация с одобрением (auto)',
  'mode.listLabel.yolo': 'Полный доступ (yolo)',
  'mode.desc.plan': 'Только анализ, без изменения файлов или выполнения команд',
  'mode.desc.planReview':
    'Используйте режим плана и обзора его рабочего процесса, если он доступен',
  'mode.desc.default':
    'Запрашивать перед выполнением команд, редактированием файлов или доступом к внешним ресурсам',
  'mode.desc.auto-edit':
    'Автоматически одобрять правки файлов и запрашивать подтверждение перед выполнением команд или другими чувствительными действиями',
  'mode.desc.auto':
    'Автоматически оценивать риск инструментов, выполнять безопасные действия и подтверждать рискованные',
  'mode.desc.yolo':
    'Автоматически одобрить все вызовы инструментов в доверенных контекстах',
  'mode.select': 'Режим одобрения',
  'mode.autoApproved': ((v) =>
    v?.tool
      ? interpolateRu('Автоматически одобрено: {{HC0}}', [v.tool])
      : 'Вызов инструмента ожидает автоматического одобрения при переключении режима.') as MessageValue,
  'mode.auto-edit': 'Автопринятие правок',
  'mode.auto-edit.desc':
    'Автоматическое одобрение операций чтения/записи файлов',
  'mode.default': 'По умолчанию',
  'mode.default.desc': 'Запрашивать перед каждым вызовом инструмента',
  'mode.plan': 'Режим плана',
  'mode.plan.desc': 'Анализ и планирование без выполнения инструментов',
  'mode.unknown': 'неизвестный режим',
  'mode.yolo': 'Режим YOLO',
  'mode.yolo.desc': 'Автоматическое одобрение всех операций',
  'plan.title': 'План',
  'model.contextWindow': 'Контекстное окно',
  'model.contextWindow.unknown': '(неизвестно)',
  'model.current': (v) =>
    interpolateRu('текущий: {{HC0}}', [v?.model ?? 'неизвестно']),
  'model.modality': 'Модальность',
  'model.modality.text': 'текст',
  'model.modality.textOnly': 'только текст',
  'model.modality.image': 'изображение',
  'model.modality.pdf': 'PDF',
  'model.modality.audio': 'аудио',
  'model.modality.video': 'видео',
  'model.baseUrl': 'Базовый URL',
  'model.apiKey': 'API-ключ',
  'model.default': '(по умолчанию)',
  'model.notSet': '(не задано)',
  'model.footer': '↑↓ для навигации · Enter — выбрать · Esc — закрыть',
  'model.searchHint': 'Нажмите / для поиска',
  'model.fastHint': 'для подсказок и дополнительных задач',
  'model.noMatch': (v) =>
    interpolateRu('Модель, соответствующая "{{HC0}}", не найдена', [
      v?.query ?? '',
    ]),
  'model.unavailable':
    'Модели недоступны; будет использована модель демона по умолчанию.',
  'model.none': 'Нет доступных моделей',
  'model.select': 'Выбрать модель',
  'model.section': 'Модель',
  'reasoning.options': 'Параметры',
  'reasoning.thinking': 'Размышление',
  'reasoning.thinkingOff': 'Отключено размышление',
  'reasoning.effort': 'Глубина рассуждений',
  'reasoning.effort.low': 'Низкий',
  'reasoning.effort.medium': 'Средний',
  'reasoning.effort.high': 'Высокий',
  'reasoning.effort.xhigh': 'Очень высокий',
  'reasoning.effort.max': 'Максимальный',
  'reasoning.updateFailed': 'Не удалось обновить настройки рассуждений',
  'model.setFast': 'Установить быструю модель',
  'model.setVoice': 'Установить голосовую модель',
  'model.setVision': 'Установить визуальную модель',
  'model.switch': 'Переключить модель',
  'model.unknown': 'неизвестно',
  'resume.current': 'текущий',
  'resume.activePrompt': 'активный запрос',
  'resume.filter': 'Фильтр',
  'resume.noMatch': (v) =>
    interpolateRu('Сессия с именем "{{HC0}}" не найдена', [v?.query ?? '']),
  'resume.none': 'Нет сессий для возобновления',
  'resume.pressSearch': 'Нажмите / для поиска',
  'resume.search': 'Поиск',
  'resume.title': 'Возобновление сессии',
  'parallelAgents.title': 'Параллельные агенты',
  'parallelAgents.done': (v) =>
    interpolateRu('{{HC0}}/{{HC1}} завершено', [v?.done ?? 0, v?.total ?? 0]),
  'parallelAgents.failed': (v) =>
    interpolateRu('{{HC0}} завершилось с ошибкой', [v?.count ?? 0]),
  'skills.actions': 'Действия навыка',
  'skills.disable': 'Отключить',
  'skills.disabled': 'Навык отключен.',
  'skills.enable': 'Включить',
  'skills.enabled': 'Навык включен.',
  'skills.install.action': 'Установить',
  'skills.install.description':
    'Установите навык из GitHub, локальной папки или ZIP-архива.',
  'skills.install.error.authentication':
    'Требуется аутентификация для загрузки навыков.',
  'skills.install.error.folderRequired': 'Введите путь к папке.',
  'skills.install.error.githubRequired':
    'Введите URL-адрес файла SKILL.md в GitHub.',
  'skills.install.error.invalidName':
    'Имя навыка отсутствует или содержит недопустимые символы.',
  'skills.install.error.manifestMissing':
    'Пакет должен содержать файл SKILL.md в корне.',
  'skills.install.error.invalidPackage':
    'Навык-пакет недействителен. Проверьте его структуру и содержимое SKILL.md.',
  'skills.install.error.zipTooLarge': 'ZIP-файл не может превышать 6 МБ.',
  'skills.install.error.invalidFolder':
    'Введите корректную локальную папку навыка.',
  'skills.install.error.githubFailed':
    'Не удалось загрузить навык из GitHub. Проверьте URL или аутентификацию и попробуйте снова.',
  'skills.install.error.invalidScope':
    'Выберите рабочую область или глобальное расположение установки.',
  'skills.install.error.invalidSource':
    'Демон не распознает этот источник загрузки. Перезапустите обновленный демон и попробуйте снова.',
  'skills.install.error.notFound': 'Требуемый навык не найден.',
  'skills.install.error.nameRequired': 'Введите имя навыка.',
  'skills.install.error.untrusted':
    'Доверьте эту рабочую область перед загрузкой навыков.',
  'skills.install.failed': 'Не удалось загрузить навык.',
  'skills.install.folder': 'Локальная папка',
  'skills.install.folderPath': 'Путь к папке',
  'skills.install.githubUrl': 'URL SKILL.md',
  'skills.install.name': 'Имя навыка',
  'skills.install.scope': 'Установить в',
  'skills.install.scope.global': 'Глобальный',
  'skills.install.scope.workspace': 'Рабочая область',
  'skills.install.selectZip': 'Выберите архив ZIP.',
  'skills.install.title': 'Загрузка навыка',
  'skills.install.succeeded': (v) =>
    interpolateRu('Навык «{{HC0}}» успешно загружен.', [v?.name ?? '']),
  'skills.install.zipSelected': (v) =>
    interpolateRu('Выбрано: {{HC0}}', [v?.name ?? '']),
  'skills.delete.action': 'Удалить навык',
  'skills.delete.description': (v) =>
    interpolateRu(
      'Удалить навык «{{HC0}}» с диска? Это действие нельзя отменить.',
      [v?.name ?? ''],
    ),
  'skills.delete.failed': 'Не удалось удалить навык.',
  'skills.delete.succeeded': (v) =>
    interpolateRu('Навык «{{HC0}}» успешно удален.', [v?.name ?? '']),
  'skills.delete.title': 'Удалить навык?',
  'skills.empty': 'Навыки недоступны.',
  'skills.count': (v) =>
    [
      interpolateRu('{{HC0}} навыков', [v?.count ?? 0]),
      ...(v?.enabled ? [interpolateRu('{{HC0}} включено', [v.enabled])] : []),
      ...(v?.disabled
        ? [interpolateRu('{{HC0}} выключено', [v.disabled])]
        : []),
    ].join(', '),
  'skills.details': 'Детали навыка',
  'skills.description': 'Описание',
  'skills.instructions': 'Инструкции из SKILL.md',
  'skills.instructions.loading': 'Загрузка SKILL.md…',
  'skills.instructions.empty': 'В этом навыке нет инструкций Markdown.',
  'skills.instructions.error': 'Не удалось загрузить SKILL.md.',
  'skills.extension': 'Расширение',
  'skills.filter.all': 'Все',
  'skills.filter.bundled': 'Встроенные',
  'skills.filter.extension': 'Расширения',
  'skills.filter.label': 'Фильтр навыков по источнику',
  'skills.filter.project': 'Настройки рабочей области',
  'skills.filter.status.all': 'Все',
  'skills.filter.status.disabled': 'Отключено',
  'skills.filter.status.enabled': 'Включено',
  'skills.filter.status.label': 'Фильтр навыков по статусу',
  'skills.filter.user': 'Глобальные настройки',
  'skills.hint': 'Подсказка',
  'skills.invocation': 'Вызов',
  'skills.level': 'Область действия',
  'skills.level.bundled': 'Встроенный',
  'skills.level.extension': 'Расширение',
  'skills.level.project': 'Проект',
  'skills.level.user': 'Глобальный',
  'skills.loading': 'Загрузка навыков...',
  'skills.manualReference': 'Ручное указание',
  'skills.manualReferenceHint':
    'Модель не может автоматически обнаружить этот навык. Укажите его вручную.',
  'skills.model': 'Модель',
  'skills.modelAccess': 'Доступ к модели',
  'skills.modelAccess.disabled': 'Модель не может вызвать',
  'skills.modelAccess.enabled': 'Модель может вызвать',
  'skills.modelInvocable': 'Модель',
  'skills.noDescription': 'Описание отсутствует',
  'skills.noMatches': 'Подходящих навыков не найдено.',
  'skills.notToggleable': 'Этот навык нельзя включить или выключить.',
  'skills.run': 'Ссылка на навык',
  'skills.search': 'Поиск навыков…',
  'skills.settingUpdated': 'Настройка рабочей области обновлена.',
  'skills.settingUpdatedAvailabilityUnchanged':
    'Настройка рабочей области обновлена. Доступность навыков осталась без изменений.',
  'skills.settingUnchanged':
    'У навыка уже есть запрошенная настройка рабочей области; изменения не внесены.',
  'skills.status': 'Статус',
  'skills.status.disabled': 'отключен',
  'skills.status.enabled': 'включен',
  'skills.toggleFailed': 'Не удалось обновить навык.',
  'skills.error.inactiveExtension':
    'Этот навык принадлежит неактивному расширению. Сначала активируйте расширение.',
  'skills.toggleUnsupported':
    'Подключённый демон не поддерживает действия по включению или выключению навыков.',
  'skills.title': 'Навыки',
  'plugins.extensions': 'Расширения',
  'plugins.agents': 'Агенты',
  'plugins.mcp': 'MCP',
  'plugins.sections': 'Разделы плагина',
  'plugins.skills': 'Навыки',
  'plugins.title': 'Плагины',
  'plugins.tools': 'Инструменты',
  'stats.accepted': 'Принято:',
  'stats.agreementRate': 'Общий процент согласия:',
  'stats.api': 'API',
  'stats.apiTime': 'Время API',
  'stats.avgDuration': 'Средняя длительность',
  'stats.avgLatency': 'Средняя задержка',
  'stats.cached': 'Кэшировано',
  'stats.cacheDesc': 'входных токенов получено из кэша, что снизило затраты.',
  'stats.calls': 'Вызовы',
  'stats.codeChanges': 'Изменения кода',
  'stats.decisionSummary': 'Сводка решений пользователя',
  'stats.duration': 'Длительность',
  'stats.errors': 'Ошибки',
  'stats.inputTokens': 'Входных токенов',
  'stats.metric': 'Метрика',
  'stats.modelStats': 'Статистика модели',
  'stats.modelTip':
    'Совет: для полного разбора токенов выполните /stats model.',
  'stats.modelUsage': 'Использование модели',
  'stats.modified': 'Изменено:',
  'stats.noApiCalls': 'В этой сессии не было вызовов API.',
  'stats.noToolCalls': 'В этой сессии не было вызовов инструментов.',
  'stats.outputTokens': 'Выходных токенов',
  'stats.overview': 'Обзор сессии',
  'stats.performance': 'Производительность',
  'stats.prompts': 'Запросы',
  'stats.rejected': 'Отклонено:',
  'stats.reqs': 'Запросов',
  'stats.requests': 'Запросы',
  'stats.savingsHighlight': 'Экономия:',
  'stats.successRate': 'Процент успеха',
  'stats.thoughts': 'Размышления',
  'stats.title': 'Статистика сессии',
  'stats.tokens': 'Токены',
  'stats.toolCalls': 'Вызовы инструментов',
  'stats.toolName': 'Имя инструмента',
  'stats.toolStats': 'Статистика инструментов',
  'stats.toolTime': 'Время инструмента',
  'stats.total': 'Всего',
  'stats.totalReviewed': 'Всего проверено предложений:',
  'tokenUsage.avgLatency': 'Средняя задержка',
  'tokenUsage.cached': 'Кэшированный ввод',
  'tokenUsage.input': 'Ввод',
  'tokenUsage.loadError': 'Не удалось загрузить статистику токенов',
  'tokenUsage.models': 'По модели',
  'tokenUsage.noData': 'В этой сессии ещё не было API-вызовов',
  'tokenUsage.noSubagents': 'В этой сессии ещё не было вызовов субагентов',
  'tokenUsage.noTools': 'В этой сессии ещё не было вызовов инструментов',
  'tokenUsage.open': 'Статистика токенов сессии',
  'tokenUsage.output': 'Итого вывод',
  'tokenUsage.refresh': 'Обновить',
  'tokenUsage.requests': 'Запросы',
  'tokenUsage.retry': 'Повторить',
  'tokenUsage.subagents': 'Субагенты',
  'tokenUsage.thoughts': 'Размышления (включены в итоговый вывод)',
  'tokenUsage.title': 'Расход токенов',
  'tokenUsage.toolRow': (v) =>
    interpolateRu('вызовов {{HC0}} · {{HC1}}% успешно · {{HC2}}', [
      v?.count ?? 0,
      v?.rate ?? 0,
      v?.duration ?? '',
    ]),
  'tokenUsage.tools': 'Инструменты',
  'tokenUsage.updatedAt': (v) =>
    interpolateRu('Обновлено {{HC0}}', [v?.time ?? '']),
  'tokenUsage.unavailable': 'Статистика токенов недоступна для этой сессии',
  'status.contextUsed': (v) =>
    interpolateRu('{{HC0}}% контекста использовано', [v?.pct ?? '0.0']),
  'status.disconnected': 'Отключен',
  'status.modeHint': '(Shift + Tab или клик для переключения)',
  'status.shortcuts': '? — горячие клавиши',
  'stream.cancel': 'Esc для отмены',
  'stream.cancelArmed': 'Нажмите Esc ещё раз, чтобы остановить',
  'stream.tokens': (v) => interpolateRu('{{HC0}} токенов', [v?.count ?? 0]),
  'theme.current': (v) => interpolateRu('текущая: {{HC0}}', [v?.theme ?? '']),
  'theme.auto': 'Авто',
  'theme.dark': 'Тёмная тема',
  'theme.dark.desc': 'Терминальный тёмный стиль',
  'theme.light': 'Светлая тема',
  'theme.light.desc': 'Терминальный светлый стиль',
  'theme.title': 'Тема',
  'todo.allDone': 'Все задачи выполнены',
  'todo.collapse': 'Свернуть список задач',
  'todo.completedAbove': (v) =>
    interpolateRu('✓ завершено {{HC0}}', [v?.count ?? 0]),
  'todo.detail.api': 'API',
  'todo.detail.cached': 'Кэшировано',
  'todo.detail.end': 'Конец',
  'todo.detail.hide': 'Скрыть детали задачи',
  'todo.detail.input': 'Ввод',
  'todo.detail.noResources':
    'Расход токенов и времени не был зафиксирован для этой задачи.',
  'todo.detail.output': 'Вывод',
  'todo.detail.sectionSpent': 'Время выполнения',
  'todo.detail.sectionTime': 'Время',
  'todo.detail.sectionTokens': 'Токены',
  'todo.detail.show': 'Показать детали задачи',
  'todo.detail.start': 'Начало',
  'todo.detail.tool': 'Инструмент',
  'todo.expand': 'Развернуть список задач',
  'todo.more': (v) => interpolateRu('... {{HC0}} ещё', [v?.count ?? 0]),
  'todo.moreAbove': (v) => interpolateRu('... {{HC0}} ранее', [v?.count ?? 0]),
  'todo.showLess': 'Показать меньше',
  'todo.stepProgress': (v) =>
    interpolateRu('Шаг {{HC0}} из {{HC1}}', [v?.current ?? 0, v?.total ?? 0]),
  'todo.stepFraction': (v) =>
    interpolateRu('{{HC0}} из {{HC1}}', [v?.current ?? 0, v?.total ?? 0]),
  'todo.title': 'Текущие задачи',
  'planExecution.dialogTitle': 'План и задачи',
  'planExecution.title': 'Выполнение плана',
  'planExecution.overview': 'Обзор рабочего процесса',
  'planExecution.overallProgress': 'Общий прогресс',
  'planExecution.stepsCompleted': 'Завершённые шаги',
  'planExecution.activeAgents': 'Активные агенты',
  'planExecution.needsAttention': 'Требует внимания',
  'planExecution.stepDetails': 'Детали шага',
  'planExecution.subagents': 'Субагенты',
  'planExecution.noSubagents': 'К субагентам пока не привязан агент.',
  'planExecution.openDetails': 'Открыть детали субагента',
  'planExecution.currentActivity': 'Текущая активность:',
  'planExecution.toolCalls': (v) =>
    interpolateRu('{{HC0}} вызовов инструментов', [v?.count ?? 0]),
  'planExecution.tokens': (v) =>
    interpolateRu('{{HC0}} токенов', [v?.count ?? 0]),
  'planExecution.view': 'Просмотр выполнения плана',
  'planExecution.dependsOn': 'Зависит от:',
  'planExecution.unblocks': 'Разблокирует:',
  'planExecution.unassigned': 'Не назначенные исполнения',
  'planExecution.attention': 'Требует внимания',
  'planExecution.status.running': 'Выполняется',
  'planExecution.status.paused': 'Приостановлено',
  'planExecution.status.completed': 'Завершено',
  'planExecution.status.blocked': 'Заблокировано',
  'planExecution.status.in_progress': 'В процессе',
  'planExecution.status.ready': 'Готов',
  'planExecution.edgesHidden': (v) =>
    interpolateRu(
      'Слишком много зависимостей для отображения ({{HC0}}). Вместо этого каждый шаг указывает свои зависимости.',
      [v?.count ?? 0],
    ),
  'workflow.chatTitle': 'Чат',
  'workflow.title': 'Рабочий процесс',
  'workflow.inspector.summary': 'Прогресс рабочего процесса',
  'workflow.inspector.selectedStep': 'Выбранный шаг',
  'workflow.inspector.allSteps': 'Шаги',
  'workflow.inspector.recentActivity': 'Последняя активность агентов',
  'workflow.inspector.expandGraph': 'Развернуть граф зависимостей',
  'workflow.inspector.graphCanvas': 'Граф зависимостей',
  'workflow.inspector.canvasHint':
    'Выберите узел графа, чтобы просмотреть его зависимости и выполнение агента здесь.',
  'workflow.inspector.activeAgents': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'активный агент', 'активных агента', 'активных агентов')}`,
  'workflow.inspector.attentionCount': (v) =>
    interpolateRu('{{HC0}} требуют внимания', [v?.count ?? 0]),
  'workflow.planReview.title': 'План и обзор',
  'workflow.planReview.question': 'Подтвердите план и начните сотрудничество?',
  'workflow.planReview.confirm': 'Подтвердить и начать',
  'workflow.planReview.continuePlanning': 'Продолжить планирование',
  'workflow.empty.title':
    'В этой сессии пока нет структурированного рабочего процесса',
  'workflow.empty.copy':
    'Вернуться в чат, перейти к «План и обзор» и запросить список задач со стабильными ID и зависимостями.',
  'workflow.empty.action': 'Вернуться в чат и создать план',
  'workflow.tabs.attention': 'Требует внимания',
  'workflow.connection.connected': 'Демон подключен',
  'workflow.connection.reconnecting': 'Переподключение демона',
  'workflow.session.defaultTitle': 'Текущий рабочий процесс сессии',
  'workflow.session.workspace': 'рабочая область',
  'workflow.dependencies.upstream': 'Зависит от',
  'workflow.dependencies.none': 'Нет',
  'workflow.dependencies.unblocks': 'Разблокирует',
  'workflow.dependencies.noDownstream': 'Нет последующих шагов',
  'workflow.activity.empty':
    'Задачи пока не связаны с никакими запусками агентов.',
  'workflow.deliverables.title': 'Доставляемые результаты сессии',
  'workflow.deliverables.none': 'Артефакты еще не опубликованы',
  'workflow.status.running': 'Выполняется',
  'workflow.status.paused': 'Приостановлено',
  'workflow.status.completed': 'Завершено',
  'workflow.status.failed': 'Ошибка',
  'workflow.status.cancelled': 'Отменено',
  'workflow.task.completed': 'Завершено',
  'workflow.task.attention': 'Требует внимания',
  'workflow.task.running': 'Сотрудничество запущено',
  'workflow.task.waitingExecution': 'Ожидание выполнения',
  'planExecution.locateCurrent': 'Найти текущий шаг',
  'status.mode': 'Режим утверждения',
  'chat.scrollToBottom': 'Прокрутить вниз',
  'chatHeader.toggleEnvironment': 'Переключить информацию об окружении',
  'chatHeader.toggleRightPanel': 'Переключить правую панель',
  'environment.title': 'Окружение',
  'environment.changes': 'Изменения',
  'environment.changeCount': (v) =>
    interpolateRu('{{HC0}} изменено', [v?.count ?? 0]),
  'environment.clean': 'Очистка',
  'environment.workspace': 'Рабочая область',
  'environment.branch': 'Ветка',
  'environment.history': 'История коммитов',
  'environment.agents': 'Субагенты',
  'environment.unnamedAgent': (v) =>
    interpolateRu('Агент ({{HC0}})', [v?.index ?? 0]),
  'environment.unavailable': 'Недоступно',
  'userMessage.showMore': 'Показать больше',
  'userMessage.showLess': 'Свернуть',
  'userMessage.sendFailed': 'Ошибка отправки',
  'userMessage.retrySend': 'Повторить отправку сообщения',
  'turn.processed': 'Обработано',
  'turn.processing': 'Обрабатывается',
  'turn.collapse': 'Свернуть шаги',
  'turn.expand': 'Развернуть шаги',
  'turn.cached': 'Кэшировано',
  'turn.executionSteps': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'шаг', 'шага', 'шагов')}`,
  'turn.toolCalls': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'вызов инструмента', 'вызова инструмента', 'вызовов инструментов')}`,
  'turn.thinkingCount': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'мысль', 'мысли', 'мыслей')}`,
  'turn.stopped': 'Вы отменили этот запрос',
  'message.renderError': 'Не удалось отобразить это сообщение.',
  'tasks.title': 'Фоновые задачи',
  'tasks.empty': 'Нет запущенных задач',
  'tasks.refreshStale':
    'Статус задачи может быть устаревшим; переподключение...',
  'tasks.cancelFailed': 'Не удалось отменить задачу',
  'tasks.alreadyStopped': 'Задача уже остановлена',
  'tasks.moreAbove': (v) => interpolateRu('^ {{HC0}} выше', [v?.count ?? 0]),
  'tasks.moreBelow': (v) => interpolateRu('v {{HC0}} ниже', [v?.count ?? 0]),
  'tasks.running': 'Выполняется',
  'tasks.completed': 'Завершено',
  'tasks.failed': 'Ошибка',
  'tasks.cancelled': 'Остановлено',
  'tasks.paused': 'Приостановлено',
  'tasks.kind.shell': 'Оболочка',
  'tasks.kind.monitor': 'Монитор',
  'tasks.action.stop': 'Остановить',
  'tasks.action.abandon': 'Отказаться',
  'tasks.action.confirmStop': 'Подтвердить остановку',
  'tasks.action.confirmAbandon': 'Подтвердить отказ',
  'tasks.action.confirmHint': 'Это завершит блокирующий шаг.',
  'tasks.pill.agent': (v) =>
    interpolateRu('{{HC0}} локальный агент', [v?.count ?? 0]),
  'tasks.pill.agents': (v) =>
    interpolateRu('{{HC0}} локальных агентов', [v?.count ?? 0]),
  'tasks.pill.agentPaused': (v) =>
    interpolateRu('{{HC0}} локальный агент на паузе', [v?.count ?? 0]),
  'tasks.pill.agentsPaused': (v) =>
    interpolateRu('{{HC0}} локальных агентов на паузе', [v?.count ?? 0]),
  'tasks.pill.done': (v) =>
    interpolateRu('задача {{HC0}} завершена', [v?.count ?? 0]),
  'tasks.pill.doneMany': (v) =>
    interpolateRu('{{HC0}} задач завершено', [v?.count ?? 0]),
  'tasks.pill.monitor': (v) =>
    interpolateRu('монитор {{HC0}}', [v?.count ?? 0]),
  'tasks.pill.monitors': (v) =>
    interpolateRu('мониторы {{HC0}}', [v?.count ?? 0]),
  'tasks.pill.shell': (v) => interpolateRu('консоль {{HC0}}', [v?.count ?? 0]),
  'tasks.pill.shells': (v) => interpolateRu('консоли {{HC0}}', [v?.count ?? 0]),
  'tasks.confirmStop':
    'ещё раз, чтобы подтвердить остановку · завершает блокирующий шаг',
  'tasks.shortcut.select': '↑/↓ для выбора',
  'tasks.shortcut.view': 'Enter для просмотра',
  'tasks.shortcut.stop': 'x для остановки',
  'tasks.shortcut.abandon': 'x для отказа',
  'tasks.shortcut.listClose': '←/Esc для закрытия',
  'tasks.shortcut.detailBack': '← назад',
  'tasks.shortcut.detailClose': 'Esc/Enter/Пробел для закрытия',
  'tasks.shortcut.close': 'Esc для закрытия',
  'tasks.shortcut.cancelConfirm': 'Esc для отмены',
  'tasks.detail.workingDir': 'Рабочая директория',
  'tasks.detail.outputFile': 'Файл вывода',
  'tasks.detail.command': 'Команда',
  'tasks.detail.events': (v) =>
    interpolateRu('события {{HC0}}', [v?.count ?? 0]),
  'tasks.detail.exit': (v) =>
    interpolateRu('выход из {{HC0}}', [v?.exitCode ?? '']),
  'tasks.detail.dropped': (v) =>
    interpolateRu('{{HC0}} сброшена', [v?.count ?? 0]),
  'tasks.detail.error': 'Ошибка',
  'tasks.detail.stoppedBecause': 'Остановлено, потому что',
  'tasks.detail.resumeBlocked': 'Возобновить блокировку',
  'tasks.detail.progress': 'Прогресс',
  'tasks.detail.prompt': 'Промпт',
  'tasks.detail.type': 'Тип',
  'tasks.detail.runtime': 'Время',
  'tasks.detail.eventCount': 'Событий',
  'tasks.detail.pid': 'PID',
  'tasks.detail.lastEvent': 'Последнее событие',
  'tasks.detail.droppedCount': 'Отброшено',
  'tasks.detail.exitCode': 'Код выхода',
  'tasks.detail.tokenCount': 'Токены',
  'tasks.detail.toolCallCount': 'Вызовы инструментов',
  'tasks.detail.tokens': (v) =>
    interpolateRu('{{HC0}} токенов', [v?.count ?? 0]),
  'tasks.detail.toolCalls': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'вызов инструмента', 'вызова инструмента', 'вызовов инструментов')}`,
  'tasks.detail.nesting': 'Вложенность',
  'tasks.detail.nestingValue': (v) =>
    interpolateRu('Уровень {{HC0}} · из {{HC1}}', [
      v?.level ?? '?',
      v?.parent ?? '?',
    ]),
  'tasks.detail.nestingLevel': (v) =>
    interpolateRu('Уровень {{HC0}}', [v?.level ?? '?']),
  'tasks.row.from': (v) => interpolateRu('из {{HC0}}', [v?.parent ?? '?']),
  'tasks.row.nested': 'вложенный',
  'tips.items':
    'Нажмите /, чтобы увидеть все доступные команды. Используйте @ для указания путей к файлам. Нажмите Esc, чтобы отменить текущий запрос. Используйте Shift+Enter для новой строки. Используйте ↑↓ для просмотра истории сообщений.',
  'tools.available': 'Доступные инструменты:',
  'tools.none': 'Инструменты недоступны.',
  'tools.empty': 'Встроенных инструментов нет. Сначала откройте сессию.',
  'tools.footer': (v) =>
    v?.name
      ? `${v?.details ? 'Enter/Space — подробности · ' : ''}t — переключить ${v.name} · r — обновить · Esc — закрыть`
      : 'r для обновления · Esc для закрытия',
  'tools.details.hide': 'Скрыть детали',
  'tools.details.show': 'Показать детали',
  'tools.description': 'Описание',
  'tools.details': 'Детали инструмента',
  'tools.loading': 'Загрузка инструментов...',
  'tools.name': 'Название инструмента',
  'tools.noDescription': 'Нет описания',
  'tools.noMatches': 'Подходящих инструментов не найдено.',
  'tools.search': 'Поиск инструментов…',
  'tools.status': 'Статус',
  'tools.status.disabled': 'отключен',
  'tools.status.enabled': 'включен',
  'tools.summary': (v) =>
    interpolateRu('Включено: {{HC0}}/{{HC1}}', [
      v?.enabled ?? 0,
      v?.total ?? 0,
    ]),
  'tools.title': 'Инструменты',
  'tools.update.disable': 'Отключить',
  'tools.update.enable': 'Включить',
  'tools.updating': 'Обновление...',
  'tool.collapse': '▲ Свернуть',
  'tool.expand': 'Развернуть',
  'tool.collapseHint': 'Свернуть',
  'tool.status.failed': 'Ошибка',
  'toolGroup.moreKinds': (v) => interpolateRu('+{{HC0}}', [v?.count ?? 0]),
  'toolGroup.summary': (v) =>
    `Выполнено: ${v?.count ?? 0} ${pluralRu(v?.count, 'инструмент', 'инструмента', 'инструментов')}`,
  'toolGroup.summary.ranAgents': (v) =>
    `Запущено: ${v?.count ?? 0} ${pluralRu(v?.count, 'агент', 'агента', 'агентов')}`,
  'toolGroup.summary.editedFiles': (v) =>
    `Файлы изменены ${v?.count ?? 0} ${pluralRu(v?.count, 'раз', 'раза', 'раз')}`,
  'toolGroup.summary.ranCommands': (v) =>
    `Выполнено: ${v?.count ?? 0} ${pluralRu(v?.count, 'команда', 'команды', 'команд')}`,
  'toolGroup.summary.readFiles': (v) =>
    `Файлы прочитаны ${v?.count ?? 0} ${pluralRu(v?.count, 'раз', 'раза', 'раз')}`,
  'toolGroup.summary.searched': (v) =>
    `Поиск выполнен ${v?.count ?? 0} ${pluralRu(v?.count, 'раз', 'раза', 'раз')}`,
  'toolGroup.summary.updatedTodos': (v) =>
    interpolateRu('Обновлен список задач{{HC0}}', [
      v?.count === 1 ? '' : interpolateRu('{{HC0}} раз', [v?.count ?? 0]),
    ]),
  'toolGroup.summary.provideInformation': 'Предоставление информации',
  'toolGroup.summary.askedQuestions': (v) =>
    `Задано ${v?.count ?? 0} ${pluralRu(v?.count, 'вопрос', 'вопроса', 'вопросов')}`,
  'toolGroup.summary.otherTools': (v) =>
    `Вызвано ${v?.count ?? 0} ${pluralRu(v?.count, 'другое средство', 'других средства', 'других средств')}`,
  'toolGroup.running': (v) =>
    Number(v?.count ?? 0) > 1
      ? interpolateRu('Запущено {{HC0}} инструментов: {{HC1}}', [
          v?.count ?? 0,
          v?.name ?? 'инструмент',
        ])
      : interpolateRu('Запущено {{HC0}}', [v?.name ?? 'инструмент']),
  'toolGroup.runningPrefix': 'Выполняется',
  'thinking.expand': 'Развернуть размышления',
  'thinking.collapse': 'Свернуть размышления',
  'thinking.running': (v) =>
    interpolateRu('Думает{{HC0}}', [
      v?.duration ? interpolateRu('Думает{{HC0}}', [v.duration]) : '',
    ]),
  'thinking.doneBriefly': 'Кратко подумал',
  'thinking.done': (v) =>
    v?.duration ? interpolateRu('Подумал за {{HC0}}', [v.duration]) : 'Подумал',
  'thinking.translate': 'Перевести',
  'thinking.translation': 'Переведенные размышления',
  'thinking.translating': 'Перевод...',
  'thinking.translationThinking': 'Мыслим...',
  'thinking.translationFailed': 'Ошибка перевода',
  'thinking.retranslate': 'Перевести снова',
  'thinking.cancelTranslation': 'Отмена',
  'thinking.closeTranslation': 'Закрыть',
  'thinking.inputTokens': (v) =>
    interpolateRu('Входные токены: {{HC0}}', [v?.count ?? '--']),
  'thinking.outputTokens': (v) =>
    interpolateRu('Выходные токены: {{HC0}}', [v?.count ?? '--']),
  'sessionsOverview.current': 'Текущая',
  'sessionsOverview.empty': 'Сессий пока нет',
  'sessionsOverview.loadFailed': 'Не удалось загрузить сессии',
  'sessionsOverview.loading': 'Загрузка сессий…',
  'sessionsOverview.noData': 'Нет данных',
  'sessionsOverview.openInSplit': 'Открыть в раздельном окне',
  'sessionsOverview.openInSplitHint':
    'Показать выбранные сессии рядом в этом окне',
  'sessionsOverview.splitLimit': (v) =>
    interpolateRu('Выберите не более {{HC0}} сессий для открытия их вместе', [
      v?.max ?? 6,
    ]),
  'sessionsOverview.openInTab': 'Открыть во вкладке',
  'sessionsOverview.openInTabHint':
    'Открыть выбранные сессии как разделённый вид в новой вкладке браузера',
  'sessionsOverview.popupBlocked':
    'Всплывающее окно заблокировано. Разрешите всплывающие окна для этого сайта, чтобы открывать сессии во новых вкладках.',
  'sessionsOverview.refresh': 'Обновить',
  'sessionsOverview.selectAll': 'Выбрать все',
  'sessionsOverview.titleColumn': 'Заголовок',
  'sessionsOverview.sessionId': 'ID сессии',
  'sessionsOverview.actions': 'Действия',
  'sessionsOverview.folder': 'Рабочая область',
  'sessionsOverview.time': 'Время',
  'sessionsOverview.worktree': 'Рабочая область',
  'sessionsOverview.selectedRows': (v) =>
    `Выбрано ${v?.count ?? 0} из ${v?.total ?? 0} ${pluralRu(v?.total, 'строки', 'строк', 'строк')}.`,
  'sessionsOverview.previousPage': 'Предыдущая',
  'sessionsOverview.nextPage': 'Следующая',
  'sessionsOverview.pageInfo': (v) =>
    interpolateRu('Страница {{HC0}} из {{HC1}}', [v?.page ?? 0, v?.total ?? 0]),
  'sessionsOverview.rowsPerPage': 'Строк на страницу',
  'sessionsOverview.workspaceFilter': 'Фильтр по рабочей области',
  'sessionsOverview.allWorkspaces': 'Все',
  'sessionsOverview.searchPlaceholder': 'Поиск сессий…',
  'sessionsOverview.confirmArchiveTitle': 'Архивировать сессию?',
  'sessionsOverview.confirmArchive': (v) =>
    interpolateRu('"{{HC0}}" будет перемещено в архивированные сессии.', [
      v?.name ?? '',
    ]),
  'sessionsOverview.confirmArchiveBulkTitle': (v) =>
    interpolateRu('Архивировать {{HC0}} сессий?', [v?.count ?? 0]),
  'sessionsOverview.confirmArchiveBulk': (v) =>
    interpolateRu(
      '{{HC0}} выбранных сессий будут перемещены в архивированные сессии.',
      [v?.count ?? 0],
    ),
  'sessionsOverview.confirmDeleteTitle': 'Удалить сессию?',
  'sessionsOverview.confirmDelete': (v) =>
    interpolateRu(
      '"{{HC0}}" и история его переписки будут безвозвратно удалены. Это действие нельзя отменить.',
      [v?.name ?? ''],
    ),
  'sessionsOverview.deleteFailed': 'Не удалось удалить сессию',
  'sessionsOverview.archiveFailed': 'Не удалось архивировать сессию',
  'sessionsOverview.actionUnavailable':
    'Это действие недоступно для выбранной сессии или рабочей области',
  'sessionsOverview.bulkArchive': 'Архивировать',
  'sessionsOverview.bulkArchiveHint': (v) =>
    interpolateRu('Архивировать {{HC0}} выбранных сессий', [v?.count ?? 0]),
  'sessionsOverview.bulkDelete': 'Удалить',
  'sessionsOverview.bulkDeleteHint': (v) =>
    interpolateRu('Удалить {{HC0}} выбранные сессии', [v?.count ?? 0]),
  'sessionsOverview.confirmDeleteBulkTitle': (v) =>
    interpolateRu('Удалить {{HC0}} сессий?', [v?.count ?? 0]),
  'sessionsOverview.confirmDeleteBulk': (v) =>
    interpolateRu(
      '{{HC0}} выбранные сессии и их история переписки будут безвозвратно удалены. Это действие нельзя отменить.',
      [v?.count ?? 0],
    ),
  'sessionsOverview.selectSession': (v) =>
    interpolateRu('Выбрать {{HC0}}', [v?.name ?? '']),
  'sessionsOverview.status.askUserQuestion': 'Требуется ввод пользователя',
  'sessionsOverview.status.needsApproval': 'Требует одобрения',
  'sessionsOverview.status.running': 'Выполняется',
  'sessionsOverview.title': 'Обзор сессии',
  'workspacesOverview.title': 'Рабочие области',
  'workspacesOverview.count': (v) =>
    interpolateRu('{{HC0}} рабочих областей', [v?.count ?? 0]),
  'workspacesOverview.column.name': 'Имя',
  'workspacesOverview.column.path': 'Путь',
  'workspacesOverview.column.sessions': 'Сессии',
  'workspacesOverview.column.mcp': 'MCP',
  'workspacesOverview.column.git': 'Ветка',
  'workspacesOverview.column.lastActivity': 'Последняя активность',
  'workspacesOverview.column.actions': 'Действия',
  'workspacesOverview.primaryBadge': 'Основная',
  'workspacesOverview.running': (v) =>
    interpolateRu('{{HC0}} запущено', [v?.count ?? 0]),
  'workspacesOverview.attention': (v) =>
    interpolateRu('{{HC0}} требует внимания', [v?.count ?? 0]),
  'workspacesOverview.truncated':
    'Больше сессий, чем на одной странице; количество является нижней границей.',
  'workspacesOverview.dirty': (v) =>
    interpolateRu('{{HC0}} изменён', [v?.count ?? 0]),
  'workspacesOverview.mcpFailed': (v) =>
    interpolateRu('{{HC0}} не удался', [v?.count ?? 0]),
  'workspacesOverview.newTask': 'Новая задача',
  'workspacesOverview.remove': 'Удалить рабочую область',
  'workspacesOverview.back': 'Назад',
  'workspacesOverview.expandChats': (v) =>
    interpolateRu('Показать чаты проекта {{HC0}}', [v?.name ?? '']),
  'workspacesOverview.collapseChats': (v) =>
    interpolateRu('Скрыть чаты проекта {{HC0}}', [v?.name ?? '']),
  'workspacesOverview.chatCount': (v) =>
    interpolateRu('{{HC0}} чатов', [v?.count ?? 0]),
  'workspacesOverview.selectAllChats': 'Выбрать все чаты',
  'workspacesOverview.selectedChats': (v) =>
    interpolateRu('Выбрано: {{HC0}}', [v?.count ?? 0]),
  'workspacesOverview.archiveSelected': 'Архивировать выбранные',
  'workspacesOverview.deleteSelected': 'Удалить выбранные',
  'workspacesOverview.archiveAll': 'Архивировать все',
  'workspacesOverview.deleteAll': 'Удалить все',
  'workspacesOverview.archiveChat': (v) =>
    interpolateRu('Архивировать {{HC0}}', [v?.name ?? '']),
  'workspacesOverview.deleteChat': (v) =>
    interpolateRu('Удалить {{HC0}}', [v?.name ?? '']),
  'workspacesOverview.openChat': (v) =>
    interpolateRu('Открыть {{HC0}}', [v?.name ?? '']),
  'workspacesOverview.emptyChats': 'В этой рабочей области нет активных чатов.',
  'workspacesOverview.untrustedChats':
    'Сначала сделайте рабочую область доверенной, чтобы увидеть её чаты.',
  'workspacesOverview.showMoreChats': (v) =>
    interpolateRu('Показать ещё {{HC0}}', [v?.count ?? 0]),
  'workspacesOverview.attentionChat': 'Требует внимания',
  'workspacesOverview.runningChat': 'Выполняется',
  'workspacesOverview.actionUnavailable':
    'Действие недоступно, пока один из чатов активен.',
  'workspacesOverview.allChatsUnavailable':
    'Не удалось загрузить полный список чатов.',
  'workspacesOverview.loadChatsFailed': 'Не удалось загрузить чаты',
  'workspacesOverview.archiveFailed': 'Не удалось архивировать чаты',
  'workspacesOverview.deleteFailed': 'Не удалось удалить чаты',
  'workspacesOverview.confirmArchiveTitle': (v) =>
    interpolateRu('Архивировать чаты: {{HC0}}?', [v?.count ?? 0]),
  'workspacesOverview.confirmArchive': (v) =>
    interpolateRu('{{HC0}} чатов будут перемещены в архив.', [v?.count ?? 0]),
  'workspacesOverview.confirmDeleteTitle': (v) =>
    interpolateRu('Удалить чаты: {{HC0}}?', [v?.count ?? 0]),
  'workspacesOverview.confirmDelete': (v) =>
    interpolateRu(
      '{{HC0}} чатов и их история будут удалены безвозвратно. Это действие нельзя отменить.',
      [v?.count ?? 0],
    ),
  'splitView.title': 'Разделенный вид',
  'splitView.count': (v) => interpolateRu('{{HC0}} панелей', [v?.count ?? 0]),
  'splitView.addPane': 'Добавить сессию',
  'splitView.closePane': 'Закрыть панель',
  'splitView.maximizePane': 'Максимизировать панель',
  'splitView.restorePane': 'Восстановить панель',
  'splitView.morePaneActions': 'Больше действий панели',
  'splitView.defaultActionLabel': 'Действие',
  'splitView.paneError': 'Эта панель сессии столкнулась с ошибкой',
  'splitView.paneConnectionError': 'Потеряно соединение',
  'splitView.outerApprovalPending': 'Основная сессия ожидает одобрения.',
  'splitView.goToApproval': 'Перейти к ней',
  'splitView.empty':
    'В разделенном виде нет сессий. Добавьте одну, чтобы начать работу.',
  'splitView.composerPlaceholder': 'Сообщение этой сессии…',
  'settings.title': 'Настройки',
  'channels.title': 'Каналы',
  'channels.description':
    'Подключите HomeCode к местам, где ваша команда уже работает.',
  'channels.summary': (v) =>
    interpolateRu('{{HC0}} · {{HC1}} настроено', [
      v?.workspace ?? '',
      v?.count ?? 0,
    ]),
  'channels.workspace.current': 'Текущая рабочая область',
  'channels.workspace.label': 'Рабочая область',
  'channels.workspace.primary': 'Основная',
  'channels.loading': 'Загрузка каналов',
  'channels.configured': 'Настроенные каналы',
  'channels.configured.description':
    'Управляйте ботами, которые получают и доставляют сообщения для этой рабочей области.',
  'channels.availablePlatforms': 'Доступные платформы',
  'channels.availablePlatforms.description':
    'Выберите платформу для добавления ещё одного подключения к этой рабочей области.',
  'channels.platform.available': 'Доступно',
  'channels.platform.configure': 'Настроить',
  'channels.platform.add': 'Добавить подключение',
  'channels.platform.configureNamed': (v) =>
    interpolateRu('Настроить {{HC0}}', [v?.platform ?? 'Канал']),
  'channels.status.stopped': 'Остановлено',
  'channels.status.starting': 'Запуск',
  'channels.status.connected': 'Подключено',
  'channels.status.partial': 'Частичное подключение',
  'channels.status.error': 'Ошибка',
  'channels.statusDescription.stopped': 'Офлайн и не получает сообщения.',
  'channels.statusDescription.starting':
    'Соединение с платформой устанавливается сейчас.',
  'channels.statusDescription.connected':
    'Онлайн и готов к получению сообщений.',
  'channels.statusDescription.partial':
    'Подключено, но некоторые возможности недоступны.',
  'channels.statusDescription.error': 'Требует внимания перед подключением.',
  'channels.startsWithServe': 'Подключение при запуске HomeCode',
  'channels.startsWithServe.description':
    'Автоматически переводить этот канал в онлайн после запуска HomeCode.',
  'channels.unsupported.title': 'Управление каналами не поддерживается',
  'channels.unsupported.description':
    'Обновите HomeCode до версии, поддерживающей управление каналами.',
  'channels.readOnly.title': 'Управление каналами доступно только для чтения',
  'channels.readOnly.description':
    'Перезапустите HomeCode с токеном авторизации для управления каналами.',
  'channels.loadError.title': 'Не удалось загрузить каналы',
  'channels.empty.title': 'Нет настроенных поддерживаемых каналов',
  'channels.empty.description':
    'Настройте DingTalk, WeCom, Feishu, GitHub или GitLab для получения сообщений в этой рабочей области.',
  'channels.runtimeError': 'Ошибка выполнения канала',
  'channels.action.back': 'Назад',
  'channels.action.refresh': 'Обновить',
  'channels.action.start': 'Запустить',
  'channels.action.stop': 'Остановить',
  'channels.action.restart': 'Перезапустить',
  'channels.action.retry': 'Повторить попытку',
  'channels.action.edit': 'Редактировать',
  'channels.action.editNamed': (v) =>
    interpolateRu('Редактировать {{HC0}}', [v?.name ?? 'Канал']),
  'channels.action.moreNamed': (v) =>
    interpolateRu('Дополнительные действия для {{HC0}}', [
      v?.name ?? 'Дополнительно',
    ]),
  'channels.action.delete': 'Удалить',
  'channels.action.deleteNamed': (v) =>
    interpolateRu('Удалить {{HC0}}', [v?.name ?? 'Канал']),
  'channels.action.startWithServeNamed': (v) =>
    interpolateRu('Запустить {{HC0}} с помощью serve', [v?.name ?? '']),
  'channels.delete.title': (v) =>
    interpolateRu('Удалить {{HC0}}?', [v?.name ?? 'Канал']),
  'channels.delete.description':
    'Канал будет остановлен и удалён из этой рабочей области. Это действие нельзя отменить.',
  'channels.delete.error': 'Не удалось удалить канал',
  'channels.editor.addTitle': (v) =>
    interpolateRu('Настроить {{HC0}}', [v?.platform ?? 'Канал']),
  'channels.editor.editTitle': (v) =>
    interpolateRu('Редактировать {{HC0}}', [v?.platform ?? 'Канал']),
  'channels.editor.addDescription':
    'Подключите зарегистрированную рабочую область к существующему приложению платформы.',
  'channels.editor.editDescription':
    'Обновите общедоступные настройки или явно измените сохранённые учётные данные.',
  'channels.editor.section.identity': 'Идентификация',
  'channels.editor.section.credentials': 'Учётные данные',
  'channels.editor.section.session': 'Управление диалогами',
  'channels.editor.section.access': 'Контроль доступа',
  'channels.editor.section.access.description':
    'Настройте доступ к личным сообщениям и группам отдельно.',
  'channels.editor.session.isolation': 'Изоляция диалогов',
  'channels.editor.instanceName': 'Имя экземпляра',
  'channels.editor.instanceNamePlaceholder': 'например, release-bot',
  'channels.editor.workspace': 'Рабочая область',
  'channels.editor.workspace.description':
    'Сообщения, сессии и настройки канала относятся к этой рабочей области. По умолчанию выбрана основная рабочая область.',
  'channels.editor.workspace.lockedDescription':
    'Настроенный канал остаётся привязанным к своей рабочей области. Для другой рабочей области создайте отдельный экземпляр.',
  'channels.editor.environmentReference': 'Поддерживается $ENV_VAR',
  'channels.editor.field.sessionScope': 'Область сессии',
  'channels.editor.field.sessionScope.description':
    'Определяет, какие входящие диалоги используют одну сессию агента.',
  'channels.editor.field.sessionScope.option.user': 'Для пользователя и чата',
  'channels.editor.field.sessionScope.option.thread': 'Для ветки обсуждения',
  'channels.editor.field.sessionScope.option.chat_thread':
    'Для чата и ветки обсуждения',
  'channels.editor.field.sessionScope.option.single': 'Одна общая сессия',
  'channels.editor.field.dingtalk.clientId': 'ID клиента (AppKey)',
  'channels.editor.field.dingtalk.clientSecret': 'Секрет клиента (AppSecret)',
  'channels.editor.field.wecom.botId': 'ID бота',
  'channels.editor.field.wecom.secret': 'Секрет бота',
  'channels.editor.field.wecom.wsUrl': 'URL WebSocket',
  'channels.editor.field.feishu.clientId': 'ID приложения',
  'channels.editor.field.feishu.clientSecret': 'Секрет приложения',
  'channels.editor.field.github.token': 'Личный токен доступа',
  'channels.editor.field.github.token.description':
    'Необязательный классический PAT с областью notifications. Переопределяет локальную аутентификацию gh.',
  'channels.editor.field.github.useLocalGh':
    'Использовать локальную аутентификацию GitHub CLI',
  'channels.editor.field.github.useLocalGh.description':
    'Явно повторно использовать учётную запись gh для всего аккаунта хоста демона, если токен не настроен',
  'channels.editor.field.github.baseUrl': 'Базовый URL API',
  'channels.editor.field.github.baseUrl.description':
    'Корень API GitHub Enterprise (например, https://ghe.example.com/api/v3). Оставьте пустым для github.com',
  'channels.editor.field.github.groupPolicy': 'Групповая политика',
  'channels.editor.field.github.groupPolicy.description':
    'Для получения уведомлений выберите Open, Allowlist или Pairing.',
  'channels.editor.field.github.senderPolicy': 'Политика отправителя',
  'channels.editor.field.github.senderPolicy.description':
    'Для публичных репозиториев используйте Allowlist и укажите разрешённых пользователей.',
  'channels.editor.field.github.allowedUsers':
    'Разрешённые пользователи (через запятую)',
  'channels.editor.field.github.allowedUsers.description':
    'Имена пользователей GitHub, используемые политиками Allowlist и Pairing',
  'channels.editor.field.github.reasonFilter': 'Фильтр причин',
  'channels.editor.field.github.reasonFilter.description':
    'Необязательно. Список причин уведомлений через запятую. Допустимые значения: mention, review_requested, assign, author, comment, ci_activity, manual, state_change, subscribed, team_mention, security_alert, approval_requested, invitation, member_feature_requested, security_advisory_credit. Оставьте пустым, чтобы обрабатывать все.',
  'channels.editor.field.gitlab.token': 'Личный токен доступа',
  'channels.editor.field.gitlab.token.description':
    'PAT с областями read_api и api',
  'channels.editor.field.gitlab.baseUrl': 'URL экземпляра',
  'channels.editor.field.gitlab.baseUrl.description':
    'URL самохостимого экземпляра (например, https://gitlab.example.com). Оставьте пустым для gitlab.com',
  'channels.editor.field.gitlab.groupPolicy': 'Групповая политика',
  'channels.editor.field.gitlab.groupPolicy.description':
    'Для обработки задач выберите Open, Allowlist или Pairing.',
  'channels.editor.field.gitlab.senderPolicy': 'Политика отправителя',
  'channels.editor.field.gitlab.senderPolicy.description':
    'Для публичных проектов используйте Allowlist и укажите разрешённых пользователей.',
  'channels.editor.field.gitlab.allowedUsers':
    'Разрешённые пользователи (через запятую)',
  'channels.editor.field.gitlab.allowedUsers.description':
    'Имена пользователей GitLab, используемые политиками Allowlist и Pairing',
  'channels.editor.field.gitlab.action_prompt_template': 'Шаблоны действий',
  'channels.editor.field.gitlab.action_prompt_template.description':
    'Обрабатываются только действия с шаблоном; остальные пропускаются. Переменные шаблона: %project%, %project_url%, %author%, %target_type%, %iid%, %title%, %description%, %todo_id%. Используйте %% для вставки символа %. Пример для "mentioned": Проект: %project% | Автор: %author% | Заголовок: %title%',
  'channels.editor.field.gitlab.action_prompt_template.option.mentioned':
    'Упоминание — @bot в комментарии или описании',
  'channels.editor.field.gitlab.action_prompt_template.option.directly_addressed':
    'Прямое обращение — комментарий начинается с @bot',
  'channels.editor.field.gitlab.action_prompt_template.option.assigned':
    'Назначено — бот назначен на задачу или MR',
  'channels.editor.field.gitlab.action_prompt_template.option.review_requested':
    'Запрос на обзор — бот запрошен как рецензент MR',
  'channels.editor.field.gitlab.action_prompt_template.option.approval_required':
    'Требуется одобрение — MR требует одобрения бота',
  'channels.editor.field.gitlab.action_prompt_template.option.marked':
    'Отмечено — кто-то поставил лайк комментарию/задаче/MR бота',
  'channels.editor.field.gitlab.action_prompt_template.option.build_failed':
    'Сборка провалилась — CI/CD-конвейер упал на ветке бота/MR',
  'channels.editor.field.gitlab.action_prompt_template.option.unmergeable':
    'Необъединяемо — MR стал необъединяемым (конфликты)',
  'channels.editor.field.gitlab.action_prompt_template.option.merge_train_removed':
    'Удалено из очереди слияния — MR удалено из очереди слияния',
  'channels.editor.secret.environment': 'Хранится в переменной окружения',
  'channels.editor.secret.stored': 'Хранится безопасно',
  'channels.editor.secret.preserve': 'Сохранить',
  'channels.editor.secret.replace': 'Заменить',
  'channels.editor.secret.clear': 'Очистить',
  'channels.editor.secret.placeholder': (v) =>
    interpolateRu('Введите {{HC0}}', [v?.label ?? 'секрет']),
  'channels.editor.secret.clearHint':
    'Этот учетный идентификатор будет удален при сохранении.',
  'channels.editor.field.shared.senderPolicy': 'Политика личных сообщений',
  'channels.editor.field.shared.senderPolicy.description':
    'Выберите, кто может инициировать личное общение с этим каналом.',
  'channels.editor.field.shared.senderPolicy.option.pairing': 'Сопряжение',
  'channels.editor.field.shared.senderPolicy.option.allowlist':
    'Разрешенный список',
  'channels.editor.field.shared.senderPolicy.option.open': 'Открытый доступ',
  'channels.editor.field.shared.allowedUsers': 'ID разрешенных пользователей',
  'channels.editor.field.shared.allowedUsers.description':
    'Укажите через запятую постоянные ID пользователей, которым доступен канал без сопряжения.',
  'channels.editor.field.shared.groupPolicy': 'Политика групповых чатов',
  'channels.editor.field.shared.groupPolicy.description':
    'Выберите, какие групповые чаты могут использовать этот канал.',
  'channels.editor.field.shared.groupPolicy.option.disabled': 'Отключено',
  'channels.editor.field.shared.groupPolicy.option.pairing': 'Сопряжение',
  'channels.editor.field.shared.groupPolicy.option.allowlist':
    'Разрешенный список',
  'channels.editor.field.shared.groupPolicy.option.open': 'Открытый доступ',
  'channels.editor.field.shared.allowedGroupIds': 'ID разрешенных групп',
  'channels.editor.field.shared.allowedGroupIds.description':
    'Укажите через запятую постоянные ID чатов или репозиториев, которым разрешено использовать этот канал.',
  'channels.editor.field.shared.allowedGroupIds.placeholder':
    'group-a, group-b',
  'channels.editor.field.shared.sessionScope': 'Изоляция диалогов',
  'channels.editor.field.shared.sessionScope.description':
    'Выберите, как диалоги будут использовать постоянный контекст агента.',
  'channels.editor.field.shared.sessionScope.option.user': 'По пользователю',
  'channels.editor.field.shared.sessionScope.option.thread':
    'По потоку (устаревший)',
  'channels.editor.field.shared.sessionScope.option.chat_thread':
    'По чату или потоку',
  'channels.editor.field.shared.sessionScope.option.single': 'Общий для всех',
  'channels.editor.field.shared.sessionScope.detail.user':
    'Сообщения одного пользователя сохраняются в одном диалоге; пользователи изолированы друг от друга.',
  'channels.editor.field.shared.sessionScope.detail.thread':
    'Сохраняет устаревшую маршрутизацию потоков, используемую существующими сессиями каналов.',
  'channels.editor.field.shared.sessionScope.detail.chat_thread':
    'Сообщения в одной группе или теме делятся одним диалогом; оптимально для совместной работы.',
  'channels.editor.field.shared.sessionScope.detail.single':
    'Все сообщения делят один диалог; оптимально для канала службы одного бота.',
  'channels.editor.field.shared.multiSession': 'Именованные задачи',
  'channels.editor.field.shared.multiSession.description':
    'В режиме управления демоном сохраняйте отдельный каталог именованных задач с ограничением по владельцу.',
  'channels.editor.policy.pairing.title': 'Сопряжение',
  'channels.editor.policy.pairing.description':
    'Пользователи получают код сопряжения и могут общаться после вашего одобрения.',
  'channels.editor.pairing.title': 'Ожидающие запросы',
  'channels.editor.pairing.description':
    'Сверьте общий код перед подтверждением доступа. Подтверждение вступает в силу сразу; кнопки «Сохранить» и «Отмена» его не отменяют.',
  'channels.editor.pairing.subject.group': (v) =>
    interpolateRu('Группа: {{HC0}}', [v?.name ?? 'Неизвестно']),
  'channels.editor.pairing.requestedBy': (v) =>
    interpolateRu('Запрошено пользователем {{HC0}}', [
      v?.sender ?? 'Неизвестно',
    ]),
  'channels.editor.pairing.refresh': 'Обновить запросы сопряжения',
  'channels.editor.pairing.approve': 'Утвердить',
  'channels.editor.pairing.approveFor': (v) =>
    interpolateRu('Одобрить {{HC0}}, код {{HC1}}', [
      v?.sender ?? 'запрос',
      v?.code ?? '',
    ]),
  'channels.editor.pairing.approved': (v) =>
    interpolateRu('{{HC0}} теперь может использовать этот канал.', [
      v?.sender ?? 'Этот человек',
    ]),
  'channels.editor.pairing.error': 'Запросы сопряжения не были обновлены',
  'channels.editor.pairing.unavailable':
    'Запросы сопряжения временно недоступны. Попробуйте позже.',
  'channels.editor.pairing.retry': 'Попробовать снова',
  'channels.editor.pairing.empty.title': 'Нет ожидающих запросов',
  'channels.editor.pairing.empty.description':
    'Новые запросы появятся здесь после того, как кто-то напишет боту.',
  'channels.editor.pairing.saveFirst.title':
    'Сначала включите режим сопряжения',
  'channels.editor.pairing.saveFirst.description':
    'Ожидающие запросы появятся здесь после сохранения этого канала в режиме сопряжения.',
  'channels.editor.pairing.approvals.title': 'Утверждения сопряжения',
  'channels.editor.pairing.approvals.description':
    'ID пользователей и групп, утверждённые через сопряжение для этого канала.',
  'channels.editor.pairing.approvals.refresh':
    'Обновить утверждения сопряжения',
  'channels.editor.pairing.approvals.revoke': 'Отозвать',
  'channels.editor.pairing.approvals.revokeFor': (v) =>
    interpolateRu('Отозвать у {{HC0}}', [
      v?.senderId ?? 'утверждение сопряжения',
    ]),
  'channels.editor.pairing.approvals.revoked': (v) =>
    interpolateRu('Одобрение сопряжения для {{HC0}} было отозвано.', [
      v?.senderId ?? 'этого отправителя',
    ]),
  'channels.editor.pairing.approvals.error':
    'Утверждения сопряжения не были обновлены',
  'channels.editor.pairing.approvals.unavailable':
    'Подтверждения сопряжения временно недоступны. Попробуйте позже.',
  'channels.editor.pairing.approvals.empty.title':
    'Нет подтверждённых сопряжений',
  'channels.editor.pairing.approvals.empty.description':
    'Здесь появятся ID пользователей и групп, получивших разрешение.',
  'channels.editor.pairing.approvals.confirm.title': (v) =>
    interpolateRu('Отозвать одобрение сопряжения для {{HC0}}?', [
      v?.senderId || 'этот отправитель',
    ]),
  'channels.editor.pairing.approvals.confirm.description':
    'Будет удалено только разрешение, созданное через сопряжение. Список разрешений канала не изменится.',
  'channels.editor.pairing.approvals.confirm.action': 'Отозвать разрешение',
  'channels.editor.pairing.allowlist.title': 'Настроенный список разрешений',
  'channels.editor.pairing.allowlist.description':
    'Пользователи из настроенного списка сохранят доступ после отзыва разрешения на сопряжение.',
  'channels.editor.policy.open.title': 'Открыть',
  'channels.editor.policy.open.description':
    'Любой, кто может обратиться к боту, сможет начать разговор.',
  'channels.editor.validation.required': (v) =>
    interpolateRu('{{HC0}} обязателен.', [v?.label ?? 'Это поле']),
  'channels.editor.validation.credential':
    'Введите токен или включите аутентификацию локального GitHub CLI.',
  'channels.editor.validation.duplicate':
    'Канал с таким именем уже существует.',
  'channels.editor.validation.invalidName': 'Выберите другое имя экземпляра.',
  'channels.editor.validation.invalidGroupId':
    'Введите ID группы, отличный от __proto__, constructor или prototype.',
  'channels.editor.validation.invalidOption':
    'Удалите значения, отсутствующие в разрешённом списке.',
  'channels.editor.validation.number': 'Введите корректное числовое значение.',
  'channels.editor.validation.outOfRange': (v) =>
    interpolateRu('Введите число больше {{HC0}}.', [v?.min ?? 0]),
  'channels.editor.validation.policy': 'Выберите политику доступа.',
  'channels.editor.saveError': 'Изменения не были сохранены',
  'channels.editor.reloadLatest': 'Обновить',
  'channels.editor.cancel': 'Отмена',
  'channels.editor.save': 'Сохранить',
  'settings.loading': 'Загрузка настроек...',
  'settings.empty': 'Настройки недоступны.',
  'settings.footer':
    '↑↓ навигация · Enter — переключить · Tab — область · r — обновить · Esc — закрыть',
  'settings.footer.edit': 'Enter — сохранить · Esc — отмена',
  'settings.footer.theme': '↑↓ Перемещение  Enter Выбор  ESC Назад',
  'settings.scope.user': 'Пользователь',
  'settings.scope.workspace': 'Рабочая область',
  'settings.value.on': 'Включено',
  'settings.value.off': 'Выключено',
  'settings.action.edit': 'Редактировать',
  'settings.action.select': 'Выбрать',
  'settings.action.save': 'Сохранить',
  'settings.modifiedIn': (v) =>
    interpolateRu('(Изменено в {{HC0}})', [v?.scope ?? '']),
  'settings.alsoModifiedIn': (v) =>
    interpolateRu('(Также изменено в {{HC0}})', [v?.scope ?? '']),
  'settings.label.general.outputLanguage': 'Язык ответов',
  'settings.description.general.outputLanguage':
    'Язык ответов модели. Применяется после перезапуска HomeCode.',
  'settings.option.general.outputLanguage.auto': 'Как в вашем сообщении',
  'settings.option.general.outputLanguage.Russian': 'Русский',
  'settings.option.general.outputLanguage.English': 'Английский',
  'settings.option.general.outputLanguage.Chinese': 'Китайский',
  'settings.label.agents.maxParallelAgents': 'Лимит параллельных сабагентов',
  'settings.description.agents.maxParallelAgents':
    'Сколько фоновых сабагентов могут работать одновременно в каждой сессии Qwen. Остальные ждут в очереди. Применяется после перезапуска HomeCode.',
  'settings.invalidNumber': 'Некорректное число',
  'settings.requiresRestart': 'Это изменение вступит в силу после перезапуска.',
  'settings.localControl.title': 'Локальное управление',
  'settings.localControl.description':
    'Продолжайте работу с этой сессией HomeCode с телефона в той же доверенной сети.',
  'settings.localControl.on': 'Включено',
  'settings.localControl.off': 'Выключено',
  'settings.localControl.network': 'Локальная сеть',
  'settings.localControl.selectNetwork': 'Выберите сеть',
  'settings.localControl.qr': 'QR-код локального управления',
  'settings.localControl.enable': 'Включить локальное управление',
  'settings.localControl.disable': 'Отключить доступ с телефона',
  'settings.localControl.encrypted': 'Зашифровано',
  'settings.localControl.unencrypted':
    'Не зашифровано — только доверенные сети; включите снова после изменений в сети.',
  'settings.localControl.awake': 'Этот Mac останется активным',
  'settings.localControl.maySleep': 'Этот Mac может перейти в спящий режим',
  'settings.localControl.urlRedacted':
    'URL сопряжения не показан, потому что у демона нет bearer-токена. URL выведен в терминале, где запущен демон — выполните сопряжение оттуда.',
  'localControl.open': 'Мобильный доступ',
  'localControl.disabledHint':
    'Локальное управление выключено. Включите его в Настройках для сопряжения телефона на той же сети.',
  'localControl.openSettings': 'Открыть настройки',
  'settings.vane.apiKey': 'API-ключ Qwen 27B',
  'settings.vane.apiKeyHint':
    'Ключ домашнего сервера для подключения Vane к Qwen3.8-27B.',
  'settings.vane.enterKey': 'Вставьте API-ключ',
  'settings.vane.replaceKey': 'Вставьте новый ключ',
  'settings.vane.saveKey': 'Сохранить ключ',
  'settings.vane.savingKey': 'Сохранение…',
  'settings.vane.keySaved': 'Ключ сохранён',
  'settings.vane.keyConfigured': 'Ключ настроен',
  'settings.vane.description':
    'Параметры поиска и ответов в режиме Chat. Сохраняются автоматически для всех чатов.',
  'settings.vane.unavailable':
    'Модели Vane недоступны. Проверьте подключение и повторите загрузку.',
  'settings.vane.model': 'Модель Chat',
  'settings.vane.modelHint': 'Модель для ответов и интернет-исследований Vane.',
  'settings.vane.depth': 'Глубина исследования',
  'settings.vane.depthHint':
    'Баланс между скоростью ответа и подробностью поиска.',
  'settings.vane.speed': 'Быстро',
  'settings.vane.balanced': 'Сбалансированно',
  'settings.vane.quality': 'Глубоко',
  'settings.vane.thinking': 'Размышления',
  'settings.vane.thinkingHint': 'Позволяет модели рассуждать перед ответом.',
  'settings.vane.noReasoning':
    'Выбранная модель не поддерживает управление размышлениями.',
  'settings.vane.effort': 'Усилие · effort',
  'settings.vane.effortHint':
    'Уровень усилий модели при включённых размышлениях.',
  'settings.vane.low': 'Низкий',
  'settings.vane.medium': 'Средний',
  'settings.vane.high': 'Высокий',
  'settings.models.chatDefaults': 'Параметры чата',
  'settings.models.subtitle': 'Подключения и параметры моделей.',
  'settings.models.back': 'К моделям',
  'settings.models.name': 'Название',
  'settings.models.modelId': 'ID модели',
  'settings.models.baseUrl': 'Адрес API',
  'settings.models.apiKey': 'API-ключ',
  'settings.models.keySaved':
    'Ключ сохранён · оставьте пустым, чтобы сохранить',
  'settings.models.keyPlaceholder': 'Вставьте API-ключ',
  'settings.models.keyHint':
    'Пустое поле сохраняет текущий ключ. При смене адреса API введите ключ заново.',
  'settings.models.default': 'По умолчанию',
  'settings.models.unchanged': 'Без изменений',
  'settings.models.reasoningHint':
    'Параметры этой модели. В чате thinking и effort можно менять в меню выбора модели.',
  'settings.models.contextWindowSize': 'Контекст · токены',
  'settings.models.maxTokens': 'Максимальный ответ · токены',
  'settings.models.temperature': 'Температура',
  'settings.models.topP': 'Top P',
  'settings.models.advanced': 'Дополнительные настройки',
  'settings.models.envKey': 'Переменная окружения для ключа',
  'settings.models.saving': 'Сохранение…',
  'settings.models.save': 'Сохранить',
  'settings.models.saved': 'Настройки модели сохранены.',
  'settings.models.deferred':
    'Сохранено. Модель получит настройки, когда её процесс будет готов.',
  'settings.models.retry': 'Повторить',
  'settings.models.access': 'Доступ',
  'settings.models.context': 'Контекст',
  'settings.models.keyConfigured': 'Ключ подключён',
  'settings.models.keyMissing': 'API-ключ не задан',
  'settings.models.edit': 'Настроить',
  'settings.models.checkLimits': 'Проверить остаток',
  'settings.models.modelscope.quota':
    'Дневная квота аккаунта и модели. Нужен подтверждённый аккаунт Alibaba Cloud.',
  'settings.models.orcarouter.quota':
    'Бесплатный API с ограничением частоты запросов. Фиксированной квоты на день или неделю нет.',
  'settings.models.unknown': 'Неизвестно',
  'settings.models.remaining': (v) => `Осталось ${v?.count ?? 0}`,
  'settings.models.period.day': 'за день',
  'settings.models.period.week': 'за неделю',
  'settings.models.period.minute': 'за минуту',
  'settings.models.resetAt': (v) => `сброс ${v?.time ?? ''}`,
  'settings.models.checkedAt': (v) =>
    `Данные сервиса на ${v?.time ?? ''}. Последующие запросы здесь ещё не учтены.`,
  'settings.models.quotaUnknown': 'Остаток пока не проверен.',
  'settings.models.checkHint': 'Проверка расходует один короткий запрос к API.',
  'settings.models.deleted': 'Модель удалена.',
  'settings.models.deletePrompt': (v) =>
    `Удалить ${v?.name ?? ''} из этого списка моделей?`,
  'settings.models.freeServices': 'Fallback бесплатные модели',
  'settings.models.freeServicesHint':
    'Бесплатные API для резервного использования без регистрации.',
  'settings.models.freeServicesAvailable': 'LLM7 · Codestral и GPT-OSS',
  'settings.models.freeServicesRequestsMinute': 'Запросы в минуту',
  'settings.models.freeServicesRequestsHour': 'Запросы в час',
  'settings.models.freeServicesTokensDay': 'Токены в сутки',
  'settings.models.freeServicesDocs': 'Доступ и лимиты LLM7',
  'settings.models.title': 'Модели',
  'settings.models.add': '+ Добавить модель',
  'settings.models.setCurrent': 'Установить текущей',
  'settings.models.current': 'Текущая',
  'settings.models.runtime': 'Среда выполнения',
  'settings.models.delete': 'Удалить',
  'settings.models.confirmDelete': 'Подтвердить',
  'settings.models.cancel': 'Отмена',
  'settings.models.empty': 'Пока не настроено ни одной модели.',
  'settings.models.loading': 'Загрузка моделей…',
  'settings.models.deleteFailed': 'Не удалось удалить модель',
  'settings.models.runtimeSyncFailed':
    'Изменение сохранено, но активные сессии не могли быть обновлены. Перед использованием обновленного списка моделей перезапустите qwen serve.',
  'settings.models.fallbacks.title': 'Резервные модели',
  'settings.models.fallbacks.hint': (v) =>
    interpolateRu(
      'Выберите до {{HC0}}; они будут использованы по очереди, если основная модель перегружена.',
      [v?.max ?? 3],
    ),
  'settings.models.fallbacks.confirm': 'Подтвердить',
  'settings.models.fallbacks.empty': 'Нет доступных для выбора моделей.',
  'settings.models.fallbacks.saveFailed':
    'Не удалось сохранить резервные модели',
  'settings.models.fallbacks.limitReached': (v) =>
    interpolateRu(
      'Максимум {{HC0}} моделей-запасов выбрано; снимите выделение с одной, чтобы выбрать другую.',
      [v?.max ?? 3],
    ),
  'settings.corrupted': (v) =>
    interpolateRu('Файл настроек повреждён{{HC0}}', [
      v?.recovered === 'true' ? '(восстановлено из резервной копии)' : '',
    ]),
  'settings.label.ui.chatWidth': 'Ширина чата',
  'settings.description.ui.chatWidth':
    'Только для фронтенда: ширина контента чата. Хранится в этом браузере.',
  'settings.option.ui.chatWidth.1000': 'Обычная',
  'settings.option.ui.chatWidth.wide': 'Ультраширокая',
  'settings.label.visionModel': 'Модель с поддержкой зрения',
  'settings.description.visionModel':
    'Модель, способная обрабатывать изображения, используемая как мост для зрения. Оставьте пустым для автовыбора.',
  'welcome.changeModel': '(/model для смены)',
  'welcome.defaultModel': 'неизвестная модель',
  'welcome.modeHint': 'Shift+Tab или /approval-mode',
  'welcome.prompt': 'Что вы хотите сделать?',
  'welcome.titlePrefix': 'Добро пожаловать в',
  'welcome.tipLabel': 'Советы:',
  'toolName.edit': 'Редактировать',
  'toolName.write_file': 'Запись в файл',
  'toolName.read_file': 'Чтение файла',
  'toolName.zoom_image': 'Увеличение изображения',
  'toolName.grep': 'Поиск содержимого',
  'toolName.grep_search': 'Поиск содержимого',
  'toolName.glob': 'Поиск файлов по шаблону',
  'toolName.run_shell_command': 'Выполнение команды',
  'toolName.todo_write': 'Список задач',
  'toolName.get_goal': 'Цель',
  'toolName.update_goal': 'Обновить цель',
  'toolName.propose_goal': 'Предложить цель',
  'toolName.save_memory': 'Сохранить память',
  'toolName.agent': 'Агент',
  'toolName.skill': 'Просмотр навыков',
  'toolName.enter_plan_mode': 'Войти в режим планирования',
  'toolName.exit_plan_mode': 'Выйти из режима планирования',
  'toolName.web_fetch': 'Веб-поиск',
  'toolName.webfetch': 'Веб-поиск',
  'toolName.fetch': 'Веб-поиск',
  'toolName.web_search': 'Веб-поиск',
  'toolName.list_directory': 'Список каталога',
  'toolName.lsp': 'LSP',
  'toolName.ask_user_question': 'Запросить вопрос у пользователя',
  'toolName.cron_create': 'Создать планировщик задач',
  'toolName.cron_list': 'Список планировщиков задач',
  'toolName.cron_delete': 'Удалить планировщик задач',
  'toolName.task_create': 'Создать задачу',
  'toolName.task_update': 'Обновить задачу',
  'toolName.task_list': 'Список задач',
  'toolName.task_stop': 'Остановить задачу',
  'toolName.team_create': 'Создать команду',
  'toolName.team_delete': 'Удалить команду',
  'toolName.send_message': 'Отправить сообщение',
  'toolName.request_shutdown': 'Запросить выход из системы',
  'toolName.list_agents': 'Перечислить агентов',
  'toolName.structured_output': 'Структурированный вывод',
  'toolName.monitor': 'Мониторинг',
  'toolName.notebook_edit': 'Редактировать Notebook',
  'toolName.tool_search': 'Поиск инструментов',
  'toolName.enter_worktree': 'Войти в рабочую область',
  'toolName.exit_worktree': 'Выйти из рабочей области',
  'toolName.workflow': 'Рабочий процесс',
  'toolName.team_plan_approval': 'Одобрение плана команды',
  'toolName.loop_wakeup': 'Циклическое пробуждение',
  'toolName.create_sub_session': 'Создать под-сессия',
  'toolName.read_mcp_resource': 'Чтение ресурса MCP',
  'toolName.artifact': 'Артефакт',
  'toolName.record_artifact': 'Запись артефакта',
  'toolName.report_findings': 'Сообщить о найденных проблемах',
  'toolName.image_gen': 'Генерация изображения',
  'toolName.display_image': 'Отображение изображения',
  'toolName.bash': 'Выполнение команды',
  'toolName.shell': 'Команда Shell',
  'toolName.read': 'Чтение файла',
  'toolName.readfile': 'Чтение файла',
  'toolName.write': 'Запись в файл',
  'toolName.writefile': 'Запись в файл',
  'toolName.search': 'Поиск содержимого',
  'toolName.todowrite': 'Список задач',
  'toolName.savememory': 'Сохранение памяти',
  'toolName.askuserquestion': 'Вопрос пользователю',
  'toolName.toolsearch': 'Поиск инструментов',
  'settings.category.General': 'Общие',
  'settings.category.UI': 'Интерфейс',
  'settings.category.Privacy': 'Конфиденциальность',
  'settings.category.Model': 'Модель',
  'settings.category.Context': 'Контекст',
  'settings.category.Tools': 'Инструменты',
  'settings.category.Daemon': 'Демон',
  'settings.category.Experimental': 'Экспериментальные функции',
  'settings.category.Advanced': 'Продвинутые настройки',
  'settings.label.general.enableAutoUpdate':
    'Включить автоматические обновления',
  'settings.description.general.enableAutoUpdate':
    'При запуске автоматически проверять и устанавливать обновления.',
  'settings.label.general.showSessionRecap': 'Показывать сводку сессии',
  'settings.description.general.showSessionRecap':
    'При возвращении в терминал после некоторого времени отсутствия автоматически показывается строка «Вернувшись сюда». По умолчанию отключено. Также можно вручную запустить командой /recap.',
  'settings.label.general.sessionRecapAwayThresholdMinutes':
    'Порог времени отсутствия для сводки сессии (минуты)',
  'settings.description.general.sessionRecapAwayThresholdMinutes':
    'Через сколько минут бездействия терминала при следующем фокусировании запускается автоматическая сводка. По умолчанию совпадает с Claude Code — 5 минут; если переключение окон кратковременное, можно увеличить значение.',
  'settings.label.general.cleanupPeriodDays': 'Период очистки (дней)',
  'settings.description.general.cleanupPeriodDays':
    'Количество дней хранения резервных копий сессий для команды /rewind в ~/.qwen/file-history/. Фоновая очистка выполняется не чаще одного раза в день. Значение 0 означает минимальное хранение (около 1 часа), при этом защищаются последние час активности и текущая активная сессия.',
  'settings.label.general.gitCoAuthor.commit': 'Привязка: commit',
  'settings.description.general.gitCoAuthor.commit':
    'При создании коммита через HomeCode добавляется трейлер Co-authored-by и записывается git note с AI-привязкой для каждого файла. При отключении обе функции пропускаются.',
  'settings.label.general.gitCoAuthor.pr': 'Привязка: PR',
  'settings.description.general.gitCoAuthor.pr':
    'При выполнении gh pr create в описание PR добавляется строка привязки HomeCode.',
  'settings.label.general.language': 'Язык: интерфейс',
  'settings.description.general.language':
    'Язык пользовательского интерфейса. Использование auto автоматически определяет язык на основе системных настроек; также можно разместить файлы локализации JS в ~/.qwen/locales/, чтобы использовать собственный код языка.',
  'settings.label.general.preventSystemSleep':
    'Предотвращение сна системы во время работы',
  'settings.description.general.preventSystemSleep':
    'Предотвращать сон системы, когда HomeCode генерирует ответы модели или выполняет инструменты. Сон не блокируется в состоянии ожидания ввода и подтверждения прав.',
  'settings.label.ui.theme': 'Тема',
  'settings.description.ui.theme': 'Цветовая тема интерфейса.',
  'settings.label.ui.hideTips': 'Скрыть подсказки',
  'settings.description.ui.hideTips': 'Скрывать подсказки помощи в интерфейсе.',
  'settings.label.ui.enableWelcomeBack':
    'Показать диалог «Добро пожаловать обратно»',
  'settings.description.ui.enableWelcomeBack':
    'Показывать диалог «Добро пожаловать обратно», возвращаясь к проекту с историей сессий. После выбора «Начать новый чат» диалог не появится повторно до изменения резюме проекта.',
  'settings.label.ui.enableUserFeedback':
    'Включить обратную связь от пользователя',
  'settings.description.ui.enableUserFeedback':
    'Показывать опциональный диалог обратной связи после завершения разговора, чтобы помочь улучшить работу Qwen.',
  'settings.label.ui.enableFollowupSuggestions':
    'Включить последующие предложения',
  'settings.description.ui.enableFollowupSuggestions':
    'Показывать контекстно-зависимые последующие предложения после завершения задачи. Нажмите Tab или стрелку вправо для принятия, Enter — для принятия и отправки.',
  'settings.label.ui.shellOutputMaxLines':
    'Максимальное количество строк вывода Shell',
  'settings.description.ui.shellOutputMaxLines':
    'Максимальное количество строк вывода shell для отображения в строке. Установка значения 0 снимает ограничение и показывает полный вывод; скрытые строки всё равно будут показаны через индикатор +N строк.',
  'settings.label.privacy.usageStatisticsEnabled':
    'Включить сбор статистики использования',
  'settings.description.privacy.usageStatisticsEnabled':
    'Включить сбор статистики использования.',
  'settings.label.fastModel': 'Быстрая модель',
  'settings.description.fastModel':
    'Модель для генерации предложений по подсказкам и предсказания выполнения. Если поле пустое, используется основная модель. Более мелкие/быстрые модели (например qwen3-coder-flash) снижают задержку и стоимость.',
  'settings.label.context.fileFiltering.respectGitIgnore':
    'Уважать .gitignore при поиске файлов',
  'settings.description.context.fileFiltering.respectGitIgnore':
    'Учитывать файл .gitignore при поиске.',
  'settings.label.context.fileFiltering.respectQwenIgnore':
    'Уважать .qwenignore при поиске файлов',
  'settings.description.context.fileFiltering.respectQwenIgnore':
    'Учитывать файл .qwenignore при поиске.',
  'settings.label.context.fileFiltering.enableFuzzySearch':
    'Включить размытый поиск',
  'settings.description.context.fileFiltering.enableFuzzySearch':
    'Включить размытый поиск при поиске файлов.',
  'settings.label.tools.toolSearch.enabled': 'Включить ToolSearch',
  'settings.description.tools.toolSearch.enabled':
    'При включении инструменты MCP будут загружаться по требованию через ToolSearch для уменьшения размера подсказок. Для моделей, зависящих от префиксного KV-кэша (например DeepSeek), выключите эту опцию, чтобы сохранить стабильность префикса подсказки и повысить эффективность кэширования.',
  'settings.label.tools.shell.enableInteractiveShell':
    'Интерактивный Shell (PTY)',
  'settings.description.tools.shell.enableInteractiveShell':
    'Использовать node-pty для обеспечения интерактивного опыта в shell. При недоступности PTY используется child_process.',
  'settings.label.policy.permissionStrategy': 'Стратегия согласования прав',
  'settings.description.policy.permissionStrategy':
    'Способ принятия решений о запросах прав при подключении нескольких клиентов. first-responder означает, что решение принимает первый откликнувший клиент; designated — только инициатор получает решение; consensus — требуется согласие N из M голосов; local-only — решать может только локальный (loopback) клиент. Вступает в силу после перезапуска демона.',
  'settings.option.policy.permissionStrategy.first-responder':
    'Первый откликнувший',
  'settings.option.policy.permissionStrategy.designated': 'Указанный инициатор',
  'settings.option.policy.permissionStrategy.consensus':
    'Стратегия разрешения: консенсус',
  'settings.option.policy.permissionStrategy.local-only': 'Только локально',
  'settings.label.experimental.enableCronTools':
    'Включить инструменты Cron/Loop',
  'settings.description.experimental.enableCronTools':
    'Включение инструментов cron/loop в сессии (экспериментально). После включения модель может создавать периодические запросы с помощью cron_create, cron_list и cron_delete. Также можно включить через переменную окружения QWEN_CODE_ENABLE_CRON=1.',
  'settings.label.experimental.sessionWorkflow':
    'Планирование и обзор процесса сессии',
  'settings.description.experimental.sessionWorkflow':
    'Показывать граф процесса сессии и представлять режим планирования как последовательность планирования и обзора.',
  'settings.label.experimental.emitToolUseSummaries':
    'Сводки использования инструментов',
  'settings.description.experimental.emitToolUseSummaries':
    'После завершения каждой группы инструментов LLM создаёт краткую метку. Метки завершённых групп заменяют общие заголовки «Инструменты × N»; у принудительно развёрнутых групп под ними показывается приглушённая строка ● <метка>. Требуется настроенная быстрая модель.',
  'settings.label.agents.arena.preserveArtifacts':
    'Сохранение артефактов Arena',
  'settings.description.agents.arena.preserveArtifacts':
    'После включения артефакты рабочей области Arena и файлы состояния сессии сохраняются после завершения сессии или выхода основного агента.',
  'settings.label.review.attribution': 'Атрибуция: review',
  'settings.description.review.attribution':
    'Добавлять в обзоры и встроенные комментарии GitHub подпись с названием модели и версией CLI. Если отключить, видимая атрибуция ИИ не публикуется: не будет ни подписи, ни маркеров важности «Critical» и «Suggestion». При этом невидимые HTML-маркеры остаются в исходном тексте комментариев и обзора, чтобы автоматизация GitHub и поиск дубликатов по-прежнему распознавали результаты /review. В режиме qwen-autofix «только Critical» такие публикации больше не распознаются как критические и откладываются. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется, поэтому репозиторий не может задавать политику обзора для проверяющих.',
  'settings.label.review.sandbox': 'Песочница для проверяемого кода: review',
  'settings.description.review.sandbox':
    'Запускать команды проверяемого репозитория — npm ci со скриптами установки, сборку, тесты и проверки изменений — внутри контейнера, а не напрямую от имени пользователя. «Авто» использует контейнер, если доступен Docker или Podman, и запускает команды напрямую, если контейнер недоступен. «Обязательно» запрещает запуск без песочницы: зависящие от выполнения доказательства будут недоступны, но сам обзор продолжится. «Выкл.» сохраняет текущее поведение. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.option.review.sandbox.off':
    'Выкл. (запускать проверяемый код напрямую)',
  'settings.option.review.sandbox.auto':
    'Авто (использовать доступный контейнер)',
  'settings.option.review.sandbox.required':
    'Обязательно (никогда не запускать без песочницы)',
  'settings.label.review.effort': 'Уровень усилий по умолчанию: review',
  'settings.description.review.effort':
    'Уровень усилий по умолчанию для /review, если не указан --effort и для проекта не сохранён явно выбранный уровень. «Авто» использует встроенное правило: высокий уровень для PR и средний для локальных изменений. Явно указанный или сохранённый уровень имеет приоритет; действующий --comment всегда устанавливает высокий минимум, а --fix — средний. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.option.review.effort.auto':
    'Авто (высокий для PR, средний для локальных изменений)',
  'settings.option.review.effort.low': 'Низкий',
  'settings.option.review.effort.medium': 'Средний',
  'settings.option.review.effort.high': 'Высокий',
  'settings.label.review.comment':
    'Публиковать комментарии по умолчанию: review',
  'settings.description.review.comment':
    'Обрабатывать каждый /review для PR так, как если бы был передан --comment: публиковать найденные проблемы в указанном pull request без дополнительного флага. Включайте, только если хотите всегда публиковать результаты обзоров. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.label.review.severityFloor':
    'Минимальная важность публикации: review',
  'settings.description.review.severityFloor':
    'Самый низкий уровень важности, который /review публикует в PR, если не задан --severity-floor. «Авто» сохраняет адаптивное правило: замечания публикуются до 5-го раунда, а с 6-го — только критические проблемы; допустимые замечания с высокой уверенностью записываются и откладываются. В раундах 2–5 новые замечания к неизменённому с прошлого раунда коду также откладываются. «Только Critical» применяет это ограничение с первого раунда, а «Suggestions и Critical» публикует замечания в каждом раунде. Для целей вне PR настройка не действует. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.option.review.severityFloor.auto':
    'Авто (только Critical с 6-го раунда)',
  'settings.option.review.severityFloor.critical':
    'Только Critical (в каждом раунде)',
  'settings.option.review.severityFloor.suggestion': 'Suggestions и Critical',
  'settings.label.review.reverseAuditRounds':
    'Предел раундов обратного аудита: review',
  'settings.description.review.reverseAuditRounds':
    'Снижает предел раундов обратного аудита для всех обзоров с высоким уровнем усилий. Обычно предел выбирается по структуре изменений: 10 для небольшого diff, 5 для разбитого на части; для огромного diff — 3 при наличии срока обзора и 5 без него. Эта настройка может только уменьшить предел соответствующего уровня, но не увеличить его. Значение должно быть целым числом в допустимом диапазоне: не ниже 3 и не выше исходного предела; иначе оно игнорируется. Цикл завершается после двух подряд раундов без находок, поэтому снижение предела не ускоряет сходимость, а чаще останавливает обзор до неё. Такая остановка отмечается как непроверенный объём и ограничивает вердикт значением Comment. Для общего снижения затрат на обзоры лучше использовать параметр усилий. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.label.review.approachRounds':
    'Порог раунда для сигнала о подходе: review',
  'settings.description.review.approachRounds':
    'Количество раундов, после которого обзор pull request может добавить справочный абзац о том, что открытым вопросом выглядит сам подход к изменению, а не текущий патч. Абзац появляется только если diff с первого измерения вырос в несколько раз, и никогда не появляется при вердикте Approve. Он не добавляет находок, не меняет вердикт и ничего не блокирует. Значение 0 сохраняет встроенный порог в 5 раундов; увеличьте его для более позднего показа или задайте очень большое значение, чтобы скрыть абзац. Положительное значение должно быть целым, иначе оно игнорируется. Параметр учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значение Рабочей области игнорируется.',
  'settings.label.output.showTimestamps': 'Показывать время ответов',
  'settings.description.output.showTimestamps':
    'Показывать метку времени [ЧЧ:ММ:СС] перед каждым ответом ассистента.',
  'settings.label.ui.disableWorkflowKeywordTrigger':
    'Отключить запуск Workflow по ключевому слову',
  'settings.description.ui.disableWorkflowKeywordTrigger':
    'Если включено, слово workflow в запросе больше не направляет выполнение к инструменту Workflow, а индикатор «workflow active» не показывается. Действует только при включённых рабочих процессах.',
  'settings.label.ui.showStatusInTitle':
    'Показывать состояние в заголовке окна',
  'settings.description.ui.showStatusInTitle':
    'Показывать название и состояние сессии HomeCode в заголовке окна терминала.',
  'settings.label.ui.showResponseTokensPerSecond':
    'Показывать скорость генерации токенов',
  'settings.description.ui.showResponseTokensPerSecond':
    'Во время генерации показывать текущую оценку токенов в секунду рядом со счётчиком токенов ответа. Вступает в силу в следующей сессии.',
  'settings.label.advisorModel': 'Модель-советник',
  'settings.description.advisorModel':
    'Модель, которую /advisor использует для независимой оценки разговора. Оставьте поле пустым, чтобы использовать основную модель. Рекомендуется модель не слабее основной. Недавняя история разговора будет отправлена этой модели, даже если она использует другого провайдера.',
  'settings.label.modelFallbacks': 'Резервные модели',
  'settings.description.modelFallbacks':
    'Упорядоченный список идентификаторов резервных моделей через запятую (не более 3), которые используются при ошибках перегрузки основной модели 429, 503 или 529. Пример: «qwen-plus,qwen-turbo». В CLI задаётся параметром --fallback-model.',
  'settings.label.voiceModel': 'Модель распознавания речи',
  'settings.description.voiceModel':
    'Модель для распознавания речи. Выберите её через /model --voice. Если оставить поле пустым, голосовой ввод будет отключён до выбора модели.',
  'settings.label.tools.webSearch.enabled': 'Включить веб-поиск',
  'settings.description.tools.webSearch.enabled':
    'Включить встроенный инструмент web_search. Также требуется настроить tools.webSearch.model. Переменная окружения ENABLE_WEB_SEARCH имеет приоритет.',
  'settings.label.tools.webSearch.model': 'Модель поиска',
  'settings.description.tools.webSearch.model':
    'Модель для отдельного поискового запроса. Разрешается через modelProviders так же, как fastModel: «modelId» или «authType:modelId». Должна указывать на DashScope-совместимую конфигурацию с envKey. Рекомендуется qwen3.6-plus. Переменная окружения WEB_SEARCH_MODEL имеет приоритет.',
  'settings.label.tools.webSearch.webExtractor':
    'Открывать страницы результатов',
  'settings.description.tools.webSearch.webExtractor':
    'Разрешить поисковому агенту открывать и читать страницы результатов через DashScope web_extractor, чтобы ответы лучше опирались на источники. DashScope тарифицирует это отдельно. Переменная окружения WEB_SEARCH_EXTRACTOR имеет приоритет.',
  'settings.label.tools.toolSearch.threshold':
    'Порог предварительной загрузки отложенных инструментов (%)',
  'settings.description.tools.toolSearch.threshold':
    'Доля контекстного окна, выделяемая при запуске сессии на предварительную загрузку обычных отложенных инструментов — встроенных и MCP. Если схемы всех доступных инструментов помещаются в бюджет, они объявляются заранее, а не загружаются по требованию, что сохраняет стабильный префикс запроса для KV-кэша. Инструменты, отложенные через tools.eager, не учитываются и остаются доступными по требованию. Значение 0 всегда загружает отложенные инструменты по требованию.',
  'settings.label.tools.listDirectory.enabled': 'Включить просмотр каталогов',
  'settings.description.tools.listDirectory.enabled':
    'Включить встроенный инструмент list_directory. По умолчанию он отключён, но автоматически включается, если явно указан в списке разрешённых coreTools (--core-tools или tools.core).',
  'settings.label.tools.workflowsEnabled': 'Динамические рабочие процессы',
  'settings.description.tools.workflowsEnabled':
    'Включить инструмент Workflow, с помощью которого модель может создавать и запускать сценарии, координирующие субагентов параллельно. По умолчанию отключено; один запуск может задействовать много субагентов и потратить соответствующее количество токенов. Переменные QWEN_CODE_ENABLE_WORKFLOWS=1 и QWEN_CODE_DISABLE_WORKFLOWS=1 имеют приоритет, при этом отключение важнее. Эта настройка не связана с представлением планирования и обзора сессии; чтобы слово workflow не направляло ход выполнения, используйте настройку отключения запуска по ключевому слову.',
  'settings.label.goals.modelProposed': 'Цели, предлагаемые моделью',
  'settings.description.goals.modelProposed':
    'Управляет инструментом propose_goal, который позволяет модели предложить цель сессии для вашего подтверждения. «Всегда спрашивать» показывает каждое предложение в диалоге и не устанавливает цель до подтверждения; «Отключено» удаляет инструмент. Введённая вручную команда /goal работает независимо. Поскольку настройка влияет на согласие пользователя, она учитывается только в областях Пользователь, Система и Системные значения по умолчанию; значения Рабочей области игнорируются.',
  'settings.option.goals.modelProposed.alwaysAsk': 'Всегда спрашивать',
  'settings.option.goals.modelProposed.disabled': 'Отключено',
  'settings.label.experimental.cron': 'Включить инструменты Cron/Loop',
  'settings.description.experimental.cron':
    'Включить инструменты cron/loop внутри сессии. Модель сможет создавать повторяющиеся запросы с помощью cron_create, cron_list и cron_delete. Переменная окружения QWEN_CODE_DISABLE_CRON=1 отключает эту возможность.',
  'settings.label.experimental.sessionWriterLease':
    'Включить блокировку записи сессий ACP',
  'settings.description.experimental.sessionWriterLease':
    'Включить межпроцессное разграничение записи для сохраняемых сессий ACP и демона. Значение фиксируется при запуске процесса ACP или демона. Все одновременно работающие процессы записи ACP и демона должны включить эту настройку; интерактивные и headless-процессы записи не участвуют в протоколе.',
  'settings.label.experimental.agentTeam': 'Включить команды агентов',
  'settings.description.experimental.agentTeam':
    'Включить экспериментальные инструменты совместной работы команд агентов. Модель сможет создавать и удалять команды, отправлять сообщения и координировать задачи с помощью team_create, team_delete, send_message, task_create, task_update и task_list. Также включается переменной окружения QWEN_CODE_ENABLE_AGENT_TEAM=1.',
  'settings.label.experimental.artifact': 'Включить артефакты',
  'settings.description.experimental.artifact':
    'Включить инструменты артефактов. По умолчанию они включены. В интерактивных сессиях вне SDK модель может публиковать автономную HTML-страницу как интерактивный артефакт и открывать её в браузере. Сессии демона вне SDK могут использовать инструмент record_artifact, сохраняющий только метаданные. Установите false или QWEN_CODE_DISABLE_ARTIFACT=1, чтобы отключить оба варианта.',
  'branchPicker.hint.createsPushBranch': (v) => `Создаст ${v?.target ?? ''}`,
  'subagent.creating': 'Создание…',
  'approval.explain': 'Объяснить',
  'approval.explanation': 'Объяснение команды',
  'approval.explaining': 'Подготовка объяснения…',
  'approval.explanationThinking': 'Размышление…',
  'approval.explanationFailed': 'Не удалось объяснить команду',
  'approval.reExplain': 'Объяснить ещё раз',
  'session.writerBlocked':
    'Другой процесс Qwen или оставшаяся блокировка записи могут мешать работе с этим чатом. Закройте его в других процессах и повторите попытку. Если ошибка сохраняется, перед восстановлением проверьте диагностику локального демона.',
  'history.openEarlier': 'Открыть раннюю историю',
  'history.loadEarlier': 'Загрузить предыдущие сообщения',
  'history.loadNewer': 'Загрузить следующие сообщения',
  'history.returnLatest': 'Вернуться к последним сообщениям',
  'history.viewUnavailable':
    'История временно недоступна: сессия переподключается или восстанавливает запись чата.',
  'history.snapshotView': 'Снимок истории · только чтение',
  'history.viewError':
    'Не удалось загрузить этот раздел. Перейдите к другому месту истории и повторите попытку или вернитесь к последним сообщениям.',
  'workflowRuns.title': 'Рабочие процессы',
  'workflowRuns.saved': 'Сохранённые',
  'workflowRuns.active': 'Выполняются',
  'workflowRuns.history': 'История',
  'workflowRuns.create': 'Создать',
  'workflowRuns.refresh': 'Обновить',
  'workflowRuns.loading': 'Загрузка запусков рабочих процессов…',
  'workflowRuns.loadFailed': 'Не удалось загрузить запуски рабочих процессов.',
  'workflowRuns.noSession':
    'Откройте сессию в этом проекте, чтобы увидеть запуски рабочих процессов.',
  'workflowRuns.emptyActive': 'Сейчас нет выполняющихся рабочих процессов.',
  'workflowRuns.emptyHistory': 'Сохранённых запусков пока нет.',
  'workflowRuns.emptySaved':
    'Рабочие процессы для повторного запуска ещё не сохранены.',
  'workflowRuns.emptySavedHint':
    'Нажмите «Создать», чтобы подготовить рабочий процесс с Qwen Code, сохраните завершённый запуск из терминала или добавьте файл .js в .qwen/workflows.',
  'workflowRuns.project': 'Проект',
  'workflowRuns.user': 'Пользователь',
  'workflowRuns.projectDescription': 'Доступен в этом проекте',
  'workflowRuns.userDescription': 'Доступен во всех проектах',
  'workflowRuns.detail.toggle': (v) => `Показать сведения: ${v?.name ?? ''}`,
  'workflowRuns.detail.loading': 'Загрузка описания рабочего процесса…',
  'workflowRuns.detail.unavailable':
    'Описание этого рабочего процесса больше недоступно.',
  'workflowRuns.detail.loadFailed':
    'Не удалось прочитать описание рабочего процесса.',
  'workflowRuns.detail.retry': 'Повторить',
  'workflowRuns.detail.noDescription':
    'У этого рабочего процесса нет описания.',
  'workflowRuns.detail.whenToUse': 'Когда использовать',
  'workflowRuns.detail.metaError': (v) =>
    `Не удалось разобрать блок meta: ${v?.error ?? ''}`,
  'workflowRuns.detail.phases': (v) => `Этапы (${v?.count ?? 0})`,
  'workflowRuns.detail.recentRuns': 'Последние запуски',
  'workflowRuns.detail.noRuns': 'В этой сессии запусков пока нет.',
  'workflowRuns.detail.viewRuns': (v) =>
    `Показать ${v?.count ?? 0} ${pluralRu(v?.count, 'запуск', 'запуска', 'запусков')} в истории`,
  'workflowRuns.detail.showSource': 'Показать исходный код',
  'workflowRuns.detail.hideSource': 'Скрыть исходный код',
  'workflowRuns.run': 'Запустить',
  'workflowRuns.starting': 'Запуск…',
  'workflowRuns.runNamed': (v) => `Запустить ${v?.name ?? ''}`,
  'workflowRuns.startFailed':
    'Не удалось запустить сохранённый рабочий процесс. Обновите список и повторите попытку.',
  'localFiles.title': 'Локальные файлы',
  'localFiles.trigger': 'Локальные файлы',
  'localFiles.hint':
    'Разрешает этой сессии читать и изменять файлы одной папки на вашем компьютере. Файлы остаются на компьютере; агент получает только запрошенные данные.',
  'localFiles.connect': 'Подключить папку…',
  'localFiles.reconnect': 'Подключить заново',
  'localFiles.disconnect': 'Отключить',
  'localFiles.openInNewTab': 'Открыть в новой вкладке',
  'localFiles.directory': 'Папка',
  'localFiles.tools': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'инструмент', 'инструмента', 'инструментов')}`,
  'localFiles.status.idle': 'Не подключено',
  'localFiles.status.connecting': 'Подключение…',
  'localFiles.status.registering': 'Регистрация…',
  'localFiles.status.connected': 'Подключено',
  'localFiles.status.reconnecting': 'Повторное подключение…',
  'localFiles.status.heldElsewhere': 'Подключено в другой вкладке',
  'localFiles.status.needsSession': 'Ожидание сессии',
  'localFiles.status.needsGesture': 'Подключите заново, чтобы продолжить',
  'localFiles.status.failed': 'Ошибка',
  'localFiles.status.unavailable': 'Здесь недоступно',
  'localFiles.needsSessionHint':
    'Сначала запустите сессию. Подключение привязано только к ней: другие сессии не получат доступ к вашим файлам.',
  'localFiles.blocker.insecureContext':
    'Страница открыта в небезопасном контексте, поэтому браузер не разрешит доступ к локальным файлам. Откройте Web Shell по HTTPS или перенаправьте порт демона через SSH и откройте http://localhost:<port>.',
  'localFiles.blocker.crossOriginFrame':
    'Доступ к локальным файлам заблокирован во встроенном фрейме другого сайта. Откройте Web Shell в отдельной вкладке браузера, чтобы подключить папку.',
  'localFiles.blocker.unsupportedBrowser':
    'Этот браузер не поддерживает File System Access API. Для подключения локальной папки используйте Chrome или Edge.',
  'localFiles.blocker.workspaceIneligible':
    'Рабочая область этого чата не поддерживает подключение локальной папки: она не является доверенной или используется для Live.',
  'sidebar.noWorkspaceSessions': 'Сессии без рабочей области',
  'sidebar.workflows': 'Рабочие процессы',
  'sidebar.activeWork': 'Текущая работа',
  'sidebar.activityUnknown': 'Фоновая активность неизвестна',
  'goal.usageLimited': 'Достигнут лимит использования для цели',
  'goal.tokens': (v) =>
    `${v?.used ?? 0} ${pluralRu(v?.used, 'токен', 'токена', 'токенов')}`,
  'goal.tokensOfBudget': (v) => `${v?.used ?? 0} / ${v?.budget ?? 0} токенов`,
  'plan.toggle.on': 'Составить план перед выполнением',
  'plan.toggle.off': (v) =>
    `Планирование; после подтверждения выполнить в режиме «${v?.mode}». Нажмите, чтобы выйти из планирования.`,
  'approval.option.executePlan': (v) => `Подтвердить и выполнить · ${v?.mode}`,
  'mode.changePending':
    'Ожидается смена режима или подтверждение плана. Повторите попытку после завершения.',
  'contextUsage.refresh': 'Обновить',
  'contextUsage.retry': 'Повторить',
  'contextUsage.loadError': 'Не удалось загрузить использование контекста.',
  'contextUsage.unavailable':
    'Использование контекста недоступно для этой сессии.',
  'workflow.open': 'Открыть рабочий процесс агентов',
  'workflow.mainAgent': 'Основной агент',
  'workflow.empty': 'В этом рабочем процессе нет сабагентов',
  'workflow.loadFailed': 'Не удалось загрузить рабочий процесс агентов',
  'environment.attachments': 'Вложения',
  'environment.artifacts': 'Артефакты',
  'environment.artifactsEmpty':
    'Здесь появятся артефакты, созданные в этой сессии.',
  'rightPanel.attachmentLoadFailed': (v) =>
    `Не удалось загрузить вложение: ${v?.error ?? 'Неизвестная ошибка'}`,
  'rightPanel.savedContentUnavailable':
    'Сохранённое содержимое панели недоступно',
  'rightPanel.restoreFailed': (v) =>
    `Не удалось восстановить панель: ${v?.error ?? 'Неизвестная ошибка'}`,
  'tasks.pausing': 'Приостановка',
  'tasks.kind.workflow': 'Рабочий процесс',
  'workflow.graph.waiting': 'Ожидание запуска первого агента…',
  'workflow.graph.notRecorded':
    'Граф выполнения этого запуска не был сохранён.',
  'workflow.inline.loading': 'Загрузка текущего выполнения рабочего процесса…',
  'workflow.inline.unavailable':
    'Этот запуск рабочего процесса больше недоступен в текущей сессии.',
  'workflow.graph.omitted': (v) =>
    `Граф сокращён для быстродействия. Скрыто этапов: ${v?.lanes ?? 0}, агентов: ${v?.nodes ?? 0}, связей: ${v?.edges ?? 0}.`,
  'workflow.noPhase': 'Без этапа',
  'workflow.dispatchCount': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'вызов', 'вызова', 'вызовов')}`,
  'workflow.selectedDispatch': 'Выбранный вызов',
  'workflow.dependencies': 'Зависит от',
  'workflow.action.pause': 'Приостановить',
  'workflow.action.resume': 'Продолжить',
  'workflow.action.retry': 'Повторить ветку с ошибкой',
  'workflow.action.rerun': 'Повторить всё',
  'workflow.action.unavailable':
    'Состояние рабочего процесса изменилось до выполнения действия.',
  'workflow.action.failed': 'Не удалось обновить рабочий процесс.',
  'workflow.history.retry': (v) => `Повтор после ошибки в ${v?.runId ?? ''}`,
  'workflow.history.rerun': (v) => `Повторный запуск из ${v?.runId ?? ''}`,
  'workflow.history.cached': (v) => `В кэше: ${v?.count ?? 0}`,
  'workflow.history.saved': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'сохранённый запуск', 'сохранённых запуска', 'сохранённых запусков')}`,
  'workflow.history.restored': 'Сохранённый запуск · только чтение',
  'workflow.history.showRuns': (v) => `История запусков (${v?.count ?? 0})`,
  'workflow.history.hideRuns': 'Скрыть историю',
  'workflow.history.filter': 'Фильтр запусков',
  'workflow.history.filterAll': 'Все статусы',
  'workflow.history.visibleCount': (v) =>
    `${v?.count ?? 0} из ${v?.total ?? 0}`,
  'workflow.history.filterEmpty':
    'Нет сохранённых запусков, соответствующих фильтру.',
  'workflow.history.exportVisible': 'Экспортировать отображаемые',
  'workflow.history.delete': 'Удалить',
  'workflow.history.deleteSaved': 'Удалить сохранённый запуск',
  'workflow.history.confirmDelete': 'Подтвердить удаление',
  'workflow.history.deleteUnavailable': 'Сохранённый запуск больше недоступен.',
  'workflow.history.deleteFailed': 'Не удалось удалить сохранённый запуск.',
  'workflow.history.compareRun': (v) => `Сравнить запуск ${v?.runId ?? ''}`,
  'workflow.history.compare': 'Сравнить запуски',
  'workflow.history.hideComparison': 'Скрыть сравнение',
  'workflow.history.source': 'Исходный запуск',
  'workflow.history.compared': 'Сравниваемый запуск',
  'workflow.history.current': 'Текущий запуск',
  'workflow.history.status': 'Статус',
  'workflow.history.agents': 'Агенты',
  'workflow.approvalNeeded': 'Требуется подтверждение',
  'workflow.respondInChat': 'Ответить в чате',
  'workflow.metric.agents': 'агентов',
  'workflow.metric.running': 'выполняются',
  'workflow.metric.queued': 'в очереди',
  'workflow.metric.tokens': 'токенов',
  'workflow.dispatch.queued': 'В очереди',
  'workflow.dispatch.running': 'Выполняется',
  'workflow.dispatch.completed': 'Завершено',
  'workflow.dispatch.failed': 'Ошибка',
  'workflow.dispatch.cancelled': 'Отменено',
  'workflow.dispatch.cached': 'Из кэша',
  'tasks.pill.workflow': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'рабочий процесс', 'рабочих процесса', 'рабочих процессов')}`,
  'tasks.pill.workflows': (v) =>
    `${v?.count ?? 0} ${pluralRu(v?.count, 'рабочий процесс', 'рабочих процесса', 'рабочих процессов')}`,
  'splitView.pendingCount': (v) => `Ожидают ввода: ${v?.count ?? 0}`,
  'splitView.nextPending': 'Перейти к следующей сессии, ожидающей ввода',
  'channels.editor.field.shared.instructions': 'Инструкции',
  'channels.editor.field.shared.instructions.description':
    'Инструкции, добавляемые в контекст каждой сессии канала. Для некоторых каналов заменяют стандартные инструкции.',
  'browserNotifications.label': 'Уведомления браузера о задачах',
  'browserNotifications.description':
    'Уведомлять о завершении или ошибке в текущем чате или чате разделённого экрана, когда страница находится в фоне или не в фокусе. Настройка сохраняется только для этого сайта в браузере; страница должна оставаться открытой.',
  'browserNotifications.completed': 'Текущий запрос выполнен.',
  'browserNotifications.failed':
    'Текущий запрос завершился с ошибкой. Вернитесь, чтобы посмотреть подробности.',
  'browserNotifications.ended':
    'Обработка текущего запроса завершена. Вернитесь, чтобы проверить результат.',
  'browserNotifications.allow': 'Разрешить уведомления',
  'browserNotifications.enabled': 'Включены.',
  'browserNotifications.disabled': 'Отключены.',
  'browserNotifications.waiting': 'Ожидание разрешения браузера.',
  'browserNotifications.denied':
    'Уведомления заблокированы. Разрешите их в настройках сайта в браузере.',
  'browserNotifications.unavailable':
    'Уведомления недоступны в этом браузере или контексте страницы.',
  'browserNotifications.requesting': 'Ожидание вашего разрешения…',
  'browserNotifications.error':
    'Не удалось включить или показать уведомления. Проверьте настройки браузера и системы.',
  'browserNotifications.temporary':
    'Настройка сохранена только для текущей страницы.',
} satisfies Record<string, MessageValue>;
