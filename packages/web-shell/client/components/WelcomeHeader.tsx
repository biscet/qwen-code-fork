import { HomeCodeWordmark } from './branding/HomeCodeBrand';
import styles from './WelcomeHeader.module.css';

export interface WelcomeHeaderProps {
  version: string;
  cwd: string;
  currentModel: string;
  currentMode: string;
  hideTips?: boolean;
}

export function WelcomeHeader(props: WelcomeHeaderProps) {
  void props;

  return (
    <div className={styles.header}>
      <h1 className={styles.title} aria-label="HomeCode">
        <HomeCodeWordmark className={styles.wordmark} aria-hidden="true" />
      </h1>
    </div>
  );
}
