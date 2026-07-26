import { Component, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { error as logError } from '@/utils/log';

interface Props extends WithTranslation {
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    logError(`ErrorBoundary caught: ${err.message}\n${err.stack}`);
  }

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-screen gap-4 text-muted-foreground">
            <p className="text-lg font-medium">{t('errorBoundary.title')}</p>
            <button
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm"
              onClick={() => this.setState({ hasError: false })}
            >
              {t('errorBoundary.retry')}
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
