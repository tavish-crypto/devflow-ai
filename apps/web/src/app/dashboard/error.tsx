"use client";
import { Button, Notice } from "@devflow/product";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="stack">
      <Notice tone="error">
        The workspace could not load. Try again to recover your saved work.
      </Notice>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
