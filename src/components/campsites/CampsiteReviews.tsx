import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Campsite, CampsiteReview, MyCampsiteReview, ReviewReportReason } from '../../types/campsite';
import {
  MAX_REVIEW_PHOTOS,
  REVIEW_MAX_LENGTH,
  manilaToday,
  reviewErrors,
  sortReviews,
  type ReviewSort,
} from '../../utils/campsites';
import { uploadReviewPhoto } from '../../utils/photoUpload';
import {
  RmsApiError,
  deleteMyCampsiteReview,
  fetchMyCampsiteReview,
  reportCampsiteReview,
  saveMyCampsiteReview,
} from '../../utils/rmsApi';
import ConfirmDialog from '../ConfirmDialog';
import { CheckCircleIcon } from '../icons';
import { PhotoSlider, type GalleryPhoto } from './CampsiteGallery';
import { StarRating, StarRatingInput } from './StarRating';

const REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam or advertising' },
  { value: 'OFFENSIVE', label: 'Rude or offensive' },
  { value: 'FAKE', label: 'Not a real visit' },
  { value: 'PRIVATE_INFO', label: 'Shares someone’s personal information' },
  { value: 'OTHER', label: 'Something else' },
];

const BLOCKED_MESSAGE = {
  ACCOUNT_TOO_NEW: 'New accounts can write a review 24 hours after signing up.',
  DAILY_LIMIT: 'You’ve reached today’s limit of 5 reviews. Please come back tomorrow.',
} as const;

/** Reviews shown before "Show all reviews". */
const FIRST_REVIEWS = 6;

const errorMessage = (err: unknown) =>
  err instanceof RmsApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong. Please check your connection and try again.';

const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function useLoginPrompt() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (reason: string) => navigate('/login', { state: { from: `${pathname}#reviews`, mode: 'login', reason } });
}

interface FormPhoto {
  key: string;
  url: string;
  /** Set once it's in storage. */
  path: string | null;
  error?: string;
}

function ReviewForm({
  slug,
  existing,
  onSaved,
  onCancel,
}: {
  slug: string;
  existing: CampsiteReview | null;
  onSaved: (review: CampsiteReview) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [visitDate, setVisitDate] = useState(existing?.visitDate ?? '');
  const [photos, setPhotos] = useState<FormPhoto[]>(
    (existing?.photos ?? []).filter((photo) => photo.path).map((photo) => ({ key: photo.path!, url: photo.url, path: photo.path! })),
  );
  const [errors, setErrors] = useState<ReturnType<typeof reviewErrors>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = { rating: useId(), ratingError: useId(), body: useId(), bodyHint: useId(), date: useId(), photos: useId() };
  const today = manilaToday();
  const uploading = photos.some((photo) => !photo.path && !photo.error);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_REVIEW_PHOTOS - photos.filter((photo) => !photo.error).length;
    const pending = [...files].slice(0, Math.max(0, room)).map((file) => ({ key: `${file.name}-${crypto.randomUUID()}`, url: URL.createObjectURL(file), file }));
    if (fileRef.current) fileRef.current.value = '';
    setPhotos((current) => [...current, ...pending.map(({ key, url }) => ({ key, url, path: null }))]);
    for (const item of pending) {
      try {
        const uploaded = await uploadReviewPhoto(item.file);
        setPhotos((current) => current.map((photo) => (photo.key === item.key ? { ...photo, path: uploaded.path } : photo)));
      } catch (err) {
        setPhotos((current) => current.map((photo) => (photo.key === item.key ? { ...photo, error: errorMessage(err) } : photo)));
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      rating,
      body: body.trim(),
      visitDate: visitDate || null,
      photoPaths: photos.flatMap((photo) => (photo.path ? [photo.path] : [])),
    };
    const found = reviewErrors(input, today);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0 || uploading) return;
    setSaving(true);
    try {
      const { review } = await saveMyCampsiteReview(slug, input);
      onSaved(review);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const goodPhotos = photos.filter((photo) => !photo.error).length;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h3 className="font-serif text-xl font-semibold text-ink">{existing ? 'Edit your review' : 'Write a review'}</h3>
      <div className="flex flex-col gap-1">
        <span id={ids.rating} className="text-sm font-semibold text-ink">
          Your rating
        </span>
        <StarRatingInput value={rating} onChange={setRating} labelledBy={ids.rating} invalid={!!errors.rating} describedBy={errors.rating ? ids.ratingError : undefined} />
        {errors.rating && (
          <p id={ids.ratingError} className="text-sm text-red-700">
            {errors.rating}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.body} className="text-sm font-semibold text-ink">
          Your review
        </label>
        <textarea
          id={ids.body}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          maxLength={REVIEW_MAX_LENGTH}
          aria-invalid={!!errors.body || undefined}
          aria-describedby={ids.bodyHint}
          placeholder="How was the campsite? Signal, restrooms, the ground, the crowd, what you'd tell a friend."
          className="rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40"
        />
        <p id={ids.bodyHint} className={`text-xs ${errors.body ? 'text-red-700' : 'text-ink-muted'}`}>
          {errors.body ?? `${body.trim().length} / ${REVIEW_MAX_LENGTH.toLocaleString('en-PH')} characters. Please don’t include phone numbers or other personal details.`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <span id={ids.photos} className="text-sm font-semibold text-ink">
          Photos <span className="font-normal text-ink-muted">(optional, up to {MAX_REVIEW_PHOTOS})</span>
        </span>
        <ul aria-labelledby={ids.photos} className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.key} className="relative h-20 w-20 overflow-hidden rounded-lg bg-surface-strong">
              <img src={photo.url} alt="" className={`h-full w-full object-cover ${photo.path ? '' : 'opacity-50'}`} />
              {!photo.path && !photo.error && <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">Uploading…</span>}
              {photo.error && <span className="absolute inset-0 flex items-center justify-center bg-red-50/90 p-1 text-center text-[10px] text-red-800">{photo.error}</span>}
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((item) => item.key !== photo.key))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white"
              >
                ×
              </button>
            </li>
          ))}
          {goodPhotos < MAX_REVIEW_PHOTOS && (
            <li>
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs font-semibold text-ink-muted hover:border-brand-forest hover:text-accent">
                <span aria-hidden="true" className="text-xl leading-none">
                  +
                </span>
                Add photo
                <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addPhotos(event.target.files)} />
              </label>
            </li>
          )}
        </ul>
        {errors.photoPaths && <p className="text-sm text-red-700">{errors.photoPaths}</p>}
        <p className="text-xs text-ink-muted">Photos appear in the campsite&rsquo;s gallery. We remove the location details stored inside them.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.date} className="text-sm font-semibold text-ink">
          When did you visit? <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id={ids.date}
          type="date"
          value={visitDate}
          max={today}
          onChange={(event) => setVisitDate(event.target.value)}
          aria-invalid={!!errors.visitDate || undefined}
          className="h-10 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40"
        />
        {errors.visitDate && <p className="text-sm text-red-700">{errors.visitDate}</p>}
      </div>
      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {submitError}
        </p>
      )}
      <p className="text-xs text-ink-muted">Your first name and last initial are shown with your review. Reviews must be honest and about your own visit.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || uploading} className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-forest-dark disabled:opacity-60">
          {uploading ? 'Uploading photos…' : saving ? 'Posting…' : existing ? 'Save changes' : 'Post review'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-strong">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ReportForm({ reviewId, onDone, onCancel }: { reviewId: string; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState<ReviewReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const legendId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportCampsiteReview(reviewId, reason, details);
      onDone();
    } catch (err) {
      if (err instanceof RmsApiError && err.code === 'ALREADY_REPORTED') onDone();
      else setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 rounded-xl bg-surface-muted p-4">
      <fieldset aria-labelledby={legendId} className="flex flex-col gap-1.5">
        <legend id={legendId} className="text-sm font-semibold text-ink">
          Why are you reporting this review?
        </legend>
        {REPORT_REASONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name={`report-${reviewId}`} value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        Anything to add? <span className="font-normal text-ink-muted">(optional)</span>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={2} maxLength={500} className="rounded-lg border border-line bg-surface p-2 text-sm font-normal" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={sending} className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** One review, Airbnb style: who and when, the stars, the text (longer ones fold), their photos. */
function ReviewCard({ review, own, signedIn }: { review: CampsiteReview; own: boolean; signedIn: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [slide, setSlide] = useState<number | null>(null);
  const promptLogin = useLoginPrompt();
  const long = review.body.length > 240;
  const photos: GalleryPhoto[] = review.photos.map((photo) => ({
    url: photo.url,
    alt: photo.alt || `Photo from ${review.displayName}`,
    source: 'camper',
    caption: `Shared by ${review.displayName}${photo.alt ? ` · ${photo.alt}` : ''}`,
  }));

  return (
    <article className="flex flex-col gap-2.5">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-forest text-sm font-semibold text-white">
          {initials(review.displayName)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 font-semibold text-ink">
            {review.displayName}{' '}
            {review.isRenter && (
              <span className="flex items-center gap-1 text-xs font-semibold text-brand-forest-dark">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                GearBnB Renter
              </span>
            )}
            {own && <span className="text-xs font-semibold text-accent">Your review</span>}
          </span>
          <span className="text-sm text-ink-muted">{review.visitDate ? `Visited ${monthYear(review.visitDate)}` : `Reviewed ${monthYear(review.createdAt)}`}</span>
        </div>
      </header>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <StarRating rating={review.rating} className="h-3.5 w-3.5" />{' '}
        <span aria-hidden="true">·</span> <span>{monthYear(review.createdAt)}</span>
      </div>
      <p className={`whitespace-pre-line text-base leading-relaxed text-ink ${long && !expanded ? 'line-clamp-4' : ''}`}>{review.body}</p>
      {long && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="self-start text-sm font-semibold text-ink underline underline-offset-2">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {photos.length > 0 && (
        <ul className="flex gap-2" aria-label={`Photos from ${review.displayName}`}>
          {photos.map((photo, index) => (
            <li key={`${photo.url}-${index}`}>
              <button type="button" onClick={() => setSlide(index)} aria-label={`Open photo ${index + 1} from ${review.displayName}`} className="block h-20 w-20 overflow-hidden rounded-lg">
                <img src={photo.url} alt={photo.alt} loading="lazy" className="h-full w-full object-cover hover:opacity-90" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {slide !== null && <PhotoSlider photos={photos} index={slide} onIndex={setSlide} onClose={() => setSlide(null)} />}
      {!own &&
        (reported ? (
          <p className="text-xs text-ink-muted">Thanks, our team will take a look.</p>
        ) : reporting ? (
          <ReportForm reviewId={review.id} onDone={() => setReported(true)} onCancel={() => setReporting(false)} />
        ) : (
          <button
            type="button"
            onClick={() => (signedIn ? setReporting(true) : promptLogin('Please log in to report a review.'))}
            className="self-start text-xs font-semibold text-ink-muted underline-offset-2 hover:underline"
          >
            Report
          </button>
        ))}
    </article>
  );
}

/** The reviews section of a campsite page: the rating summary, the camper's own review, and the list. */
export default function CampsiteReviews({ campsite, onChanged }: { campsite: Campsite; onChanged: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const promptLogin = useLoginPrompt();
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [mine, setMine] = useState<MyCampsiteReview | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sortId = useId();

  useEffect(() => {
    if (authLoading || !user) {
      setMine(null);
      return;
    }
    let cancelled = false;
    fetchMyCampsiteReview(campsite.slug).then(
      (result) => !cancelled && setMine(result),
      (err) => !cancelled && setMineError(errorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, campsite.slug]);

  const myReview = mine?.review ?? null;
  const others = sortReviews(
    campsite.reviews.filter((review) => review.id !== myReview?.id),
    sort,
  );
  const shown = showAll ? others : others.slice(0, FIRST_REVIEWS);
  const { average, count } = campsite.rating;

  function handleSaved(review: CampsiteReview) {
    setMine({ review, canReview: true, reason: null });
    setNotice(myReview ? 'Your review was updated.' : 'Thanks! Your review is posted.');
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    try {
      await deleteMyCampsiteReview(campsite.slug);
      setMine((previous) => (previous ? { ...previous, review: null } : previous));
      setNotice('Your review was deleted.');
      onChanged();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  let yourReview = null;
  if (!user) {
    yourReview = (
      <button
        type="button"
        onClick={() => promptLogin('Please log in to write a review.')}
        className="self-start rounded-lg border border-ink px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-strong"
      >
        Write a review
      </button>
    );
  } else if (mineError) {
    yourReview = <p className="text-sm text-ink-muted">We couldn&rsquo;t load your review right now. {mineError}</p>;
  } else if (mine && (editing || (!myReview && mine.canReview))) {
    yourReview = <ReviewForm slug={campsite.slug} existing={myReview} onSaved={handleSaved} onCancel={myReview ? () => setEditing(false) : undefined} />;
  } else if (mine && !myReview && mine.reason) {
    yourReview = <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-ink-muted">{BLOCKED_MESSAGE[mine.reason]}</p>;
  }

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="flex scroll-mt-24 flex-col gap-6">
      <h2 id="reviews-heading" className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
        {count > 0 && average !== null ? (
          <>
            <span aria-hidden="true" className="text-[#f5b400]">
              ★
            </span>
            {average.toFixed(1)} · {count} {count === 1 ? 'review' : 'reviews'}
          </>
        ) : (
          'Camper Reviews'
        )}
      </h2>

      {count > 0 && average !== null ? (
        <dl className="grid max-w-xl gap-1.5">
          {(['5', '4', '3', '2', '1'] as const).map((stars) => {
            const share = count ? (campsite.ratingBreakdown[stars] / count) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-sm">
                <dt className="w-12 shrink-0 text-ink-muted">{stars} star</dt>
                <dd className="flex flex-1 items-center gap-3">
                  <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-5 text-right text-ink-muted">{campsite.ratingBreakdown[stars]}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">No reviews yet. Camped here? Be the first to tell other campers what it&rsquo;s like.</p>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-brand-cream/50 px-4 py-3 text-sm text-ink">
          {notice}
        </p>
      )}

      {yourReview}

      {myReview && !editing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-forest/30 bg-surface p-5">
          <ReviewCard review={myReview} own signedIn />
          {!campsite.reviews.some((review) => review.id === myReview.id) && <p className="text-xs text-ink-muted">Only you can see this review right now.</p>}
          <div className="flex gap-4">
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
              Edit
            </button>
            <button type="button" onClick={() => setDeleting(true)} className="text-sm font-semibold text-red-700 underline-offset-2 hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}

      {others.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-ink-muted">
            Sort by
          </label>
          <select id={sortId} value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink">
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="grid gap-x-16 gap-y-10 md:grid-cols-2">
          {shown.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} own={false} signedIn={!!user} />
            </li>
          ))}
        </ul>
      )}

      {others.length > FIRST_REVIEWS && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="self-start rounded-lg border border-ink px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-strong">
          {showAll ? 'Show fewer reviews' : `Show all ${others.length} reviews`}
        </button>
      )}

      <ConfirmDialog
        open={deleting}
        title="Delete your review?"
        message="Your review, rating and photos will be removed from this campsite."
        confirmLabel="Delete review"
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
