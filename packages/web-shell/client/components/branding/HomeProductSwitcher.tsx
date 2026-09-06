import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { HomeChatMark, HomeCodeMark } from './HomeCodeBrand';
import styles from './HomeProductSwitcher.module.css';

export type HomeProduct = 'homecode' | 'homechat';

export function HomeProductSwitcher({
  product,
  onProductChange,
}: {
  product: HomeProduct;
  onProductChange: (product: HomeProduct) => void;
}) {
  const label = product === 'homechat' ? 'Chat' : 'Harness';
  return (
    <div className={styles.row}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label={`Режим: ${label}`}
          >
            {product === 'homechat' ? (
              <HomeChatMark aria-hidden="true" />
            ) : (
              <HomeCodeMark aria-hidden="true" />
            )}
            <span>{label}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={styles.menu} sideOffset={6}>
          <DropdownMenuItem
            className={styles.item}
            onSelect={() => onProductChange('homecode')}
          >
            <HomeCodeMark aria-hidden="true" />
            <span className={styles.itemCopy}>
              <strong>Harness</strong>
              <small>Агентная разработка</small>
            </span>
            {product === 'homecode' && <Check className={styles.check} />}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={styles.item}
            onSelect={() => onProductChange('homechat')}
          >
            <HomeChatMark aria-hidden="true" />
            <span className={styles.itemCopy}>
              <strong>Chat</strong>
              <small>Исследование</small>
            </span>
            {product === 'homechat' && <Check className={styles.check} />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
