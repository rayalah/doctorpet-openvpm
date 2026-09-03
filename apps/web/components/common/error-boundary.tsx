"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/common/report-client-error";
import { useTranslations } from "@/lib/i18n/client";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LocalizedProps extends Props {
  errorTitle: string;
  unexpectedError: string;
  retryLabel: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class LocalizedErrorBoundary extends Component<LocalizedProps, State> {
  constructor(props: LocalizedProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reportClientError("react-error-boundary", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-heading text-lg font-semibold">
              {this.props.errorTitle}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {this.state.error?.message || this.props.unexpectedError}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {this.props.retryLabel}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary(props: Props) {
  const t = useTranslations();
  return (
    <LocalizedErrorBoundary
      {...props}
      errorTitle={t("shared.error.title")}
      unexpectedError={t("shared.error.unexpected")}
      retryLabel={t("shared.error.retry")}
    />
  );
}
