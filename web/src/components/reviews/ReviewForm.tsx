"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { createReview } from "@/lib/api/reviews";
import { t } from "@/lib/i18n";
import { limitWait, recordHit, REVIEW_WINDOW_MS, reviewKey } from "@/lib/rateLimit";

import { StarRating } from "./StarRating";

interface ReviewFormProps {
  bookingId: string;
  /** О ком отзыв: имя второй стороны сделки */
  aboutName: string;
  onDone(): void;
}

/** Отзыв после завершённой сделки: 1–5 звёзд + текст до 500 символов. Один на сделку */
export function ReviewForm({ bookingId, aboutName, onDone }: ReviewFormProps) {
  const titleId = useId();
  const ratingErrorId = useId();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [already, setAlready] = useState(false);

  // Клиентский лимит «1 отзыв на сделку» — например, если отправили с другой вкладки
  useEffect(() => {
    setAlready(limitWait(reviewKey(bookingId), 1, REVIEW_WINDOW_MS) > 0);
  }, [bookingId]);

  async function submit() {
    if (rating < 1) {
      setError(t("reviews.ratingRequired"));
      return;
    }
    setSending(true);
    try {
      const review = await createReview(bookingId, rating, text);
      recordHit(reviewKey(bookingId), REVIEW_WINDOW_MS);
      // Антифрод мог скрыть отзыв — честно говорим, что он появится после проверки
      if (review.is_hidden) toast(t("reviews.moderation"), { description: t("reviews.moderationText") });
      else toast.success(t("reviews.done"));
      onDone();
    } catch (err) {
      if (isApiError(err) && err.code === "conflict") {
        recordHit(reviewKey(bookingId), REVIEW_WINDOW_MS);
        setAlready(true);
      }
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (already) {
    return <p className="rounded-[12px] bg-background p-4 text-[15px] text-ink">{t("reviews.already")}</p>;
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="rounded-card bg-surface p-5 shadow-card"
    >
      <h2 id={titleId} className="text-lg font-bold text-ink">
        {t("reviews.formTitle")}
      </h2>
      <p className="mt-1 text-[15px] text-muted">{t("reviews.formAbout", { name: aboutName })}</p>
      <div className="mt-3">
        <StarRating
          value={rating}
          onChange={(value) => {
            setRating(value);
            setError(null);
          }}
          labelledBy={titleId}
          invalid={Boolean(error)}
          describedBy={error ? ratingErrorId : undefined}
        />
        {error && (
          <p id={ratingErrorId} role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Textarea
        containerClassName="mt-4"
        label={t("reviews.textLabel")}
        placeholder={t("reviews.textPlaceholder")}
        value={text}
        maxLength={500}
        count={text.length}
        rows={4}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/Cmd+Enter — отправить (обычный Enter — перенос строки)
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <Button type="submit" variant="accent" size="md" loading={sending} className="mt-4 w-full sm:w-auto">
        {sending ? t("reviews.sending") : t("reviews.submit")}
      </Button>
    </form>
  );
}
